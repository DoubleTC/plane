# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

"""
Management command: seed_system_roles
======================================
Creates the built-in metadata Custom Roles for every workspace. Idempotent —
running it multiple times produces the same result.

Usage::

    python manage.py seed_system_roles
    python manage.py seed_system_roles --workspace <slug>  # single workspace
"""

from django.core.management.base import BaseCommand, CommandError

from plane.db.models import Workspace, CustomRole


# Each entry: (name, scope, authority_level)
SYSTEM_ROLE_DEFS: list[tuple[str, str, int]] = [
    # Workspace-scoped
    ("Workspace Admin", "workspace", 20),
    ("Workspace Member", "workspace", 15),
    ("Workspace Guest", "workspace", 5),
    # Project-scoped
    ("Project Admin", "project", 20),
    ("Project Member", "project", 15),
    ("Project Guest", "project", 5),
]


class Command(BaseCommand):
    help = "Seed system custom roles for all workspaces (idempotent)."

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

    def _seed_workspace(self, workspace: Workspace) -> None:
        for name, scope, authority_level in SYSTEM_ROLE_DEFS:
            CustomRole.objects.get_or_create(
                workspace=workspace,
                name=name,
                scope=scope,
                defaults={
                    "is_system": True,
                    "authority_level": authority_level,
                },
            )

        self.stdout.write(f"  ✓ {workspace.slug}")
