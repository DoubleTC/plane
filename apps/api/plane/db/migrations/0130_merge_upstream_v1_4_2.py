# Merges the BananaZ migration branch (0122_add_gac_models … 0129) with the
# upstream v1.4.2 branch (0122_alter_draftissue_assignees_…); both fork from 0121.

from django.db import migrations


class Migration(migrations.Migration):
    dependencies = [
        ("db", "0122_alter_draftissue_assignees_alter_issue_assignees_and_more"),
        ("db", "0129_align_custom_model_state"),
    ]

    operations = []
