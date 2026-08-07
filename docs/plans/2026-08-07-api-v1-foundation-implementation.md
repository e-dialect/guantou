# API v1 基础架构落地计划

## 状态

已批准实施。领域决策以 ADR-0001、ADR-0002 和 `docs/api/v1/openapi.yaml` 为准。

## 目标

把已合并的预期 API v1 设计落实到当前 Django/uni-app 基础架构，优先解决会造成数据语义错误、私有资料泄露或后续迁移困难的冲突。实现完成后，前后端不再依赖 `FlavorVariant`、`Can.flavor_variant`、行政区划式方言字段或旧错误结构。

非功能约束：

- 已有录音、读音和铭牌不得因迁移丢失；无法完整归类的旧记录进入明确的“待归类”节点。
- 私有 Can 的 Nameplate 和读音证据不得通过集合、搜索或嵌套序列化泄露。
- 创建 Can 与初始 Nameplate、创建铭牌修订与 supersede、支持与主铭牌选举必须在事务内完成。
- 同级方言和 canonical 读音由数据库约束兜底；接口层返回可定位的 400/409 错误。
- 列表接口统一分页，`page_size` 最大 100。

## 已确认冲突

1. `Dialect.code` 是全局唯一 ASCII slug，且模型混入省市县镇；目标是同级唯一中文短码、根到叶限定码、alias、人工顺序和按需关系展开。
2. `FlavorVariant` 只有 Flavor 与可空 Dialect，直接保存音频；目标 `Pronunciation` 必须包含 Package、Flavor、Dialect，音频证据经 Nameplate 关联。
3. `Can.dialect` 被当作规范方言，`Can.flavor_variant` 直接断言读音；目标只保留采集提示 `submitted_dialect`。
4. `Nameplate` 只有写法、义项和字符串来源，缺少 Dialect、Pronunciation、结构化 source、原样读音、状态和修订链。
5. Nameplate 集合未按 Can 可见性隔离；旧 nested POST、vote POST 和筛选参数与契约不同。
6. 全局错误同时返回 `msg/message`，使用字符串 `code` 和 `details`；目标是数字 HTTP `code`、单一 `message` 与 `data`。
7. 前端继续消费 `dialect_detail`、`variants`、`source_citation`、`/vote/` 和聚合搜索模拟联想。

## 迁移策略

采用单次向前迁移，但保存历史含义：

1. 扩充 Dialect 后转换旧 `region_level`；旧省市县镇保存到 `external_refs.legacy_location`。
2. 将 FlavorVariant 重命名为 Pronunciation，新增 Package 外键。优先使用 FlavorPackage 的 primary/最早关联；没有关联时创建 uncertain Package 和 FlavorPackage。
3. 旧空 Dialect 统一关联显式的“待归类”节点，避免伪造具体县镇。
4. 对每个 `Can.flavor_variant`，复用或创建 Nameplate，并写入 package/flavor/dialect/pronunciation/source；随后移除 Can 到读音的直接外键。
5. `Can.dialect` 原位重命名为 `submitted_dialect`；旧行政字段写入 `metadata.legacy_location` 后移除。
6. 旧 `source_citation` 转换为结构化 source；无出处时标为 creator。

## 实现切片与验证

### 1. 数据层

- 输出：新模型、约束、可逆 schema migration 与前向数据迁移。
- 验证：`makemigrations --check --dry-run`、从空库迁移、从旧 fixture 迁移。

### 2. API 层

- 输出：Dialect resolve/expand、Pronunciation CRUD/transition、Nameplate 查询/修订/支持、Can 新契约、统一错误与分页。
- 验证：模型约束、权限隔离、状态转换、冲突和响应 shape 测试。

### 3. 前端层

- 输出：新 API client、方言树加载与排序、结构化铭牌来源、读音/Can/搜索字段适配。
- 验证：Vitest、ESLint、H5 与微信小程序构建。

### 4. 集成层

- 输出：专项冲突清单与实现文档同步。
- 验证：后端全测试、前端全测试、OpenAPI lint、Docker 构建和 H5 E2E。

## 备选方案

### 长期同时暴露旧、新两套字段

迁移风险较低，但会让 `FlavorVariant` 和 Pronunciation、`dialect` 和 `submitted_dialect` 长期产生双写分歧，且无法真正验证 v1，故不采用。只在本地草稿恢复处做一次性输入兼容。

### 只改序列化字段、不改数据库

无法建立三外键、canonical、同级方言和主铭牌约束，也无法阻止后台或脚本写入错误数据，故不采用。

### 删除旧数据重新开始

实现最简单，但违反方言资料可追溯和录音不可丢失要求，故不采用。

## 风险与缓解

- 旧 Flavor 没有关联 Package：创建 uncertain 占位写法并保留关联，进入后续整理队列。
- 旧 Dialect 为空：只使用一个“待归类”节点，不推断具体地区。
- 迁移期间主铭牌不完整：保留 active 铭牌但取消不符合完整性要求的 primary，等待整理。
- 并发支持或选举：使用唯一约束、原子计数和事务锁。
- JSON source 无数据库枚举约束：Serializer 严格验证，数据迁移只生成已知类型。
