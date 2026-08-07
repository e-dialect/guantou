# ADR-0003：采用受约束的 PocketBase 风格接口边界

## Status

Accepted for API v1.

## Context

当前 API 已使用资源路径、PATCH、统一分页和错误中间件，但字段错误多包一层 `data.fields`，未处理异常可能把原始异常字符串返回客户端。PocketBase 提供了值得参考的统一错误、集合分页、关系展开和权限过滤形式；本项目同时需要保持可静态描述的方言领域 API。

## Decision

- 错误响应固定为数字 HTTP `code`、单一 `message`、结构化 `data` 和 `request_id`。
- 字段错误直接放在 `data.<field>`，值包含稳定错误码与消息；嵌套输入保持同构嵌套。
- 未处理异常只记录在服务端，客户端收到通用 500 消息和 request ID。
- 客户端只把 2xx 视为成功，且只消费 `message`；历史 `msg` 仅可在服务端归一化边界内出现。
- 不可见单条资源返回 404，集合查询只返回当前身份可见记录。
- 更新使用 PATCH，删除成功使用 204，支持/取消支持等幂等状态使用 PUT/DELETE。
- 列表继续使用 OpenAPI 明确定义的类型化查询参数与有上限的 DRF 分页。

## Consequences

### Positive

- 前端只需要一个稳定错误解析器，字段可以直接映射到表单。
- 生产异常不会泄露文件路径、SQL 或第三方错误细节。
- 筛选与权限规则可审计、可生成文档，不需实现通用查询语言。

### Negative

- 不具备 PocketBase `filter/sort/fields/expand` 的完全动态能力。
- 新增筛选字段需要同步修改 ViewSet、OpenAPI 和测试。

### Neutral

- 保留 snake_case 和现有资源路径，不追求与 PocketBase SDK 线协议兼容。

## Alternatives Considered

### 完整复制 PocketBase Records API

通用性高，但会把 BaaS 的动态 schema、过滤 DSL、字段投影和权限组合复杂度带入一个强领域项目，不采用。

### 保持 DRF 默认错误原样

实现成本最低，但不同异常来源结构不一致，且字段错误不利于前端稳定映射，不采用。

## References

- [PocketBase API Records](https://pocketbase.io/docs/api-records/)
- [PocketBase API rules and filters](https://pocketbase.io/docs/api-rules-and-filters/)
- [PocketBase custom routing and error responses](https://pocketbase.io/docs/js-routing/)
- [API v1](../api/v1/README.md)
