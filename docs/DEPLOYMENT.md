# 部署说明

## 普通 Docker Compose

```bash
cp .env.example .env
docker compose up --build
```

该模式下前端 nginx 只提供静态 H5，不反向代理后端。H5 默认访问 `FRONTEND_BACKEND_URL=http://localhost:8000`，适合本机开发和快速检查。

## Traefik 本地域名 Compose

```bash
cp .env.example .env
docker compose -f docker-compose.traefik.yml up --build
```

默认绑定本机 80 端口，并按域名分流：

- `http://guantou.localhost`：前端 H5。
- `http://api.guantou.localhost`：后端 Django。

Traefik 不按 path 前缀区分前后端，这样资源路径可以在后端域名下保持清晰，例如 `http://api.guantou.localhost/cans/`。前端 nginx 只提供静态文件，并通过 `try_files $uri $uri/ /index.html` 支持 Vue/uni-app H5 页面直达，例如 `http://guantou.localhost/pages/cans/index`。

如果本机 80 端口被占用，可以在 `.env` 中把 `TRAEFIK_PORT` 改成其他端口，例如 `8181`，访问地址也相应变成 `http://guantou.localhost:8181` 和 `http://api.guantou.localhost:8181`。

生产部署也建议采用这个职责划分：前端 nginx 只 serve 静态文件，Traefik 或其他网关统一负责后端路由、TLS、域名和中间件。不要在前端镜像里维护后端反向代理规则。

主要环境变量：

- `BACKEND_PORT`：后端映射端口，默认 `8000`。
- `FRONTEND_PORT`：前端映射端口，默认 `8181`。
- `TRAEFIK_PORT`：Traefik 本地入口端口，默认 `80`。
- `FRONTEND_BACKEND_URL`：普通 Compose 下前端运行时访问的后端地址，默认 `http://localhost:8000`。
- `TRAEFIK_FRONTEND_BACKEND_URL`：Traefik Compose 下前端运行时访问的后端地址，默认 `http://api.guantou.localhost`。生产独立后端子域名部署时可设置为 `https://api.example.com`。
- `SECRET_KEY`、`JWT_KEY`：Django 和旧 token 兼容所需密钥。
- `APP_SECRET`：微信小程序密钥；旧拼写 `APP_SECRECT` 暂时兼容，但不建议继续新增使用。
后端数据目录为 `data/backend/`。生产部署前应配置真实密钥、对象存储和邮件参数。

## GitHub Actions

- `.github/workflows/ci.yml`：默认 CI，执行后端、前端和 Docker 检查。
- `.github/workflows/deploy-cos.yml`：手动 H5 部署到腾讯云 COS，不自动触发。

## 手动 COS 部署

在 GitHub Actions 中手动运行 `Deploy H5 to Tencent COS`，填写：

- `target_prefix`：COS 目标前缀，例如 `guantou-preview/`。
- `backend_url`：H5 访问的后端 API 地址。

需要配置以下 secrets：

- `TENCENT_CLOUD_SECRET_ID`
- `TENCENT_CLOUD_SECRET_KEY`
- `TENCENT_CLOUD_BUCKET`
- `TENCENT_CLOUD_REGION`

旧 PR preview 和 master 自动部署不再启用。需要恢复时，应先确认新仓库域名、分支策略和 secrets，再新增自动触发规则。
