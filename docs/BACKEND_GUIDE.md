# 后端开发指南

> 本文记录当前代码结构。核心方言、读音、罐头、铭牌和错误处理已经按预期 API v1 落地；尚未覆盖的路径仍以 [`API.md`](API.md) 的契约和实现进度为准。

后端使用 Django + Django REST Framework。目录来自旧 `hinghwa-dict-backend`，但现在是单仓库结构：旧系统能力继续可用，新罐头体系优先走 `guantou` app 和根路径资源 router。

## 目录结构

```text
backend/guantou/
  config/          Django 项目配置、根路由、settings。
  guantou/         新罐头体系：罐头、铭牌、读音、义项、写法、集盒、方言点。
  user/            账户、登录、token、资料设置、旧用户接口。
  announcements/   公告。
  siteconfig/      站点配置。
  files/           文件上传和公开文件访问。
  inbox/           通知/站内信。
  utils/           跨 app 工具，包含全局异常类型和中间件。
```

`tools/materials/` 在仓库根目录下，不属于 Django 运行路径。方言材料清洗、旧词典迁移脚本放那里，不要塞进 Django app。

## App 边界

不要再强制所有后端代码都放进 `guantou` app。按领域划分：

- 罐头、铭牌、义项、写法、集盒、方言点：`guantou`
- 用户、登录、资料、token：`user`
- 文件上传和访问：`files`
- 通知：`inbox`
- 公告：`announcements`
- 站点配置：`siteconfig`
- 材料处理和迁移脚本：`tools/materials/`

方言点统一使用 `guantou.Dialect` 的按需关系树。用户资料的默认方言也通过 `primary_dialect_id` 引用这棵树；迁移前县镇文本只保存在不可编辑的 `legacy_location` 中用于追溯，不再作为业务分类依据。

新增 app 需要有真实领域边界，例如“审核工作流”未来可能独立；不要因为只有一个视图或一个搜索函数就新增 app。聚合搜索如果只是跨现有实体查询，优先放在已有实体 app 的 API 层或服务层，不要为了它单独建 `search` app。

## 请求流

推荐结构：

```text
config/urls.py
  -> app/urls.py 或 DRF router
  -> views.py / ViewSet
  -> serializers.py
  -> services.py（复杂业务时）
  -> models.py
```

简单 CRUD 可以直接由 ViewSet + Serializer 完成。出现下面情况时再加 `services.py`：

- 一个操作同时创建多个模型。
- 有复杂状态流转。
- 需要复用同一段业务逻辑。
- 需要把视图层从导入/清洗/投票等细节中解放出来。

## API 路由

当前根路由在 `backend/guantou/config/urls.py`。

新罐头体系资源挂在根路径，不使用 api 前缀：

```text
/cans/
/flavors/
/pronunciations/
/packages/
/nameplates/
/shelves/
/dialects/
```

这些资源由 `backend/guantou/guantou/urls.py` 的 DRF `DefaultRouter` 暴露。新增同类实体时，优先注册到这个 router。

旧系统接口仍保留根路径：

```text
/users
/login
/announcements
/site-settings/
/files
/notifications
```

不要随意迁移旧接口路径，否则会影响现有客户端。新增罐头体系接口继续使用根路径资源名，不要再新增 api 前缀，避免 API 风格继续分裂。

## 认证与权限

DRF 默认配置在 `config/settings.py`：

- `BearerTokenAuthentication`：读取 `Authorization: Bearer <jwt>`。
- `SessionAuthentication`：保留 Django 会话认证。
- `IsAuthenticatedOrReadOnly`：默认读开放，写需要登录。
- 默认分页：`ApiPageNumberPagination`，每页 15 条，允许通过 `page_size` 调整，最大 100 条。

具体 ViewSet 可以覆盖全局权限。例如 `Can`、`Nameplate`、`Flavor`、`Pronunciation`、`Shelf` 使用 `IsOwnerOrAdmin` 限制修改/删除只能由创建者或管理员执行；支持铭牌、贴铭牌、状态流转等 action 也会单独声明权限。Nameplate 查询必须经过其 Can 的可见性过滤，不能因独立集合或 Pronunciation 证据嵌套泄露私有录音。

