# ADR-0002：铭牌作为可查询的资料主张

## Status

Accepted for the proposed API v1 design.

## Context

同一条 Can 录音可能被不同人以不同写法、义项、方言和读音解释。依据也可能来自录音创作者、口述确认、田野记录、书籍、论文、档案或网页。系统既要允许这些主张竞争，又要把规范化词典资料与历史来源分开，避免后来修改 Package、Flavor 或 Pronunciation 时篡改原始著录。

功能要求：铭牌可独立查询；可关联 Can、Package、Flavor、Dialect 和 Pronunciation；保留来源中的原样写法、释义和读音转写；记录创建者、资料责任者、出处位置、状态和社区支持。

非功能要求：主张可追溯、引用稳定、修订有历史、公开接口不泄露私密来源信息，常用筛选应能建立普通数据库索引。

## Decision

`Nameplate` 是一等 annotation/attestation 实体，Can 是它的目标对象，字段和外键是它对录音提出的描述。采用以下关系：

```text
Can 1 ─ N Nameplate
             ├─ Package? / Flavor? / Dialect?
             ├─ Pronunciation?
             ├─ 原样 text_content / definition / pronunciation_text
             └─ source + creator + status + support
```

- 每张铭牌必须关联 `can_id`，并至少提出一项可验证内容。
- Package、Flavor、Dialect、Pronunciation 外键允许为空，以容纳尚未规范化的资料；若提供 Pronunciation，它与同时提供的其他外键必须一致。
- Can 只保存音频和采集上下文。`submitted_dialect_id` 是装罐时的初始提示，不是最终词典分类；Can 不直接保存 Flavor 或 Pronunciation 外键。
- 原样字段是来源快照，不能因规范实体改名、合并或重审而自动覆盖。
- `source` 在 v1 内嵌为结构化对象，区分创作者自述、口述、田野、书籍、论文、档案、网页和其他来源。系统 `creator` 与资料 `attributed_to` 分开。
- Nameplate 提供集合查询。`GET /cans/{id}/nameplates/` 只是按 Can 过滤的便捷子资源，规范创建入口是 `POST /nameplates/`。
- 已被支持、成为主铭牌或被其他记录引用后不得原地改写主张。修订创建新记录并设置 `supersedes_id`；撤回使用软状态，保留历史来源。
- 主铭牌必须处于 active 且达到完整性要求；它只代表当前默认展示，不抹除其他主张。

## Consequences

### Positive

- 同一录音的不同解释和不同来源能够并存并被单独引用。
- 规范化词典事实、原始媒体和社区/文献主张边界清晰。
- 可直接查询“某书支持哪些读音”“某方言有哪些待规范铭牌”等资料问题。
- 修订不会改写已经获得支持或被引用的历史记录。

### Negative

- 查询 Pronunciation 的录音证据需要经过 Nameplate，不能依赖 Can 上的直接外键。
- 原样字段与规范实体可能暂时不一致，客户端必须明确区分“来源写法”和“当前规范名称”。
- 结构化来源增加了创建表单和迁移工作的字段数量。

### Failure modes and mitigation

- **外键组合矛盾**：服务端验证 Pronunciation 的 Package、Flavor、Dialect 与铭牌显式外键一致，不一致返回 409。
- **来源伪装**：`creator` 由认证上下文写入；资料作者仅进入 `source.attributed_to`，两者不得互换。
- **修改历史主张**：有支持、主铭牌或引用的记录拒绝语义 PATCH，要求用 `supersedes_id` 新建修订。
- **删除导致断链**：DELETE 表示撤回并保留 tombstone；只有从未公开、未引用的草稿才允许物理删除。
- **敏感来源泄露**：公开 source 只存可公开引文；联系方式、精确住址等受限田野信息不进入公开 Nameplate schema。

## Alternatives Considered

### 把规范分类直接存到 Can

读取最简单，但同一录音只能有一套解释，后来的更新会覆盖异议和来源历史，因此不采用。

### Nameplate 只保存自由文本

适合留言，但无法稳定筛选 Package、Flavor、Dialect 和 Pronunciation，也不能成为词典证据，因此不采用。

### Nameplate 只保存外键

规范化程度高，但实体改名或合并后无法还原原书、原口述中的实际写法和转写，因此采用“外键 + 原样快照”的混合设计。

### v1 单独建立 Citation/Source 表

有利于跨铭牌复用书目，但会引入去重、版本、权限和书目规范化工作。v1 先内嵌结构化 source；出现大量重复来源后再以兼容方式抽取。

## References

- [W3C Web Annotation Data Model](https://www.w3.org/TR/annotation-model/)
- [OntoLex Lemon Lexicography Module](https://www.w3.org/2019/09/lexicog/)
- [API v1 设计说明](../api/v1/README.md)
- [ADR-0001：方言层级与读音模型](0001-dialect-pronunciation-model.md)
