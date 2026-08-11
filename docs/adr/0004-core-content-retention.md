# ADR-0004：账号删除后保留并匿名化核心内容

## Status

Accepted for the demo and API v1.

## Context

公告、录音罐头和铭牌是站点资产、语言资料或可引用的证据主张。若它们随作者账号级联删除，账号注销或管理员清理会不可逆地破坏公开页面、集盒关系与著录历史。已发送通知也需要对接收者保留基本上下文。

## Decision

- `Announcement.author`、`Can.recorder`、`Nameplate.creator` 和 `Notification.actor` 在账号删除时使用 `SET_NULL`。
- API 对空作者使用匿名展示；Can 的 `recorder` 可以为 `null`。
- 无作者的 Can 和 Nameplate 不再有普通用户 owner，只有 staff 可以修改或删除。
- 通知接收者仍使用 `CASCADE`：删除账号时清理只属于该账号的收件箱。
- Can 的点赞、评论与再使用流程允许接收者为空，此时不创建事件通知。

## Consequences

公开语言资料、公告和历史事件不再因账号生命周期意外消失，稳定 ID 与外部引用得以保留。代价是数据导出和界面必须明确区分“已注销用户”与真实账号，且涉及个人数据的删除请求仍需按隐私政策单独清理音频或文本内容，不能只依赖外键删除。

## Alternatives Considered

使用 `PROTECT` 可以阻止删除，但会让账号注销流程被历史内容阻塞；继续 `CASCADE` 实现最简单，却不符合资料长期保存与铭牌可追溯目标，因此均不采用。
