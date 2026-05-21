# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

"""Serializers for the GAC (Granular Access Control) models."""

from rest_framework import serializers

from plane.db.models import PermissionScheme, CustomRole, CustomRoleScheme
from plane.db.constants.permissions import RESERVED_PERMISSIONS, ALL_PERMISSIONS

from .base import BaseSerializer


class PermissionSchemeSerializer(BaseSerializer):
    class Meta:
        model = PermissionScheme
        fields = [
            "id",
            "workspace",
            "name",
            "description",
            "scope",
            "is_system",
            "permissions",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "workspace", "is_system", "created_at", "updated_at"]

    def validate_permissions(self, value: list) -> list:
        """
        Validate that every identifier in *value* is a known permission and
        that none of the reserved permissions (workspace:delete, etc.) are
        included.
        """
        if not isinstance(value, list):
            raise serializers.ValidationError("permissions must be a list.")

        invalid = [p for p in value if p not in ALL_PERMISSIONS]
        if invalid:
            raise serializers.ValidationError(
                f"Unknown permission identifier(s): {invalid}"
            )

        reserved = [p for p in value if p in RESERVED_PERMISSIONS]
        if reserved:
            raise serializers.ValidationError(
                f"The following permissions are reserved and cannot be assigned: {reserved}"
            )

        return list(set(value))  # deduplicate

    def validate(self, attrs):
        # Prevent editing system schemes
        if self.instance and self.instance.is_system:
            raise serializers.ValidationError("System schemes cannot be modified.")
        return attrs


class PermissionSchemeLiteSerializer(BaseSerializer):
    """Lightweight variant used when embedding schemes inside a role."""

    class Meta:
        model = PermissionScheme
        fields = ["id", "name", "scope", "is_system", "permissions"]
        read_only_fields = fields


class CustomRoleSerializer(BaseSerializer):
    schemes = PermissionSchemeLiteSerializer(many=True, read_only=True)
    effective_permissions = serializers.SerializerMethodField()
    member_count = serializers.SerializerMethodField()

    class Meta:
        model = CustomRole
        fields = [
            "id",
            "workspace",
            "name",
            "description",
            "scope",
            "is_system",
            "authority_level",
            "schemes",
            "effective_permissions",
            "member_count",
            "created_at",
            "updated_at",
        ]
        read_only_fields = [
            "id",
            "workspace",
            "is_system",
            "authority_level",
            "schemes",
            "effective_permissions",
            "member_count",
            "created_at",
            "updated_at",
        ]

    def get_effective_permissions(self, obj: CustomRole) -> list[str]:
        all_perms: set[str] = set()
        for scheme in obj.schemes.all():
            all_perms.update(scheme.permissions)
        return list(_resolve_conditional_conflicts(all_perms))

    def get_member_count(self, obj: CustomRole) -> int:
        from plane.db.models import WorkspaceMember, ProjectMember

        ws_count = WorkspaceMember.objects.filter(custom_role=obj, is_active=True).count()
        proj_count = ProjectMember.objects.filter(custom_role=obj, is_active=True).count()
        return ws_count + proj_count


class CustomRoleSchemeSerializer(BaseSerializer):
    class Meta:
        model = CustomRoleScheme
        fields = ["id", "role", "scheme", "created_at"]
        read_only_fields = ["id", "created_at"]


# ---------------------------------------------------------------------------
# Utility
# ---------------------------------------------------------------------------


def _resolve_conditional_conflicts(permissions: set[str]) -> set[str]:
    base_unconditional = {p for p in permissions if "+" not in p}
    resolved: set[str] = set()
    for perm in permissions:
        if "+" in perm:
            base = perm.split("+", 1)[0]
            if base in base_unconditional:
                continue
        resolved.add(perm)
    return resolved
