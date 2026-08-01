# 贡献说明

乡声集盒是由原前后端仓库合并后的单一仓库。新功能应优先围绕 `docs/PRODUCT_DESIGN.md` 和 `guantou` 新实体实现；方言材料处理脚本按地域放在 `tools/materials/`，不进入 Django 运行路径。

## 分支与提交

- 分支命名建议使用 `feat/...`、`fix/...`、`docs/...`、`refactor/...`。
- PR 中的提交信息必须使用 Conventional Commits 风格：`type: summary` 或 `type(scope): summary`，例如 `ci: cache dependencies` 或 `feat(cans): add nameplate voting`。
- 常用类型：`feat`、`fix`、`docs`、`test`、`refactor`、`build`、`ci`、`chore`、`revert`。
- 可选 `scope` 使用小写英文、数字或短横线，例如 `frontend`、`backend`、`cans`、`ci`。
- PR 分支应保持干净：不要包含 `WIP`、`fixup!`、`squash!`、merge commit 或与本次工作无关的历史提交；必要时在提交 PR 前本地 rebase/squash。
- 仓库初始化提交 `init` 是历史重写时的特例；后续普通提交不使用裸 `init` 或自由格式信息。

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
- 涉及方言材料导入或清洗时，先在 `tools/materials/README.md` 说明适用方言、输入输出和依赖，再新增或调整脚本。
- 新文档只维护根目录 `README.md` 和 `docs/`，不要在子仓库目录继续新增分散说明。
