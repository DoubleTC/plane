# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

# Django imports
from django.db import models
from django.db.models import Q

# Module imports
from .base import BaseModel


class CustomRole(BaseModel):
    """
    A custom role used purely as a metadata label for classifying / grouping
    workspace and project members.  It does NOT carry any enforced permissions —
    actual access control still goes through the built-in ROLE_CHOICES on
    ``WorkspaceMember.role`` and ``ProjectMember.role``.

    ``authority_level`` mirrors the existing ROLE_CHOICES integers (20 Admin,
    15 Member, 5 Guest, 0 custom) so future authority comparisons stay
    consistent with the rest of the codebase.

    ``is_system`` marks roles seeded by the management command so that they
    cannot be deleted from the UI.
    """

    workspace = models.ForeignKey(
        "db.Workspace",
        on_delete=models.CASCADE,
        related_name="custom_roles",
    )
    name = models.CharField(max_length=255)
    description = models.TextField(blank=True)
    scope = models.CharField(
        max_length=20,
        choices=[("workspace", "Workspace"), ("project", "Project")],
    )
    is_system = models.BooleanField(default=False)
    authority_level = models.PositiveIntegerField(default=0)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["workspace", "name", "scope"],
                condition=Q(deleted_at__isnull=True),
                name="custom_role_unique_ws_name_scope_active",
            )
        ]
        verbose_name = "Custom Role"
        verbose_name_plural = "Custom Roles"
        db_table = "custom_roles"
        ordering = ("-created_at",)

    def __str__(self) -> str:
        return f"{self.name} [{self.scope}] <{self.workspace.slug}>"
