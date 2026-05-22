# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

from rest_framework import serializers

from plane.db.models import Milestone, MilestoneIssue

from .base import BaseSerializer, DynamicBaseSerializer


class MilestoneSerializer(DynamicBaseSerializer):
    total_issues = serializers.IntegerField(read_only=True, default=0)
    completed_issues = serializers.IntegerField(read_only=True, default=0)
    cancelled_issues = serializers.IntegerField(read_only=True, default=0)
    started_issues = serializers.IntegerField(read_only=True, default=0)
    unstarted_issues = serializers.IntegerField(read_only=True, default=0)
    backlog_issues = serializers.IntegerField(read_only=True, default=0)

    class Meta:
        model = Milestone
        fields = "__all__"
        read_only_fields = ["workspace", "project", "created_by", "updated_by", "deleted_at"]


class MilestoneWriteSerializer(BaseSerializer):
    class Meta:
        model = Milestone
        fields = [
            "id",
            "name",
            "description",
            "target_date",
            "color",
            "sort_order",
            "logo_props",
        ]

    def validate_name(self, value):
        if not value or not value.strip():
            raise serializers.ValidationError("Milestone name cannot be empty.")
        return value.strip()


class MilestoneIssueSerializer(BaseSerializer):
    class Meta:
        model = MilestoneIssue
        fields = "__all__"
        read_only_fields = ["workspace", "project", "milestone", "created_by", "updated_by", "deleted_at"]
