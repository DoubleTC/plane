# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

# Third party imports
from rest_framework import serializers

# Module imports
from plane.db.models import Phase, ProjectMember, User
from plane.utils.phase_rules import PHASE_DATES_OVERLAP_ERROR, overlapping_phases
from .base import BaseSerializer


class PhaseSerializer(BaseSerializer):
    """
    Phase with cycle progress.

    A phase groups cycles into a named time-box. total_cycles and completed_cycles
    are computed from the linked cycles (a cycle counts as completed when it has at
    least one work item and all of them are in a completed state).
    """

    total_cycles = serializers.IntegerField(read_only=True, default=0)
    completed_cycles = serializers.IntegerField(read_only=True, default=0)
    cycle_ids = serializers.ListField(child=serializers.UUIDField(), read_only=True, default=list)

    class Meta:
        model = Phase
        fields = [
            "id",
            "name",
            "description",
            "status",
            "start_date",
            "end_date",
            "lead",
            "sort_order",
            "archived_at",
            "total_cycles",
            "completed_cycles",
            "cycle_ids",
            "project",
            "workspace",
            "created_at",
            "updated_at",
            "created_by",
            "updated_by",
        ]
        read_only_fields = fields


class PhaseWriteSerializer(BaseSerializer):
    """
    Create or update a phase.

    Dates are optional, but when both are set the start date must not be after the
    end date and the range must not overlap another non-archived phase of the project.
    The lead must be an active member of the project.
    """

    lead = serializers.PrimaryKeyRelatedField(
        queryset=User.objects.all(),
        required=False,
        allow_null=True,
        help_text="ID of the project member who leads the phase.",
    )

    class Meta:
        model = Phase
        fields = [
            "name",
            "description",
            "status",
            "start_date",
            "end_date",
            "lead",
            "sort_order",
        ]

    def validate(self, data):
        project = self.context["project"]
        start_date = data.get("start_date", self.instance.start_date if self.instance else None)
        end_date = data.get("end_date", self.instance.end_date if self.instance else None)

        if start_date and end_date:
            if start_date > end_date:
                raise serializers.ValidationError("Start date cannot exceed end date")

            exclude = self.instance.pk if self.instance else None
            if overlapping_phases(project.id, start_date, end_date, exclude_phase_id=exclude).exists():
                raise serializers.ValidationError(PHASE_DATES_OVERLAP_ERROR)

        lead = data.get("lead")
        if (
            lead
            and not ProjectMember.objects.filter(
                project=project,
                member=lead,
                is_active=True,
            ).exists()
        ):
            raise serializers.ValidationError({"lead": "Lead must be an active member of the project"})

        return data


class PhaseCycleRequestSerializer(serializers.Serializer):
    """Cycles to link to a phase."""

    cycles = serializers.ListField(
        child=serializers.UUIDField(),
        allow_empty=False,
        help_text="IDs of cycles of the same project to link to the phase.",
    )
