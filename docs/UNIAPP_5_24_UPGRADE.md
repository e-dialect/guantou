# UniApp 5.24 成组升级记录

更新时间：2026-09-05；跟踪 Issue：#353。

## 决策

本次采用 DCloud 官方 Vue 3 Vite 模板的正式 5.24 批次 `3.0.0-5020420260813003`，不追随 npm `vue3` 标签上的后续 alpha。官方 CLI 文档建议通过版本管理或模板升级整批 CLI 依赖；因此所有 DCloud 编译器、运行时和目标平台包一次性对齐，不混用 4.08、5.01、5.02 与 5.24。

参考：

- [DCloud uni-app CLI 工程文档](https://en.uniapp.dcloud.io/quickstart-cli.html)
- [DCloud 官方 Vue 3 Vite 模板 package.json](https://github.com/dcloudio/uni-preset-vue/blob/6085e2034de05a4aff527687cbfe517bd0855b63/package.json)
- [HBuilderX 5.24 更新记录](https://download1.dcloud.net.cn/hbuilderx/changelog/5.24.2026081301.html)

## 锁定矩阵

| 分组 | 版本 |
| --- | --- |
| `@dcloudio/uni-*` 编译器与平台包 | `3.0.0-5020420260813003` |
| `@dcloudio/types` | `3.4.31` |
| Vue / runtime-core / compiler-dom | `3.4.21` |
| Vite / `@vitejs/plugin-vue` | `5.2.8` / `5.2.4` |
| Rollup | `4.14.3` |

Vitest 2.1.9 与 vite-node 接受 Vite `^5.0.0`，Vite 5.2.8 接受 Rollup `^4.13.0`。`package.json` 的 `resolutions` 将这些传递依赖也固定到上表版本，避免开发构建和单测各自加载不同的 Vite/Rollup。

`@dcloudio/uni-ui` 是独立 UI 组件库，不属于编译器批次，保留既有兼容范围。

## 安装环境

项目与 CI 使用 Node 22。当前锁文件里的 `jsdom@30.0.1` 要求 Node `^22.22.2`、`^24.15.0` 或 `>=26`，因此本机 Node 24.11 不能重新安装；本次使用 Node 24.19 和 Yarn 1.22.19 生成并验证锁文件。`yarn install --frozen-lockfile` 可复现安装。

安装日志剩余两类非矩阵告警：Yarn 1 自身调用 `url.parse()`，以及官方 `uni-automator` 声明但本项目不使用的 Jest 27 peer。它们不代表 H5 或小程序运行时加载了第二套 Vue/Vite。

## 上游限制

正式 5.24 在 H5 和微信小程序构建中仍通过 Vue SFC 适配层调用 Sass legacy JS API。移除 `silenceDeprecations: ['legacy-js-api']` 后，H5 告警门禁能稳定复现四条上游弃用提示；项目自身 Sass 已使用模块 API。因此本轮保留这一条精确静默，待后续正式编译器不再调用旧接口时删除，不能把“升级完成”误写成“上游问题消失”。

## 回归结论

- `yarn lint` 通过。
- 完整单测通过：51 个文件、360 项测试。
- H5 与微信小程序 checked build 通过，编译器均报告 5.24；版本更新提示不再出现，对应允许规则已删除。
- 完整 H5 E2E 通过：26 项，单 worker，390×844 viewport。
- 390×844 搜索页浅色和暗色人工检查布局一致，未见字体、间距或对比度回归。
- 产物体积、哈希和上游 CSS 差异记录在 [`BUILD_WARNINGS.md`](BUILD_WARNINGS.md)。

单测中的 `scroll-view` stub 告警由 #354 跟踪；浏览器里的 `setBackgroundColor` / `getMenuButtonBoundingClientRect` H5 兼容告警由 #350 跟踪，均已在各自隔离分支处理，不混入本次依赖升级提交。
