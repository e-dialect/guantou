# 主题装扮模块总览

**文档状态：** 产品总结（整套主题中心 PRD 的入口）
**产品：** 乡声集盒 · 主题中心（H5 网页 + 微信小程序）

细节以分册为准，发生冲突时按下面优先级，不要在分册里另造一套枚举：

1. **是否对用户开放、小程序降级** → ROADMAP
2. **字段名与接口** → DATA（`privilege_type=activity`，`status=coming|available|deprecated`）
3. **失败提示** → FAULT
4. **进退栈** → NAV
5. **启用是否允许** → SECURITY

前端内部仍可能用 `access=event`、`upcoming`/`ended`，对外接口和后台只用契约值。埋点里的中文枚举是报表展示，不是第四套权限名。

个人中心入口文案为 **主题中心**（需求里的「主题装扮」指同一入口）。界面不用「作品」「短视频」；需求里的「作品卡片」写作 **罐头卡片**。后续「发布方言罐头兑换装扮」对应需求里的短视频兑换。

| 契约 | 前端内部 | 用户可见 |
| --- | --- | --- |
| `privilege_type`: `free` `member` `activity` `creator` | `access`: `free` `member` `event` `creator` | 免费 / 会员专属 / 活动限定 / 方言创作者专属 |
| `status`: `available` `coming` `deprecated` | `usable` / `upcoming` / `ended` `removed` | 可用 / 待上线 / 已下架绝版 |
| `support_terminal`: `h5` `miniprogram` | 同 | H5 / 微信小程序 |
| `item_type`: `theme` `decoration` | `kind`: theme / dress | 全局主题 / 局部装扮 |

## 分册索引

| 主题 | 文档 |
| --- | --- |
| 三期范围与小程序降级 | [`THEME_CENTER_ROADMAP.md`](THEME_CENTER_ROADMAP.md) |
| 全局主题模块（独立拆分） | [`THEME_CENTER_GLOBAL.md`](THEME_CENTER_GLOBAL.md) |
| 局部装扮模块（独立拆分） | [`THEME_CENTER_DRESS.md`](THEME_CENTER_DRESS.md) |
| 冲突控制开关（独立拆分） | [`THEME_CENTER_OVERLAY.md`](THEME_CENTER_OVERLAY.md) |
| 我的装扮汇总（独立拆分） | [`THEME_CENTER_OUTFIT.md`](THEME_CENTER_OUTFIT.md) |
| 三层预览体系（独立拆分） | [`THEME_CENTER_PREVIEW.md`](THEME_CENTER_PREVIEW.md) |
| 最近使用记录（独立拆分） | [`THEME_CENTER_RECENT.md`](THEME_CENTER_RECENT.md) |
| 搜索筛选排序（独立拆分） | [`THEME_CENTER_SEARCH.md`](THEME_CENTER_SEARCH.md) |
| 四维权限（独立拆分） | [`THEME_CENTER_PRIVILEGE.md`](THEME_CENTER_PRIVILEGE.md) |
| 收藏 / 分享 / 热度（独立拆分） | [`THEME_CENTER_SOCIAL.md`](THEME_CENTER_SOCIAL.md) |
| 历史搭配方案（独立拆分） | [`THEME_CENTER_MIX.md`](THEME_CENTER_MIX.md) |
| 空态 / 占位 / 失效标识（独立拆分） | [`THEME_CENTER_STATUS.md`](THEME_CENTER_STATUS.md) |
| 双端存储与云端同步（独立拆分） | [`THEME_CENTER_SYNC.md`](THEME_CENTER_SYNC.md) |
| 标准化数据结构（独立拆分） | [`THEME_CENTER_DATA.md`](THEME_CENTER_DATA.md) |
| 全场景异常与边界兜底（独立拆分） | [`THEME_CENTER_FAULT.md`](THEME_CENTER_FAULT.md) |
| 全链路数据埋点（独立拆分） | [`THEME_CENTER_ANALYTICS.md`](THEME_CENTER_ANALYTICS.md) |
| 页面 / 弹窗跳转 | [`THEME_CENTER_NAV.md`](THEME_CENTER_NAV.md) |
| 运营后台（独立拆分） | [`THEME_CENTER_ADMIN.md`](THEME_CENTER_ADMIN.md) |
| 全链路性能优化（独立拆分） | [`THEME_CENTER_PERF.md`](THEME_CENTER_PERF.md) |
| 全链路安全风控（独立拆分） | [`THEME_CENTER_SECURITY.md`](THEME_CENTER_SECURITY.md) |
| 用户投稿与创作者自制（独立拆分，三期） | [`THEME_CENTER_UGC.md`](THEME_CENTER_UGC.md) |
| 三期商业化与生态拓展（独立拆分） | [`THEME_CENTER_ECO.md`](THEME_CENTER_ECO.md) |

