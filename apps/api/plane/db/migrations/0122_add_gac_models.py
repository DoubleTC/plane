# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

# Generated for GAC (Granular Access Control) feature.

import uuid
import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("db", "0121_alter_estimate_type"),
    ]

    operations = [
        # ------------------------------------------------------------------ #
        # 1. PermissionScheme
        # ------------------------------------------------------------------ #
        migrations.CreateModel(
            name="PermissionScheme",
            fields=[
                (
                    "id",
                    models.UUIDField(
                        default=uuid.uuid4,
                        editable=False,
                        primary_key=True,
                        serialize=False,
                        unique=True,
                        db_index=True,
                    ),
                ),
                ("created_at", models.DateTimeField(auto_now_add=True, verbose_name="Created At")),
                ("updated_at", models.DateTimeField(auto_now=True, verbose_name="Last Modified At")),
                ("deleted_at", models.DateTimeField(blank=True, null=True, verbose_name="Deleted At")),
                (
                    "created_by",
                    models.ForeignKey(
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        related_name="permissionscheme_created_by",
                        to="db.user",
                        verbose_name="Created By",
                    ),
                ),
                (
                    "updated_by",
                    models.ForeignKey(
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        related_name="permissionscheme_updated_by",
                        to="db.user",
                        verbose_name="Last Modified By",
                    ),
                ),
                (
                    "workspace",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="permission_schemes",
                        to="db.workspace",
                    ),
                ),
                ("name", models.CharField(max_length=255)),
                ("description", models.TextField(blank=True)),
                (
                    "scope",
                    models.CharField(
                        choices=[("workspace", "Workspace"), ("project", "Project")],
                        max_length=20,
                    ),
                ),
                ("is_system", models.BooleanField(default=False)),
                ("permissions", models.JSONField(default=list)),
            ],
            options={
                "verbose_name": "Permission Scheme",
                "verbose_name_plural": "Permission Schemes",
                "db_table": "permission_schemes",
                "ordering": ("-created_at",),
                "abstract": False,
            },
        ),
        migrations.AddConstraint(
            model_name="permissionscheme",
            constraint=models.UniqueConstraint(
                condition=models.Q(deleted_at__isnull=True),
                fields=["workspace", "name", "scope"],
                name="permission_scheme_unique_ws_name_scope_active",
            ),
        ),
        # ------------------------------------------------------------------ #
        # 2. CustomRole
        # ------------------------------------------------------------------ #
        migrations.CreateModel(
            name="CustomRole",
            fields=[
                (
                    "id",
                    models.UUIDField(
                        default=uuid.uuid4,
                        editable=False,
                        primary_key=True,
                        serialize=False,
                        unique=True,
                        db_index=True,
                    ),
                ),
                ("created_at", models.DateTimeField(auto_now_add=True, verbose_name="Created At")),
                ("updated_at", models.DateTimeField(auto_now=True, verbose_name="Last Modified At")),
                ("deleted_at", models.DateTimeField(blank=True, null=True, verbose_name="Deleted At")),
                (
                    "created_by",
                    models.ForeignKey(
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        related_name="customrole_created_by",
                        to="db.user",
                        verbose_name="Created By",
                    ),
                ),
                (
                    "updated_by",
                    models.ForeignKey(
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        related_name="customrole_updated_by",
                        to="db.user",
                        verbose_name="Last Modified By",
                    ),
                ),
                (
                    "workspace",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="custom_roles",
                        to="db.workspace",
                    ),
                ),
                ("name", models.CharField(max_length=255)),
                ("description", models.TextField(blank=True)),
                (
                    "scope",
                    models.CharField(
                        choices=[("workspace", "Workspace"), ("project", "Project")],
                        max_length=20,
                    ),
                ),
                ("is_system", models.BooleanField(default=False)),
                ("authority_level", models.PositiveIntegerField(default=0)),
            ],
            options={
                "verbose_name": "Custom Role",
                "verbose_name_plural": "Custom Roles",
                "db_table": "custom_roles",
                "ordering": ("-created_at",),
                "abstract": False,
            },
        ),
        migrations.AddConstraint(
            model_name="customrole",
            constraint=models.UniqueConstraint(
                condition=models.Q(deleted_at__isnull=True),
                fields=["workspace", "name", "scope"],
                name="custom_role_unique_ws_name_scope_active",
            ),
        ),
        # ------------------------------------------------------------------ #
        # 3. CustomRoleScheme (junction)
        # ------------------------------------------------------------------ #
        migrations.CreateModel(
            name="CustomRoleScheme",
            fields=[
                (
                    "id",
                    models.UUIDField(
                        default=uuid.uuid4,
                        editable=False,
                        primary_key=True,
                        serialize=False,
                        unique=True,
                        db_index=True,
                    ),
                ),
                ("created_at", models.DateTimeField(auto_now_add=True, verbose_name="Created At")),
                ("updated_at", models.DateTimeField(auto_now=True, verbose_name="Last Modified At")),
                ("deleted_at", models.DateTimeField(blank=True, null=True, verbose_name="Deleted At")),
                (
                    "created_by",
                    models.ForeignKey(
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        related_name="customrolescheme_created_by",
                        to="db.user",
                        verbose_name="Created By",
                    ),
                ),
                (
                    "updated_by",
                    models.ForeignKey(
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        related_name="customrolescheme_updated_by",
                        to="db.user",
                        verbose_name="Last Modified By",
                    ),
                ),
                (
                    "role",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="role_schemes",
                        to="db.customrole",
                    ),
                ),
                (
                    "scheme",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="scheme_roles",
                        to="db.permissionscheme",
                    ),
                ),
            ],
            options={
                "verbose_name": "Custom Role Scheme",
                "verbose_name_plural": "Custom Role Schemes",
                "db_table": "custom_role_schemes",
                "ordering": ("-created_at",),
                "abstract": False,
            },
        ),
        migrations.AddConstraint(
            model_name="customrolescheme",
            constraint=models.UniqueConstraint(
                condition=models.Q(deleted_at__isnull=True),
                fields=["role", "scheme"],
                name="custom_role_scheme_unique_role_scheme_active",
            ),
        ),
        # ------------------------------------------------------------------ #
        # 4. Add custom_role FK to WorkspaceMember
        # ------------------------------------------------------------------ #
        migrations.AddField(
            model_name="workspacemember",
            name="custom_role",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name="workspace_members",
                to="db.customrole",
            ),
        ),
        # ------------------------------------------------------------------ #
        # 5. Add custom_role FK to ProjectMember
        # ------------------------------------------------------------------ #
        migrations.AddField(
            model_name="projectmember",
            name="custom_role",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name="project_members",
                to="db.customrole",
            ),
        ),
    ]
