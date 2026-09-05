# Entry / Recording API 说明

> 状态：当前公开契约。字段级定义见 [`openapi.yaml`](openapi.yaml)。

## 领域语义

- `Entry`：同一个词及其读音身份。无录音、写法尚不确定的词条也合法。
- `EntrySense`：同一 Entry 下的相关编号义；不同读音、词源或核心意义应拆为 Entry。
- `WritingForm`：汉字、俗写、借字、拟音、罗马字等可检索写法。
- `Concept`：WALK、RUN 等跨语言抽象概念，只用于关联发现。
- `PronunciationVariant`：某一 Entry 在特定地区的读音变化。
- `Recording`：音频、使用地区、录制者、类型和贡献者原始大意，不保存设备位置。
- `RecordingEntryLink`：录音与词条的多对多关系，角色为 `primary / mention / competing`。
- `EvidenceRecord`：贡献者原话或文献原文，不允许覆写。
- `UsageAttestation`：“我这里也这么说”的地区范围补证。

“行走的行”和“银行的行”是不同 Entry。“走＝步行”和“走＝奔跑”也可以拆成不同
Entry，再分别关联 WALK、RUN。搜索相同写法时返回多条清楚标注读音和大意的结果，
不会因支持数、权重或 Concept 自动合并。

## 主要路径

- `GET /entries/`：词条优先搜索；支持地区、录音有无、状态、IPA、罗马字等筛选。
- `POST /recordings/`：最低提交音频、使用地区和大意；写法、音标可后补。
- `POST /recording-entry-links/`：提出主要词条、句中词或竞争解释。
- `POST /usage-attestations/`：提交地区使用补证。
- `GET /entries/bookmarks/` 与 `PUT|DELETE /entries/{id}/bookmark/`：私有收藏。
- `GET /curation/`、`GET /curation/tasks/`：按授权显示整理工作台。
- `GET /contributions/me/`：个人录音、补证、修订和地区足迹。

## 方言范围

`Dialect` 是可停在任一级的树。贡献者可以只选“莆仙方言”，也可以继续选到“莆田 ›
城里”。父节点只表示已知范围，不推断所有子节点都使用。默认筛选为 `exact`；显式传
`dialect_scope=subtree` 才搜索所选节点及后代。普通响应提供自然名称和路径标签，内部
限定码只用于解析和管理工具。

## 历史数据

旧 Can/Nameplate/Flavor/Package 等表保留在数据库中作为只读归档，以便核对迁移来源。
它们没有公开 router、前端页面或自动选主执行路径。旧库导入器只创建 V2 对象，每个旧
词条先形成一个可追溯 Entry，每条旧录音只形成一个 Recording；含编号义和重复写法的
记录只生成待审核候选，不自动拆合。
