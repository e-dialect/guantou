# TDesign UI migration tracker

通用控件迁移遵循 [ADR-0005](adr/0005-tdesign-ui-foundation.md) 和 [`frontend/AGENTS.md`](../frontend/AGENTS.md)。状态含义：`done` 已完成；`partial` 已使用部分 TDesign 但仍有遗留控件；`issue` 已延期并由独立 issue 跟踪；`queued` 尚未开始。

本轮 H5 视觉基线保存在 [`docs/assets/tdesign-migration/`](assets/tdesign-migration/)（390×844，含浅色、暗色、旧表单兼容与 404 空态）。

| 页面/共享区域 | 状态 | 后续工作或 Issue |
| --- | --- | --- |
| `components/BaseButton/BaseForm/BaseField/BaseLoading` | done | 项目级原语 |
| `components/EmptyState` | done | 所有现有消费者自动迁移 |
| `components/PageShell` / `components/AppShell` | done | 已接入按钮原语与反馈 Host |
| `components/CommentThread` | done | 表单、按钮、加载与空态使用项目原语 |
| `pages/error/not-found` | done | TDesign 空态 |
| `pages/users/settings/username` | done | 单字段表单 |
| `pages/users/settings/nickname` | done | 单字段表单 |
| `pages/users/settings/telephone` | done | 单字段表单 |
| `pages/mails/send` | done | 标准表单与 payload 回归测试 |
| `pages/login/login` | issue | [#238](https://github.com/e-dialect/guantou/issues/238)：倒计时、双登录模式与登录恢复 |
| `pages/nameplates/create` | issue | [#237](https://github.com/e-dialect/guantou/issues/237)：原生 Picker、联合校验与来源映射 |
| `pages/users/settings/information` | issue | [#225](https://github.com/e-dialect/guantou/issues/225)：头像开放能力、日期与方言 Picker |
| `pages/users/settings/password` | issue | [#229](https://github.com/e-dialect/guantou/issues/229)：密码显示与原生 form submit |
| `pages/users/settings/email` | issue | [#227](https://github.com/e-dialect/guantou/issues/227)：验证码与邮箱绑定流程 |
| `pages/login/register` | issue | [#228](https://github.com/e-dialect/guantou/issues/228)：验证码、协议与注册校验 |
| `pages/login/register/wechat` | issue | [#230](https://github.com/e-dialect/guantou/issues/230)：微信昵称/授权能力 |
| `pages/login/forget` | issue | [#226](https://github.com/e-dialect/guantou/issues/226)：多阶段找回密码流程 |
| `pages/cans/create` | issue | [#232](https://github.com/e-dialect/guantou/issues/232)：录音、草稿、条件表单与 Picker |
| `pages/pronunciations/create` | issue | [#234](https://github.com/e-dialect/guantou/issues/234)：联动 Picker 与读音字段语义 |
| `pages/shelves/index` | issue | [#231](https://github.com/e-dialect/guantou/issues/231)：创建表单与列表状态 |
| `pages/shelves/details` | issue | [#235](https://github.com/e-dialect/guantou/issues/235)：编辑、双搜索和成员管理 |
| `pages/search` / `components/SearchPanel` | issue | [#236](https://github.com/e-dialect/guantou/issues/236)：聚焦、键盘与搜索联想 |
| `pages/users/onboarding` | issue | [#233](https://github.com/e-dialect/guantou/issues/233)：方言联动选择与登录门禁 |
| `pages/cans/index` / `drafts` / `library` | queued | 每页独立 PR |
| `pages/cans/details` / `comments` | done | 普通控件已收敛；分享开放能力及低频 Cell/Textarea 直接使用 TDesign |
| `pages/nameplates/details` / `comments` | done | 普通按钮与加载已收敛；低频 Cell 直接使用 TDesign |
| `pages/posts/compose` / `details` | queued | 每页独立 PR |
| `pages/flavors/index` / `details` | queued | 搜索、列表与详情操作 |
| `pages/packages/index` / `details` | queued | 搜索、加载与详情操作 |
| `pages/circles/index` / `details` | queued | 搜索、Picker 与详情操作 |
| `pages/discovery/index` | queued | 操作按钮与加载状态 |
| `pages/users/me` / `details` / `recommend-follow` | queued | 开放能力与关注交互分别迁移 |
| `pages/mails/index` / `details` | queued | Cell、加载和通用操作 |

## Completion

所有 `issue` 和 `queued` 页面完成后：确认仓库不再使用原生交互控件、`uni-ui` 表单或 `cu-*`，再删除 `legacy-form-compat.scss`、ColorUI 全局引入、无用 easycom 映射与 `@dcloudio/uni-ui` 依赖。
