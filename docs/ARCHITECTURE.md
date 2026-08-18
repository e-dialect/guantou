# 乡声集盒架构说明

## 核心模型

`Can` 是一段具体录音，用户文案称为“罐头”。它保存音频 URL、录制者、时长、采集提示、状态和审核可见性。`submitted_dialect` 只是装罐时的初始范围，不是规范方言结论。Can 是系统的数据原子，可以先于稳定写法、义项和读音分析存在。

`Nameplate` 是贴在罐头上的一等资料主张，表示“某人或某来源认为这段录音对应这种写法、义项、方言和读音”。它分别关联 Can、Package、Flavor、Dialect 和可选 Pronunciation，同时保存来源中的原样写法、释义、转写及结构化出处。Nameplate 可独立查询、引用和修订；同一个 Can 可以有多张铭牌，`weight` 和 `is_primary` 决定默认展示。系统保留低权重、撤回和被取代的铭牌作为异议和考据记录，不用覆盖式写入抹掉历史观点。

`Flavor` 是语义核心，用户文案称为“义项”，例如“月亮”“银行机构”“行走动作”“祖母称谓”。它解决“同字不同义”和跨地区同义检索，粒度以义项为准，不以单个汉字或某一地读音为准。

`Pronunciation` 是带语义消歧的方言读音记录，分别指向 `Package`、`Flavor` 和 `Dialect`，保存 IPA、变调前与变调后的罗马字、文白读、变调环境、来源和认证状态。它表达“这个写法在表示这个义项时，在这个方言下读作什么”。同一组合允许多个读音，以容纳文白异读、代际差异和争议记录。

`Package` 是写法入口，表示正字、借字、俗写、拟音等用户可能搜索或书写出来的形式。`FlavorPackage` 记录义项和写法之间的主写法、同义写法、假借或争议关系；API 必须用带 `mapping_type` 的 `package_links` 保留该语义，不能只暴露无类型的多对多 ID。

`Dialect` 是按需建立的方言关系树。地区名只有在表示可区分的地方话时才成为方言节点；系统不另建行政区划树，也不自动把省市县镇转换成方言层级。节点使用稳定 ID，限定码按根到叶书写，例如 `闽.莆仙.仙游.游洋`；同级人工顺序由 `sort_order` 决定。

`Shelf` 是主题集盒，用来组织义项或罐头。代码名暂时保留 `Shelf`，用户界面优先显示“集盒/盒子”。

单字不作为独立一等实体。单字写法进入 `Package`；声韵调、文白读等资料只有在服务具体 Package、Flavor 和 Dialect 组合时进入 `Pronunciation`。音频始终保存在 `Can`，不重复保存在 Pronunciation。

## 关系原则

- 罐头与铭牌是一对多：同一段录音允许多个用户提出不同写法、释义和证据。
- 铭牌是 Can 与词典资料之间的著录关系：它可同时指向 Package、Flavor、Dialect、Pronunciation，并保存原样内容和来源。
- 义项与写法是多对多：一个义项可以有多个写法，一个写法也可以连接多个义项。
- 写法、义项和方言共同确定 Pronunciation 的语境；三元组不唯一，可以保留多种读法。
- Pronunciation 通过 Nameplate 获得多条实际录音证据；Can 不直接保存规范 Pronunciation，尚未分析的录音可以暂时没有完整铭牌。
- 主铭牌是当前共识，不是永久真理：投票、认证或后续考据可以改变主铭牌。
- 评论复用 `CanComment`，但目标边界严格分离：`nameplate=NULL` 是罐头公共评论，非空时是对应铭牌的论证区，所属 Can 由铭牌推导。

例如“行”这种多义字，`Package(text="行")` 可以连接“行走”“行业”“可以/好”等多个 `Flavor`；“月亮”这个 Flavor 也可以连接“月亮”“月光”“月娘”等多个 Package。用户搜索“行”时先进入写法，再看到其下不同义项；进入“行走”义项后，再按 Dialect 展示对应 Pronunciation 和录音证据。

方言与读音的完整取舍见 [ADR-0001](adr/0001-dialect-pronunciation-model.md)，铭牌与证据边界见 [ADR-0002](adr/0002-nameplate-as-attestation.md)，接口与异常边界见 [ADR-0003](adr/0003-api-response-conventions.md)，字段级目标契约见 [API v1](api/v1/README.md)。

## 治理边界

v1 只实现可追溯的主张与权重，不实现 AI 聚类或自动正字裁判。后续可以在 `Flavor` 或扩展提案模型上加入相似风味提示、合并提案、地区主理人认证等能力，但这些都不能替代铭牌层的证据记录。

## API 边界

业务接口直接挂载在根路径，由 DRF router 暴露资源。项目当前没有单独的服务端页面路由，继续保留 api 前缀收益不大，反而会和既有 `/users`、`/login`、`/files` 等入口形成两套心智模型。旧词典式 `/words`、`/pronunciation`、`/characters` 入口不存在。

