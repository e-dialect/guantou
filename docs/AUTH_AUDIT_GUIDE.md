# 身份、游客与审计开发指南

## 客户端请求

业务请求经过 `frontend/src/utils/request.js`，认证、注册等需要自行处理错误的请求经过
`rawRequest.js`，最终都使用 `httpClient.js`。页面不要直接调用 `uni.request`。公开请求
显式传 `{ auth: false }`；登录请求自动带 Bearer token，匿名访问自动复用 `X-Visitor-ID`。

```js
import request from '@/utils/request';

export function listEntries(params) {
  return request.get('/entries/', params, true);
}
```

## 服务端身份与权限

后端只接受 `Authorization: Bearer <token>`，不读取旧 `token` header。DRF V2 资源使用
`V2ResourcePermission`：游客可读公开资料；贡献者可修订自己的初稿；词条整理员和地区
整理员按有效授权范围工作。授权不能由 `X-Visitor-ID`、积分或客户端字段代替。

旧式账户 view 如需当前用户，统一使用 `user.tokens.get_request_user` 或
`check_request_user`。特殊 action 在自身声明权限，不修改全局权限设置。

## 游客追踪

`audit.AnonymousVisitor` 只保存随机 visitor id、user agent 和加盐 IP hash，不保存明文
IP 或请求体。`VisitorEvent` 记录 method、path、状态码、request id 和耗时。admin、static、
media、OPTIONS、能力矩阵和产品事件上报不进入游客追踪；审计写入失败不能改变业务响应。

## 对象审计

`audit.ObjectChangeLog` 通过 signals 跟踪 Entry、EntrySense、WritingForm、Concept、
PronunciationVariant、Recording、RecordingEntryLink、EvidenceRecord、UsageAttestation、
整理授权/申请/操作、Dialect 及相应关联模型的 create/update/delete。

每条日志包含对象、动作、变化字段、前后快照、登录用户、visitor 和 request id。
`QuerySet.update()` 不触发 save signals；需要通用审计的修改应使用实例 `save()`。高层整理
动作还必须写入 `CurationAction`，保留业务理由与证据。

## 检查清单

- 公开与登录请求的 auth 语义正确。
- 写接口覆盖未登录、越权和成功路径。
- 不记录请求体、明文 IP、设备位置或 token。
- 不恢复旧 Can/Nameplate 权重选主或旧对象权限类。
- 运行 `make backend-check`、`make frontend-check` 和 `make api-contract-check`。
