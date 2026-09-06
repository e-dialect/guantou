# v1 功能回归记录

参考版本：`a3c3491^`（旧运行时删除前），并对照 `c90f2a4` 的核心流程切换。

| 原功能 | v2 去向 | 复用与更新 |
| --- | --- | --- |
| Can 草稿箱、canDraftAudio | 录音草稿箱 | 提取 H5 IndexedDB／小程序持久文件算法，改为新命名空间；等待事务提交成功后才报告保存完成，不读取旧数据 |
| Can 详情与分享 | Recording 详情 | 原始大意、授权、地区、关联词条独立呈现，未关联词条仍可访问 |
| Shelf 与混合内容列表 | Collection → CollectionEntry → CollectionRecording | 重新设计为词条目录；选中的录音明确挂在词条下，单独保留待整理区 |
| 每日罐头、随机发现 | Recording daily／random | 借鉴按日期持久选择，过滤公开候选，撤回内容不继续暴露 |
| SearchPanel 历史／联想 | 查词辅助 | 本地历史按账号隔离、限制数量；防抖和请求序号丢弃过期联想，不采集搜索原词 |
| 社区罐头流 | 关注录音流 | 复用现有 UserFollow，不引入 Post |
| 评论、回复和点赞 | RecordingComment／RecordingLike | 挂在录音下，限制一层回复；评论请求 UUID 去重，消息不携带原文，点赞不参与治理 |
| 主题预览 | 当前四导航与集盒预览 | 使用现有 token，不引入第二套配色服务 |
| 铭牌支持选主、动态、用同款 | 不恢复 | 与当前治理原则或本次确认范围不符 |
| 账户、方言圈、收藏、贡献、主题装扮、站内信 | 原实现保留并衔接 | 不重复建设 |

旧表、旧草稿与旧链接不作为新功能数据源。新迁移仅建立 v2 功能表及通知类型，不批量转换旧数据。

## 功能边界

- 集盒默认私有；公开后仍按每个底层资源的可见性过滤，盒内归属不是词条关联或认证。
- 添加词条不自动添加录音；一段录音可在多个词条下展示，总数按 Recording 去重。
- 待整理录音有了关联后不会自动挪动；所有者选择归属才移入词条目录。失效关联仍保存，所有者可移出并重新收纳。
- 草稿保存在当前设备，显式保存或提交失败时保存；没有跨设备同步、分片断点续传或旧草稿导入。存储失败必须保留当前录制页面。
- 评论分页，作者删除或管理员隐藏后回复也不展示；重复发送同一 UUID 返回原记录，不重复通知。

## 验证记录

- 后端完整测试：合入最新 main 基线后 208 项通过，包含集盒可见性、同形词身份、录音去重、隐藏目录排序、批量查询、评论请求去重、每日稳定与关注范围。日志中的 `database is locked` 来自已有审计降级测试主动注入的异常，测试结果为通过。
- 前端完整单测：79 个文件、506 项通过。草稿音频测试覆盖浏览器事务提交／中止、小程序持久文件复用、提交路径更新，以及音频和索引写入失败后的保留与重试。
- H5 浏览器：4 项通过，覆盖 390×844 明暗主题目录与录音详情、实际试听操作、1440×1000 盒签编辑、草稿刷新恢复；无控制台错误和横向溢出。
- API 契约检查及 OpenAPI YAML／引用完整性通过；新模型的 migration 检查无遗漏。
- 新建迁移只在测试数据库执行；未导入历史数据、未部署或修改线上数据库。

截图：[集盒浅色](../assets/ui-v2/restoration/collection-light.png)、[集盒深色](../assets/ui-v2/restoration/collection-dark.png)、[桌面编辑](../assets/ui-v2/restoration/collection-desktop.png)、[录音浅色](../assets/ui-v2/restoration/recording-light.png)、[录音深色](../assets/ui-v2/restoration/recording-dark.png)。

可重复浏览器检查：`cd frontend && npx playwright test --config=playwright.restoration.config.js`。
也可用已构建的静态 H5 预览设置 `VISUAL_REVIEW_EXTERNAL=1`，并用 `VISUAL_REVIEW_API_ORIGIN` 指定模拟 API 的源；测试不需要写业务数据库。