仓库里已有不少二期页面入口。验收仍按期：一期能换主题和核心装扮并同步；二期方言素材 + 权限/搜索/搭配真正跑通；三期才做后台、碎片、社区、投稿。**不要因为页面先写了就把付费和方言货架一次做完。**

---

## 一、核心目标

1. **个性化：** 一套全局主题 + 多组件局部装扮，用户可换界面。
2. **方言特色：** 川渝、江南吴语、岭南粤韵等地域风格主题/装扮（货架在 **二期** 铺开）。
3. **混搭：** 保存整套搭配（最多 10），一键复用；最近使用最多 8 条。
4. **商业化：** 免费 / 会员专属 / 活动限定 / 方言创作者专属。前端置灰，**启用必须服务端校验**。
5. **双端：** H5 与微信小程序同一套 path 与字段。小程序原生导航栏、tabBar **不能换皮**，按阶段藏入口或置灰说明。
6. **稳定：** 弱网、坏 JSON、下架、换账号、存储满，不崩溃、不丢本地配置、不串号。

样式只走 `style_json` → CSS 变量，页面不写死色值。实时预览在沙盒里模拟，点「立即应用」前不改真实页。

---

## 二、模块汇总

分期：● 一期必须 ｜ ○ 二期 ｜ △ 三期。一期不做的项即使页面有入口，也不对用户承诺。

| # | 模块 | 期 | 要点 |
| --- | --- | --- | --- |
| 1 | 主题中心首页 | ● | 个人中心进入。一期 Tab：全局主题、局部装扮。底部/第四入口：我的装扮汇总（`?tab=mine`，见 [`THEME_CENTER_OUTFIT.md`](THEME_CENTER_OUTFIT.md)）。二期加我的收藏 |
| 2 | 局部装扮组件 | ●/○ | 一期只做罐头卡片、主页背景、头像框、评论气泡。二期补按钮、话题卡、输入框；nav/tab **二期可见但小程序置灰**。契约：`nav_bar` `tab_bar` `button` `card` `home_bg` `avatar_frame` `comment_bubble` `topic_card` `input_box` |
| 3 | 覆盖开关 | ● | 「全局主题覆盖局部装扮」。打开且已有局部装扮要二次确认 |
| 4 | 预览 | ●/○ | 卡片缩略、详情大图（一期，见 [`THEME_CENTER_PREVIEW.md`](THEME_CENTER_PREVIEW.md)）。全屏实时模拟（二期）。小程序预览标注原生栏不生效 |
| 5 | 最近使用 / 历史搭配 | ○ | 最近 8 条（见 [`THEME_CENTER_RECENT.md`](THEME_CENTER_RECENT.md)）；搭配最多 10 套、一键应用跳过失效件（见 [`THEME_CENTER_MIX.md`](THEME_CENTER_MIX.md)） |
| 6 | 搜索筛选排序 | ○ | 关键词；权限/风格/组件/方言地域；多种排序。搜索为子页（现网可先页内 searching）。见 [`THEME_CENTER_SEARCH.md`](THEME_CENTER_SEARCH.md) |
| 7 | 权限 | ○ | `free` `member` `activity` `creator`。待上线占位不可启用。会员/活动/任务走站内页。见 [`THEME_CENTER_PRIVILEGE.md`](THEME_CENTER_PRIVILEGE.md) |
| 8 | 分享 | ○ | 私信、微信/小程序转发、复制链接（H5）、海报（优先后台预生成图）。见 [`THEME_CENTER_SOCIAL.md`](THEME_CENTER_SOCIAL.md) |
| 9 | 收藏 | ○ | 个人标记，不是解锁。空态留在收藏 Tab。见 [`THEME_CENTER_SOCIAL.md`](THEME_CENTER_SOCIAL.md) |
| 10 | 重置全部 | ● | 二次确认后恢复默认 |
| 11 | 本地 + 云端 | ● | 游客只本地。登录写云端，失败先本地再生效再重试。登出 / A→B 清本地。游客→登录：云端 / 本地 / 合并。见 [`THEME_CENTER_SYNC.md`](THEME_CENTER_SYNC.md) |
| 12 | 容错 | ● | 列表失败重试或缓存条；绝版跳过；存储满会话临时生效；小程序 SDK 过低提示。策略见 [`THEME_CENTER_FAULT.md`](THEME_CENTER_FAULT.md)。空态文案见 [`THEME_CENTER_STATUS.md`](THEME_CENTER_STATUS.md) |
| 13 | 数据 | ● | `theme_item` / `decoration_item` / `user_collect` / `user_saved_mix` / `user_current_config`。搭配与配置 **只存 id** |
| 14 | 分期 | — | 见 ROADMAP，完成一期再开二期 |
| 15 | 跳转 | ● | 主页面 / 子页面入栈；详情、筛选、分享、预览、确认为模态不入栈。返回：弹窗关层、子页回首页、首页回个人中心 |
| 16 | 后台 | △ | 增删改、终端、标签、活动定时、只读用户搭配、报表、日志。有引用禁止物理删除。Django Admin 校验与活动窗校正可提前；`/manage/` 中台、热搜/空态 CMS、Excel 看板按三期。见 [`THEME_CENTER_ADMIN.md`](THEME_CENTER_ADMIN.md) |
| 17 | 性能 | △（分页/懒加载可提前） | >50 条虚拟列表；每页 20；列表缩略图；style 防抖；缓存无整份 JSON；关预览释放 |
| 18 | 安全 | ○（随权限上线） | 启用服务端二次校验；不收客户端 `style_json`/计数；限流 429；收藏搭配隔离；包内不写死会员。HMAC 当授权 / 后台可配阈值 / 风险看板见 SECURITY 分期，不做一期闸门。见 [`THEME_CENTER_SECURITY.md`](THEME_CENTER_SECURITY.md) |
| 19 | 用户投稿 | △ | 创作者草稿、审核后进目录。现网无入口。见 [`THEME_CENTER_UGC.md`](THEME_CENTER_UGC.md) |
| 20 | 商业化 / 碎片 / 社区 | △ | 账本、支付、公开复刻、榜单。现网无路由。见 [`THEME_CENTER_ECO.md`](THEME_CENTER_ECO.md) |

