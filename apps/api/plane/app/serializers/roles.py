# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

"""Serializer for the metadata-only Custom Role model."""

from rest_framework import serializers

from plane.db.models import CustomRole

from .base import BaseSerializer


class CustomRoleSerializer(BaseSerializer):
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
            "member_count",
            "created_at",
            "updated_at",
        ]
        read_only_fields = [
            "id",
            "workspace",
            "is_system",
            "authority_level",
            "member_count",
            "created_at",
            "updated_at",
        ]

    def get_member_count(self, obj: CustomRole) -> int:
        from plane.db.models import WorkspaceMember, ProjectMember

        ws_count = WorkspaceMember.objects.filter(custom_role=obj, is_active=True).count()
        proj_count = ProjectMember.objects.filter(custom_role=obj, is_active=True).count()
        return ws_count + proj_count
