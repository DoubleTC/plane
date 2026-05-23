# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

from django.db.models import Count, Q
from django.utils import timezone
from rest_framework import status
from rest_framework.response import Response

from plane.app.permissions import ProjectEntityPermission, ProjectLitePermission
from plane.app.serializers import PhaseCycleSerializer, PhaseSerializer, PhaseWriteSerializer
from plane.db.models import Cycle, Phase, PhaseCycle, Project

from .base import BaseViewSet


class PhaseViewSet(BaseViewSet):
    """CRUD for Phases within a project.

    Requires the project to have phase_view enabled.
    """

    permission_classes = [ProjectEntityPermission]
    serializer_class = PhaseSerializer

    def get_queryset(self):
        return (
            Phase.objects.filter(
                workspace__slug=self.kwargs.get("slug"),
                project_id=self.kwargs.get("project_id"),
                archived_at__isnull=True,
            )
            .annotate(
                total_cycles=Count("phase_cycles", distinct=True),
                completed_cycles=Count(
                    "phase_cycles",
                    filter=Q(
                        phase_cycles__cycle__end_date__lt=timezone.now().date(),
                    )
                    | Q(phase_cycles__cycle__status="completed"),
                    distinct=True,
                ),
            )
            .order_by("sort_order")
        )

    def _check_feature_flag(self, project_id, slug):
        project = Project.objects.filter(pk=project_id, workspace__slug=slug).first()
        if not project or not project.phase_view:
            return Response(
                {"error": "Phases are not enabled for this project."},
                status=status.HTTP_403_FORBIDDEN,
            )
        return None

    def list(self, request, slug, project_id):
        err = self._check_feature_flag(project_id, slug)
        if err:
            return err
        phases = self.get_queryset()
        serializer = PhaseSerializer(phases, many=True)
        return Response(serializer.data, status=status.HTTP_200_OK)

    def create(self, request, slug, project_id):
        err = self._check_feature_flag(project_id, slug)
        if err:
            return err
        serializer = PhaseWriteSerializer(data=request.data)
        if serializer.is_valid():
            serializer.save(project_id=project_id, workspace_id=request.user.workspacemember_set.get(workspace__slug=slug).workspace_id, created_by=request.user, updated_by=request.user)
            # Re-fetch with annotations
            phase = Phase.objects.filter(pk=serializer.instance.pk).annotate(
                total_cycles=Count("phase_cycles", distinct=True),
                completed_cycles=Count("phase_cycles", filter=Q(phase_cycles__cycle__end_date__lt=timezone.now().date()) | Q(phase_cycles__cycle__status="completed"), distinct=True),
            ).first()
            return Response(PhaseSerializer(phase).data, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    def retrieve(self, request, slug, project_id, pk):
        phase = self.get_queryset().filter(pk=pk).first()
        if not phase:
            return Response({"error": "Phase not found."}, status=status.HTTP_404_NOT_FOUND)
        return Response(PhaseSerializer(phase).data, status=status.HTTP_200_OK)

    def partial_update(self, request, slug, project_id, pk):
        phase = Phase.objects.filter(workspace__slug=slug, project_id=project_id, pk=pk).first()
        if not phase:
            return Response({"error": "Phase not found."}, status=status.HTTP_404_NOT_FOUND)
        serializer = PhaseWriteSerializer(phase, data=request.data, partial=True)
        if serializer.is_valid():
            serializer.save(updated_by=request.user)
            phase = Phase.objects.filter(pk=pk).annotate(
                total_cycles=Count("phase_cycles", distinct=True),
                completed_cycles=Count("phase_cycles", filter=Q(phase_cycles__cycle__end_date__lt=timezone.now().date()) | Q(phase_cycles__cycle__status="completed"), distinct=True),
            ).first()
            return Response(PhaseSerializer(phase).data, status=status.HTTP_200_OK)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    def destroy(self, request, slug, project_id, pk):
        phase = Phase.objects.filter(workspace__slug=slug, project_id=project_id, pk=pk).first()
        if not phase:
            return Response({"error": "Phase not found."}, status=status.HTTP_404_NOT_FOUND)
        phase.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class PhaseArchiveViewSet(BaseViewSet):
    """Archive / unarchive a phase."""

    permission_classes = [ProjectEntityPermission]

    def create(self, request, slug, project_id, phase_id):
        """POST → archive."""
        phase = Phase.objects.filter(workspace__slug=slug, project_id=project_id, pk=phase_id).first()
        if not phase:
            return Response({"error": "Phase not found."}, status=status.HTTP_404_NOT_FOUND)
        phase.archived_at = timezone.now()
        phase.save(update_fields=["archived_at"])
        return Response({"archived_at": phase.archived_at}, status=status.HTTP_200_OK)

    def destroy(self, request, slug, project_id, phase_id):
        """DELETE → unarchive."""
        phase = Phase.objects.filter(workspace__slug=slug, project_id=project_id, pk=phase_id).first()
        if not phase:
            return Response({"error": "Phase not found."}, status=status.HTTP_404_NOT_FOUND)
        phase.archived_at = None
        phase.save(update_fields=["archived_at"])
        return Response(status=status.HTTP_204_NO_CONTENT)


class PhaseCycleViewSet(BaseViewSet):
    """List, add, and remove Cycles linked to a Phase."""

    permission_classes = [ProjectEntityPermission]
    serializer_class = PhaseCycleSerializer

    def get_queryset(self):
        return PhaseCycle.objects.filter(
            phase__workspace__slug=self.kwargs.get("slug"),
            phase__project_id=self.kwargs.get("project_id"),
            phase_id=self.kwargs.get("phase_id"),
        )

    def list(self, request, slug, project_id, phase_id):
        qs = self.get_queryset().select_related("cycle")
        return Response(PhaseCycleSerializer(qs, many=True).data, status=status.HTTP_200_OK)

    def create(self, request, slug, project_id, phase_id):
        """Add one or more cycles.  Body: {"cycles": [<uuid>, ...]}"""
        phase = Phase.objects.filter(workspace__slug=slug, project_id=project_id, pk=phase_id).first()
        if not phase:
            return Response({"error": "Phase not found."}, status=status.HTTP_404_NOT_FOUND)
        cycle_ids = request.data.get("cycles", [])
        if not cycle_ids:
            return Response({"error": "cycles list is required."}, status=status.HTTP_400_BAD_REQUEST)

        workspace = phase.workspace
        created = []
        for cycle_id in cycle_ids:
            if not Cycle.objects.filter(pk=cycle_id, project_id=project_id).exists():
                continue
            pc, _ = PhaseCycle.objects.get_or_create(
                phase=phase,
                cycle_id=cycle_id,
                defaults={
                    "project_id": project_id,
                    "workspace": workspace,
                    "created_by": request.user,
                    "updated_by": request.user,
                },
            )
            created.append(pc)
        return Response(PhaseCycleSerializer(created, many=True).data, status=status.HTTP_201_CREATED)

    def destroy(self, request, slug, project_id, phase_id, pk):
        """Remove a single PhaseCycle link."""
        pc = self.get_queryset().filter(pk=pk).first()
        if not pc:
            return Response({"error": "PhaseCycle not found."}, status=status.HTTP_404_NOT_FOUND)
        pc.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)
