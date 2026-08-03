# 身份、游客与审计开发指南

这份文档给新贡献者使用：需要写接口、调接口、判断权限、追踪游客或理解对象历史时，先看这里。

## 前端如何调用

普通业务请求只走 `frontend/src/utils/request.js` 或 `frontend/src/utils/rawRequest.js`，不要在页面里直接写 `uni.request`。

- `request`：默认带登录态，错误会 toast，401 会跳登录页。
- `rawRequest`：默认带登录态，但静默处理错误，适合登录、注册、刷新 token、页面自己处理错误的流程。
- 公开入口必须传 `{ auth: false }`，例如登录、注册、微信登录。

请求层会自动处理两类 header：

```http
Authorization: Bearer <token>
X-Visitor-ID: <visitor uuid>
```

`Authorization` 来自本地 `token`。`X-Visitor-ID` 来自本地 `visitor_id`；如果后端返回新的 `X-Visitor-ID`，前端会自动保存并用于后续请求。

示例：

```js
import request from '@/utils/request';
import rawRequest from '@/utils/rawRequest';

export function listCans(params) {
  return request.get('/cans/', params);
}

export function login(username, password) {
  return rawRequest.post('/login', { username, password }, { auth: false });
}
```

## 后端如何认证用户

后端只接受标准 Bearer token，不再接受 legacy `token` header。

DRF ViewSet 默认通过 `guantou.authentication.BearerTokenAuthentication` 写入 `request.user`。新写 DRF 接口时优先使用 DRF 权限类：

```python
from rest_framework import permissions, viewsets


class ExampleViewSet(viewsets.ModelViewSet):
    permission_classes = [permissions.IsAuthenticatedOrReadOnly]
```

旧式 Django `View` 或 function view 需要手动读当前用户时，使用 `user.tokens` 的统一工具：

```python
from user.tokens import get_request_user, check_request_user


def get(self, request, id):
    user = get_request_user(request)
    if not user.is_authenticated:
        ...


def put(self, request, id):
    user = check_request_user(request, id)
```

不要再使用：

```python
request.headers.get("token")
request.headers["token"]
```

## 权限约定

- 游客可以读公开内容。
- 游客不能创建罐头、铭牌、投票、上传文件或执行管理操作。
- 普通登录用户只能修改自己拥有的对象。
- `is_staff` 或 `is_superuser` 用户可执行对应管理操作。
- `Can`、`Nameplate`、`Flavor` 这类对象级权限优先复用 `IsOwnerOrAdmin`。

如果一个接口有特殊权限，不要改全局 settings；在 ViewSet 或 action 上显式声明 `permission_classes`，或者在旧式 view 中调用统一 token 工具。

## 游客追踪

游客不是 Django `User`。后端通过 `audit.AnonymousVisitor` 记录匿名身份：

- 请求带合法 `X-Visitor-ID` 时复用该 visitor。
- 请求未带或格式不合法时生成新 visitor。
- 响应头回写 `X-Visitor-ID`。
- 只保存 IP hash，不保存明文 IP。
- 不记录请求体。

`audit.VisitorEvent` 会记录 API 访问：

- visitor
- 登录 user
- method
- path
- status_code
- request_id
- duration_ms
- created_at

不会记录 admin、static、media、OPTIONS 请求。

## 对象审计

`audit.ObjectChangeLog` 通过 Django signals 自动记录 `guantou` 核心模型的 `create`、`update`、`delete`。

当前追踪模型：

- `Can`
- `Nameplate`
- `Flavor`
- `FlavorVariant`
- `Package`
- `Dialect`
- `Shelf`
- `NameplateSupport`

每条日志记录：

- 对象类型和对象 id
- action
- changed_fields
- before / after 快照
- actor_user
- actor_visitor
- request_id
- created_at

注意事项：

- `Can.views` 读取计数不会进入对象审计；访问记录看 `VisitorEvent`。
- v1 不追踪 ManyToMany 关系变更。
- `QuerySet.update()` 不会触发 Django `save()` signals。修改被审计模型时，优先使用实例赋值加 `save()`。
- 批量导入、数据清洗、管理后台特殊动作如果需要标记来源，后续应扩展审计上下文，不要临时写另一套日志。

## 新接口检查清单

提交新接口前确认：

- 前端没有直接调用 `uni.request`。
- 登录态请求没有手写 `Authorization`。
- 公开请求显式传了 `{ auth: false }`。
- 后端没有读取 legacy `token` header。
- 写接口有明确权限类或 `check_request_user(...)`。
- 被审计模型没有用 `QuerySet.update()` 绕过 signal。
- 测试覆盖成功、未登录、权限不足三类路径。

常用验证：

```bash
cd backend/guantou
python manage.py check
python manage.py makemigrations --check --dry-run
python manage.py test guantou announcements user siteconfig files inbox audit
black --check announcements guantou user siteconfig files inbox audit utils config

cd ../../frontend
yarn lint
yarn test:unit
```
