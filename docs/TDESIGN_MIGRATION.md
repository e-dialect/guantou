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
| `pages/mails/send` | done | [#195](https://github.com/e-dialect/guantou/issues/195) / [PR #216](https://github.com/e-dialect/guantou/pull/216)：标准表单、字段错误与 payload 回归测试 |
| `pages/login/login` | issue | [#238](https://github.com/e-dialect/guantou/issues/238)：倒计时、双登录模式与登录恢复 |
| `pages/nameplates/create` | issue | [#237](https://github.com/e-dialect/guantou/issues/237)：原生 Picker、联合校验与来源映射 |
| `pages/users/settings/information` | issue | [#225](https://github.com/e-dialect/guantou/issues/225)：头像开放能力、日期与方言 Picker |
| `pages/users/settings/password` | issue | [#229](https://github.com/e-dialect/guantou/issues/229)：密码显示与原生 form submit |
| `pages/users/settings/email` | issue | [#227](https://github.com/e-dialect/guantou/issues/227)：验证码与邮箱绑定流程 |
| `pages/login/register` | issue | [#228](https://github.com/e-dialect/guantou/issues/228)：验证码、协议与注册校验 |
| `pages/login/register/wechat` | issue | [#230](https://github.com/e-dialect/guantou/issues/230)：微信昵称/授权能力 |
| `pages/login/forget` | issue | [#226](https://github.com/e-dialect/guantou/issues/226)：多阶段找回密码流程 |
| `pages/cans/create` | partial | [#195](https://github.com/e-dialect/guantou/issues/195) / [PR #216](https://github.com/e-dialect/guantou/pull/216)：录音、草稿、TDesign 级联与枚举 Picker 已迁移；项目表单原语的进一步收敛由 [#232](https://github.com/e-dialect/guantou/issues/232) 跟踪 |
| `pages/pronunciations/create` | done | [#234](https://github.com/e-dialect/guantou/issues/234)：PageShell + BaseForm/BaseField/BaseButton、统一加载/重试/反馈；保留写法 Picker、方言级联、联合校验、字段错误定位与成功返回 |
| `pages/shelves/index` | issue | [#231](https://github.com/e-dialect/guantou/issues/231)：创建表单与列表状态 |
| `pages/shelves/details` | issue | [#235](https://github.com/e-dialect/guantou/issues/235)：编辑、双搜索和成员管理 |
| `pages/search` / `components/SearchPanel` | issue | [#236](https://github.com/e-dialect/guantou/issues/236)：聚焦、键盘与搜索联想 |
| `pages/users/onboarding` | issue | [#233](https://github.com/e-dialect/guantou/issues/233)：方言联动选择与登录门禁 |
| `pages/cans/drafts` | done | [#195](https://github.com/e-dialect/guantou/issues/195) / [PR #216](https://github.com/e-dialect/guantou/pull/216)：加载、空态、错误、继续编辑与删除反馈 |
| `pages/cans/index` / `library` | queued | 每页独立 PR |
| `pages/cans/details` / `comments` | done | 普通控件已收敛；分享开放能力及低频 Cell/Textarea 直接使用 TDesign |
| `pages/nameplates/details` / `comments` | done | 普通按钮与加载已收敛；低频 Cell 直接使用 TDesign |
| `pages/posts/compose` | done | [#195](https://github.com/e-dialect/guantou/issues/195) / [PR #216](https://github.com/e-dialect/guantou/pull/216)：来源锁定、发布状态、字段错误与成功跳转 |
| `pages/posts/details` | queued | 独立 PR |
| `pages/flavors/index` / `details` | queued | 搜索、列表与详情操作 |
| `pages/packages/index` / `details` | queued | 搜索、加载与详情操作 |
| `pages/circles/index` / `details` | queued | 搜索、Picker 与详情操作 |
| `pages/discovery/index` | queued | 操作按钮与加载状态 |
| `pages/users/me` / `details` / `recommend-follow` | queued | 开放能力与关注交互分别迁移 |
| `pages/mails/index` / `details` | queued | Cell、加载和通用操作 |

## 添加读音页（#234）

- 义项继续由路由锁定；唯一关联写法自动选中，多个写法不自动选首项。重新加载时保留仍有效的选择，清除不再关联的写法。
- 方言保留可检索的层级级联、默认方言与最近使用入口。读音类型与更多语言学信息的显隐方式不变。
- `validatePronunciationDraft` 仍是联合校验的来源：IPA、写法、方言必填；变调前后形式成对填写；填写变调环境时必须同时具备两种形式。`sandhi_info` 错误映射到 `sandhi_environment` 表单项。
- 客户端和服务端字段错误均交给 BaseForm 展示；先展开相关折叠区，再校验并滚动定位。PageShell 使用页面滚动，让 TDesign 的错误定位在长表单中生效。
- 提交继续清理首尾空白、转换数字 ID，保留 API 与 payload；成功时返回上一页，无历史栈则返回锁定义项详情。请求失败保留输入，不重复弹出字段错误提示。

回归入口：`frontend/tests/unit/PronunciationCreate.test.js` 与 `frontend/tests/e2e/pronunciation-create.spec.js`。浏览器用例使用隔离的接口响应，不写入真实业务数据，覆盖浅暗主题、写法/方言选择、变调联合校验、服务端错误、选项加载失败/重试与成功返回。

390×844 H5 截图：[浅色](assets/tdesign-migration/pronunciation-create-light-390x844.png)、[暗色](assets/tdesign-migration/pronunciation-create-dark-390x844.png)、[变调校验](assets/tdesign-migration/pronunciation-create-sandhi-error-390x844.png)。

在已启动的 H5 服务上运行 `yarn test:e2e:h5 tests/e2e/pronunciation-create.spec.js`；非默认端口通过 `E2E_BASE_URL` 指定。需要刷新文档截图时设置 `UPDATE_MIGRATION_SCREENSHOTS=1`，普通测试只生成测试附件。微信小程序需通过 `yarn build:mp-weixin`；构建不替代开发者工具/真机交互验收。

## Completion

所有 `issue` 和 `queued` 页面完成后：确认仓库不再使用原生交互控件、`uni-ui` 表单或 `cu-*`，再删除 `legacy-form-compat.scss`、ColorUI 全局引入、无用 easycom 映射与 `@dcloudio/uni-ui` 依赖。
