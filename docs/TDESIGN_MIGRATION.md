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
| `pages/nameplates/create` | done | [#237](https://github.com/e-dialect/guantou/issues/237)：BaseForm/BaseField/BaseButton、TDesign Picker、联合校验、加载重试与防重复提交；H5 浅暗主题已验收，小程序构建通过，真机验收待补 |
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

## 发表立论页（#237）

- 表单使用 BaseForm/BaseField/BaseButton；方言与来源类型手动导入 TDesign Picker/PickerItem，保留 Cell 触发入口。PageShell 使用页面滚动，让长表单校验能定位到错误字段。
- 方言继续使用服务端排序的扁平列表和 `qualified_code` 标签。本次不新增层级或搜索交互；参考铭牌的方言默认选中但可覆盖，没有匹配时沿用列表首项。空列表保持允许不传 `dialect_id` 的行为。
- 写法和实际读音至少填写一项（纯空白不算），联合错误由 BaseForm 显示在两个字段下方；修改任一字段同时清除两处旧错误。仅在 `validate()` 返回 `true` 时提交。
- 保留 `nameplate_create` 登录恢复上下文、参考铭牌加载、`createNameplate` 调用及成功后的 replace 跳转。写法、读音和释义清理首尾空白；来源字段只过滤空白项，保留非空值的原文。`creator` 的证据等级继续为 1，其余七种来源为 2。
- 加载中使用 BaseLoading，加载失败使用 EmptyState 重试；提交失败保留输入和错误提示。通用错误由请求层通过 feedback service 提示，成功使用 `notifySuccess`。异步校验、请求和成功跳转阶段均防止重复提交。

回归入口：`frontend/tests/unit/NameplateCreate.test.js`（22 项）与 `frontend/tests/e2e/nameplate-create.spec.js`（7 项）。浏览器测试使用隔离接口响应，覆盖 390×844 浅暗主题、联合错误与定位、两个 Picker 的取消/重新打开/确认、来源过滤与 payload、登录拦截、加载失败重试、提交失败重试和重复点击，不写入真实业务数据。

390×844 H5 截图：首屏 [浅色](assets/tdesign-migration/nameplate-create-light-390x844.png) / [暗色](assets/tdesign-migration/nameplate-create-dark-390x844.png)，方言 Picker [浅色](assets/tdesign-migration/nameplate-create-picker-light-390x844.png) / [暗色](assets/tdesign-migration/nameplate-create-picker-dark-390x844.png)，长表单底部 [浅色](assets/tdesign-migration/nameplate-create-footer-light-390x844.png) / [暗色](assets/tdesign-migration/nameplate-create-footer-dark-390x844.png)。

在已启动的 H5 服务上运行 `npm run test:e2e:h5 -- tests/e2e/nameplate-create.spec.js`，非默认端口通过 `E2E_BASE_URL` 指定；设置 `UPDATE_MIGRATION_SCREENSHOTS=1` 可刷新文档截图。已通过 lint、全量单元测试、H5 与微信小程序构建，并检查小程序产物显式注册两个 Picker 组件且页面没有原生 Picker。当前环境未进行微信开发者工具/真机浅暗主题交互验收，构建结果不替代这一步。

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
