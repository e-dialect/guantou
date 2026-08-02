# 乡声集盒架构说明

## 核心模型

`Can` 是一段具体录音，用户文案称为“罐头”。它保存音频 URL、录制者、方言点、产地、状态、来源说明、审核可见性。它是系统的数据原子，可以先于稳定写法和释义存在。

`Nameplate` 是贴在罐头上的铭牌，表示“我认为这段录音应该这样写、这样解释、属于这个义项”。铭牌是连接罐头、义项和写法的主张实体，同一个罐头可以有多张铭牌，`weight` 和 `is_primary` 决定默认展示。系统保留低权重铭牌作为异议和考据记录，不用覆盖式写入抹掉少数观点。

`Flavor` 是语义核心，用户文案称为“义项”，例如“月亮”“银行机构”“行走动作”“祖母称谓”。它解决“同字不同义”和跨地区同义检索，粒度以义项为准，不以单个汉字或某一地读音为准。

`FlavorVariant` 是同一个风味在某个方言点下的读音变体，保存 IPA、拼音/罗马字、文白读、变调信息和官方认证状态。县镇之间读音差异优先进入变体，不把“同一个概念的不同读法”拆成多个风味。

`Package` 是写法入口，表示正字、借字、俗写、拟音等用户可能搜索或书写出来的形式。`FlavorPackage` 记录义项和写法之间的主写法、同义写法、假借或争议关系。

`Dialect` 是方言点树，支持父子层级。查询父级时包含所有子方言，查询子级时只查该子级。

`Shelf` 是主题集盒，用来组织义项或罐头。代码名暂时保留 `Shelf`，用户界面优先显示“集盒/盒子”。

单字和字音不作为独立一等实体。单字写法进入 `Package`；声韵调、文白读、地区等资料只有在服务具体义项或录音时进入 `FlavorVariant` 或 `Nameplate`。

## 关系原则

- 罐头与铭牌是一对多：同一段录音允许多个用户提出不同写法、释义和证据。
- 铭牌同时指向义项与写法：它记录“这段录音属于哪个义项，以及我主张用哪个写法表达”。
- 义项与写法是多对多：一个义项可以有多个写法，一个写法也可以连接多个义项。
- 义项与变体是一对多：读音、地区、文白读、变调属于变体层。
- 主铭牌是当前共识，不是永久真理：投票、认证或后续考据可以改变主铭牌。

例如“行”这种多义字，`Package(text="行")` 可以连接“行走”“行业”“可以/好”等多个 `Flavor`；“月亮”这个 `Flavor` 也可以连接“月亮”“月光”“月娘”等多个 `Package`。用户搜索“行”时先进入写法，再看到其下不同义项；进入“月亮”义项时再按方言点展示各地读音变体和罐头。

## 治理边界

v1 只实现可追溯的主张与权重，不实现 AI 聚类或自动正字裁判。后续可以在 `Flavor` 或扩展提案模型上加入相似风味提示、合并提案、地区主理人认证等能力，但这些都不能替代铭牌层的证据记录。

## API 边界

业务接口直接挂载在根路径，由 DRF router 暴露资源。项目当前没有单独的服务端页面路由，继续保留 `/api/` 前缀收益不大，反而会和既有 `/users`、`/login`、`/files` 等入口形成两套心智模型。旧词典式 `/words`、`/pronunciation`、`/characters` 入口不存在。

新增前端 service、测试和文档都应使用根路径，例如 `/cans/`、`/search/`、`/users`、`/login`、`/files`。如果未来后端需要同时承载传统网页或多版本公开 API，再统一迁移到 `/api/v1/` 这类版本化前缀。

读接口默认开放，写接口需要旧系统 `token` header。后端通过 `guantou.authentication.HeaderTokenAuthentication` 复用现有 JWT 解析逻辑。

后端可以按领域拆分 Django app，不要求所有模型和接口都塞进 `guantou` app。新增 app 时应同时补齐 `apps.py`、`urls.py`、service 层和聚合入口；跨领域编排优先放在 service 层，不把复杂业务直接堆在 view 或 serializer 里。

聚合搜索目前只是罐头、义项和写法的横向读取能力，归入 `guantou` 的 view/service，不单独拆 app。只有当搜索拥有独立索引、同步任务、权限模型或外部检索后端时，才值得拆出专门 app。

异常响应由 `utils.exceptions` 统一处理。DRF 校验错误、自定义业务异常和普通 Django 中间件异常都应返回同一结构：

```json
{
  "msg": "错误提示",
  "message": "错误提示",
  "code": "validation_error",
  "details": {},
  "request_id": "..."
}
```

`X-Request-ID` 请求头会透传到响应头和错误 payload；没有传入时后端生成一个新的 id。前端页面只消费 `msg/message/code/details/request_id`，不要为单个页面发明新的错误格式。

## 前端边界

页面只负责页面状态、表单交互和导航；接口访问统一进入 `src/services/`，底层 HTTP 统一经过 `src/utils/httpClient.js`。后续新增页面时，优先复用已有 service 或在同目录新增领域 service，不在 `.vue` 页面中散落 `uni.request`。

用户反馈统一进入 `src/services/feedback.js`。加载态、成功提示、错误 toast 和后续可能接入的全局消息通知，都从这里扩展；业务 service 返回结构化数据和异常，不直接替页面决定复杂交互。

前端页面优先用共享组件搭骨架：`PageShell` 负责顶部栏和滚动区，`SectionBlock` 负责详情分区，`CanList` 负责罐头分页列表，`EntityCard` 负责义项/写法/集盒卡片，`SearchPanel` 负责搜索聚焦态，`NameplateComposer` 负责贴铭牌表单。新增列表、详情、创建流程时，先判断是否可以扩展这些组件的 props 和事件，而不是复制一份视觉结构。

罐头相关页面继续复用 `CanCard`、`NameplateCard`、`EmptyState`、`ResultSection`、`AudioCapture`。首页、搜索页、罐头列表/详情、义项/写法/集盒页面是给后续贡献者参考的样板页面。

## 状态机

`Can.status`：

- `unlabeled`：无铭牌。
- `pending`：已有铭牌，等待社区或管理员校验。
- `tentative`：社区暂定。
- `verified`：正品认证。
- `disputed`：存在争议。
- `rejected`：已驳回。

`FlavorVariant.status`：

- `draft`：草稿。
- `verified`：已认证。
- `rejected`：已驳回。
- `disputed`：争议。

`visibility` 仍表示是否对普通用户可见，和状态流转分离。
