# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only

import django.db.models.deletion
import uuid
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("db", "0125_milestones_to_phases"),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        # Add status to Phase
        migrations.AddField(
            model_name="phase",
            name="status",
            field=models.CharField(
                choices=[
                    ("backlog", "Backlog"),
                    ("planned", "Planned"),
                    ("in-progress", "In Progress"),
                    ("paused", "Paused"),
                    ("completed", "Completed"),
                    ("cancelled", "Cancelled"),
                ],
                default="planned",
                max_length=20,
            ),
        ),
        # Add lead FK to Phase
        migrations.AddField(
            model_name="phase",
            name="lead",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name="phase_leads",
                to=settings.AUTH_USER_MODEL,
            ),
        ),
        # Create PhaseMember through table
        migrations.CreateModel(
            name="PhaseMember",
            fields=[
                ("created_at", models.DateTimeField(auto_now_add=True, verbose_name="Created At")),
                ("updated_at", models.DateTimeField(auto_now=True, verbose_name="Last Modified At")),
                ("deleted_at", models.DateTimeField(null=True)),
                (
                    "id",
                    models.UUIDField(
                        db_index=True,
                        default=uuid.uuid4,
                        editable=False,
                        primary_key=True,
                        serialize=False,
                        unique=True,
                    ),
                ),
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
                        related_name="%(class)s_workspace",
                        to="db.workspace",
                        verbose_name="Workspace",
                    ),
                ),
                (
                    "project",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="%(class)s_project",
                        to="db.project",
                        verbose_name="Project",
                    ),
                ),
                (
                    "phase",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="phase_memberships",
                        to="db.phase",
                    ),
                ),
                (
                    "member",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="user_phase_memberships",
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
            ],
            options={
                "verbose_name": "Phase Member",
                "verbose_name_plural": "Phase Members",
                "db_table": "phase_members",
                "unique_together": {("phase", "member", "deleted_at")},
            },
        ),
        # Add constraint for unique non-deleted phase members
        migrations.AddConstraint(
            model_name="phasemember",
            constraint=models.UniqueConstraint(
                condition=models.Q(deleted_at__isnull=True),
                fields=["phase", "member"],
                name="unique_phase_member_when_deleted_at_null",
            ),
        ),
        # Add members M2M on Phase (uses the PhaseMember through table)
        migrations.AddField(
            model_name="phase",
            name="members",
            field=models.ManyToManyField(
                blank=True,
                related_name="phase_members",
                through="db.PhaseMember",
                through_fields=("phase", "member"),
                to=settings.AUTH_USER_MODEL,
            ),
        ),
    ]
