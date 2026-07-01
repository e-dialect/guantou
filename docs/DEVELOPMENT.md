# 开发指南

## 运行环境

- Python 3.12
- Node.js 22
- Yarn
- Docker Compose
- ffmpeg

后端位于 `backend/guantou`，前端位于 `frontend`。根目录负责 Docker、CI、文档和部署。

## Docker 开发

```bash
cp .env.example .env
docker compose up --build
```

默认地址：

- 前端：`http://localhost:8181`
- 后端：`http://localhost:8000`

后端 SQLite、媒体文件和日志挂载在 `data/backend/`。Docker H5 默认通过同源 `/api/` 访问后端；如果要模拟独立 API 子域名，可设置 `FRONTEND_BACKEND_URL`。

## 后端本地运行

```bash
cd backend/guantou
python3.12 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
python manage.py migrate
python manage.py runserver
```

新业务代码优先放在 `guantou` app。`announcements` 只负责站内公告；`siteconfig` 负责后台可编辑的运营配置；邮箱验证码归入 `user`，文件上传归入 `files`，站内通知归入 `inbox`。部署环境变量仍由 `config/settings.py` 读取，不放入数据库。

## 前端本地运行

```bash
cd frontend
yarn install --frozen-lockfile --production=false
yarn dev:h5
```

默认 API 地址为 `http://localhost:8000`。需要覆盖时设置：

```bash
VITE_BACKEND_URL=http://localhost:8000 yarn dev:h5
```

新页面优先使用 `src/services/guantou.js` 调用 `/api/` 资源接口，不再引入词典式旧客户端流程。

## 前端工具边界

`src/utils/httpClient.js` 是统一请求内核。`src/utils/request.js` 和 `src/utils/rawRequest.js` 保留为兼容包装：

- `request`：用于普通业务请求，默认带 token，错误会提示，401 会跳登录。
- `rawRequest`：用于登录、注册、刷新 token 等流程，默认带 token，但错误静默，不自动跳登录。

登录、注册、微信登录/注册等公开入口必须显式传 `{ auth: false }`，避免浏览器或小程序本地残留的旧 token 污染 public 请求。刷新 token、加载当前用户信息等需要登录态的流程继续使用默认 `auth: true`。

`src/polyfill` 和 `src/utils/u-parse` 是旧 uni-app 迁移兼容层。它们不是 uni-app 编译微信小程序的必需依赖；删除前必须先确认源码不再依赖对应能力，并通过 H5、mp-weixin 构建和 H5 E2E。
