# 前端构建告警门禁

更新时间：2026-09-05；跟踪 Issue：#352。

## 目标

构建成功不等于构建日志健康。CI 对 H5 与微信小程序分别执行带审计的构建，未登记的 warning、deprecation、Browserslist 数据过期提示或 Vite `(!)` 提示都会使任务失败。

```bash
cd frontend
yarn build:h5:checked
yarn build:mp-weixin:checked
```

审计器位于 `frontend/scripts/build-with-warning-audit.mjs`。允许项按精确指纹和所属 Issue 匹配，不能用宽泛字符串屏蔽同类新告警。

## 当前登记项

| 指纹 | 平台 | 归属 | 退出条件 |
| --- | --- | --- | --- |
| UniApp 检测到新版本 | H5 / 微信小程序 | #353 | 按同一官方兼容矩阵成组升级 DCloud 依赖 |

微信小程序编译器内部仍通过 Vue SFC 的 `renderSync` 进入 Sass legacy JS API。项目 Sass 已完成模块化迁移，因此 `vite.config.mjs` 仅对 `legacy-js-api` 这一条上游弃用提示使用 Sass 官方 `silenceDeprecations`；#353 升级编译器并确认改用现代 API 后必须删除该配置。

## #367 已清理项

- themeFault、themeApi、themeAnalytics、themeCenter 与 themeSchema 已通过显式运行时适配器解除反向动态依赖。
- H5 不再输出 themeApi.js、themeCenter.js、themeSchema.js 无法拆分 chunk 的三条提示；#328 允许规则已删除。
- 主题服务依赖图与适配器注册/恢复已有单元测试，不能靠重新加入动态 import 或循环静态 import 绕开边界。设计与体积/时延基线见 [`THEME_RUNTIME_BOUNDARY.md`](THEME_RUNTIME_BOUNDARY.md)。

## #352 已清理项

- `App.vue` 的 Sass `@import` 已迁移为 `@use`。
- `tokens.scss` 的全局 `map-get` 已迁移为 `sass:map` 的 `map.get`。
- H5 Sass 改用 Vite `modern-compiler` API。
- `caniuse-lite` 从 `1.0.30001765` 更新到 `1.0.30001810`。
- Vitest 配置改用 `.mjs` 并使用现代 Sass API，不再触发 Vite CJS Node API 与 Sass legacy JS API 弃用提示。

## 产物回归基线

语法迁移前后使用同一提交、同一依赖树构建，产物保持一致：

| 目标 | 文件数 | 磁盘占用 | 关键样式 SHA-1 |
| --- | ---: | ---: | --- |
| H5 | 115 | 1816 KiB | `index-CLQK1Xn6.css`: `100a02e7123976c1195f14d88336c82a17e4a2c2` |
| 微信小程序 | 365 | 2336 KiB | `app.wxss`: `59ba1e02cb1affb4e4affdd602272c4e31299687` |

文件数、体积与关键 CSS 内容哈希在迁移前后完全相同；任何后续差异都需要在对应 PR 中解释并重新做明暗主题视觉检查。
