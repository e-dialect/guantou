# 贡献说明

方言罐头是由原前后端仓库合并后的单一仓库。新功能应优先围绕根目录文档和 `guantou` 新实体实现，旧 `word`、`pronunciation` 等模块仅作为迁移来源和历史参考。

## 分支与提交

- 分支命名建议使用 `feat/...`、`fix/...`、`docs/...`、`refactor/...`。
- 提交信息建议使用 `type(scope): summary`，例如 `feat(cans): add nameplate voting`。
- 常用类型：`feat`、`fix`、`docs`、`test`、`refactor`、`build`、`ci`、`chore`。

## 本地检查

后端：

```bash
cd backend/guantou
python manage.py check
python manage.py makemigrations --check --dry-run
python manage.py test guantou announcements user siteconfig files inbox
black --check announcements guantou user siteconfig files inbox utils config
```

前端：

```bash
cd frontend
yarn lint
yarn test:unit
yarn build
yarn build:mp-weixin
```

Docker：

```bash
docker compose config
docker compose build backend frontend
```

也可以在根目录运行：

```bash
make check
```

## 旧系统约束

- 不再为旧 `/words`、`/pronunciation` API 增加新客户端功能。
- 涉及旧数据导入时，先更新 `docs/MIGRATION.md`，再调整迁移命令。
- 新文档只维护根目录 `README.md` 和 `docs/`，不要在子仓库目录继续新增分散说明。