匿名游客由 `audit.AnonymousVisitor` 追踪。后端读取或生成 `X-Visitor-ID`，挂到 `request.visitor`，并在响应头回写同名 header。游客只用于访问/审计归因，不创建 Django `User`，也不能绕过写接口登录要求。

对象审计由 `audit.ObjectChangeLog` 自动记录 `guantou` 核心模型的 create/update/delete。访问行为由 `audit.VisitorEvent` 记录；`Can.views` 这类读取计数更新不会写入对象变更审计。

## 全局异常行为

全局异常中间件是 `utils.exceptions.middleware.ExceptionMiddleware`，注册在 `config/settings.py` 的 `MIDDLEWARE` 末尾。

当前行为：

- `EmptyPage` 转成 `BadRequestException`。
- `KeyError` 转成缺少必要参数的 400 响应。
- `ValueError` 转成参数值异常的 400 响应。
- `CommonException` 及其子类直接返回自己的 JSON 响应。
- DRF `ValidationError`、认证失败、权限不足、404 等由 `utils.exceptions.handler.drf_exception_handler` 归一化。
- 未识别异常会写入后端日志，然后返回 `CommonException` 的 500 响应。

异常响应统一使用 v1 字段：

```json
{
  "code": 400,
  "message": "错误信息",
  "data": {},
  "request_id": "..."
}
```

字段校验错误直接位于 `data.<field>`，形如 `{"code": "required", "message": "该字段是必填项。"}`；嵌套输入保持嵌套。未处理异常只在服务端日志保留原文，500 客户端响应固定为通用消息并携带 `request_id`。

生产默认 `DEBUG=false`；包括非 DRF 404 在内的所有 HTTP 错误都由异常中间件转换为 JSON。仅在本地 `.env` 显式设置 `DEBUG=true`。

`ExceptionMiddleware` 会为请求生成或透传 `X-Request-ID`，并把它写回响应头；排查线上问题时，前端和后端都应保留这个 id。

业务代码里不要临时返回另一套错误格式。需要表达业务错误时，优先使用 `utils.exceptions.types` 下的类型：

- `BadRequestException`
- `UnauthorizedException`
- `ForbiddenException`
- `NotFoundException`
- `ConflictException`
- `CommonException`

如果必须直接返回 `Response`，只用于成功响应或已经约定好的业务数据；错误分支优先抛统一异常，让前端 service 层拿到稳定结构。

## 模型与迁移

修改 `models.py` 后必须运行：

```bash
cd backend/guantou
python manage.py makemigrations --check --dry-run
```

如果命令提示需要迁移文件，就正常生成 migration 并提交。不要手改数据库，也不要为了绕过迁移检查临时修改 settings。

模型字段建议：

- 状态字段使用 `choices`。
- 用户可见文案和代码枚举分开。
- 外键要想清楚删除行为，默认不要随意 `CASCADE` 删除用户内容。
- 查询常用字段可以加索引，但要在 PR 里说明查询场景。

`0004_api_v1_domain_model` 是有数据迁移的领域切换：旧 `FlavorVariant` 迁为 `Pronunciation`，旧 `Can.flavor_variant` 迁为 Nameplate attestation，旧方言行政字段进入 legacy metadata。后续不得重新引入这些旧字段；历史草稿兼容只允许存在于前端恢复边界。

`Dialect` 不设置固定层级 `kind`；粒度由按需父子树表达。`Pronunciation` 分别保存 `base_romanization` 与 `surface_romanization`，变调环境才进入 `sandhi_info`。

## 测试建议

按风险选择测试范围：

- 只改文档：`git diff --check`
- 改 serializer/view：至少跑对应 app 测试。
- 改模型/权限/异常：跑全后端测试。
- 改全局配置：跑 `python manage.py check` 和相关集成测试。

常用命令：

```bash
cd backend/guantou
python manage.py check
python manage.py makemigrations --check --dry-run
python manage.py test guantou announcements user siteconfig files inbox audit
black --check announcements guantou user siteconfig files inbox audit utils config
```

## 什么时候先写方案

下面这些不要直接开大 PR：

- 新增 Django app。
- 改 API 路径策略。
- 改全局异常响应格式。
- 改认证方式。
- 大规模迁移旧词典数据。
- 引入新依赖或新存储服务。

先在 issue 里写清楚背景、目录归属、兼容性、测试计划，维护者确认后再实现。
