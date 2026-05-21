# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

"""
Management command: seed_system_roles
======================================
Creates (or updates) the built-in Permission Schemes and Custom Roles for
every workspace.  The command is *idempotent* — running it multiple times
produces the same result.

Usage::

    python manage.py seed_system_roles
    python manage.py seed_system_roles --workspace <slug>  # single workspace
"""

from django.core.management.base import BaseCommand, CommandError

from plane.db.models import Workspace, PermissionScheme, CustomRole, CustomRoleScheme
from plane.db.constants.permissions import WORKSPACE_PERMISSIONS, PROJECT_PERMISSIONS

# ---------------------------------------------------------------------------
# System scheme definitions
# ---------------------------------------------------------------------------

_WORKSPACE_MEMBER_PERMS = [
    "workspace:view_settings",
    "workspace_member:view",
    "project:browse",
    "project:create",
    "project:self_join_public",
    "custom_role:view",
]

_WORKSPACE_GUEST_PERMS = [
    "workspace_member:view",
    "project:browse",
]

_PROJECT_MEMBER_PERMS = [
    "workitem:view",
    "workitem:create",
    "workitem:edit",
    "workitem:delete+creator",
    "comment:create",
    "comment:edit+creator",
    "comment:delete+creator",
    "cycle:view",
    "cycle:create",
    "cycle:edit",
    "cycle:delete+creator",
    "module:view",
    "module:create",
    "module:edit",
    "module:delete+creator",
    "page:view",
    "page:create",
    "page:edit",
]

_PROJECT_GUEST_PERMS = [
    "workitem:view",
    "comment:create",
    "comment:edit+creator",
    "comment:delete+creator",
    "cycle:view",
    "module:view",
    "page:view",
]

# Each entry: (name, scope, permissions, authority_level)
SYSTEM_SCHEME_DEFS: list[tuple[str, str, list[str], int]] = [
    # Workspace-scoped
    ("Workspace Admin", "workspace", WORKSPACE_PERMISSIONS, 20),
    ("Workspace Member", "workspace", _WORKSPACE_MEMBER_PERMS, 15),
    ("Workspace Guest", "workspace", _WORKSPACE_GUEST_PERMS, 5),
    # Project-scoped
    ("Project Admin", "project", PROJECT_PERMISSIONS, 20),
    ("Project Member", "project", _PROJECT_MEMBER_PERMS, 15),
    ("Project Guest", "project", _PROJECT_GUEST_PERMS, 5),
]


class Command(BaseCommand):
    help = "Seed system permission schemes and custom roles for all workspaces (idempotent)."

    def add_arguments(self, parser):
        parser.add_argument(
            "--workspace",
            dest="workspace_slug",
            default=None,
            help="Seed only the specified workspace (by slug).",
        )

    def handle(self, *args, **options):
        slug = options.get("workspace_slug")

        if slug:
            try:
                workspaces = [Workspace.objects.get(slug=slug)]
            except Workspace.DoesNotExist:
                raise CommandError(f"Workspace '{slug}' not found.")
        else:
            workspaces = list(Workspace.objects.all())

        total = len(workspaces)
        self.stdout.write(f"Seeding {total} workspace(s)…")

        for ws in workspaces:
            self._seed_workspace(ws)

        self.stdout.write(self.style.SUCCESS("✓ System roles seeded successfully."))

    # ---------------------------------------------------------------------- #

    def _seed_workspace(self, workspace: Workspace) -> None:
        for name, scope, permissions, authority_level in SYSTEM_SCHEME_DEFS:
            # Upsert scheme — update permissions if already exists
            scheme, created = PermissionScheme.objects.get_or_create(
                workspace=workspace,
                name=name,
                scope=scope,
                defaults={
                    "permissions": permissions,
                    "is_system": True,
                },
            )
            if not created and scheme.permissions != permissions:
                scheme.permissions = permissions
                scheme.save(disable_auto_set_user=True)

            # Upsert role (1-to-1 with scheme)
            role, _ = CustomRole.objects.get_or_create(
                workspace=workspace,
                name=name,
                scope=scope,
                defaults={
                    "is_system": True,
                    "authority_level": authority_level,
                },
            )

            # Ensure the scheme is attached to the role
            CustomRoleScheme.objects.get_or_create(role=role, scheme=scheme)

        self.stdout.write(f"  ✓ {workspace.slug}")
