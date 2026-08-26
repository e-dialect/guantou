# 前端开发指南

前端使用 uni-app + Vue3，目录来自旧 `hinghwa-dict-uni-app`，但新功能应以本仓库当前结构为准。页面可以先粗糙，组件接口、数据流和错误反馈要稳定，方便后来的人照着写。

## 目录结构

```text
frontend/
  src/
    pages/          页面。一个路由页面对应一个 .vue 文件。
    pages.json      uni-app 路由、全局导航和 easycom 配置。
    services/       API 服务层。页面通过这里请求后端。
    utils/          请求封装、音频、剪贴板等通用工具。
    routers/        旧入口兼容层；新业务导航统一委托给 services/navigation.js。
    components/     可复用组件。出现重复 UI 时优先沉淀到这里。
    const/          常量、枚举、静态配置。
    colorui/        旧 ColorUI 样式和基础组件。
    uni_modules/    uni-app 插件。
```

页面层只负责交互状态和页面组合；服务层负责 API 路径；工具层负责跨页面通用能力。不要在页面里直接散落 `uni.request`、重复登录跳转或重复 toast 逻辑。

## API 服务层

当前请求链路是：

```text
pages/*.vue
  -> services/*.js
  -> utils/request.js 或 utils/rawRequest.js
  -> utils/httpClient.js
  -> uni.request / uni.uploadFile
```

常规页面使用 `utils/request.js`，它默认带 `Authorization: Bearer <token>`、发送 `X-Visitor-ID`、显示 loading、401 时跳登录页。需要静默请求或自己处理错误时使用 `utils/rawRequest.js`。

`utils/httpClient.js` 会保存响应头里的 `X-Visitor-ID` 到本地 `visitor_id`，并在后续请求中继续发送。游客身份只用于访问追踪；受保护动作仍然通过 `authGuard.requireAuth(...)` 拦截并引导登录。

新实体服务放在 `frontend/src/services/guantou.js`。目前资源实体统一走根路径，不使用 api 前缀：

- `/cans/`
- `/flavors/`
- `/pronunciations/`
- `/packages/`
- `/shelves/`
- `/nameplates/`
- `/dialects/`
- `/search/`

方言选择器通过 `/dialects/?flat=true` 获取扁平列表，按服务端 `sort_order`、`id` 展示 `qualified_code`；前端不递归请求 `flavors`，也不维护县/镇静态枚举。

读音展示优先并列显示 `base_romanization → surface_romanization`（本调 → 变调后）；缺少其中一项时只展示已有证据，不在客户端猜测或复制。

账户、登录、通知、文件等旧系统接口仍保留根路径，例如 `/users`、`/login`、`/notifications`、`/files`。新增罐头体系接口时不要继续扩大这种混合历史形态。

服务函数命名建议：

- 列表：`listCans(params)`
- 详情：`getCan(id)`
- 创建：`createCan(payload)`
- 行为：`supportNameplate(id)` / `unsupportNameplate(id)`
- 组合流程：`createCanWithNameplate(payload)`

## 页面写法

新增页面时按这个顺序做：

1. 在 `frontend/src/pages/` 下建页面文件。
2. 在 `frontend/src/pages.json` 注册路由。
3. 在 `frontend/src/services/` 增加或复用服务函数。
4. 页面里处理 `loading`、`error`、`empty`、`data` 四类状态。
5. 在 `services/navigation.js` 增加或复用语义化方法（如 `goCanDetail(id)`），页面不拼接路径，也不直接调用 `uni.navigateTo`。

根页面使用 `AppShell` 的品牌页眉、页脚和底部导航；详情、登录、编辑和评论页使用 `PageShell`，其返回按钮在没有历史栈时会回到合理根页面。首页铭牌数据必须由罐头列表响应自包含，卡片组件不得自行补请求。

列表页至少包含：

- 初次加载。
- 空态。
- 下拉或按钮触发的刷新/分页。
- 点击条目进入详情。

详情页至少包含：

- 顶部标题或返回入口。
- 主体信息。
- 相关列表，例如罐头详情里的铭牌、义项详情里的罐头。
- 主要操作，例如贴铭牌、支持铭牌、补录音。

表单页至少包含：

- 必填校验。
- 提交中状态。
- 成功后的跳转或刷新。
- 失败 toast，优先复用请求封装的错误提示。

## UI 规范速查

全站视觉基于 `frontend/src/styles/tokens.scss` 的全局 Design Token，由 `App.vue` 统一注入。**新代码禁止新增 hex 颜色字面量**，颜色、间距、圆角、字号一律消费 Token；暗色模式（`services/theme.js`）依赖这一机制，硬编码颜色会导致暗色失效。

颜色 Token（明暗双套，自动切换）：

| Token | 用途 |
| --- | --- |
| `--page-color` | 页面底色 |
| `--surface-color` / `--surface-subtle-color` | 卡片浮层 / 弱底色（按钮、禁用态背景） |
| `--text-color` / `--text-secondary-color` / `--muted-color` | 正文 / 次级正文 / 辅助文字 |
| `--border-color` | 描边与分割线 |
| `--accent-color` / `--accent-subtle-color` / `--on-accent-color` | 品牌强调 / 徽章浅底 / 强调背景上的文字 |
| `--danger-color` / `--danger-subtle-color` / `--on-danger-color` | 危险操作（删除等） |
| `--warning-color` / `--success-color` | 警告与成功语义色 |

