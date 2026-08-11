import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models


def copy_shelf_links(apps, schema_editor):
    Shelf = apps.get_model("guantou", "Shelf")
    ShelfFlavor = apps.get_model("guantou", "ShelfFlavor")
    ShelfCan = apps.get_model("guantou", "ShelfCan")
    old_flavors = Shelf._meta.get_field("flavors").remote_field.through
    old_cans = Shelf._meta.get_field("cans").remote_field.through

    flavor_positions = {}
    flavor_links = []
    for link in old_flavors.objects.order_by("shelf_id", "id").iterator():
        position = flavor_positions.get(link.shelf_id, 0)
        flavor_links.append(
            ShelfFlavor(
                shelf_id=link.shelf_id,
                flavor_id=link.flavor_id,
                sort_order=position,
            )
        )
        flavor_positions[link.shelf_id] = position + 1
    ShelfFlavor.objects.bulk_create(flavor_links)

    can_positions = {}
    can_links = []
    for link in old_cans.objects.order_by("shelf_id", "id").iterator():
        position = can_positions.get(link.shelf_id, 0)
        can_links.append(
            ShelfCan(
                shelf_id=link.shelf_id,
                can_id=link.can_id,
                sort_order=position,
            )
        )
        can_positions[link.shelf_id] = position + 1
    ShelfCan.objects.bulk_create(can_links)


def restore_shelf_links(apps, schema_editor):
    Shelf = apps.get_model("guantou", "Shelf")
    ShelfFlavor = apps.get_model("guantou", "ShelfFlavor")
    ShelfCan = apps.get_model("guantou", "ShelfCan")
    old_flavors = Shelf._meta.get_field("flavors").remote_field.through
    old_cans = Shelf._meta.get_field("cans").remote_field.through
    old_flavors.objects.bulk_create(
        [
            old_flavors(shelf_id=link.shelf_id, flavor_id=link.flavor_id)
            for link in ShelfFlavor.objects.order_by("sort_order", "id")
        ],
        ignore_conflicts=True,
    )
    old_cans.objects.bulk_create(
        [
            old_cans(shelf_id=link.shelf_id, can_id=link.can_id)
            for link in ShelfCan.objects.order_by("sort_order", "id")
        ],
        ignore_conflicts=True,
    )


class Migration(migrations.Migration):
    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
        ("guantou", "0010_canpost"),
    ]

    operations = [
        migrations.AlterField(
            model_name="can",
            name="recorder",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name="cans",
                to=settings.AUTH_USER_MODEL,
                verbose_name="录制者",
            ),
        ),
        migrations.AlterField(
            model_name="nameplate",
            name="creator",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name="nameplates",
                to=settings.AUTH_USER_MODEL,
                verbose_name="贴牌者",
            ),
        ),
        migrations.CreateModel(
            name="ShelfFlavor",
            fields=[
                (
                    "id",
                    models.AutoField(
                        auto_created=True,
                        primary_key=True,
                        serialize=False,
                        verbose_name="ID",
                    ),
                ),
                ("sort_order", models.PositiveIntegerField(default=0)),
                ("added_at", models.DateTimeField(auto_now_add=True)),
                (
                    "added_by",
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        related_name="added_shelf_flavors",
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
                (
                    "flavor",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="shelf_links",
                        to="guantou.flavor",
                    ),
                ),
                (
                    "shelf",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="flavor_links",
                        to="guantou.shelf",
                    ),
                ),
            ],
            options={
                "ordering": ["sort_order", "id"],
                "constraints": [
                    models.UniqueConstraint(
                        fields=("shelf", "flavor"), name="unique_shelf_flavor"
                    )
                ],
            },
        ),
        migrations.CreateModel(
            name="ShelfCan",
            fields=[
                (
                    "id",
                    models.AutoField(
                        auto_created=True,
                        primary_key=True,
                        serialize=False,
                        verbose_name="ID",
                    ),
                ),
                ("sort_order", models.PositiveIntegerField(default=0)),
                ("added_at", models.DateTimeField(auto_now_add=True)),
                (
                    "added_by",
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        related_name="added_shelf_cans",
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
                (
                    "can",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="shelf_links",
                        to="guantou.can",
                    ),
                ),
                (
                    "shelf",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="can_links",
                        to="guantou.shelf",
                    ),
                ),
            ],
            options={
                "ordering": ["sort_order", "id"],
                "constraints": [
                    models.UniqueConstraint(
                        fields=("shelf", "can"), name="unique_shelf_can"
                    )
                ],
            },
        ),
        migrations.RunPython(copy_shelf_links, restore_shelf_links),
        migrations.RemoveField(model_name="shelf", name="cans"),
        migrations.RemoveField(model_name="shelf", name="flavors"),
        migrations.AddField(
            model_name="shelf",
            name="cans",
            field=models.ManyToManyField(
                blank=True,
                related_name="shelves",
                through="guantou.ShelfCan",
                to="guantou.can",
            ),
        ),
        migrations.AddField(
            model_name="shelf",
            name="flavors",
            field=models.ManyToManyField(
                blank=True,
                related_name="shelves",
                through="guantou.ShelfFlavor",
                to="guantou.flavor",
            ),
        ),
    ]
