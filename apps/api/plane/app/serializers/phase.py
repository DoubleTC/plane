# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

from rest_framework import serializers

from plane.db.models import IssueAssignee, Phase, PhaseCycle, User

from .base import BaseSerializer, DynamicBaseSerializer


class PhaseSerializer(DynamicBaseSerializer):
    """Read serializer — includes annotated cycle counts, computed member info, and is_favorite."""

    total_cycles = serializers.IntegerField(read_only=True, default=0)
    completed_cycles = serializers.IntegerField(read_only=True, default=0)
    is_favorite = serializers.BooleanField(read_only=True, default=False)
    lead_id = serializers.PrimaryKeyRelatedField(source="lead", read_only=True, allow_null=True)
    member_ids = serializers.SerializerMethodField()

    class Meta:
        model = Phase
        fields = "__all__"
        read_only_fields = ["workspace", "project", "created_by", "updated_by", "deleted_at"]

    def get_member_ids(self, obj):
        """
        Computed: union of all assignees of all work items in all cycles of this phase.
        Phase → PhaseCycle → Cycle → CycleIssue → IssueAssignee → User

        cycle_ids is materialised to a plain list so Django generates an IN (...)
        clause instead of a correlated subquery, avoiding phantom duplicate rows
        that can appear when the queryset is used directly inside __in with
        multiple JOIN conditions.  A Python set() then guarantees uniqueness
        regardless of any edge-case the DB-level DISTINCT might miss.
        """
        cycle_ids = list(
            PhaseCycle.objects.filter(
                phase=obj,
                deleted_at__isnull=True,
            ).values_list("cycle_id", flat=True)
        )

        if not cycle_ids:
            return []

        assignee_ids = (
            IssueAssignee.objects.filter(
                issue__issue_cycle__cycle_id__in=cycle_ids,
                issue__issue_cycle__deleted_at__isnull=True,
                deleted_at__isnull=True,
            )
            .values_list("assignee_id", flat=True)
            .distinct()
        )
        # Python-level dedup as a safety net against any ORM JOIN artefacts
        return list({str(uid) for uid in assignee_ids})


class PhaseWriteSerializer(BaseSerializer):
    """Write serializer — accepts lead_id only; member_ids are now computed."""

    lead_id = serializers.PrimaryKeyRelatedField(
        source="lead", queryset=User.objects.all(), required=False, allow_null=True
    )

    class Meta:
        model = Phase
        fields = [
            "id",
            "name",
            "description",
            "status",
            "start_date",
            "end_date",
            "lead_id",
            "sort_order",
            "archived_at",
        ]

    def to_representation(self, instance):
        data = super().to_representation(instance)
        data["lead_id"] = str(instance.lead_id) if instance.lead_id else None
        return data

    def create(self, validated_data):
        project = self.context["project"]
        return Phase.objects.create(**validated_data, project=project)

    def update(self, instance, validated_data):
        return super().update(instance, validated_data)


class PhaseCycleSerializer(BaseSerializer):
    class Meta:
        model = PhaseCycle
        fields = "__all__"
        read_only_fields = ["workspace", "project", "created_by", "updated_by", "deleted_at"]
