# 主题中心页面视图边界

更新时间：2026-09-05；跟踪 Issue：#328 / #369；基线：#368 `e8e2281`。

## 决策

主题中心原 SFC 同时承载 1,740 行模板、页面生命周期、目录/收藏/搭配/登录合并状态和 868 行样式。服务层在 #368 拆开后，页面仍无法按用户旅程独立评审或挂载。

#369 保留 `/pages/users/theme-center` 路由、query、返回行为和所有产品语义，把入口收敛为 PageShell 与显式视图装配：

| 视图 | 用户职责 | 独立状态 |
| --- | --- | --- |
| `ThemeCenterDiscoveryView` | 搜索入口、目录同步提示、一级 Tab | loading / stale / error / search empty / normal |
| `ThemeCenterRecentView` | 最近使用 | empty / available / disabled |
| `ThemeCenterGlobalView` | 当前主题、目录、分类与排序 | empty / filtered empty / normal / upcoming |
| `ThemeCenterLocalView` | 局部装扮分类与组件入口 | empty / filtered empty / blocked / normal |
| `ThemeCenterFavoritesView` | 收藏筛选与启用 | empty / retired / normal |
| `ThemeCenterMineView` | 当前搭配、冲突设置、历史与获取 | empty / applied / blocked / saved |
| `ThemeCenterThemeDetail` | 详情、收藏/喜欢/分享、实时预览与缩放 | unavailable / H5 / mini program / zoom |
| `ThemeCenterFilterSheet` | 多维筛选草稿 | open / reset / confirm |
| `ThemeCenterOutfitSheet` | 保存与重命名搭配 | save / rename / validation error |
| `ThemeCenterMergeSheet` | 登录后的本地/云端配置选择 | cloud / local / merge |

`theme-center.vue` 从 4,130 行降为 286 行，只导入视图、已有 preview/share 组件和页面 controller，不直接导入任何 service。UniApp 的 `onLoad`、`onShow`、分享与返回钩子仍通过对象展开保留为页面顶层选项，没有依赖 mixin 对自定义生命周期的隐式合并。

## 所有权与交互

- `pages/users/theme-center/controller.js` 是页面状态与业务副作用的唯一拥有者；它依赖 #368 的 facade/领域 API，但不导入任何功能视图。
- 子视图只接收当前旅程所需 props，并通过显式 emits 上报用户意图；不读取路由、不访问 service、不复制目录或用户状态。内部组件使用轻量 props 名单，避免把运行时校验元数据打入路由包；边界测试逐项确认入口显式绑定了每个 prop。
- 原页面 scoped 样式迁至 `components/theme-center/theme-center.scss`，所有规则都位于 `.theme-center-page` 命名空间内，既能覆盖抽出的子组件，也不会污染其它路由。
- `ThemeCenterViewBoundary.test.js` 固定入口行数、service/view 单向依赖、所有内部 prop 的显式装配和样式命名空间。
- #366 正在另一工作树补 Tab 前景色契约；本分支没有修改 HomeTabBar、themeSchema 或前后端 catalog。

## 独立验证矩阵

`ThemeCenterViews.test.js` 不挂载页面 controller，直接为十个视图提供最小 fixture，覆盖：

- 目录 loading、失败、搜索空态与正常热门词；
- 最近使用空态与禁用项；
- 全局/局部目录的筛选空态、正常卡片与点击命令；
- 收藏空态、筛选事件与正常项；
- 我的装扮的空/已应用/历史搭配与覆盖开关；
- 详情缩放生命周期，以及筛选、搭配、登录合并弹层的决策事件。

既有 `ThemeCenter.test.js` 的 50 项页面/服务兼容测试继续通过，确保路由参数、收藏、同步、权限、埋点、搭配、返回与异常行为未因视图提取改变。

## 产物与进入基线

P1 基线使用 UniApp 5.24 依赖与生产构建：H5 114 files / 1,605,580 B，JS 1,081,224 B；主题中心入口 chunk 72,271 B，加上其共享 `ThemeStatusPane` 后的路由相关 JS 为 85,845 B，CSS 20,263 B。390×844、明暗交错、reduced-motion、即时 mock API 的 7 个隔离 Chrome context，从导航开始到搜索区可见的中位数为 826 ms。

最终 #369 使用相同依赖与测量方法：

| 指标 | P1 基线 | #369 | 解释 |
| --- | ---: | ---: | --- |
| H5 总产物 | 1,605,580 B | 1,619,442 B | +13,862 B / +0.86% |
| H5 JS | 1,081,224 B | 1,094,752 B | +13,528 B / +1.25%；共享组件图产生少量包装开销 |
| H5 主题中心相关 JS | 85,845 B | 85,798 B | -47 B / -0.05%；入口路径没有回退 |
| H5 主题中心 CSS | 20,263 B | 20,597 B | +334 B / +1.65%；来自 `.theme-center-page` 隔离包装 |
| 微信小程序总产物 | 1,364,811 B | 1,374,529 B | +9,718 B / +0.71% |
| 微信小程序 JS | 717,113 B | 729,826 B | +12,713 B / +1.77% |
| 微信小程序主题中心路由产物 | 101,815 B | 111,534 B | +9,719 B / +9.55%；十个独立组件生成各自 JS/JSON/WXML 包装 |
| 进入搜索区中位时间 | 826 ms | 824 ms | 7 个隔离 Chrome context；仅判定无回退，不主张性能提升 |

独立挂载能力在微信小程序端确实有组件包装成本，但总包增幅为 0.71%，H5 用户进入路径没有增长；因此接受这一可观测、可回滚的架构交换，不把拆分包装成性能优化。

## 最终门禁

- ESLint：通过，0 warning；
- Vitest：60 files / 385 tests 全部通过；测试输出中的 `scroll-view` 解析提示属于 #354 已登记的共享测试桩边界；
- UniApp 5.24：H5 checked build 与 mp-weixin checked build 均通过，构建告警审计无新增；
- Playwright + 本机 Chrome：26/26 H5 E2E 通过；
- 390×844 视觉/溢出矩阵：全局明暗、搜索长文案空态、收藏空态、我的空态、筛选弹层和详情弹层均无水平溢出；
- 浏览器控制台：仅复现 #350 已登记的 `uni.setBackgroundColor`、`uni.getMenuButtonBoundingClientRect` H5 能力提示及同一条基线 `Object` pageerror，#369 无新增 error/warning。