新增前端 service、测试和文档都应使用根路径，例如 `/cans/`、`/search/`、`/users`、`/login`、`/files`。如果未来后端需要同时承载传统网页或多版本公开接口，应先在 issue 中重新讨论版本化和兼容策略，不要在本阶段自行加路径前缀。

读接口默认开放，写接口需要 `Authorization: Bearer <jwt>`。后端通过 `guantou.authentication.BearerTokenAuthentication` 复用现有 JWT 解析逻辑。

匿名访客和审计属于跨领域基础设施，放在 `audit` app。`AnonymousVisitor` 通过 `X-Visitor-ID` 追踪游客访问但不授予写权限；`VisitorEvent` 记录 API 访问；`ObjectChangeLog` 通过 signals 记录 `guantou` 核心模型的 create/update/delete。

认证与权限失败都进入统一错误结构；匿名访客 ID 不能替代 Bearer 身份凭证。

后端可以按领域拆分 Django app，不要求所有模型和接口都塞进 `guantou` app。新增 app 时应同时补齐 `apps.py`、`urls.py`、service 层和聚合入口；跨领域编排优先放在 service 层，不把复杂业务直接堆在 view 或 serializer 里。

聚合搜索目前只是罐头、义项和写法的横向读取能力，归入 `guantou` 的 view/service，不单独拆 app。只有当搜索拥有独立索引、同步任务、权限模型或外部检索后端时，才值得拆出专门 app。

异常响应由 `utils.exceptions` 统一处理。DRF 校验错误、自定义业务异常和普通 Django 中间件异常都应返回同一结构：

```json
{
  "message": "错误提示",
  "code": 400,
  "data": {},
  "request_id": "..."
}
```

`code` 必须与 HTTP 状态码相同；同状态码下需要机器区分的原因放在 `data.reason`，字段错误直接放在 `data.<field>` 并包含字段级 `code/message`。`X-Request-ID` 请求头会透传到响应头和错误 payload；没有传入时后端生成一个新的 id。500 响应不得包含原异常信息，前端页面只消费 `message/code/data/request_id`，不要为单个页面发明新的错误格式。

## 前端边界

页面只负责页面状态、表单交互和导航；接口访问统一进入 `src/services/`，底层 HTTP 统一经过 `src/utils/httpClient.js`。后续新增页面时，优先复用已有 service 或在同目录新增领域 service，不在 `.vue` 页面中散落 `uni.request`。

用户反馈统一进入 `src/services/feedback.js`。加载态、成功提示、错误 toast 和后续可能接入的全局消息通知，都从这里扩展；业务 service 返回结构化数据和异常，不直接替页面决定复杂交互。

前端页面优先用共享组件搭骨架：`AppShell` 负责罐头、图鉴、集盒、我的四个根入口的品牌框架，`PageShell` 负责详情、登录、编辑和评论页的可靠返回，`SectionBlock` 负责详情分区，`CanList` 负责罐头分页列表，`EntityCard` 负责义项/写法/集盒卡片，`SearchPanel` 负责搜索聚焦态，`NameplateCard` 负责铭牌摘要。新增列表、详情、创建流程时，先判断是否可以扩展这些组件的 props 和事件，而不是复制一份视觉结构。页面导航统一调用 `src/services/navigation.js` 的语义方法；登录恢复只接受该服务白名单生成的目的地。

罐头相关页面继续复用 `CanCard`、`NameplateCard`、`EmptyState`、`ResultSection`、`AudioCapture`。首页、搜索页、罐头列表/详情、义项/写法/集盒页面是给后续贡献者参考的样板页面。

词典生产入口同样保持单份页面逻辑：写法列表使用标准分页；义项详情锁定义项后进入读音表单，写法候选只取该义项的 `package_links`；集盒编辑按 PATCH 全量替换契约执行“重读—合并—提交”。H5 与小程序只在输入聚焦、picker 呈现、滚动容器和页面高度上做条件编译，不复制业务页面。

## 状态机

`Can.status`：

- `unlabeled`：无铭牌。
- `pending`：已有铭牌，等待社区或管理员校验。
- `tentative`：社区暂定。
- `verified`：正品认证。
- `disputed`：存在争议。
- `rejected`：已驳回。

Can 状态流转由事务化 service 统一执行并锁定当前行：录制者可 submit、dispute，staff 可 verify、reject，录制者或 staff 可 restore。详情见 API v1 文档；所有成功流转写入结构化审计日志，过期状态返回 409。

`Pronunciation.status`：

- `draft`：草稿。
- `verified`：已认证。
- `rejected`：已驳回。
- `disputed`：争议。

`visibility` 仍表示是否对普通用户可见，和状态流转分离。