冲突开关打开时只生效全局主题。同一 `component_type` 同时只生效一件局部装扮。

方言地域标签（展示文案）：川渝、江南吴语、岭南粤韵、闽台闽南、北方晋陕、湘楚潇湘、云贵滇黔。

---

## 三、风险与规避

### 1. 小程序原生导航栏、tabBar 不能换皮

用户会以为「买了顶栏却没变」。

- 一期：**不展示** nav/tab 装扮入口（不要置灰卡）。
- 二期：入口可见 + 置灰 +「小程序暂不支持该组件装扮」；预览写明系统默认顶栏/底栏。
- 两端都不对原生栏注入 `style_json`。人力优先头像框、罐头卡片、评论气泡、主页背景。

### 2. `style_json` 损坏导致花屏、白屏

- 后台非法 JSON 禁止保存。
- C 端解析失败丢该层，回退默认，Toast「装扮样式加载异常，已恢复默认」。
- 预览只在 `ThemeLivePreview` 沙盒，取消不改真实页。

### 3. 历史搭配里的件被下架

- 禁止物理删除已被收藏或写入搭配/当前配置的件，只标 `deprecated`。
- 一键应用自动跳过，Toast「部分装扮已下架，已自动跳过」（或环境跳过文案）。
- 用户的搭配记录保留，不替用户删方案。

### 4. 抓包盗用会员 / 活动装扮

- 前端置灰不够。`apply` / `config` 服务端查存在、状态、权益、终端。
- 忽略客户端传来的会员标记和 `style_json`。失败不写云端配置。
- 未登录不能写 `/users/theme/*`。

### 5. 弱网同步失败丢配置

- 先写本地并立刻 hydrate；登录再排队云端，网络恢复 flush。
- Toast 说明已本地生效、稍后重试。
- 游客不同步服务端。

### 6. 货架变长后列表卡顿、内存涨

- 分页 20；超过 50 条虚拟滚动；列表只懒加载缩略图。
- 关预览 `abortThemePreview`，卸实例。
- 持久化不存整份货架 `style_json`。

### 7. 换账号串号

- A→B：清空本地主题/收藏/搭配，拉 B 的云端。
- 登出 / token 失效：清本地主题键，游客不残留上一账号配置。
- 游客→登录：弹窗选云端 / 本地 / 合并；合并后服务端仍会滤掉无权限 id。

策略见 [`THEME_CENTER_SYNC.md`](THEME_CENTER_SYNC.md)。

其它：存储满 → 会话临时生效；SDK 过低 → 提示不跳错页；活动到期自动绝版且不可再启用。

