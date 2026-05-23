# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

from rest_framework import serializers

from plane.db.models import Phase, PhaseCycle

from .base import BaseSerializer, DynamicBaseSerializer


class PhaseSerializer(DynamicBaseSerializer):
    """Read serializer — includes annotated cycle counts."""

    total_cycles = serializers.IntegerField(read_only=True, default=0)
    completed_cycles = serializers.IntegerField(read_only=True, default=0)

    class Meta:
        model = Phase
        fields = "__all__"
        read_only_fields = ["workspace", "project", "created_by", "updated_by", "deleted_at"]


class PhaseWriteSerializer(BaseSerializer):
    class Meta:
        model = Phase
        fields = [
            "id",
            "name",
            "description",
            "start_date",
            "end_date",
            "sort_order",
            "archived_at",
        ]


class PhaseCycleSerializer(BaseSerializer):
    class Meta:
        model = PhaseCycle
        fields = "__all__"
        read_only_fields = ["workspace", "project", "created_by", "updated_by", "deleted_at"]
