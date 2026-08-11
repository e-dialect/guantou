from django.db import migrations

PUTIAN_LEAVES = [
    ("城里", 10),
    ("江口", 20),
    ("湄洲", 30),
    ("涵江", 40),
    ("三江口", 50),
    ("东埔", 60),
    ("东峤", 70),
    ("东庄", 80),
    ("东海", 90),
    ("北高", 100),
    ("华亭", 110),
    ("国欢", 120),
    ("埭头", 130),
    ("大洋", 140),
    ("山亭", 150),
    ("平海", 160),
    ("庄边", 170),
    ("忠门", 180),
    ("新县", 190),
    ("月塘", 200),
    ("梧塘", 210),
    ("白塘", 220),
    ("白沙", 230),
    ("笏石", 240),
    ("萩芦", 250),
    ("西天尾", 260),
    ("黄石", 270),
]

XIANYOU_LEAVES = [
    ("城关", 10),
    ("游洋", 20),
    ("枫亭", 30),
    ("书峰", 40),
    ("园庄", 50),
    ("大济", 60),
    ("度尾", 70),
    ("榜头", 80),
    ("盖尾", 90),
    ("石苍", 100),
    ("社硎", 110),
    ("西苑", 120),
    ("赖店", 130),
    ("钟山", 140),
    ("鲤南", 150),
    ("龙华", 160),
]


def get_node(Dialect, parent, code, name, sort_order, description=""):
    node, _ = Dialect.objects.get_or_create(
        parent=parent,
        code=code,
        defaults={
            "name": name,
            "sort_order": sort_order,
            "description": description,
            "aliases": [],
            "external_refs": {},
        },
    )
    return node


def remove_obsolete_dialect_kind(apps, schema_editor):
    """Repair early local databases that retained a field absent from state.

    A historical development snapshot was created from an intermediate model
    containing ``Dialect.kind`` and then had migration 0004 marked applied.
    Current ORM inserts cannot work while that unknown NOT NULL column remains.
    """
    connection = schema_editor.connection
    with connection.cursor() as cursor:
        columns = {
            column.name
            for column in connection.introspection.get_table_description(
                cursor, "guantou_dialect"
            )
        }
    if "kind" in columns:
        table = schema_editor.quote_name("guantou_dialect")
        column = schema_editor.quote_name("kind")
        schema_editor.execute(f"ALTER TABLE {table} DROP COLUMN {column}")


def seed_puxian_dialects(apps, schema_editor):
    Dialect = apps.get_model("guantou", "Dialect")
    DialectCircle = apps.get_model("guantou", "DialectCircle")

    min_root = get_node(Dialect, None, "闽", "闽语", 10)
    puxian = get_node(Dialect, min_root, "莆仙", "莆仙片（兴化方言）", 10)
    putian = get_node(Dialect, puxian, "莆田", "莆田", 10)
    xianyou = get_node(Dialect, puxian, "仙游", "仙游", 20)

    for code, order in PUTIAN_LEAVES:
        get_node(Dialect, putian, code, code, order)
    for code, order in XIANYOU_LEAVES:
        get_node(Dialect, xianyou, code, code, order)

    mindong = get_node(Dialect, min_root, "闽东", "闽东片", 20)
    houguan = get_node(Dialect, mindong, "侯官", "侯官片", 10)
    get_node(Dialect, houguan, "福州", "福州", 10)
    minnan = get_node(Dialect, min_root, "闽南", "闽南片", 30)
    quanzhang = get_node(Dialect, minnan, "泉漳", "泉漳片", 10)
    get_node(Dialect, quanzhang, "泉州", "泉州", 10)
    get_node(Dialect, quanzhang, "厦门", "厦门", 20)
    chaoshan = get_node(Dialect, minnan, "潮汕", "潮汕片", 20)
    get_node(Dialect, chaoshan, "潮州", "潮州", 10)

    for dialect in Dialect.objects.all().iterator():
        DialectCircle.objects.get_or_create(
            dialect=dialect,
            defaults={
                "name": f"{dialect.name}圈",
                "description": dialect.description
                or f"一起听、录和校验{dialect.name}乡音。",
            },
        )


class Migration(migrations.Migration):
    dependencies = [("guantou", "0011_content_governance")]

    operations = [
        migrations.RunPython(
            remove_obsolete_dialect_kind,
            migrations.RunPython.noop,
        ),
        migrations.RunPython(seed_puxian_dialects, migrations.RunPython.noop),
    ]
