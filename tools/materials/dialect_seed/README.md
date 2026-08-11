# 方言点种子数据

本目录为 v1 `Dialect` 按需父子树提供可重复执行的联调数据。树只按实际需要展开，不为填满固定层级而创建空节点。

## 数据口径

- 种子树保留当前联调需要的闽语分支，并包含从兴化语记旧库地点归一化得到的 42 个莆田/仙游叶节点。
- `code` 是同级唯一的中文短码；不同分支可以使用相同短码。
- 树本身表达语言关系与按需粒度，无须额外的层级类型或行政区划字段。
- 莆仙分支参考《莆田市志》方言篇，闽语分片框架参考《中国语言地图集》。这是联调骨架，不是学术级完整分区。

## 输入格式

`dialects.json` 或自定义 JSON/CSV 使用以下字段：

| 字段 | 必填 | 说明 |
| --- | --- | --- |
| `key` | 是 | 仅在输入文件内使用的稳定 source key |
| `code` | 是 | 同级唯一短码，不得含点、斜杠或空白，最长 32 字符 |
| `name` | 是 | 展示名称 |
| `parent` | 否 | 文件内父节点 `key`，或已落库父节点的完整限定码 |
| `sort_order` | 否 | 同级人工顺序，默认 0；随附数据按 10 的倍数留出插入空间 |
| `description` | 否 | 方言点说明 |
| `aliases` | 否 | 历史完整限定码数组，默认空数组 |
| `external_refs` | 否 | 真实外部标识或链接对象，默认空对象 |

JSON 中 `aliases` 必须是字符串数组，`external_refs` 必须是对象。CSV 适合不使用这两个结构化字段的简单输入。
输入包含表格之外的字段时会校验失败，避免拼写错误或无效数据被静默忽略。

## 运行

在仓库根目录执行：

```bash
# 只计算报告，不落库
backend/guantou/.venv/bin/python -m tools.materials.dialect_seed.seed_dialects --dry-run

# 写入默认数据
backend/guantou/.venv/bin/python -m tools.materials.dialect_seed.seed_dialects

# 自定义输入
backend/guantou/.venv/bin/python -m tools.materials.dialect_seed.seed_dialects --input path/to/dialects.json
```

脚本通过 `DJANGO_SETTINGS_MODULE=config.settings` 引导 ORM。如需使用其它 SQLite 数据库，设置 `SQLITE_PATH`。

## 幂等与失败边界

stdout 固定输出：

```json
{"created": 56, "skipped": 0, "failed": []}
```

- 数据库身份是 `parent + code`；同一输入重复执行只增加 `skipped`。
- 已有同级 code 但名称不同，或已有同级名称但 code 不同时，记入 `failed`，不覆盖人工数据。
- dry-run 与真实写入共用同一套解析、拓扑排序和冲突判定。
- 退出码：0 表示无失败，1 表示存在逐条失败，2 表示输入文件无法读取或解析。

## 测试

```bash
python -m unittest discover tools/materials/tests
# 或
make materials-check
```

纯函数测试覆盖字段校验与拓扑排序；ORM 测试从空白临时 SQLite 库建表，验证 dry-run、重复导入、同级冲突、跨分支同码、限定码和排序。
