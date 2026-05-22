# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

# Migration for Milestone feature.

import uuid
import django.db.models.deletion
import django.utils.timezone
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("db", "0123_drop_permission_schemes"),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        # ------------------------------------------------------------------ #
        # 1. Add milestone_view flag to Project
        # ------------------------------------------------------------------ #
        migrations.AddField(
            model_name="project",
            name="milestone_view",
            field=models.BooleanField(default=False),
        ),

        # ------------------------------------------------------------------ #
        # 2. Milestone table
        # ------------------------------------------------------------------ #
        migrations.CreateModel(
            name="Milestone",
            fields=[
                ("created_at", models.DateTimeField(auto_now_add=True, verbose_name="Created At")),
                ("updated_at", models.DateTimeField(auto_now=True, verbose_name="Last Modified At")),
                ("deleted_at", models.DateTimeField(null=True, blank=True)),
                ("id", models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ("name", models.CharField(max_length=255, verbose_name="Milestone Name")),
                ("description", models.TextField(blank=True, verbose_name="Milestone Description")),
                ("target_date", models.DateField(blank=True, null=True, verbose_name="Target Date")),
                ("color", models.CharField(blank=True, max_length=7, null=True, verbose_name="Color")),
                ("sort_order", models.FloatField(default=65535)),
                ("logo_props", models.JSONField(default=dict)),
                ("archived_at", models.DateTimeField(blank=True, null=True)),
                (
                    "created_by",
                    models.ForeignKey(
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        related_name="%(class)s_created_by",
                        to=settings.AUTH_USER_MODEL,
                        verbose_name="Created By",
                    ),
                ),
                (
                    "updated_by",
                    models.ForeignKey(
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        related_name="%(class)s_updated_by",
                        to=settings.AUTH_USER_MODEL,
                        verbose_name="Last Modified By",
                    ),
                ),
                (
                    "project",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="project_%(class)s",
                        to="db.project",
                    ),
                ),
                (
                    "workspace",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="workspace_%(class)s",
                        to="db.workspace",
                    ),
                ),
            ],
            options={
                "verbose_name": "Milestone",
                "verbose_name_plural": "Milestones",
                "db_table": "milestones",
                "ordering": ("-created_at",),
            },
        ),
        migrations.AddConstraint(
            model_name="milestone",
            constraint=models.UniqueConstraint(
                condition=models.Q(deleted_at__isnull=True),
                fields=["name", "project"],
                name="milestone_unique_name_project_when_not_deleted",
            ),
        ),

        # ------------------------------------------------------------------ #
        # 3. MilestoneIssue bridge table
        # ------------------------------------------------------------------ #
        migrations.CreateModel(
            name="MilestoneIssue",
            fields=[
                ("created_at", models.DateTimeField(auto_now_add=True, verbose_name="Created At")),
                ("updated_at", models.DateTimeField(auto_now=True, verbose_name="Last Modified At")),
                ("deleted_at", models.DateTimeField(null=True, blank=True)),
                ("id", models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                (
                    "created_by",
                    models.ForeignKey(
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        related_name="%(class)s_created_by",
                        to=settings.AUTH_USER_MODEL,
                        verbose_name="Created By",
                    ),
                ),
                (
                    "updated_by",
                    models.ForeignKey(
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        related_name="%(class)s_updated_by",
                        to=settings.AUTH_USER_MODEL,
                        verbose_name="Last Modified By",
                    ),
                ),
                (
                    "issue",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="issue_milestone",
                        to="db.issue",
                    ),
                ),
                (
                    "milestone",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="milestone_issues",
                        to="db.milestone",
                    ),
                ),
                (
                    "project",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="project_%(class)s",
                        to="db.project",
                    ),
                ),
                (
                    "workspace",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="workspace_%(class)s",
                        to="db.workspace",
                    ),
                ),
            ],
            options={
                "verbose_name": "Milestone Issue",
                "verbose_name_plural": "Milestone Issues",
                "db_table": "milestone_issues",
                "ordering": ("-created_at",),
            },
        ),
        migrations.AddConstraint(
            model_name="milestoneissue",
            constraint=models.UniqueConstraint(
                condition=models.Q(deleted_at__isnull=True),
                fields=["issue", "milestone"],
                name="milestone_issue_unique_when_not_deleted",
            ),
        ),
    ]
