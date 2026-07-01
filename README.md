# 方言罐头

方言罐头是一个多方言语音采集与校验客户端。

它不再把“词条”当成唯一中心，而是把一段具体录音称为“罐头”，把用户对这段录音的写法、释义、来源判断称为“铭牌”。多个铭牌可以竞争同一个罐头的主展示，风味负责承载可复用的义项/概念，包装负责承载正字、借字、俗写、拟音等文字入口。

## 当前结构

- 后端新增 `guantou` 业务 app，核心实体为 `Can / Nameplate / Flavor / Package / Dialect / Shelf`。
- API 新入口为 `/api/`，使用 Django REST Framework 的 `ModelViewSet` 和 router。
- 前端第一屏改为“货架 / 装罐 / 图鉴 / 我的”，新增装罐、罐头详情、图鉴、货架页面。
- 本仓库按新项目初始化处理，不保留旧词典 API 或旧迁移命令；少量前端迁移兼容层仅在测试保护下暂存。

## 文档

- [架构说明](docs/ARCHITECTURE.md)
- [API 约定](docs/API.md)
- [开发指南](docs/DEVELOPMENT.md)
- [测试说明](docs/TESTING.md)
- [部署说明](docs/DEPLOYMENT.md)
- [贡献说明](CONTRIBUTING.md)

## Docker 启动

根目录是唯一 Docker 入口：

```bash
cp .env.example .env
docker compose up --build
```

默认访问：

- 前端：http://localhost:8181
- 后端：http://localhost:8000

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
- 风味是义项核心：多义词必须能拆成多个风味，避免一个字头混杂多个意思。
- 方言点是树：查父级包含子方言，查子级不自动上溯。
- AI 可以成为后续“推荐贴纸”，但 v1 不让 AI 裁判正字。
