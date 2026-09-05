# 测试说明

## 后端

```bash
cd backend/guantou
python manage.py check
python manage.py makemigrations --check --dry-run
python manage.py test config guantou announcements user siteconfig files inbox audit themes
black --check announcements guantou user siteconfig files inbox audit utils config themes
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

H5 E2E 使用 Playwright，默认访问 `http://localhost:8181`。普通 Docker Compose 下，`yarn wait:e2e:h5` 会等待 H5 首页、后端能力接口和 Recording API 都可访问，避免容器冷启动时前端 nginx 已启动但 Django 仍在迁移导致测试过早开始。测试覆盖“听 / 查 / 录 / 我”、受保护 API 的未登录行为和主要页面可达性。

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

- 录：只填录音、地区和大意即可提交；写法与音标可选。
- 查：同形异读异义返回不同 Entry，无录音词条显示待补音。
- 关联：同一 Recording 可关联 primary、mention 和 competing Entry。
- 方言树：可停在“莆仙方言”，也可继续到城里；普通页面不显示限定码。
- 用户资料：默认方言引用树节点、旧县镇资料可追溯，公开资料不泄露联系方式。
- 读音证据：PronunciationVariant 关联 Entry 与地区，EvidenceRecord 保留原文。
- 异常：字段错误直接映射 `data.<field>.code/message`，500 不返回原异常字符串。
- 治理：授权过期即失效，整理动作保留理由、前后快照和依据。
- 账户：收藏私有，贡献履历不显示积分等级或权威称号。
