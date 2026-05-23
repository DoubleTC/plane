"""
Copyright (c) 2023-present Plane Software, Inc. and contributors
SPDX-License-Identifier: AGPL-3.0-only
See the LICENSE file for details.

Migration: replace Milestone/MilestoneIssue with Phase/PhaseCycle and
rename the project feature-flag from milestone_view to phase_view.
"""

import django.db.models.deletion
import django.utils.timezone
import uuid
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("db", "0124_add_milestones"),
    ]

    operations = [
        # 1. Add new project feature flag
        migrations.AddField(
            model_name="project",
            name="phase_view",
            field=models.BooleanField(default=False),
        ),
        # 2. Drop old project feature flag
        migrations.RemoveField(
            model_name="project",
            name="milestone_view",
        ),
        # 3. Drop old bridge table first (FK → milestones)
        migrations.DeleteModel(name="MilestoneIssue"),
        # 4. Drop old milestone table
        migrations.DeleteModel(name="Milestone"),
        # 5. Create Phase
        migrations.CreateModel(
            name="Phase",
            fields=[
                ("id", models.UUIDField(db_index=True, default=uuid.uuid4, editable=False, primary_key=True, serialize=False, unique=True)),
                ("created_at", models.DateTimeField(auto_now_add=True, verbose_name="Created At")),
                ("updated_at", models.DateTimeField(auto_now=True, verbose_name="Last Modified At")),
                ("deleted_at", models.DateTimeField(null=True, verbose_name="Deleted At")),
                ("name", models.CharField(max_length=255)),
                ("description", models.TextField(blank=True, null=True)),
                ("start_date", models.DateField(blank=True, null=True)),
                ("end_date", models.DateField(blank=True, null=True)),
                ("sort_order", models.FloatField(default=65535)),
                ("archived_at", models.DateTimeField(null=True, blank=True)),
                ("created_by", models.ForeignKey(null=True, on_delete=django.db.models.deletion.SET_NULL, related_name="%(class)s_created_by", to="db.user", verbose_name="Created By")),
                ("project", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="phases", to="db.project")),
                ("updated_by", models.ForeignKey(null=True, on_delete=django.db.models.deletion.SET_NULL, related_name="%(class)s_updated_by", to="db.user", verbose_name="Last Modified By")),
                ("workspace", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="%(class)s_workspace", to="db.workspace")),
            ],
            options={"verbose_name": "Phase", "verbose_name_plural": "Phases", "db_table": "phases", "ordering": ("sort_order",)},
        ),
        migrations.AddConstraint(
            model_name="phase",
            constraint=models.UniqueConstraint(
                condition=models.Q(deleted_at__isnull=True),
                fields=["project", "name"],
                name="unique_phase_name_per_project",
            ),
        ),
        # 6. Create PhaseCycle
        migrations.CreateModel(
            name="PhaseCycle",
            fields=[
                ("id", models.UUIDField(db_index=True, default=uuid.uuid4, editable=False, primary_key=True, serialize=False, unique=True)),
                ("created_at", models.DateTimeField(auto_now_add=True, verbose_name="Created At")),
                ("updated_at", models.DateTimeField(auto_now=True, verbose_name="Last Modified At")),
                ("deleted_at", models.DateTimeField(null=True, verbose_name="Deleted At")),
                ("created_by", models.ForeignKey(null=True, on_delete=django.db.models.deletion.SET_NULL, related_name="%(class)s_created_by", to="db.user", verbose_name="Created By")),
                ("project", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="phase_cycles", to="db.project")),
                ("updated_by", models.ForeignKey(null=True, on_delete=django.db.models.deletion.SET_NULL, related_name="%(class)s_updated_by", to="db.user", verbose_name="Last Modified By")),
                ("workspace", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="%(class)s_workspace", to="db.workspace")),
                ("phase", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="phase_cycles", to="db.phase")),
                ("cycle", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="phase_cycles", to="db.cycle")),
            ],
            options={"verbose_name": "Phase Cycle", "verbose_name_plural": "Phase Cycles", "db_table": "phase_cycles"},
        ),
        migrations.AddConstraint(
            model_name="phasecycle",
            constraint=models.UniqueConstraint(
                condition=models.Q(deleted_at__isnull=True),
                fields=["phase", "cycle"],
                name="unique_cycle_per_phase",
            ),
        ),
    ]
