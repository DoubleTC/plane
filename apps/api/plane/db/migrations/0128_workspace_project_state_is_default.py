# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("db", "0127_workspace_project_states"),
    ]

    operations = [
        migrations.AddField(
            model_name="workspaceprojectstate",
            name="is_default",
            field=models.BooleanField(default=False),
        ),
    ]
