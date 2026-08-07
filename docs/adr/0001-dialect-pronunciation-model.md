# ADR-0001：方言层级与读音模型

## Status

Accepted for the proposed API v1 design.

## Context

乡声集盒需要同时表达：

- 同一个标准化义项在不同方言中的读音差异；
- 同一个写法因义项不同而产生的读音差异；
- 同一方言内部的文白异读、代际差异和争议读音；
- 多条实际录音对一条词典读音记录的支持；
- 从宽泛方言到地方话的按需细分。

原模型中 `FlavorVariant` 同时承担义项变体、读音、音频和地区信息，边界不清。原 `Dialect` 又混合方言分类与 province/city/county/town 字段，容易把行政隶属误当成语言关系。

非功能要求：标识应稳定、响应可按需展开、上层方言查询不能意外扫描全部后代、分类调整不应破坏外键、原始录音与规范化判断必须可追溯。

## Decision

### 方言层级

只维护一棵 `Dialect` 方言关系树。地区名只有在表示可区分的地方话时才成为节点，不另建行政区划树。

- 节点使用稳定 ID，`parent_id` 表示唯一上级。
- `code` 在同级内唯一，默认使用社区熟悉的中文简称；`qualified_code` 从根到叶拼接，例如 `闽.莆仙.仙游.游洋`。
- `qualified_code` 用于解析和展示，不作为外键。历史限定名作为 alias 保留。
- 同级展示顺序显式使用 `sort_order, id`；限定码可用于前缀过滤和支系聚合，但不能依赖 Unicode 字典序表达语言学顺序。
- 节点按有证据的实际需求创建，不预建所有省市县镇。
- 默认查询精确节点；包含后代必须显式使用 `dialect_scope=subtree`。
- 节点不设置固定 `kind`；粒度完全由按需父子关系表达，未来需要外部分类时通过 taxonomy 或 `external_refs` 对齐。

### 读音模型

以 `Pronunciation` 替代 `FlavorVariant`。Pronunciation 分别引用：

- `package_id`：规范化写法；
- `flavor_id`：标准化义项；
- `dialect_id`：方言节点。

服务端创建或更新时必须验证 Package 与 Flavor 已存在关联。三元组本身不设唯一约束，以容纳文读、白读、代际差异和争议读音；同一三元组与 `reading_type` 下最多一条记录可标记为 canonical。

Pronunciation 保存规范化音系描述和来源，不保存音频，也不直接持有 Can。`Nameplate.pronunciation_id` 可空，多张 Nameplate 把实际 Can 作为同一 Pronunciation 的带来源证据。无法确定读音的 Can 仍可先保存，再由 Nameplate 提出 Package、Flavor、Dialect 和读音主张。

罗马字显式拆为 `base_romanization`（变调前/本调）和 `surface_romanization`（语流中的变调后形式），`sandhi_info` 只记录触发环境与规则。文读/白读属于 `reading_type`；是否发生变调是正交信息，不设置 `changed_tone` 类型。

## Consequences

### Positive

- Package、Flavor、Pronunciation、Can 各自只有一个清晰职责。
- 同形异义、同义异读和同地多读法均可表达。
- 根到叶限定码便于阅读、前缀解析和按需展开，又不依赖它作为主键。
- 原始证据、社区主张和规范化词典记录相互关联但不会互相覆盖。
- 读者无需解释 JSON 即可并列比较本调和变调后罗马字。

### Negative

- Pronunciation 请求必须同时提交并校验三个外键。
- 方言重新归类需要更新限定名缓存和 alias。
- 上层方言与地方话之间是否应新建节点仍需要人工语言学判断，不能由行政区划自动生成。

### Failure modes and mitigation

- **循环父子关系**：保存 Dialect 前检查祖先链，数据库或服务层拒绝形成环。
- **限定名冲突**：同级 code 唯一；重命名时保留旧 alias，并拒绝 alias 与现行限定名冲突。
- **重复读音**：创建时提示相似 IPA/罗马字记录，由 reviewer 合并，不用过强唯一约束丢失真实差异。
- **无证据 canonical**：canonical Pronunciation 必须至少有来源说明或一张关联可访问 Can 的 active Nameplate；撤回最后证据时自动取消 canonical。

## Alternatives Considered

### 独立 Dialect 与 Place，再组合 SpeechVariety

语义最严谨，但当前产品明确只需要方言关系；引入独立地理模型会增加选择、查询和维护成本，因此 v1 不采用。

### 将行政区和语言类别混入固定层级

查询简单，但假设行政边界必然对应方言边界，并要求预建大量没有资料的节点，因此不采用。地区名可以用于命名方言节点，但节点语义必须仍是语言变体。

### 在 Dialect 上保留 kind 或层级 tags

可以提供展示标签，但当前没有独立查询或约束用途，反而会重新引入固定层级心智模型，因此 v1 删除。需要多套学术分类时另建 taxonomy 关系。

### Pronunciation 引用 FlavorPackage 中间表

能在结构上保证写法—义项关系，但 API 不够直观，且用户已选择显式 `package_id + flavor_id + dialect_id`。v1 改为服务端验证组合关系。

### 从 Can 与 Nameplate 动态聚合读音

采集端最简单，但无法稳定承载规范 IPA、文白读和审核状态，查询和去重成本高，因此不采用。

## References

- [CLDF：Cross-Linguistic Data Formats](https://cldf.clld.org/)
- [Glottolog languoid information](https://glottolog.org/glottolog/glottologinformation)
- [Concepticon](https://concepticon.clld.org/about)
- [API v1 设计说明](../api/v1/README.md)
- [ADR-0002：铭牌作为可查询的资料主张](0002-nameplate-as-attestation.md)
