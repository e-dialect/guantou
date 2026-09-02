# API 文档

本目录描述乡声集盒的**预期 API v1 契约**。它是产品与接口设计目标，不表示当前代码已经全部实现。

## 权威顺序

1. [`api/v1/openapi.yaml`](api/v1/openapi.yaml)：字段、类型、必填项、路径、状态码与鉴权的规范性来源。
2. [`api/v1/README.md`](api/v1/README.md)：中文语义、典型流程与使用示例。
3. [`ARCHITECTURE.md`](ARCHITECTURE.md)：系统边界和领域模型。
4. [`adr/0001-dialect-pronunciation-model.md`](adr/0001-dialect-pronunciation-model.md)：方言层级与读音模型的设计依据。
5. [`adr/0002-nameplate-as-attestation.md`](adr/0002-nameplate-as-attestation.md)：铭牌、录音与词典资料的边界和来源规则。

发生冲突时以前一项为准。实现代码、测试或旧讨论稿不能反向覆盖已经确认的 v1 契约；如需改变契约，应同时修改 OpenAPI、中文说明和相关 ADR。

## 版本管理

- v1 使用根路径，例如 `/cans/`、`/flavors/`、`/pronunciations/`，不在 URL 中增加 `/api/v1/`。
- v1 正式冻结前可以继续完善；冻结后的兼容性补充仍更新 `v1/`。
- 冻结后的破坏性变更新建 `docs/api/v2/`，不得静默改变 v1 的字段或语义。
- 只维护 YAML 契约，不提交内容相同的 JSON 副本。Apifox 等工具直接导入 `openapi.yaml`。
- 不在契约中记录 PR、issue 或实现进度；这些信息由 Git 与项目管理工具维护。

## 核心约定摘要

- 写接口使用 `Authorization: Bearer <token>`。
- 客户端可传 `X-Visitor-ID`；服务端在缺失时生成并通过同名响应头返回。匿名访客只用于访问追踪和审计归因，不具备写权限。
- 错误响应使用 `{ code, message, data, request_id }`，其中数字 `code` 与 HTTP 状态码一致。
- `Package` 是规范化写法，`Flavor` 是标准化义项，`Pronunciation` 表示“某写法在某义项、某方言下的一种读音”，`Can` 保存实际录音证据。
- `Nameplate` 是连接 Can 与 Package、Flavor、Dialect、Pronunciation 的可查询资料主张，并保存原样内容和来源。
- `Dialect` 是按需建立的方言关系树；限定码从根到叶书写，如 `闽.莆仙.仙游.游洋`，同级人工顺序使用 `sort_order`。
- 列表统一使用 `{ count, next, previous, results }` 分页结构，时间统一使用 RFC 3339。
- `/search/suggest/` 的已实现容错、可见性、去重和排序规则已经纳入 v1 契约，详见 OpenAPI 与中文说明。
- `/search/` 按 `flavors`、`packages`、`nameplates`、`cans` 分组，每组使用同一个 `limit`（默认 8，范围 1～20）；它不是资源列表分页接口。`/search/hot/` 返回按热度排序的 `[{ keyword, rank }]`。
- 评论的顶层列表与顶层创建必须且只能指定 `can_id` 或 `nameplate_id`：前者表示罐头公共评论（数据库中 `nameplate=NULL`），后者表示具体铭牌的独立讨论。回复列表按 `parent_id` 拉取、回复创建用 `reply_to_id` 推导目标，均不需 `can_id`/`nameplate_id`。

## 维护检查

修改 API 设计时至少检查：

1. OpenAPI 中的路径、schema 和示例是否一致。
2. 中文说明是否仍与 OpenAPI 和 ADR 一致。
3. 新的嵌套响应是否只使用 Ref/Card，避免递归嵌套 Detail。
4. `npx --yes @redocly/cli@1.34.5 lint --config docs/api/redocly.yaml docs/api/v1/openapi.yaml` 是否通过。
5. `git diff --check` 是否通过。
