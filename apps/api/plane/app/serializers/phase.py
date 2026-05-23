# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

from rest_framework import serializers

from plane.db.models import Phase, PhaseMember, PhaseCycle, User

from .base import BaseSerializer, DynamicBaseSerializer


class PhaseSerializer(DynamicBaseSerializer):
    """Read serializer — includes annotated cycle counts, member info, and is_favorite."""

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
        return [str(m.id) for m in obj.members.all()]


class PhaseWriteSerializer(BaseSerializer):
    """Write serializer that accepts lead_id and member_ids."""

    lead_id = serializers.PrimaryKeyRelatedField(
        source="lead", queryset=User.objects.all(), required=False, allow_null=True
    )
    member_ids = serializers.ListField(
        child=serializers.PrimaryKeyRelatedField(queryset=User.objects.all()),
        write_only=True,
        required=False,
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
            "member_ids",
            "sort_order",
            "archived_at",
        ]

    def to_representation(self, instance):
        data = super().to_representation(instance)
        data["lead_id"] = str(instance.lead_id) if instance.lead_id else None
        data["member_ids"] = [str(m.id) for m in instance.members.all()]
        return data

    def _sync_members(self, phase, members, project):
        if members is None:
            return
        PhaseMember.objects.filter(phase=phase, deleted_at__isnull=True).delete()
        PhaseMember.objects.bulk_create(
            [
                PhaseMember(
                    phase=phase,
                    member=member,
                    project=project,
                    workspace=project.workspace,
                    created_by=phase.created_by,
                    updated_by=phase.updated_by,
                )
                for member in members
            ],
            batch_size=10,
            ignore_conflicts=True,
        )

    def create(self, validated_data):
        members = validated_data.pop("member_ids", None)
        project = self.context["project"]
        phase = Phase.objects.create(**validated_data, project=project)
        self._sync_members(phase, members, project)
        return phase

    def update(self, instance, validated_data):
        members = validated_data.pop("member_ids", None)
        self._sync_members(instance, members, instance.project)
        return super().update(instance, validated_data)


class PhaseCycleSerializer(BaseSerializer):
    class Meta:
        model = PhaseCycle
        fields = "__all__"
        read_only_fields = ["workspace", "project", "created_by", "updated_by", "deleted_at"]
