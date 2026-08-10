# 乡声集盒 API v1 设计说明

> 状态：预期设计，尚未冻结。字段级契约以同目录 [`openapi.yaml`](openapi.yaml) 为准。

## 1. 设计目标

v1 支持“可查、可录、可校验”的方言语音资料闭环：用户按写法或义项检索，查看不同方言下的读音与实录；也可以先保存录音，再由社区通过铭牌补充写法、义项和证据。

核心关系如下：

```text
Package（规范化写法） N ─ N Flavor（标准化义项）
          │                    │
          └──── Pronunciation ─┘
                    │
                 Dialect

Can 1 ─ N Nameplate（带来源的资料主张）
              ├─ Package / Flavor / Dialect
              └─ Pronunciation（可选）
Shelf N ─ N Flavor / Can
```

`Package`、`Flavor`、`Dialect` 和 `Pronunciation` 是可复用的词典资料；`Can` 是一次具体录音；`Nameplate` 是把某个来源的判断附着到录音上的可追溯著录记录。规范化资料不能覆盖或替代原始证据。

## 2. 通用约定

### 路径与数据格式

- 业务资源直接挂在根路径，统一保留尾部 `/`。
- 请求与响应使用 UTF-8 JSON；文件上传使用 `multipart/form-data`。
- 时间使用 RFC 3339，例如 `2026-08-06T10:30:00+08:00`。
- 创建成功返回 201，删除成功返回 204，普通读取或更新返回 200。
- 分页查询使用 `page` 和 `page_size`，`page_size` 默认 15、最大 100。

```json
{
  "count": 1,
  "next": null,
  "previous": null,
  "results": []
}
```

### 认证与错误

写接口使用：

```http
Authorization: Bearer <token>
```

客户端可以随请求传入 `X-Visitor-ID`。服务端在缺失时生成匿名访客 ID，并在响应头通过 `X-Visitor-ID` 返回。该 ID 只用于访问追踪和审计归因，不代表登录身份，也不能授予任何写权限。

统一错误结构只保留一个人类可读字段：

```json
{
  "code": 401,
  "message": "请先登录",
  "data": {},
  "request_id": "7f2c1a90-..."
}
```

- `code` 是数字，必须等于 HTTP 状态码。
- `message` 供用户或开发者阅读。
- `data` 保存字段校验错误或冲突上下文；没有附加信息时为空对象。需要区分同一状态码下的业务原因时使用稳定的 `data.reason`。字段错误直接放在 `data.<field>`，每项包含机器可读 `code` 和可展示 `message`，嵌套输入保持同样的嵌套结构。
- `request_id` 用于排障，并通过响应头 `X-Request-ID` 同步返回。
- 401 表示未认证或凭证失效；403 表示身份有效但无权操作；409 表示资源状态或唯一约束冲突。

## 3. 方言树

`Dialect` 只表达方言之间的从属关系，不额外维护行政区划树。地区名称只有在代表一种可区分的地方话时才进入树：

```text
闽语
└─ 莆仙语
   ├─ 莆田片
   └─ 仙游片
      └─ 游洋话
```

每个节点包含稳定 `id`、同级唯一的短 `code`、`parent_id` 和同级 `sort_order`。短 code 默认使用社区熟悉的中文简称；规范限定码按**根到叶**拼接，例如 `闽.莆仙.仙游.游洋`。节点不设置固定层级类型，按需树本身就是粒度表达。

根到叶的形式便于阅读、前缀过滤和把同一支系聚在一起，但它不是主键，也不能代替人工顺序：数据库外键始终使用稳定 ID，同级展示按 `sort_order, id` 排列。改名或重新归类后，旧限定码保留为 alias；客户端不能把 Unicode 字典序当成语言学排序。

- `GET /dialects/?parent_id=...` 只返回直接子节点。
- `GET /dialects/{id}/?expand=ancestors,children` 按需展开关系。
- `GET /dialects/resolve/?qualified_code=...` 把限定名或 alias 解析为稳定节点。
- 其他资源按 `dialect_id` 筛选时默认精确匹配；显式传 `dialect_scope=subtree` 才包含全部后代。

资料只能确定到上层方言时直接关联上层节点，不能为了填满层级虚构县镇节点。详见方言与读音模型 [ADR](../../adr/0001-dialect-pronunciation-model.md)。

## 4. 写法、义项与读音

### Package：写法入口

`Package` 保存规范化书写形式，例如“行”“月娘”“hing2”。`package_type` 区分正字、借字、俗写、拟音、罗马字和未定写法。同一写法可以连接多个义项。

### Flavor：义项

`Flavor` 保存跨方言比较使用的标准化语义，例如“行走动作”“银行机构”“月亮”。同一个义项可以连接多个写法。可选 `concepticon_id` 用于与外部概念集对齐，但外部编号不能替代本项目的稳定 ID 和中文定义。

