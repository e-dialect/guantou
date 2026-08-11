from django.db import migrations


def repair_pronunciation_columns(apps, schema_editor):
    """Align local snapshots whose 0004 migration state was marked too early."""
    connection = schema_editor.connection
    table_name = "guantou_pronunciation"
    with connection.cursor() as cursor:
        columns = {
            column.name
            for column in connection.introspection.get_table_description(
                cursor, table_name
            )
        }
    table = schema_editor.quote_name(table_name)
    quote = schema_editor.quote_name
    if "surface_romanization" not in columns and "romanization" in columns:
        schema_editor.execute(
            f"ALTER TABLE {table} RENAME COLUMN {quote('romanization')} "
            f"TO {quote('surface_romanization')}"
        )
        columns.remove("romanization")
        columns.add("surface_romanization")
    if "base_romanization" not in columns:
        schema_editor.execute(
            f"ALTER TABLE {table} ADD COLUMN {quote('base_romanization')} "
            "varchar(120) NOT NULL DEFAULT ''"
        )
        columns.add("base_romanization")
    if "tone_value" in columns:
        schema_editor.execute(f"ALTER TABLE {table} DROP COLUMN {quote('tone_value')}")


class Migration(migrations.Migration):
    dependencies = [("guantou", "0013_legacy_import_support")]

    operations = [
        migrations.RunPython(
            repair_pronunciation_columns,
            migrations.RunPython.noop,
        )
    ]
