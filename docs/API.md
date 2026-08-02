# 乡声集盒 API

所有业务接口直接挂载在根路径，分页使用 DRF 默认结构：

```json
{
  "count": 1,
  "next": null,
  "previous": null,
  "results": []
}
```

## 资源

- `GET/POST /dialects/`
- `GET/POST /packages/`
- `GET/POST /flavors/`
- `GET/POST /flavor-variants/`
- `GET/POST /cans/`
- `GET/POST /nameplates/`
- `GET/POST /shelves/`
- `GET /search/`
- `/users...`
- `/login...`
- `/announcements...`
- `/site-settings...`
- `/files...`
- `/notifications...`

写接口需要在 header 中传入旧系统的 `token`。

## 错误响应

后端统一返回可被前端 service 层消费的错误结构：

```json
{
  "msg": "请先登录",
  "message": "请先登录",
  "code": "not_authenticated",
  "details": {},
  "request_id": "..."
}
```

前端应优先展示 `msg` 或 `message`，并在排查问题时把 `request_id` 带给后端。客户端传入 `X-Request-ID` 时，后端会在响应头 `X-Request-ID` 和错误 payload 中透传；未传入时后端自动生成。

## 数据约定

- `Nameplate` 是用户主张，创建时必须尽量同时给出 `flavor`（义项）和 `package`（写法）；没有明确写法时可以先记录 `text_content`，后续再补写法。
- `Flavor` 表示义项/概念，不直接承载县镇读音差异。
- `FlavorVariant` 表示义项在某方言点的读音，不负责决定正字。
- `Package` 是检索入口，`package_type` 用于区分正字、借字、俗写、拟音等写法。
- `sandhi_info` 只存结构化变调说明，v1 不做自动推导。

## 罐头

创建罐头：

```http
POST /cans/
```

```json
{
  "audio_url": "https://example.com/audio.mp3",
  "dialect": 1,
  "concept_text": "膝盖",
  "source_note": "本人记忆，家中长辈确认",
  "county": "莆田",
  "town": "游洋"
}
```

常用查询：

- `/cans/?status=unlabeled`
- `/cans/?needs_label=true`
- `/cans/?dialect=1`
- `/cans/?flavor=1`
- `/cans/?mine=true`
- `/cans/?search=膝盖`

`dialect` 查询遵循“查父含子，查子不含父”。

## 铭牌

给某个罐头贴铭牌：

```http
POST /cans/{can_id}/nameplates/
```

```json
{
  "flavor": 1,
  "package": 1,
  "text_content": "膝盖",
  "definition": "大腿与小腿连接处",
  "evidence_level": 1,
  "source_citation": "本人记忆"
}
```

给铭牌投票：

```http
POST /nameplates/{nameplate_id}/vote/
```

```json
{ "delta": 1 }
```

投票后后端会重新选择该罐头权重最高的铭牌作为主铭牌。

铭牌字段语义：

- `text_content`：用户实际写在牌面上的文字。
- `flavor`：这张铭牌主张的义项。
- `package`：这张铭牌主张的写法入口。
- `evidence_level`：证据强度，值越高表示越可靠。
- `source_citation`：文献、田野记录、长辈确认等来源说明。
- `weight`：投票和管理动作累积后的展示权重。
- `is_primary`：当前罐头默认展示的铭牌。

## 义项与写法

创建写法：

```json
{
  "text": "行",
  "package_type": "orthodox"
}
```

创建义项：

```json
{
  "name": "行走",
  "definition": "走路",
  "mandarin": ["走路"],
  "package_ids": [1]
}
```

创建变体：

```json
{
  "flavor": 1,
  "dialect": 2,
  "ipa": "hing23",
  "romanization": "hing2",
  "sandhi_info": {
    "rule_description": "仅记录，不自动推导",
    "changes": []
  }
}
```

常用查询：

- `/flavors/?search=膝盖`
- `/flavors/?package=1`
- `/flavor-variants/?flavor=1&dialect=2`
- `/packages/?search=行`

搜索写法时，前端应展示该写法关联的义项列表；进入义项详情后，再展示方言点变体和相关罐头。

## 聚合搜索

聚合搜索属于罐头核心领域，不单独拆 Django app：

```http
GET /search/?q=膝盖&limit=8
```

返回 `flavors`、`packages`、`cans` 三组结果。它不会改变外键检索方式；单资源筛选仍走 `/flavors/?package=...`、`/cans/?flavor=...` 等资源列表参数。