---

## 四、验收

按 **当前阶段闸门** 验收，不要用下面「完整能力」清单卡一期。

### 一期（必须先过）

- 个人中心能进主题中心；能换全局主题，真实页样式变。
- 能启用一期四类局部装扮；覆盖开关开则局部不生效，关则能单独生效。
- 能重置；重置不删收藏、历史搭配、最近使用；游客杀进程再进配置还在；登录换设备（或清缓存拉云端）能对上。
- 「我的装扮」（`?tab=mine`）能看当前全局主题与一期局部槽位；【更换主题】回到全局主题 Tab。
- 列表卡片缩略与详情大图可看；关闭预览不改真实配置。全屏实时模拟不作为一期闸门。
- 坏 JSON 回退默认，不白屏。列表失败有重试或缓存条。
- 小程序 **没有** nav/tab 装扮入口。文案无「作品」「短视频」。
- 快速连点启用不重复提交（同按钮防抖）。

### 二期（一期过后再验）

- 收藏、搜索/筛选（含方言地域）、分享、最近使用、保存搭配、一键应用、实时预览。
- 无会员/活动/创作者资格不能启用（**服务端拒绝**抓包改 id）。
- 搭配含绝版：跳过 + Toast，方案还在。
- 小程序 nav/tab 可见但不可启用，有环境文案；H5 可按权限启用。
- 换账号不串号；游客登录合并三种选择可用。

### 三期后台、投稿与生态

- 运营可新增/编辑/上下架；活动到点自动上架/绝版；非法 JSON 不能存。见 [`THEME_CENTER_ADMIN.md`](THEME_CENTER_ADMIN.md)。
- 有引用的装扮不能删。报表、操作日志可查。运营不能改用户搭配。
- 目录 100+ 列表可滑；弱网先出缓存。
- 投稿未过审不上公开目录。见 [`THEME_CENTER_UGC.md`](THEME_CENTER_UGC.md)。
- 碎片只记云端；公开复刻走同一套下架跳过；**绝版仍不可启用**。见 [`THEME_CENTER_ECO.md`](THEME_CENTER_ECO.md)。
- 未开工前不对用户承诺支付、社区页、投稿入口。

### 稳定性（各期都要）

- 页面不因样式或网络崩掉。
- 弱网能看缓存列表。
- 非法请求不泄露内部错误；失败配置不脏写。
- 收藏、分享等紧凑操作继续使用项目 `BaseButton` 原语；圆形图标必须有包含资源名称的可访问名称，不可用资源使用真实 disabled，不能只降低透明度。

### 双端

H5、小程序各走一遍该阶段主路径。小程序不支持处必须是产品文案，不能看起来像故障。

---

## 五、后续方向（三期及以后，不插队）

1. 装扮碎片：发方言 **罐头** 获碎片，兑换限定装扮（服务端账本）。见 [`THEME_CENTER_ECO.md`](THEME_CENTER_ECO.md)。
2. 装扮社区：看别人搭配，一键复制（走同一套下架跳过）。见 [`THEME_CENTER_ECO.md`](THEME_CENTER_ECO.md)。
3. 用户投稿自制装扮，审核后上架。见 [`THEME_CENTER_UGC.md`](THEME_CENTER_UGC.md)（三期；现网无入口）。
4. 节日主题定时轮换（复用活动开始/结束）。见 [`THEME_CENTER_ECO.md`](THEME_CENTER_ECO.md)、[`THEME_CENTER_ADMIN.md`](THEME_CENTER_ADMIN.md)。
5. 更多地域主题与纹样（头像 / 罐头卡 / 评论优先加量）。

不做（除非单独立项）：直播装扮、第三方皮肤市场、跨 App 导出、承诺小程序原生栏可换皮。

---

## 怎么读、怎么排期

1. 先看本文 + ROADMAP，锁定当前期「做 / 不做」。
2. 实现字段对 DATA，交互对 NAV，失败对 FAULT，权限对 SECURITY。
3. 二期货架和付费未过闸门，不要把后台、碎片、社区、投稿、支付并行铺开。见 [`THEME_CENTER_ECO.md`](THEME_CENTER_ECO.md)。
4. C 端不写管理界面；运营走 `/manage/`，staff 登录。
5. [`THEME_CENTER_UGC.md`](THEME_CENTER_UGC.md) / [`THEME_CENTER_ECO.md`](THEME_CENTER_ECO.md) 写的是三期契约，**不是已上线能力**。与一期/二期分册冲突时，以 ROADMAP「是否对用户开放」为准。
