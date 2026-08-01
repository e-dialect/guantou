"""Small Django compatibility shims for legacy third-party packages."""

from django.db.models import options


def patch_legacy_model_meta_options():
    """Allow django-notifications-hq 1.8.3 to import on Django 6."""
    if "index_together" not in options.DEFAULT_NAMES:
        options.DEFAULT_NAMES = (*options.DEFAULT_NAMES, "index_together")

    if getattr(options.Options, "_guantou_index_together_patch", False):
        return

    original_contribute_to_class = options.Options.contribute_to_class

    def contribute_to_class_with_legacy_index_together(self, cls, name):
        if self.meta and hasattr(self.meta, "index_together"):
            index_together = self.meta.index_together
            if index_together and isinstance(index_together[0], str):
                self.meta.index_together = (tuple(index_together),)
        return original_contribute_to_class(self, cls, name)

    options.Options.contribute_to_class = contribute_to_class_with_legacy_index_together
    options.Options._guantou_index_together_patch = True
