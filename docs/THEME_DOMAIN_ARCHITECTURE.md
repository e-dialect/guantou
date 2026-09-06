# 主题领域模块边界

更新时间：2026-09-05；跟踪 Issue：#328 / #368；基线：#367 `a0ba1e1`。

## 决策

`themeCenter.js` 原先同时保存内置目录、用户状态、筛选查询、预览渲染、历史搭配和远端同步。它的 5,396 行并不是首要问题；真正风险是这些能力共享模块级可变状态，任何同步测试都会加载完整目录，渲染与网络边界也无法单独验证。

#368 保留 `@/services/themeCenter` 作为旧调用方的兼容 facade，并把真值所有权收敛到 `frontend/src/services/theme/`：

| 模块 | 唯一职责 | 禁止依赖 |
| --- | --- | --- |
| `contracts.js` | 权限类型与默认主题等稳定产品值 | 状态、目录、渲染、网络 |
| `store.js` | 存储键、序列化读取、配额回退与会话态 | catalog、render、sync、themeApi |
| `catalog.js` | 内置/远端目录、权限、筛选、标签与资源状态 | render、sync、themeApi |
| `render.js` | 预览组合、样式变量解析与实际 hydration | sync、themeApi |
| `sync.js` | 状态变更、历史/收藏/搭配与远端副作用编排 | 完整 catalog、完整 render |

`catalogPort.js` 与 `renderPort.js` 是两个经过校验的窄接口。catalog/render 在加载后注册实现；sync 只依赖安全默认值与这些接口，因此同步单测可以绑定最小 fixture，不再解析 4,000 行目录。它们不是第二套状态：目录数据只存在于 catalog，用户状态只存在于 store。

```text
catalog ──→ contracts / store / catalogPort
render  ──→ catalog / store / renderPort
sync    ──→ contracts / store / catalogPort / renderPort

themeCenter facade → contracts / store / catalog / render / sync
```

依赖图、禁止动态绕环、网络归属和 facade 职责由 `ThemeDomainBoundary.test.js` 固定。`themeCenter.js` 只做原公共 API 的兼容导出与 #367 运行时适配器装配，store 内部 helper 不会经由 facade 外泄；页面模板与产品/API/存储契约均未改变。

## 兼容边界

- 原有 `@/services/themeCenter` 的具名导出继续可用；外部页面无需一次性迁移。
- 所有既有 storage key 保持原字符串，配额失败时的内存 fallback 行为保持不变。
- `GLOBAL_THEMES`、`LOCAL_DRESS_ITEMS` 仍是唯一可变目录对象，远端合并没有复制第二份目录。
- themeApi payload、游客合并、会员/活动/创作者权限、离线队列与样式 hydration 顺序不变。
- #369 才拆 theme-center 页面模板；本轮只移动服务所有权。

## 产物与交互基线

以下比较使用同一 UniApp 5.24 锁文件和同一构建命令：

| 指标 | #367 | #368 | 变化 |
| --- | ---: | ---: | ---: |
| H5 文件数 | 114 | 114 | 0 |
| H5 总字节数 | 1,603,642 | 1,605,580 | +1,938（+0.12%） |
| H5 全部 JS | 1,079,286 B | 1,081,224 B | +1,938（+0.18%） |
| H5 首屏入口 JS | 565,126 B | 567,064 B | +1,938（+0.34%） |
| 主题中心路由相关 JS | 85,845 B | 85,845 B | 0 |
| 微信小程序文件数 | 371 | 378 | +7 |
| 微信小程序总字节数 | 1,353,715 | 1,364,811 | +11,096（+0.82%） |

小程序新增的 7 个文件正是显式领域模块与 port；业务目录和页面代码没有复制。H5 路由包完全不变，入口与小程序的小幅增加是模块包装和接口校验成本。

真实 Chrome 在 390×844、reduced-motion、即时 mock API 条件下，对两个生产构建交错运行 7 个隔离 context。用户从确认“立即启用”到卡片显示“已启用”的中位数为 256 ms → 256 ms；不主张提速，只据此判定拆分未造成可见主题切换回退。

两端浏览器样本都只出现基线已有、由 #350 处理的 `setBackgroundColor` / `getMenuButtonBoundingClientRect` H5 警告与 `Object` pageerror，#368 没有新增 console warning、console error 或 pageerror。

## 验证

- lint 通过。
- 完整 Vitest：58 files / 373 tests 通过；其中 5 个新领域测试文件直接覆盖 store、catalog、render、sync 与边界图；输出中的既有 `scroll-view` stub 告警由 #354 跟踪。
- H5 / mp-weixin checked build 均通过，`tracked notices: none`。
- 390×844 真实 Chrome 完整 H5 E2E 26/26 通过；首页 smoke 显式断言无 error 级浏览器控制台消息。
- 本轮单 worker E2E 没有再次触发 #351 SQLite 锁冲突；该并发风险仍由独立负责人处理，不因单次未复现而关闭。
- Django 启动稳定出现的 pydub/ffmpeg 环境告警已查重并登记为 #372；生产容器已有 ffmpeg，本轮不混入后端能力探测改造。