尺寸 Token：间距 `--space-1..5`（8–48rpx）；圆角 `--radius-sm/md/lg/pill`；字号 `--font-size-xs..xl`（24–36rpx）。

沉浸式场景 Token（首页罐头流专用，固定深色）：`--immersive-*` / `--on-immersive-*` 系列定义在 tokens.scss 文末的 `immersive-color-tokens`，由 `.immersive-shell`（`pages/index.vue` 根节点）注入子树。**沉浸流固定深色、不随明暗主题翻转**；沉浸场景内的文字/图标/表面/波形/骨架屏一律消费 `--on-immersive-color`、`--on-immersive-muted-color`、`--immersive-surface-color`、`--immersive-wave-*-color`、`--immersive-skeleton-*-color` 等，不要复用明暗双套 Token（会随主题翻转导致沉浸流破功）。

基础原语（`frontend/src/components/`，easycom 自动注册）：

- `BaseButton`：TDesign Button 的项目语义层，支持 `variant="primary|ghost|danger|danger-ghost|light"`、尺寸、`block`、`loading` 与 `@click`。
- `BaseForm`：统一封装 TDesign Form，使用 `:data`、`:rules`，并通过 ref 调用 `validate/reset/submit/clearValidate`。
- `BaseField`：统一封装 TDesign FormItem + Input/Textarea，支持 `v-model`、`name`、`label`、`required`、`error`、`type="textarea"`。
- `BaseLoading` / `EmptyState`：页面或区块加载、空态和重试操作。
- `ConfirmDialog` 与 `services/feedback.js`：通过页面 Shell 中的 TDesign Host 展示反馈，旧页面才回退原生 API。

第三方组件库：项目已接入腾讯 TDesign UniApp（`@tdesign/uniapp`），完整明暗语义色已映射到项目 Token。当前 uni-app 版本的 easycom 对 npm 组件在小程序端不可靠，**必须手动导入**（如 `import TPicker from '@tdesign/uniapp/picker/picker.vue'`）。常规按钮、表单、加载、空态和反馈使用上述项目原语；Picker、Popup、Tabs、Cell、Upload 等复杂低频组件可直接使用 TDesign。

新页面和完成迁移的页面禁止新增原生 `button/input/textarea/picker/switch`、`uni-ui` 表单或 `cu-*`。完整选择规则与验收要求见 [`frontend/AGENTS.md`](../frontend/AGENTS.md)。
逐页迁移状态与延期 issue 见 [`TDESIGN_MIGRATION.md`](TDESIGN_MIGRATION.md)。

`src/colorui/` 为历史遗留样式库，新页面不要新增 `cu-*` 类名引用，待存量页面迁移后移除。

## 组件沉淀规则

不要一开始就为了一个页面抽很多组件。满足下面任意一条时，再放进 `frontend/src/components/`：

- 同一个 UI 在两个以上页面重复。
- 它承载稳定业务概念，例如罐头卡片、铭牌表单、实体卡片。
- 它有明确输入输出，别人照着 props 和事件就能用。

推荐组件接口保持简单：

```vue
<CanCard
  :can="can"
  @click="openCan(can)"
/>
```

组件不要自己请求后端，除非它本身就是完整业务容器。优先由页面获取数据，再把数据传给组件。

## 用户反馈约定

`httpClient` 已经统一处理：

- loading：默认显示 `uni.showLoading`。
- 401：提示并跳登录页。
- 403/404/500：显示对应 toast。
- 网络错误：显示网络错误 toast。

客户端只把 2xx 视为成功，并统一从 `message` 取用户可见错误。字段错误从 `data.<field>` 读取 `{ code, message }`；不要再解析 `msg` 或 `data.fields`。

页面不要重复弹同类错误。需要自己控制提示时，把请求设为 silent，然后在页面中处理：

```js
rawRequest.get('/cans/', params, { silent: true });
```

## 搜索与列表

当前搜索页通过 `searchGuantou(keyword, options)` 调用 `/search/` 聚合搜索，返回 `flavors`、`packages`、`nameplates`、`cans` 四组结果。建议搜索页使用这个入口；单资源列表筛选仍走各自服务函数，例如 `listFlavors({ search })`、`listPackages({ search })`、`listCans({ search })`。

搜索页通常负责：

- 输入框状态。
- 300ms 左右防抖联想，联想请求传 `limit: 5`。
- 热门词和历史记录。
- 分组结果展示。
- 点击结果跳到对应详情页。

列表页要把查询条件保存在页面状态里，分页参数通过服务函数传给后端。不要在多个页面复制一套分页计算，重复后再抽组件或 composable。

## 文案和业务词

用户界面优先使用：

- `罐头`：一段录音。
- `铭牌`：贴在罐头上的写法、释义和证据。
- `义项`：语义核心。
- `写法`：正字、俗写、借字、拟音等文本入口。
- `集盒`：主题集合。

代码里可以保留模型英文名，例如 `Can`、`Nameplate`、`Flavor`、`Package`、`Shelf`。不要在新页面里重新引入旧词典的 `word`、`pronunciation` 作为主概念。

## 提交前检查

常用命令：

```bash
cd frontend
yarn lint
yarn test:unit
yarn build
yarn build:mp-weixin
```

只改文档或很小样式时，可以在 PR 里说明没有跑完整前端检查的原因。
