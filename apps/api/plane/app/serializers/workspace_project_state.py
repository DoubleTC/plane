# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only

from plane.db.models import WorkspaceProjectState

from .base import BaseSerializer, DynamicBaseSerializer


class WorkspaceProjectStateSerializer(DynamicBaseSerializer):
    class Meta:
        model = WorkspaceProjectState
        fields = "__all__"
        read_only_fields = [
            "workspace",
            "id",
            "created_at",
            "updated_at",
            "created_by",
            "updated_by",
        ]


class WorkspaceProjectStateWriteSerializer(BaseSerializer):
    class Meta:
        model = WorkspaceProjectState
        fields = ["name", "description", "group", "color", "sequence"]