Flavor 与 Package 之间通过 `FlavorPackage` 关联，并保留 `primary / synonym / borrowed / disputed`（主写法、同义写法、假借、争议）及说明。写入 Flavor 时使用结构化的 `package_links`，不能把这一关系降级成没有语义的 ID 数组。这个中间表只负责写法—义项关系；Pronunciation 仍按下述三个外键直接存储。

### Pronunciation：带语义消歧的方言读音

`Pronunciation` 替代含义不清的 `FlavorVariant`，准确表示：

> 这个 `Package` 在表达这个 `Flavor` 时，在这个 `Dialect` 下读作什么。

```json
{
  "package_id": 12,
  "flavor_id": 34,
  "dialect_id": 56,
  "ipa": "hiŋ²³",
  "base_romanization": "hing5",
  "surface_romanization": "hing2",
  "reading_type": "colloquial",
  "sandhi_info": {},
  "source_citation": "田野调查记录"
}
```

`base_romanization` 是变调前或孤立读法，`surface_romanization` 是当前语流环境中的实际形式；二者自身包含声调标记，前端应并列展示，不另设 `tone_value` 制造第二套声调真相。`sandhi_info` 只补充触发环境、位置或规则，不能替代这两个一等字段。文读/白读由 `reading_type` 表达，是否发生变调与它正交。

虽然 Pronunciation 分别保存三个外键，服务端仍须验证 `package_id + flavor_id` 已存在关联。该三元组不唯一：同一方言可以存在文读、白读、代际差异或争议读音。每个 `reading_type` 最多有一条 `is_canonical=true` 的推荐记录，其他记录继续保留。

Pronunciation 不保存音频 URL，也不直接占有 Can。多张 Nameplate 可以把不同 Can 指向同一条 Pronunciation，作为带来源的实录证据；尚未完成词典分析的 Can 可以先独立保存，稍后通过 Nameplate 归入已有或新建的 Pronunciation。

### “行”的示例

```text
Package「行」
├─ Flavor「行走动作」
│  ├─ Pronunciation（莆田片，读音 A）
│  │  └─ Nameplate → Can #101 / #102
│  └─ Pronunciation（仙游片，读音 B）
│     └─ Nameplate → Can #205
└─ Flavor「行业类别」
   └─ Pronunciation（另一读音）
```

这样既能表达“同一个义项在不同方言中读音不同”，也能表达“同一个写法因义项不同而读音不同”。

## 5. 罐头与铭牌

### Can：录音载体

Can 类似商品本体：保存音频、上传者、时长、采集提示和来源上下文，不直接断言唯一正确的写法、义项或规范读音。`submitted_dialect_id` 只是采集者装罐时给出的初始范围，便于待整理资料过滤；最终展示分类来自主铭牌。

### 创建罐头

```http
POST /cans/
```

自由装罐只要求录音、普通话概念和方言。用户可以同时提交 `initial_nameplate`；服务端必须在同一事务中创建或关联 Package、Flavor、Nameplate，避免生成半成品数据。

```json
{
  "audio_url": "https://example.com/audio.mp3",
  "submitted_dialect_id": 56,
  "concept_text": "行走",
  "source_note": "本人记忆，家中长辈确认",
  "initial_nameplate": {
    "text_content": "行",
    "definition": "走路",
    "package_type": "orthodox",
    "evidence_level": 1,
    "source": {
      "type": "oral",
      "attributed_to": "家中长辈",
      "note": "由录音上传者采集"
    }
  }
}
```

为已有词典资料补录音时，也通过 `initial_nameplate.pronunciation_id` 提出关联，不把规范化外键直接写到 Can。未提交初始铭牌的录音进入待贴牌状态。

### 铭牌

Nameplate 类似同一件商品可由不同人撰写、带不同依据的商品说明，也是词典意义上的 annotation/attestation（著录或用例证据）。它不是 Can 内部的一段可覆盖文字，而是有稳定 ID、创建者、来源、状态和支持关系的一等资源，可以独立分页、筛选和引用。

贴铭牌时可以选择现有 Package、Flavor 与 Dialect。仅提交原样新写法时，服务端按 `Package.package_type=uncertain` 幂等归一；铭牌同时具有 Package 与 Flavor 时，服务端幂等建立 FlavorPackage，避免只记录主张却断开规范关系。

每张铭牌必须指向一个 Can，并可分别主张 `package_id`、`flavor_id`、`dialect_id` 和 `pronunciation_id`。外键用于连接规范化词典资料；`text_content`、`definition`、`pronunciation_text` 保存来源中的原样写法、释义和转写，不能因规范实体后来修订而被覆盖。若给出 `pronunciation_id`，它的 Package、Flavor、Dialect 必须与铭牌同时给出的外键一致。

`source` 结构区分创作者自述、口述、田野记录、书籍、论文、档案和网页等来源，并可保存题名、责任者、页码/条目位置和 URL。`creator` 表示谁在系统中创建铭牌，不能冒充资料原作者。第一张完整有效铭牌可以成为主铭牌；不同用户和不同来源的主张继续并存。

交互层可以把录音者为自己内容贴牌时的来源默认成 `{ "type": "creator" }`，但 API 仍显式保存该来源，不能用“字段为空”暗示自述。

