# 后端开发指南

后端使用 Django + Django REST Framework。目录来自旧 `hinghwa-dict-backend`，但现在是单仓库结构：旧系统能力继续可用，新罐头体系优先走 `guantou` app 和 `/api/` router。

## 目录结构

```text
backend/guantou/
  config/          Django 项目配置、根路由、settings。
  guantou/         新罐头体系：罐头、铭牌、义项、写法、集盒、方言点。
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

新罐头体系资源挂在 `/api/`：

```text
/api/cans/
/api/flavors/
/api/flavor-variants/
/api/packages/
/api/nameplates/
/api/shelves/
/api/dialects/
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

不要随意迁移旧接口路径，否则会影响现有客户端。新增罐头体系接口也不要再新增根路径，避免 API 风格继续分裂。

## 认证与权限

DRF 默认配置在 `config/settings.py`：

- `HeaderTokenAuthentication`：复用旧系统 `token` header。
- `SessionAuthentication`：保留 Django 会话认证。
- `IsAuthenticatedOrReadOnly`：默认读开放，写需要登录。
- 默认分页：`PageNumberPagination`，每页 15 条。

如果某个接口必须公开写入或完全禁止匿名读，不要在全局 settings 里改，应该在具体 ViewSet 上显式声明 `permission_classes`。

## 全局异常行为

全局异常中间件是 `utils.exceptions.middleware.ExceptionMiddleware`，注册在 `config/settings.py` 的 `MIDDLEWARE` 末尾。

当前行为：

- `EmptyPage` 转成 `BadRequestException`。
- `KeyError` 转成缺少必要参数的 400 响应。
- `ValueError` 转成参数值异常的 400 响应。
- `CommonException` 及其子类直接返回自己的 JSON 响应。
- 未识别异常会打印 `repr(exception)`，然后返回 `CommonException` 的 500 响应。

异常响应当前使用统一字段：

```json
{
  "msg": "错误信息"
}
```

业务代码里不要临时返回另一套错误格式。需要表达业务错误时，优先使用 `utils.exceptions.types` 下的类型：

- `BadRequestException`
- `UnauthorizedException`
- `ForbiddenException`
- `NotFoundException`
- `CommonException`

注意：DRF serializer validation error 会先由 DRF 处理，格式可能不是 `{"msg": ...}`。如果后续要进一步统一 DRF 异常，应该单独做一个小 PR，补测试后再改全局行为。

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
python manage.py test guantou announcements user siteconfig files inbox
black --check announcements guantou user siteconfig files inbox utils config
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
