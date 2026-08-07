# API v1 第二轮领域与接口复审

## 状态

已按维护者反馈接受，作为 PR #128 的修订依据。

## 需求与约束

- 方言树按证据和使用需要逐级展开，不让固定层级类型反向约束树形。
- 读音要让普通读者能并列比较变调前后的罗马字，而不是解析自由 JSON。
- API 错误必须稳定、可机器处理且不泄露服务端异常。
- 保持 v1 单一契约，不引入兼容期双写字段。
- 查询参数必须能由 OpenAPI 描述，权限过滤不能因关系展开而失效。

## 决策

### 方言节点不设 kind

`Dialect` 仅保存稳定 ID、同级短码、父节点、同级顺序、alias、说明和外部引用。`闽.莆仙.仙游.游洋` 中每一段是什么粒度，由资料本身和父子关系表达；系统不假设第几层必然是“方言区”“方言片”或“地方话”。旧 `region_level` 只进入 `external_refs.legacy_region_level` 供迁移追溯。

备选方案是保留可空 `kind` 或改为 tags。两者都会让没有实际查询用途的分类继续进入所有写接口和响应，故 v1 直接删除；未来若确有多套语言学分类需求，应作为独立 taxonomy/外部引用设计，而不是把单一枚举塞回树节点。

### 本调与变调后罗马字是一等字段

`Pronunciation` 使用：

- `base_romanization`：孤立读法或变调前的本调形式；
- `surface_romanization`：特定语流环境中实际读出的变调后形式；
- `sandhi_info`：触发词、位置、规则、语境等结构化补充。

旧 `romanization` 最接近旧录音对应的实际读法，迁入 `surface_romanization`；`base_romanization` 留空等待有证据的整理，不复制旧值制造“未发生变调”的伪结论。声调由这两个罗马字字段自身表达，不再另存 `tone_value`。`changed_tone` 不再作为 `reading_type`，因为文读/白读和是否发生变调是两个独立维度。

### PocketBase 只借鉴稳定边界

保留资源式路径、POST/PATCH/DELETE、类型化筛选和当前 snake_case。错误体继续使用此前确定的 `{code, message, data, request_id}`；字段错误直接位于 `data.<field>`，每项包含机器可读 `code` 和人类可读 `message`。服务端 500 只返回通用消息，原异常写日志并用 request ID 关联。

不照搬 PocketBase 的任意字符串 `filter`、动态 `fields` 或 camelCase 分页。这些能力适合通用 BaaS，但会扩大本项目的查询攻击面、权限组合和文档复杂度。关系展开仍由各资源显式定义，并在展开后继续应用可见性过滤。

## 非功能要求

- 安全：不可见资源继续表现为 404；私有 Can 不可通过 Pronunciation/Nameplate 展开泄露；500 不含异常原文。
- 一致性：迁移必须保存旧罗马字和旧层级信息；客户端不双写旧新字段。
- 性能：列表保持最大 `page_size=100`；不引入无上限通用 expand/filter。
- 可维护性：错误、分页和筛选继续由共享基础设施处理，专项规则由 serializer/service 验证。

## 验证

- 旧模型到 v1 的数据迁移测试覆盖 kind 删除和 romanization 重命名。
- 前端仅把 2xx 当作成功，仅从规范字段 `message` 取错误文案。
- DRF 与历史 Django 视图的 5xx 响应都不得向客户端泄露原始异常。
- API 测试覆盖本调/变调后字段、旧字段拒绝、错误字段结构和通用 500。
- 前端测试覆盖读音优先展示“本调 → 变调后”。
- OpenAPI lint、后端全测试、前端 lint/unit、H5/微信构建和 CI 全部通过。
