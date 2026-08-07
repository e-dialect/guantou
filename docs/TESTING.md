# 测试说明

## 后端

```bash
cd backend/guantou
python manage.py check
python manage.py makemigrations --check --dry-run
python manage.py test guantou announcements user siteconfig files inbox audit
black --check announcements guantou user siteconfig files inbox audit utils config
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
yarn wait:e2e:h5
yarn test:e2e:h5
```

H5 E2E 使用 Playwright，默认访问 `http://localhost:8181`。普通 Docker Compose 下，`yarn wait:e2e:h5` 会等待 H5 首页、后端站点配置接口和罐头 API 都可访问，避免容器冷启动时前端 nginx 已启动但 Django 仍在迁移导致测试过早开始。测试覆盖首页渲染、后端接口可达性、受保护 API 的未登录行为和主要页面可达性。

Traefik 域名分流模式可以用下面的环境变量手测同一套 E2E：

```bash
E2E_BASE_URL=http://guantou.localhost E2E_BACKEND_URL=http://api.guantou.localhost yarn test:e2e:h5
```

## Docker

```bash
docker compose config
docker compose build backend frontend
docker compose -f docker-compose.traefik.yml config
```

根目录 compose 必须能直接构建后端和前端镜像。后端镜像使用 Python 3.12，容器启动时自动执行数据库迁移。

## 材料处理工具

```bash
./backend/guantou/.venv/bin/python -m unittest discover tools/materials/tests
```

只测试无副作用的通用和地域纯函数。`tools/materials/*/legacy/` 中的历史脚本不进入 CI，除非补齐 fixture、参数化输入输出和单独依赖。

## 根目录快捷命令

```bash
make backend-check
make frontend-check
make docker-check
make materials-check
make check
```

## 手动验收

- 装罐：创建罐头并填写方言点、普通话概念、候选写法、证据来源。
- 贴铭牌：给无铭牌罐头新增铭牌，并验证主铭牌选择。
- 资料来源：分别创建创作者自述、口述和书籍铭牌，验证责任者与页码可查询。
- 方言树：按 `sort_order` 展开 `闽.莆仙.仙游.游洋`，验证旧 alias 仍可解析。
- 用户资料：默认方言引用树节点、旧县镇资料可追溯，公开资料不泄露联系方式。
- 读音证据：通过 Nameplate 把 Can 关联到 `Pronunciation(package, flavor, dialect)`，确认 Can 没有直接读音外键。
- 读音转写：分别提交本调与变调后罗马字，确认变调环境不能在缺少任一形式时写入。
- 异常：字段错误直接映射 `data.<field>.code/message`，500 不返回原异常字符串。
- 搜索：通过写法文字进入义项列表，再进入义项详情。
- 详情：罐头详情展示主铭牌、异议铭牌、方言点和录音信息。
