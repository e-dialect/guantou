# 兴化语记

管理命令 `import_hinghwa_legacy` 只读打开兴化语记旧库 SQLite，并用
`source_system + source_table + source_id + target_model` 台账保证断点续跑和幂等重跑。
过渡期会同时保留当前 V1 对象，并为每个旧词建立独立的 `Entry`、为每条旧录音建立唯一的
`Recording` 及其主词条关系；因此已经完成 V1 导入的数据库也可以安全重跑以补建 V2。
命令不会复制 COS 音频对象，只保留原 HTTPS URL。

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

每个 `word_word.id` 无论是否有录音都会形成一条初稿 Entry。旧库标准转写只作为
“闽语 › 莆仙方言 › 莆田 › 城里”的地区读音证据；录音自己的县镇范围另行映射，原县镇
文本只进入不可覆写的 EvidenceRecord，不进入 Recording 的设备位置信息。隐藏词和隐藏
录音继续保持隐藏。

报告中的 `review_candidates` 及数据库中的旧库审核候选只表示待人工判断：①②编号生成
“建议分义”，同一地区多读音生成“建议拆词条”，相同写法生成“可能重复”。导入器不会
据此自动增加义项、拆分词条或合并同形词。

### 同手机号账号的登录主体

旧库内部或旧库与目标库出现相同手机号时，双方积分和贡献关系合并到同一个目标用户。
登录主体按以下顺序确定：管理员（`is_staff` 或 `is_superuser`）优先；管理员状态相同时，
最近登录时间较新的账号优先；登录时间为空视为最早。仍完全相同时，旧库内部使用稳定
来源顺序，旧库撞目标库则保留目标登录主体。若旧库身份胜出，会沿用目标用户主键并
切换为旧库用户名、密码哈希和权限。幂等重跑会修复旧版本台账中不符合该规则的账号，
但不会重复累计积分。身份切换会注销旧目标的 Django session；JWT 也会因为用户名声明
不再匹配而失效，必须使用胜出账号重新登录。

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
