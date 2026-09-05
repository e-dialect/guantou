# API 文档

乡声集盒当前只公开 Entry / Recording V2 领域接口。字段、方法和状态码以
[`api/v1/openapi.yaml`](api/v1/openapi.yaml) 为准；这里的 `v1` 是公开契约目录版本，
不代表已退役的 Can/Nameplate V1 领域。

## 权威顺序

1. [`api/v1/openapi.yaml`](api/v1/openapi.yaml)：公开路径和字段契约。
2. [`api/v1/README.md`](api/v1/README.md)：中文语义与典型流程。
3. [`ARCHITECTURE.md`](ARCHITECTURE.md)：运行时边界。
4. [`adr/0006-entry-sense-recording-domain.md`](adr/0006-entry-sense-recording-domain.md)：V2 领域决策。
5. [`adr/0007-retire-legacy-can-nameplate-runtime.md`](adr/0007-retire-legacy-can-nameplate-runtime.md)：旧运行时退役决策。

## 核心约定

- 业务资源直接挂在根路径并保留尾斜杠，如 `/entries/`、`/recordings/`。
- 写接口使用 `Authorization: Bearer <token>`；公开资料默认允许匿名读取。
- 列表统一返回 `{ count, next, previous, results }`。
- 同形不同读音或核心意义返回不同 Entry；Concept 关联不会自动合并词条。
- Recording 与 Entry 通过 `primary / mention / competing` 多对多关联。
- 地区默认精确匹配；只有 `dialect_scope=subtree` 才包含后代。
- Can、Nameplate、Flavor、Package、Pronunciation、Shelf、Post、Comment 旧领域路径已退役，
  旧数据库表仅用于历史归档和可追溯迁移。

## 维护检查

修改公开契约时同步更新 OpenAPI、中文说明和 ADR，并运行：

```bash
make api-contract-check
```

检查会同时确认 V2 serializer/route 与 OpenAPI 对齐，以及旧核心路由没有重新出现。
