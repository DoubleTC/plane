# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

# Django imports
from django.db import models
from django.db.models import Q

# Module imports
from .base import BaseModel


class PermissionScheme(BaseModel):
    """
    A reusable bundle of permission identifiers.

    ``scope`` determines whether this scheme applies at the workspace level
    or the project level.  ``is_system`` marks schemes that are created by
    the seed command and must not be modified or deleted by users.

    ``permissions`` is a JSON list of permission identifier strings, e.g.::

        ["workitem:view", "workitem:edit", "workitem:delete+creator"]
    """

    workspace = models.ForeignKey(
        "db.Workspace",
        on_delete=models.CASCADE,
        related_name="permission_schemes",
    )
    name = models.CharField(max_length=255)
    description = models.TextField(blank=True)
    scope = models.CharField(
        max_length=20,
        choices=[("workspace", "Workspace"), ("project", "Project")],
    )
    is_system = models.BooleanField(default=False)
    # List of permission identifier strings.
    permissions = models.JSONField(default=list)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["workspace", "name", "scope"],
                condition=Q(deleted_at__isnull=True),
                name="permission_scheme_unique_ws_name_scope_active",
            )
        ]
        verbose_name = "Permission Scheme"
        verbose_name_plural = "Permission Schemes"
        db_table = "permission_schemes"
        ordering = ("-created_at",)

    def __str__(self) -> str:
        return f"{self.name} [{self.scope}] <{self.workspace.slug}>"


class CustomRole(BaseModel):
    """
    A custom role definition whose effective permissions are the union of all
    attached :class:`PermissionScheme` objects.

    ``authority_level`` mirrors the existing ROLE_CHOICES integers so that
    authority comparisons remain consistent with the rest of the codebase:
    - 20 = Admin
    - 15 = Member
    - 5  = Guest
    - 0  = custom (default for user-created roles)

    ``is_system`` marks roles that correspond to the three built-in system
    roles (Admin / Member / Guest) and must not be deleted.
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
    # Mirrors ROLE_CHOICES: Admin=20, Member=15, Guest=5, custom=0
    authority_level = models.PositiveIntegerField(default=0)
    schemes = models.ManyToManyField(
        PermissionScheme,
        through="CustomRoleScheme",
        related_name="roles",
        blank=True,
    )

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


class CustomRoleScheme(BaseModel):
    """Junction table linking :class:`CustomRole` ↔ :class:`PermissionScheme`."""

    role = models.ForeignKey(
        CustomRole,
        on_delete=models.CASCADE,
        related_name="role_schemes",
    )
    scheme = models.ForeignKey(
        PermissionScheme,
        on_delete=models.CASCADE,
        related_name="scheme_roles",
    )

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["role", "scheme"],
                condition=Q(deleted_at__isnull=True),
                name="custom_role_scheme_unique_role_scheme_active",
            )
        ]
        verbose_name = "Custom Role Scheme"
        verbose_name_plural = "Custom Role Schemes"
        db_table = "custom_role_schemes"
        ordering = ("-created_at",)

    def __str__(self) -> str:
        return f"{self.role.name} → {self.scheme.name}"
