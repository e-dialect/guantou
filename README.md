# 乡声集盒

[![Ask DeepWiki](https://deepwiki.com/badge.svg)](https://deepwiki.com/e-dialect/guantou)

乡声集盒是一个多方言语音采集与校验客户端。

它不再把“词条”当成唯一中心，而是把一段具体录音称为“罐头”，把用户对这段录音的写法、义项、释义、来源判断称为“铭牌”。多个铭牌可以竞争同一个罐头的主展示，`Flavor` 负责承载可复用的义项/概念，`Package` 负责承载正字、借字、俗写、拟音等写法入口。

## 当前结构

- 后端新增 `guantou` 业务 app，核心实体为 `Can / Nameplate / Flavor / Package / Dialect / Shelf`。
- 资源实体 API 使用根路径，例如 `/cans/`、`/flavors/`、`/packages/`，并由 Django REST Framework 的 `ModelViewSet` 和 router 暴露。
- 前端第一屏改为“集盒 / 装罐 / 图鉴 / 我的”，新增装罐、罐头详情、图鉴、集盒页面。
- 本仓库按新项目初始化处理，不保留旧词典 API；材料处理脚本按地域归档在 `tools/materials/`，少量前端迁移兼容层仅在测试保护下暂存。

## 文档

- [产品设计](docs/PRODUCT_DESIGN.md)
- [历史视觉/交互参考](docs/references/README.md)
- [架构说明](docs/ARCHITECTURE.md)
- [API 约定](docs/API.md)
- [开发指南](docs/DEVELOPMENT.md)
- [测试说明](docs/TESTING.md)
- [部署说明](docs/DEPLOYMENT.md)
- [贡献说明](CONTRIBUTING.md)

协作提交请遵循 [贡献说明](CONTRIBUTING.md) 中的 Conventional Commits 风格提交信息：`type: summary` 或 `type(scope): summary`。

## Docker 启动

普通 Docker Compose 会启动前端静态 nginx 和后端 Django，前端通过 `FRONTEND_BACKEND_URL` 访问后端：

```bash
cp .env.example .env
docker compose up --build
```

默认访问：

- 前端：http://localhost:8181
- 后端：http://localhost:8000

如果想用单入口同源路由，可以启动 Traefik 版本：

```bash
docker compose -f docker-compose.traefik.yml up --build
```

默认访问 `http://localhost:8181`，Traefik 会把资源接口转发到后端，把其余路径转发到前端静态站点。

后端容器启动时会自动执行数据库迁移，运行数据默认挂载到 `data/backend/`。

## 本地开发

后端使用 Python 3.12：

```bash
cd backend/guantou
python3.12 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
python manage.py migrate
python manage.py runserver
```

前端使用 Node 22 和 Yarn：

```bash
cd frontend
yarn install --frozen-lockfile --production=false
yarn dev:h5
```

根目录可一键安装开发依赖：

```bash
make setup
```

## 测试

```bash
cd backend/guantou
python manage.py test guantou announcements user siteconfig files inbox
black --check announcements guantou user siteconfig files inbox utils config

cd ../../frontend
yarn lint
yarn test:unit
yarn build
yarn build:mp-weixin

cd ..
docker compose config
```

## 产品原则

- 罐头是数据原子：一段声音先被保存下来，即使正字暂时不确定。
- 铭牌是社区主张：不同写法、释义、证据可以共存，权重最高者成为主铭牌。
- `Flavor` 是义项核心：多义词必须能拆成多个义项，避免一个字头混杂多个意思。
- `Package` 是写法入口：同一个写法可以连接多个义项，同一个义项也可以有多个写法。
- 方言点是树：查父级包含子方言，查子级不自动上溯。
- AI 可以成为后续“推荐贴纸”，但 v1 不让 AI 裁判正字。
