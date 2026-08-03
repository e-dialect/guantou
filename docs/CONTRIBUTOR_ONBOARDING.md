# 新手贡献路线图

这份文档给第一次参与乡声集盒的人看。目标不是让你一次理解全部代码，而是帮你知道“我现在该看哪里、改哪里、跑什么检查”。

## 先理解三个原则

1. 乡声集盒不是旧词典的简单搬家。新功能优先围绕 `Can`（罐头）、`Nameplate`（铭牌）、`Flavor`（义项）、`Package`（写法）、`Shelf`（集盒）这些实体展开。
2. 页面、接口、脚本都要放在稳定位置。不要为了一个 issue 随手新建一套请求工具、异常格式或目录结构。
3. 大 issue 可以只完成基础骨架。PR 描述里写清楚“本次完成了什么、哪些细节留给后续贡献者”，比强行关闭 issue 更可靠。

## 按难度选任务

### Level 1：适合第一次 PR

适合内容：

- 修正文案、链接、空态提示。
- 调整一个页面的小样式。
- 补充文档里的目录说明或操作步骤。
- 给已有函数补一个小测试。

需要阅读：

- `CONTRIBUTING.md`
- 你要修改的那个文件附近 1 到 2 个相似文件。

本地检查通常跑相关部分即可，例如只改文档可以跑 `git diff --check`。

### Level 2：适合已经能看懂 Vue 页面的人

适合内容：

- 新增一个列表页、详情页或表单页。
- 把重复 UI 抽成组件。
- 给现有页面接入一个已有服务函数。
- 给搜索、罐头列表、铭牌表单等用户流程补状态。

需要阅读：

- `docs/FRONTEND_GUIDE.md`
- `frontend/src/services/guantou.js`
- 一个相似页面，例如 `frontend/src/pages/cans/index.vue` 或 `frontend/src/pages/flavors/details.vue`

提交前尽量跑：

```bash
cd frontend
yarn lint
yarn test:unit
yarn build
```

### Level 3：适合会 Django/DRF 的贡献者

适合内容：

- 新增或调整 `guantou` 里的实体接口。
- 修改序列化字段、分页、过滤或权限。
- 给全局异常、认证、文件上传等基础能力补测试。

需要阅读：

- `docs/BACKEND_GUIDE.md`
- `docs/ARCHITECTURE.md`
- 相关 app 的 `models.py`、`serializers.py`、`views.py`、`urls.py`

提交前尽量跑：

```bash
cd backend/guantou
python manage.py check
python manage.py makemigrations --check --dry-run
python manage.py test guantou announcements user siteconfig files inbox
black --check announcements guantou user siteconfig files inbox utils config
```

### Level 4：适合熟悉数据和架构的人

适合内容：

- 旧词典数据迁移。
- 方言材料清洗和导入。
- 新 Django app 边界设计。
- 跨前后端的数据流重构。

需要阅读：

- `docs/ARCHITECTURE.md`
- `docs/PRODUCT_DESIGN.md`
- `tools/materials/README.md`
- 相关旧仓库只作历史参考，不直接复制结构。

这类任务建议先在 issue 里写方案，得到维护者确认后再实现。

## 一个页面 PR 应该怎么做

1. 找一个相似页面照着改，例如列表页看 `pages/cans/index.vue`，详情页看 `pages/cans/details.vue`。
2. 如果要请求后端，先在 `frontend/src/services/` 增加或复用服务函数，页面不要直接写 `uni.request`。
3. 页面至少处理加载中、空结果、请求失败、成功跳转这几类状态。
4. 如果出现第二处相同 UI，再考虑抽到 `frontend/src/components/`。
5. PR 描述里写清楚手测路径，例如“首页进入罐头列表，点击第一条进入详情”。

## 一个接口 PR 应该怎么做

1. 先确认实体属于哪个 app。罐头、铭牌、义项、写法、集盒优先在 `guantou`；账户在 `user`；通知在 `inbox`；文件在 `files`。
2. 新实体资源优先挂在根路径的 DRF router 下，例如 `/cans/`、`/flavors/`，历史账户/文件接口不要随意改路径。
3. 业务校验尽量放在 serializer 或 service，视图层负责组织请求和响应。
4. 抛业务错误时使用 `utils.exceptions.types` 下的异常类型，不要返回临时格式。
5. 修改模型后必须检查迁移。

## PR 描述模板

```markdown
## Summary
- 做了什么
- 为什么这样做

## Scope
- 本次覆盖哪些页面/接口
- 哪些 issue 只是提供骨架，没有关闭

## Test Plan
- 跑过的命令
- 手测路径

## Notes
- 留给后续贡献者的事项
```

## 不确定时怎么办

先保持改动小。开源协作里，一个清楚、可审、可继续迭代的小 PR，通常比一个试图一次解决所有问题的大 PR 更有价值。
