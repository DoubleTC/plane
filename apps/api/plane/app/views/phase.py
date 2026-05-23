# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

from django.db.models import Count, Exists, IntegerField, OuterRef, Q, Subquery
from django.db.models.functions import Coalesce
from rest_framework import status
from rest_framework.response import Response

from plane.app.permissions import ProjectEntityPermission, ProjectLitePermission
from plane.app.serializers import PhaseCycleSerializer, PhaseSerializer, PhaseWriteSerializer
from plane.db.models import Cycle, CycleIssue, Phase, PhaseCycle, Project, UserFavorite

from .base import BaseViewSet


def _annotate_phases(qs, user=None, project_id=None, slug=None):
    """user, project_id, slug: when provided, also annotate is_favorite."""
    """
    Annotate each Phase with:
      - total_cycles   : number of linked PhaseCycles
      - completed_cycles: number of linked cycles where EVERY work item
                         has state.group = 'completed'
                         (cycles with zero issues are NOT counted as complete)
    """
    # Inner exists: does this cycle have at least one CycleIssue?
    cycle_has_any_issue = CycleIssue.objects.filter(
        cycle_id=OuterRef("cycle_id"),
        deleted_at__isnull=True,
    )

    # Inner exists: does this cycle have any issue whose state is NOT 'completed'?
    cycle_has_incomplete_issue = CycleIssue.objects.filter(
        cycle_id=OuterRef("cycle_id"),
        deleted_at__isnull=True,
    ).exclude(issue__state__group="completed")

    # Subquery: for a given Phase PK, count PhaseCycles whose linked cycle is
    # "completed" (has ≥1 issue AND no incomplete issues).
    completed_cycles_subq = Subquery(
        PhaseCycle.objects.filter(
            phase_id=OuterRef("pk"),
            deleted_at__isnull=True,
        )
        .annotate(
            has_any=Exists(cycle_has_any_issue),
            has_incomplete=Exists(cycle_has_incomplete_issue),
        )
        .filter(has_any=True, has_incomplete=False)
        .values("phase_id")
        .annotate(cnt=Count("id"))
        .values("cnt"),
        output_field=IntegerField(),
    )

    annotations = dict(
        total_cycles=Count(
            "phase_cycles",
            filter=Q(phase_cycles__deleted_at__isnull=True),
            distinct=True,
        ),
        completed_cycles=Coalesce(completed_cycles_subq, 0),
    )

    if user is not None:
        favorite_subquery = UserFavorite.objects.filter(
            user=user,
            entity_type="phase",
            entity_identifier=OuterRef("pk"),
            project_id=project_id,
            workspace__slug=slug,
        )
        annotations["is_favorite"] = Exists(favorite_subquery)

    return qs.annotate(**annotations)


class PhaseViewSet(BaseViewSet):
    """CRUD for Phases within a project.

    Requires the project to have phase_view enabled.
    """

    permission_classes = [ProjectEntityPermission]
    serializer_class = PhaseSerializer

    def _get_project(self, project_id, slug):
        return Project.objects.filter(pk=project_id, workspace__slug=slug).first()

    def get_queryset(self):
        return _annotate_phases(
            Phase.objects.filter(
                workspace__slug=self.kwargs.get("slug"),
                project_id=self.kwargs.get("project_id"),
                archived_at__isnull=True,
            ),
            user=self.request.user,
            project_id=self.kwargs.get("project_id"),
            slug=self.kwargs.get("slug"),
        ).order_by("-is_favorite", "sort_order")

    def _check_feature_flag(self, project_id, slug):
        project = self._get_project(project_id, slug)
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
        serializer = PhaseSerializer(self.get_queryset(), many=True)
        return Response(serializer.data, status=status.HTTP_200_OK)

    def create(self, request, slug, project_id):
        err = self._check_feature_flag(project_id, slug)
        if err:
            return err
        project = self._get_project(project_id, slug)
        serializer = PhaseWriteSerializer(
            data=request.data,
            context={"project": project, "request": request},
        )
        if serializer.is_valid():
            serializer.save(
                workspace=project.workspace,
                created_by=request.user,
                updated_by=request.user,
            )
            phase = _annotate_phases(
                Phase.objects.filter(pk=serializer.instance.pk),
                user=request.user,
                project_id=project_id,
                slug=slug,
            ).first()
            return Response(PhaseSerializer(phase).data, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    def retrieve(self, request, slug, project_id, pk):
        phase = _annotate_phases(
            Phase.objects.filter(workspace__slug=slug, project_id=project_id, pk=pk),
            user=request.user,
            project_id=project_id,
            slug=slug,
        ).first()
        if not phase:
            return Response({"error": "Phase not found."}, status=status.HTTP_404_NOT_FOUND)
        return Response(PhaseSerializer(phase).data, status=status.HTTP_200_OK)

    def partial_update(self, request, slug, project_id, pk):
        phase = Phase.objects.filter(workspace__slug=slug, project_id=project_id, pk=pk).first()
        if not phase:
            return Response({"error": "Phase not found."}, status=status.HTTP_404_NOT_FOUND)
        serializer = PhaseWriteSerializer(
            phase,
            data=request.data,
            partial=True,
            context={"project": phase.project, "request": request},
        )
        if serializer.is_valid():
            serializer.save(updated_by=request.user)
            phase = _annotate_phases(
                Phase.objects.filter(pk=pk),
                user=request.user,
                project_id=project_id,
                slug=slug,
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


class PhaseFavoriteViewSet(BaseViewSet):
    """Add / remove a Phase from the current user's favorites."""

    permission_classes = [ProjectLitePermission]
    model = UserFavorite

    def create(self, request, slug, project_id, phase_id):
        UserFavorite.objects.create(
            project_id=project_id,
            user=request.user,
            entity_type="phase",
            entity_identifier=phase_id,
        )
        return Response(status=status.HTTP_204_NO_CONTENT)

    def destroy(self, request, slug, project_id, phase_id):
        favorite = UserFavorite.objects.filter(
            project_id=project_id,
            user=request.user,
            workspace__slug=slug,
            entity_type="phase",
            entity_identifier=phase_id,
        ).first()
        if not favorite:
            return Response({"error": "Favorite not found."}, status=status.HTTP_404_NOT_FOUND)
        favorite.delete(soft=False)
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
