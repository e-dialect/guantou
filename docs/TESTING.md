# 测试说明

## 后端

```bash
cd backend/guantou
python manage.py check
python manage.py makemigrations --check --dry-run
python manage.py test guantou announcements user siteconfig files inbox
black --check announcements guantou user siteconfig files inbox utils config
```

当前主测试范围包括核心 `guantou` DRF API，以及公告、用户、站点配置、文件和通知边界。旧 Apifox JSON 集合不再作为新仓库验收入口。

## 前端

```bash
cd frontend
yarn lint
yarn test:unit
yarn build
yarn build:mp-weixin
```

前端单测使用 Vitest。当前重点覆盖请求兼容层，保证 `request` 与 `rawRequest` 的静默、跳登录和 token 语义不会被误改。H5 构建和 mp-weixin 构建都作为基础门槛。

## H5 E2E

```bash
docker compose up -d --build
cd frontend
yarn test:e2e:h5
```

H5 E2E 使用 Playwright，默认访问 `http://localhost:8181`。测试覆盖首页渲染、站点配置代理、受保护 API 的未登录行为和主要页面可达性。

## Docker

```bash
docker compose config
docker compose build backend frontend
```

根目录 compose 必须能直接构建后端和前端镜像。后端镜像使用 Python 3.12，容器启动时自动执行数据库迁移。

## 根目录快捷命令

```bash
make backend-check
make frontend-check
make docker-check
make check
```

## 手动验收

- 装罐：创建罐头并填写方言点、普通话概念、候选写法、证据来源。
- 贴铭牌：给无铭牌罐头新增铭牌，并验证主铭牌选择。
- 搜索：通过包装文字进入风味列表，再进入风味详情。
- 详情：罐头详情展示主铭牌、异议铭牌、方言点和录音信息。