最终交付检查：前端 `npm run lint`、`npm run build:h5`、`npm run build:mp-weixin` 均通过，
后端与新增契约检查脚本的 Black 检查通过，`git diff --check` 通过。两端构建仍有仓库既有
Browserslist 数据更新提示，本地依赖较锁文件旧且本机 Node 不满足重新安装要求；PR 的干净 CI 环境中严格构建已通过。微信小程序验证范围为编译及持久文件接口测试，
未进行真机录音授权测试。

## PR #408 自审修复

由 OpenAI Codex 按独立审查标准执行自审，并非独立人工批准。

- P1：覆盖已有草稿时，新音频保存失败原先会删除旧音频。现在中止覆盖、保留原表单和音频，提示保留当前页面重试；已添加服务层回归测试。
- P1：小程序 saveFile 移动临时文件后，索引写入失败原先会删除新文件。现在将永久路径交回录音页保留，并以该路径重试；服务层和页面重试测试均覆盖。
- 清理已压缩合并的 #396 历史，本 PR 只包含功能回归及自审修复，并保留 main 的音频处理、审计降级修复。
- P2：账户页新增集盒／草稿入口补齐键盘焦点与 Enter／Space 触发，更新旧的两入口断言，并验证新入口实际跳转。
- P2：手机横屏中发现按钮占用额外一行，遮挡空态操作；页头与发现按钮改为横屏并排，恢复完整可见的空态区域。保留原有可见高度断言，不放宽阈值。

## 2026-09-07 二次代码核对与补缺

以 `a3c3491^` 的路由、views 动作、canDrafts/canSocial 服务和录制页生命周期为依据逐项核对，补齐三个此前没有等价实现的能力：

| v1 证据 | v2 缺口 | 本轮处理 |
| --- | --- | --- |
| cans/create 的 onHide/onUnload → persistDirtyDraft 与串行保存队列 | 只有显式保存和提交失败保存，直接离页会丢掉修改 | 编辑防抖保存，离页补存，串行写入；已提交的草稿不会因离页重建；保存途中更换音频不覆盖新选择 |
| canDrafts.listCanDraftsWithAudioStatus | 草稿箱只凭 persisted 标志报告“已保存音频” | 实际查询 IndexedDB／小程序永久文件；失效时仍保留表单并显示可补录状态 |
| canSocial.listNameplateComments/createNameplateComment 与 nameplates/comments | 只有录音评论，无法讨论词条本身 | Entry 评论直接归属词条，与 Recording 评论共用存储、回复／点赞／通知与前端组件；数据库约束一条评论只能有一种目标 |

其余删除路由按用户任务核对：Shelf → 词条目录集盒；Flavor/Package/Pronunciation/Nameplate 的查询、读音和整理 → Entry、WritingForm、PronunciationVariant、Evidence 与整理台；Can 详情／列表／草稿／素材库 → Recording、听、个人贡献与草稿；发现／搜索 → 听和查。旧 Post、用同款、支持选主仍按已确认边界不恢复。原有圈子、关注、账户、装扮、消息和认证页面未退役，继续使用现有实现。

本轮不读取旧草稿、不迁移旧评论。评论扩展保留当前 RecordingComment 表与内容类型，以免已产生的通知和录音评论失联；新增 entry 可空字段并对两种归属施加互斥非空约束。词条接口为 `/entry-comments/`，原 `/recording-comments/` 保持兼容且不串读。

旧录制页的最近地区偏好已由当前 DialectSelector 的账号隔离最近选择承接，经代码核对无需另建存储或入口。

本轮验证：完整后端 211 项通过；完整前端 79 文件／511 项通过，最终含账号切换的 19 项草稿／讨论相关用例通过；浏览器 8 项恢复路径和 8 项账户回归通过，包含词条讨论明暗主题发送、编辑自动保存、立即打开草稿箱。H5／小程序构建、lint、API 契约、迁移漂移及 Black 检查通过。小程序真机录音授权未覆盖；本机旧 Browserslist 数据仍有提示。