```http
POST /nameplates/
```

```json
{
  "can_id": 101,
  "package_id": 12,
  "flavor_id": 34,
  "dialect_id": 56,
  "pronunciation_id": 78,
  "text_content": "行",
  "definition": "走路",
  "pronunciation_text": "hiŋ²³",
  "evidence_level": 1,
  "source": {
    "type": "book",
    "title": "某地方言志",
    "attributed_to": "某某编",
    "locator": "第 42 页",
    "url": "https://example.com/source"
  }
}
```

铭牌是可查询资源：

```http
GET /nameplates/?can_id=101
GET /nameplates/?package_id=12&flavor_id=34&dialect_id=56
GET /nameplates/?source_type=book
```

`GET /cans/{can_id}/nameplates/` 保留为罐头详情的便捷子资源。修正已有铭牌时创建一条带 `supersedes_id` 的新铭牌，避免有支持或引用后原地改写历史依据；撤回只改变状态，不物理删除著录记录。

用户支持铭牌使用幂等资源：

```http
PUT    /nameplates/{id}/support/
DELETE /nameplates/{id}/support/
```

## 6. 查询与响应深度

- `*Ref`：嵌入其他资源的最小引用。
- `*Card`：列表、搜索和集盒中的展示数据。
- `*Detail`：资源详情页所需数据。

嵌套对象只能使用 Ref 或 Card；Detail 不允许递归嵌套 Detail。例如 FlavorDetail 可以返回 PronunciationCard 列表，但 PronunciationCard 中的 Flavor、Package 和 Dialect 必须是 Ref。

聚合搜索：

```http
GET /search/?q=行&limit=8
GET /search/suggest/?q=行&limit=8
GET /search/hot/?limit=10
```

搜索按 `flavors`、`packages`、`cans` 分组。单资源筛选继续使用资源列表，例如：

搜索联想返回 `{ keyword, suggestions }`，建议来源依次为 Flavor、Package、Nameplate。同一文本按该优先级去重，每类内部前缀匹配优先于包含匹配；Nameplate 必须挂在当前访问者可见的 Can 上。`q` trim 后为空时返回空建议，超过 50 字符截断；`limit` 是每类上限，默认 5、限制在 1～10，非数字回退为 5。

聚合搜索不是资源分页接口：它按 `flavors`、`packages`、`cans` 分组，`limit` 同时限制每组数量（默认 8，限制在 1～20）。资源列表继续使用标准 `{ count, next, previous, results }` 分页契约。

热门搜索直接返回 `[{ keyword, rank }]`，不公开内部计数。同一登录用户或匿名 visitor 对同一关键词每天只计一次；空白或超过 20 个字符的关键词不参与统计。统计写入失败不会影响聚合搜索响应。

```http
GET /pronunciations/?package_id=12&flavor_id=34&dialect_id=56
GET /pronunciations/?flavor_id=34&dialect_id=2&dialect_scope=subtree
GET /nameplates/?pronunciation_id=78
```

## 7. 状态与权限

Can 的状态保持为 `unlabeled / pending / tentative / verified / disputed / rejected`，通过以下端点流转：

```http
POST /cans/{id}/transition/
```

流转在事务中锁定并重读 Can，非法或已经过期的状态返回 409，失败不会写入状态或日志。固定矩阵如下：

- 录制者：`pending → tentative`（submit）、`tentative → disputed`（dispute）。
- staff：`tentative/disputed → verified`（verify），`pending/tentative/disputed → rejected`（reject）。
- 录制者或 staff：`rejected → pending`（restore）。

每次成功流转在 `transition_log` 中追加 `action / from / to / by / at / reason`，其中 `by` 使用公开 UserRef，不暴露权限字段。只有本人私有用户响应包含 `is_staff`；公开用户资料不返回权限。

Pronunciation 使用 `draft / verified / disputed / rejected`，认证与驳回由 reviewer 或 admin 执行。非法状态转换返回 409，权限不足返回 403。

审核 Pronunciation 使用 `POST /pronunciations/{id}/transition/`。`verify` 时 reviewer 可传 `is_canonical=true`；服务端须在同一事务中取消相同 `package_id + flavor_id + dialect_id + reading_type` 下旧记录的 canonical 标记，保证最多一条推荐读音。

通用权限：

- 匿名用户可读公开资料。
- 登录用户可创建 Can、Nameplate、Shelf，以及提交 Package、Flavor、Pronunciation 候选。
- 创建者可修改自己的用户生成内容；共享词典资料进入 verified 后只允许 reviewer 或 admin 修改。
- Dialect 树的新增、改名和重新归类只允许 admin，避免限定名和后代查询被任意破坏。

## 8. 用户隐私

`GET /users/{id}/` 只返回公开档案。邮箱、电话、生日、微信绑定状态和登录时间只从 `GET /users/me/` 返回；修改本人资料也统一使用 `/users/me/`。不提供公开的邮箱筛选或通过用户名返回完整邮箱的接口。
