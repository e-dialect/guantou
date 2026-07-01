# 部署说明

## 本地/单机 Docker

```bash
cp .env.example .env
docker compose up --build
```

主要环境变量：

- `BACKEND_PORT`：后端映射端口，默认 `8000`。
- `FRONTEND_PORT`：前端映射端口，默认 `8080`。
- `FRONTEND_BACKEND_URL`：前端运行时访问的后端地址；留空时使用同源 `/api/`，由前端 nginx 代理到后端容器。独立后端子域名部署时可设置为 `https://api.example.com`。
- `SECRET_KEY`、`JWT_KEY`：Django 和旧 token 兼容所需密钥。
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
