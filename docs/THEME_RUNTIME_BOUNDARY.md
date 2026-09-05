# 主题运行时依赖边界

更新时间：2026-09-05；跟踪 Issue：#328 / #367。

## 为什么需要这一层

主题中心此前用动态 `import()` 绕开 themeFault、themeApi、themeAnalytics、themeCenter 与 themeSchema 之间的反向依赖。代码最终仍被其它入口静态加载，因此 Vite 每次 H5 构建都会提示三个模块无法拆成独立 chunk；同时，登录合并、目录恢复和埋点的初始化顺序只能靠调用方碰巧先加载某个大模块。

#367 只建立依赖反转边界，不提前搬动 #368 的目录、状态、同步和渲染实现，也不拆 #369 的页面模板。

## 依赖方向

`themeRuntime.js` 不依赖任何业务模块，只保存经过校验的函数适配器。各功能拥有者在模块完成求值后注册自己实现，反向调用只通过运行时接口发生：

```text
themeCenter ──→ themeApi ──→ themeSchema ──→ themeFault ──→ themeAnalytics
     │              │              │              │               │
     └──────────────┴──────────────┴──────────────┴───────────────→ themeRuntime

themeStatus ──→ themeFault
themeAnalytics / themeStatus ──→ themeAnalyticsLabels
```

静态依赖图必须无环，主题服务之间不得重新加入反向动态 `import()`；两条规则由 `ThemeDependencyGraph.test.js` 固定。

## 适配器归属

| 拥有者 | 注册能力 | 主要消费者 |
| --- | --- | --- |
| themeSchema | 清理解析后的样式缓存 | themeFault 的目录版本切换 |
| themeApi | 拉取云端状态、上报产品事件 | themeFault、themeAnalytics |
| themeCenter | 默认目录、权限/状态查询、目录合并、本地应用与云端 hydration | themeFault、themeApi、themeAnalytics |

未绑定能力使用明确的安全默认值：查询返回空/默认状态，写操作返回 `{ ok: false, reason: 'unbound' }`，埋点传输不阻塞用户动作。注册函数会拒绝未知名称或非函数值，并返回 scoped restore，单测可覆盖适配器而不污染其它用例。

## 构建与性能基线

比较同一 UniApp 5.24 锁文件下的 #353 基线与 #367：

| 指标 | #353 | #367 | 变化 |
| --- | ---: | ---: | ---: |
| H5 文件数 | 115 | 114 | -1 |
| H5 全部 JS | 1,088,291 B | 1,079,286 B | -9,005 B（-0.83%） |
| 首屏入口 JS | 563,705 B | 565,126 B | +1,421 B（+0.25%） |
| 主题中心路由相关 JS | 96,135 B | 85,845 B | -10,290 B（-10.70%） |

路由相关 JS 统计主题中心页面、ThemeStatusPane 与拆分前独立 themeAnalytics chunk；入口文件单列，避免重复计数。

真实 Chrome 在 390×844、reduced-motion、即时 mock API 条件下，对两个生产构建交错运行 7 个隔离 context：导航事件中位数 619 ms → 614 ms，`theme_perf_list_ready` 中位数 493 ms → 487 ms。该 5–6 ms 差异只说明没有可见回退，不作为性能提升主张。

## 验证边界

- H5 与微信小程序 checked build 均为 `tracked notices: none`。
- 完整单测通过：53 个文件、364 项测试，覆盖适配器注册/恢复、无动态反向依赖、无静态循环及既有目录/同步/渲染行为。
- 390×844 的 H5 Chrome E2E 26/26 通过；首页 smoke 用例显式断言无 error 级浏览器控制台消息。
- `scroll-view` 测试桩告警继续由 #354 跟踪；本边界不全局吞掉未知组件 warning。
- E2E 后端日志仍能复现 #351 已登记的 SQLite 匿名访客写入锁；该问题已有独立负责人，本改造不混入后端并发修复。
