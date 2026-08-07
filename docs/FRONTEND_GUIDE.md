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
    routers/        页面跳转 helper。
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

装罐和个人资料的方言选择器复用同一个递归加载器，按服务端 `sort_order`、`id` 展示 `qualified_code`；前端不维护县/镇静态枚举。

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
5. 用 `frontend/src/routers/` 或 `uni.navigateTo` 做跳转，参数名保持简单稳定。

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

页面不要重复弹同类错误。需要自己控制提示时，把请求设为 silent，然后在页面中处理：

```js
rawRequest.get('/cans/', params, { silent: true });
```

## 搜索与列表

当前搜索页通过 `searchGuantou(keyword, options)` 调用 `/search/` 聚合搜索，返回 `flavors`、`packages`、`cans` 三组结果。建议搜索页使用这个入口；单资源列表筛选仍走各自服务函数，例如 `listFlavors({ search })`、`listPackages({ search })`、`listCans({ search })`。

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
