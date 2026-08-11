# 兴化语记

管理命令 `import_hinghwa_legacy` 只读打开兴化语记旧库 SQLite，并用
`source_system + source_table + source_id` 台账保证断点续跑和幂等重跑。命令不会复制
COS 音频对象，只保留原 HTTPS URL。

## 正式导入前

1. 配置目标环境并执行 `python manage.py migrate`。
2. 对目标 SQLite 创建独立的、经过完整性检查的备份。
3. 先执行全量预演并检查报告中的 `failed` 和 `conflicts`：

```bash
python manage.py import_hinghwa_legacy \
  --source /absolute/path/to/legacy.sqlite3 \
  --dry-run --all \
  --report migration-reports/legacy-dry-run.json
```

来源文件通过 SQLite `mode=ro` 打开。预演不会写目标数据库；`--limit N` 可替代
`--all` 做小规模开发验证。

## 执行和恢复

确认预演无意外失败后执行：

```bash
python manage.py import_hinghwa_legacy \
  --source /absolute/path/to/legacy.sqlite3 \
  --apply --all \
  --report migration-reports/legacy-apply.json \
  --export-demo guantou/fixtures/hinghwa_demo.json
```

每个来源对象分别在事务中写入。命令中断后可原样重跑；已写入对象由台账跳过，报告的
`ledger_actions` 和 `database_counts` 给出累计结果。报告、来源库、目标库备份和真实环境
变量均被 `.gitignore` 排除。

不要在生产环境首次尝试导入。应先用生产库副本完成预演、计数核对、登录与搜索抽样，
再单独安排生产变更窗口。

## 脱敏 demo fixture

仓库内的 `guantou/fixtures/hinghwa_demo.json` 使用逻辑键而非数据库主键，包含城里、
江口、湄洲、城关和枫亭各一条公开录音。它不含真实用户名、邮箱、手机号、微信标识、
密码哈希、头像或管理员权限，可重复导入空库或已有库：

```bash
python manage.py import_hinghwa_legacy \
  --fixture guantou/fixtures/hinghwa_demo.json \
  --dry-run

python manage.py import_hinghwa_legacy \
  --fixture guantou/fixtures/hinghwa_demo.json \
  --apply
```
