# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only

import uuid

import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("db", "0126_phase_add_status_lead_members"),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        # 1. Add project_states_enabled to Workspace
        migrations.AddField(
            model_name="workspace",
            name="project_states_enabled",
            field=models.BooleanField(default=False),
        ),
        # 2. Create WorkspaceProjectState table
        migrations.CreateModel(
            name="WorkspaceProjectState",
            fields=[
                (
                    "id",
                    models.UUIDField(
                        default=uuid.uuid4,
                        editable=False,
                        primary_key=True,
                        serialize=False,
                    ),
                ),
                ("created_at", models.DateTimeField(auto_now_add=True, verbose_name="Created At")),
                ("updated_at", models.DateTimeField(auto_now=True, verbose_name="Last Modified At")),
                ("deleted_at", models.DateTimeField(null=True)),
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
                    "workspace",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="project_states",
                        to="db.workspace",
                    ),
                ),
                ("name", models.CharField(max_length=255)),
                ("description", models.TextField(blank=True, null=True)),
                (
                    "group",
                    models.CharField(
                        choices=[
                            ("draft", "Draft"),
                            ("planning", "Planning"),
                            ("execution", "Execution"),
                            ("monitoring", "Monitoring"),
                            ("completed", "Completed"),
                            ("cancelled", "Cancelled"),
                        ],
                        db_index=True,
                        max_length=20,
                    ),
                ),
                ("color", models.CharField(default="#94A3B8", max_length=20)),
                ("sequence", models.FloatField(default=65535)),
            ],
            options={
                "verbose_name": "Workspace Project State",
                "verbose_name_plural": "Workspace Project States",
                "db_table": "workspace_project_states",
                "ordering": ("sequence",),
            },
        ),
        # 3. Add project_status FK to Project
        migrations.AddField(
            model_name="project",
            name="project_status",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name="projects",
                to="db.workspaceprojectstate",
            ),
        ),
        # 4. Add priority to Project
        migrations.AddField(
            model_name="project",
            name="priority",
            field=models.CharField(
                blank=True,
                choices=[
                    ("urgent", "Urgent"),
                    ("high", "High"),
                    ("medium", "Medium"),
                    ("low", "Low"),
                    ("none", "None"),
                ],
                max_length=30,
                null=True,
            ),
        ),
        # 5. Add start_date to Project
        migrations.AddField(
            model_name="project",
            name="start_date",
            field=models.DateField(blank=True, null=True),
        ),
        # 6. Add end_date to Project
        migrations.AddField(
            model_name="project",
            name="end_date",
            field=models.DateField(blank=True, null=True),
        ),
    ]
