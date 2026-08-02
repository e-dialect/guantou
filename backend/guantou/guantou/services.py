from django.db import transaction

from .models import Can, Flavor, FlavorPackage, FlavorVariant, Nameplate, Package


def clean_text(value):
    return str(value or "").strip()


def get_or_create_package(label):
    text = clean_text(label.get("text_content"))
    if not text:
        return None
    package_type = label.get("package_type") or Package.PackageType.UNCERTAIN
    package, _ = Package.objects.get_or_create(
        text=text,
        package_type=package_type,
        defaults={"metadata": {}},
    )
    return package


def get_or_create_submission_flavor(can, label, user, package):
    flavor_id = label.get("flavor")
    if flavor_id:
        return Flavor.objects.filter(id=flavor_id).first()

    if not package:
        return None

    definition = clean_text(label.get("definition")) or can.concept_text or package.text
    flavor = Flavor.objects.create(
        name=definition,
        definition=definition,
        mandarin=[can.concept_text] if can.concept_text else [],
        created_by=user if user and user.is_authenticated else None,
    )
    FlavorPackage.objects.get_or_create(flavor=flavor, package=package)
    return flavor


def create_initial_nameplate(can, label, user):
    text_content = clean_text(label.get("text_content"))
    if not text_content:
        return None

    package = get_or_create_package(label)
    flavor = get_or_create_submission_flavor(can, label, user, package)
    nameplate = Nameplate.objects.create(
        can=can,
        flavor=flavor,
        package=package,
        creator=user,
        text_content=text_content,
        definition=clean_text(label.get("definition")) or can.concept_text,
        evidence_level=label.get("evidence_level") or Nameplate.EvidenceLevel.MEMORY,
        source_citation=clean_text(label.get("source_citation")),
    )
    nameplate.promote_to_primary()
    if can.status == Can.Status.UNLABELED:
        can.status = Can.Status.PENDING
        can.save(update_fields=["status", "updated_at"])
    return nameplate


def create_flavor_variant_for_can(can_data, flavor, user):
    return FlavorVariant.objects.create(
        flavor=flavor,
        dialect=can_data.get("dialect"),
        audio_url=can_data.get("audio_url", ""),
        audio_source=FlavorVariant.AudioSource.USER,
        created_by=user if user and user.is_authenticated else None,
    )


@transaction.atomic
def create_can_submission(*, user, can_data, initial_nameplate=None, flavor=None):
    data = dict(can_data)
    if flavor:
        data["flavor_variant"] = create_flavor_variant_for_can(data, flavor, user)
        data["concept_text"] = data.get("concept_text") or flavor.name
    data["recorder"] = user

    can = Can.objects.create(**data)
    if initial_nameplate:
        create_initial_nameplate(can, initial_nameplate, user)
    return can
