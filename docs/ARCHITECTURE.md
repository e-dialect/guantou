# 乡声集盒架构说明

## 运行时领域

当前运行时以 `Entry` 和 `Recording` 为两个独立中心。`Entry` 表示同一个词及其读音
身份；`EntrySense` 表示同词条下的相关编号义；`WritingForm` 保存汉字、俗写、借字、
拟音和罗马字；`Concept` 只连接 WALK、RUN 等跨词条概念。

`PronunciationVariant` 把 Entry 与方言树上的一个已知范围关联。`Recording` 保存音频、
录制者、使用地区、类型和贡献者原始大意，不保存设备位置。`RecordingEntryLink` 以
`primary / mention / competing` 表达一段录音和多条词条之间的关系。`EvidenceRecord`
保留用户原话或文献原文，整理后的结构化结果不能覆盖它；`UsageAttestation` 记录地区
使用补证。

```text
WritingForm N ─ Entry 1 ─ N EntrySense N ─ N Concept
                       └─ N PronunciationVariant ─ 1 Dialect

Entry N ─ RecordingEntryLink ─ N Recording ─ 1 Dialect
             primary / mention / competing

EvidenceRecord ─ EvidenceLink ─ Entry / Sense / Variant / Recording / Link
```

词条可以没有录音，录音也可以在专业写法尚未确定时提交。“行走的行”和“银行的行”
是不同 Entry；“走＝步行”和“走＝奔跑”也可以独立存在。Concept 帮助发现相关词条，
不承担自动合并或裁决。

## 方言树

`Dialect` 是按需建立的语言变体层级，不是行政区划树。每一级都可直接选定；父节点只
表示贡献者目前知道的范围，不能反向推断所有后代地区都使用。API 默认精确筛选，只有
显式 `dialect_scope=subtree` 才包含后代。普通界面使用 `display_name` 和 `path_label`，
`qualified_code` 只服务于导入、解析和管理工具。

## API 与权限

业务接口直接挂载在根路径。读接口默认开放，写接口使用 Bearer 身份。对象贡献者可以
修订自己的初稿；词条整理员处理写法、分义、概念和拆合；地区整理员处理范围、地区读音
与录音关联。授权默认有期限，审核操作保存操作者、理由、前后快照和依据。

公开契约只包含 Entry / Recording V2。旧 Can、Nameplate、Flavor、Package、
Pronunciation、Shelf、Post、Comment 表作为迁移归档留在数据库中，但没有公开 router、
前端入口或自动按支持数/权重选主的活动路径。详见
[ADR-0007](adr/0007-retire-legacy-can-nameplate-runtime.md)。

## 前端边界

一级导航为“听 / 查 / 录 / 我”。页面只管理交互和导航；Entry/Recording 请求集中在
`src/services/entryRecording.js`，方言树和方言圈请求集中在 `src/services/guantou.js`，
底层统一经过 `src/utils/httpClient.js`。地区选择必须复用逐级选择器，允许停在父节点。

“我”是完整账户中心，覆盖资料、设置、关注收藏和贡献履历；只有已授权用户显示整理入口
和待办。普通贡献以录音、补证、修订和地区足迹呈现，不使用积分等级暗示语言权威。

## 基础设施

账户、公告、站内通知、文件、站点配置、审计、主题和产品分析仍由各自 Django app
负责。能力是否可用取编译能力与服务端开关的交集；产品事件明细最多保留 90 天，长期只
保留日汇总。异常响应统一为 `{ message, code, data, request_id }`，并在响应头回传
`X-Request-ID`。
