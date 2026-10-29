# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

# Django imports
from django.contrib.postgres.aggregates import ArrayAgg
from django.db import IntegrityError, transaction
from django.db.models import Q, Value
from django.utils import timezone

# Third party imports
from rest_framework import status
from rest_framework.response import Response
from drf_spectacular.utils import OpenApiParameter, OpenApiRequest, OpenApiResponse
from drf_spectacular.types import OpenApiTypes

# Module imports
from plane.api.serializers import (
    CycleLiteSerializer,
    PhaseCycleRequestSerializer,
    PhaseSerializer,
    PhaseWriteSerializer,
)
from plane.app.permissions import ProjectEntityPermission
from plane.db.models import Cycle, Phase, PhaseCycle, Project
from plane.utils.phase_progress import annotate_phase_cycle_progress
from plane.utils.phase_rules import (
    PHASE_DATES_OVERLAP_ERROR,
    PHASE_DELETE_FORBIDDEN_ERROR,
    can_delete_phase,
    has_overlap,
)
from plane.utils.openapi import (
    phase_docs,
    PHASE_ID_PARAMETER,
    CYCLE_ID_PARAMETER,
    CURSOR_PARAMETER,
    PER_PAGE_PARAMETER,
    create_paginated_response,
    INVALID_REQUEST_RESPONSE,
    DELETED_RESPONSE,
)
from .base import BaseAPIView

PHASES_DISABLED_ERROR = "Phases are not enabled for this project."

ARCHIVED_PARAMETER = OpenApiParameter(
    name="archived",
    description="List archived phases instead of active ones",
    required=False,
    type=OpenApiTypes.BOOL,
    location=OpenApiParameter.QUERY,
)


class PhaseBaseAPIEndpoint(BaseAPIView):
    """Shared lookups for phase endpoints; every endpoint requires the project's Phases feature."""

    permission_classes = [ProjectEntityPermission]

    def initial(self, request, *args, **kwargs):
        super().initial(request, *args, **kwargs)
        self.project = Project.objects.filter(
            pk=self.kwargs.get("project_id"),
            workspace__slug=self.kwargs.get("slug"),
            archived_at__isnull=True,
        ).first()

    def phases_disabled_response(self):
        """Return an error response when the project is missing or has Phases disabled, else None."""
        if not self.project:
            return Response({"error": "Project not found."}, status=status.HTTP_404_NOT_FOUND)
        if not self.project.phase_view:
            return Response({"error": PHASES_DISABLED_ERROR}, status=status.HTTP_403_FORBIDDEN)
        return None

    def phase_queryset(self):
        return annotate_phase_cycle_progress(Phase.objects.filter(project=self.project)).annotate(
            cycle_ids=ArrayAgg(
                "phase_cycles__cycle_id",
                # phase_cycles__isnull=False drops the NULL row the LEFT JOIN yields for phases without links.
                filter=Q(
                    phase_cycles__isnull=False,
                    phase_cycles__deleted_at__isnull=True,
                    phase_cycles__cycle__deleted_at__isnull=True,
                ),
                distinct=True,
                default=Value([]),
            )
        )

    def get_phase(self, phase_id):
        return self.phase_queryset().get(pk=phase_id)

    def integrity_error_response(self, name, exclude_phase_id=None):
        """409 when the failure is the per-project unique name, otherwise a generic 400."""
        existing = Phase.objects.filter(project=self.project, name=name)
        if exclude_phase_id:
            existing = existing.exclude(pk=exclude_phase_id)
        existing = existing.first() if name else None
        if existing:
            return Response(
                {"error": "Phase with the same name already exists in the project", "id": str(existing.id)},
                status=status.HTTP_409_CONFLICT,
            )
        return Response({"error": "The payload is not valid"}, status=status.HTTP_400_BAD_REQUEST)


class PhaseListCreateAPIEndpoint(PhaseBaseAPIEndpoint):
    """List and create phases of a project."""

    @phase_docs(
        operation_id="list_phases",
        summary="List phases",
        description="List the phases of a project with their cycle progress. Archived phases are excluded unless archived=true.",  # noqa: E501
        parameters=[CURSOR_PARAMETER, PER_PAGE_PARAMETER, ARCHIVED_PARAMETER],
        responses={
            200: create_paginated_response(
                PhaseSerializer,
                "PaginatedPhaseResponse",
                "Paginated list of phases",
                "Paginated Phases",
            ),
        },
    )
    def get(self, request, slug, project_id):
        """List phases"""
        if error := self.phases_disabled_response():
            return error
        archived = request.GET.get("archived", "false").lower() == "true"
        queryset = self.phase_queryset().filter(archived_at__isnull=not archived).order_by("sort_order", "created_at")
        return self.paginate(
            request=request,
            queryset=queryset,
            on_results=lambda phases: PhaseSerializer(phases, many=True, fields=self.fields).data,
        )

    @phase_docs(
        operation_id="create_phase",
        summary="Create phase",
        description="Create a phase in a project. Dates are optional but must not overlap another active phase.",
        request=OpenApiRequest(request=PhaseWriteSerializer),
        responses={
            201: OpenApiResponse(description="Phase created", response=PhaseSerializer),
            400: INVALID_REQUEST_RESPONSE,
            409: OpenApiResponse(description="A phase with the same name already exists"),
        },
    )
    def post(self, request, slug, project_id):
        """Create phase"""
        if error := self.phases_disabled_response():
            return error
        serializer = PhaseWriteSerializer(data=request.data, context={"project": self.project})
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        try:
            with transaction.atomic():
                phase = serializer.save(project=self.project, workspace=self.project.workspace)
        except IntegrityError:
            return self.integrity_error_response(serializer.validated_data.get("name"))
        return Response(PhaseSerializer(self.get_phase(phase.id)).data, status=status.HTTP_201_CREATED)


class PhaseDetailAPIEndpoint(PhaseBaseAPIEndpoint):
    """Retrieve, update and delete a phase."""

    @phase_docs(
        operation_id="retrieve_phase",
        summary="Retrieve phase",
        description="Retrieve a phase with its cycle progress and linked cycle IDs.",
        parameters=[PHASE_ID_PARAMETER],
        responses={200: OpenApiResponse(description="Phase", response=PhaseSerializer)},
    )
    def get(self, request, slug, project_id, phase_id):
        """Retrieve phase"""
        if error := self.phases_disabled_response():
            return error
        return Response(PhaseSerializer(self.get_phase(phase_id), fields=self.fields).data, status=status.HTTP_200_OK)

    @phase_docs(
        operation_id="update_phase",
        summary="Update phase",
        description="Partially update a phase. Dates must not overlap another active phase.",
        parameters=[PHASE_ID_PARAMETER],
        request=OpenApiRequest(request=PhaseWriteSerializer),
        responses={
            200: OpenApiResponse(description="Phase updated", response=PhaseSerializer),
            400: INVALID_REQUEST_RESPONSE,
            409: OpenApiResponse(description="A phase with the same name already exists"),
        },
    )
    def patch(self, request, slug, project_id, phase_id):
        """Update phase"""
        if error := self.phases_disabled_response():
            return error
        phase = Phase.objects.get(project=self.project, pk=phase_id)
        serializer = PhaseWriteSerializer(phase, data=request.data, partial=True, context={"project": self.project})
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        try:
            with transaction.atomic():
                serializer.save()
        except IntegrityError:
            return self.integrity_error_response(serializer.validated_data.get("name"), exclude_phase_id=phase_id)
        return Response(PhaseSerializer(self.get_phase(phase_id)).data, status=status.HTTP_200_OK)

    @phase_docs(
        operation_id="delete_phase",
        summary="Delete phase",
        description="Delete a phase. Linked cycles are kept; only the links are removed. "
        "Only a project admin or the phase creator can delete a phase.",
        parameters=[PHASE_ID_PARAMETER],
        responses={204: DELETED_RESPONSE},
    )
    def delete(self, request, slug, project_id, phase_id):
        """Delete phase"""
        if error := self.phases_disabled_response():
            return error
        phase = Phase.objects.get(project=self.project, pk=phase_id)
        if not can_delete_phase(request.user, phase):
            return Response({"error": PHASE_DELETE_FORBIDDEN_ERROR}, status=status.HTTP_403_FORBIDDEN)
        phase.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class PhaseArchiveUnarchiveAPIEndpoint(PhaseBaseAPIEndpoint):
    """Archive (POST) or unarchive (DELETE) a phase."""

    @phase_docs(
        operation_id="archive_phase",
        summary="Archive phase",
        description="Archive a phase. Archived phases are hidden from the default phase list.",
        parameters=[PHASE_ID_PARAMETER],
        request=None,
        responses={200: OpenApiResponse(description="Phase archived", response=PhaseSerializer)},
    )
    def post(self, request, slug, project_id, phase_id):
        """Archive phase"""
        if error := self.phases_disabled_response():
            return error
        phase = Phase.objects.get(project=self.project, pk=phase_id)
        phase.archived_at = timezone.now()
        phase.save(update_fields=["archived_at", "updated_at"])
        return Response(PhaseSerializer(self.get_phase(phase_id)).data, status=status.HTTP_200_OK)

    @phase_docs(
        operation_id="unarchive_phase",
        summary="Unarchive phase",
        description="Restore an archived phase to the default phase list. Rejected when its dates overlap "
        "another active phase.",
        parameters=[PHASE_ID_PARAMETER],
        responses={
            200: OpenApiResponse(description="Phase unarchived", response=PhaseSerializer),
            400: INVALID_REQUEST_RESPONSE,
        },
    )
    def delete(self, request, slug, project_id, phase_id):
        """Unarchive phase"""
        if error := self.phases_disabled_response():
            return error
        phase = Phase.objects.get(project=self.project, pk=phase_id)
        if phase.archived_at and has_overlap(phase):
            return Response({"error": PHASE_DATES_OVERLAP_ERROR}, status=status.HTTP_400_BAD_REQUEST)
        phase.archived_at = None
        phase.save(update_fields=["archived_at", "updated_at"])
        return Response(PhaseSerializer(self.get_phase(phase_id)).data, status=status.HTTP_200_OK)


class PhaseCycleListCreateAPIEndpoint(PhaseBaseAPIEndpoint):
    """List and link cycles of a phase."""

    def linked_cycles(self, phase_id):
        return Cycle.objects.filter(
            project=self.project,
            phase_cycles__phase_id=phase_id,
            phase_cycles__deleted_at__isnull=True,
        ).order_by("start_date", "created_at")

    @phase_docs(
        operation_id="list_phase_cycles",
        summary="List phase cycles",
        description="List the cycles linked to a phase.",
        parameters=[PHASE_ID_PARAMETER],
        responses={200: OpenApiResponse(description="Linked cycles", response=CycleLiteSerializer(many=True))},
    )
    def get(self, request, slug, project_id, phase_id):
        """List phase cycles"""
        if error := self.phases_disabled_response():
            return error
        Phase.objects.get(project=self.project, pk=phase_id)
        cycles = self.linked_cycles(phase_id)
        return Response(CycleLiteSerializer(cycles, many=True, fields=self.fields).data, status=status.HTTP_200_OK)

    @phase_docs(
        operation_id="add_phase_cycles",
        summary="Add cycles to phase",
        description="Link cycles of the same project to a phase. Already linked cycles are left unchanged.",
        parameters=[PHASE_ID_PARAMETER],
        request=OpenApiRequest(request=PhaseCycleRequestSerializer),
        responses={
            200: OpenApiResponse(description="All cycles now linked", response=CycleLiteSerializer(many=True)),
            400: INVALID_REQUEST_RESPONSE,
        },
    )
    def post(self, request, slug, project_id, phase_id):
        """Add cycles to phase"""
        if error := self.phases_disabled_response():
            return error
        phase = Phase.objects.get(project=self.project, pk=phase_id)
        serializer = PhaseCycleRequestSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        requested_ids = {str(cycle_id) for cycle_id in serializer.validated_data["cycles"]}
        found_ids = {
            str(cycle_id)
            for cycle_id in Cycle.objects.filter(project=self.project, pk__in=requested_ids).values_list(
                "id", flat=True
            )
        }
        if missing := sorted(requested_ids - found_ids):
            return Response(
                {"error": "Cycles not found in this project", "cycle_ids": missing},
                status=status.HTTP_400_BAD_REQUEST,
            )

        for cycle_id in found_ids:
            PhaseCycle.objects.get_or_create(
                phase=phase,
                cycle_id=cycle_id,
                defaults={"project": self.project, "workspace": self.project.workspace},
            )
        cycles = self.linked_cycles(phase_id)
        return Response(CycleLiteSerializer(cycles, many=True).data, status=status.HTTP_200_OK)


class PhaseCycleDetailAPIEndpoint(PhaseBaseAPIEndpoint):
    """Unlink a cycle from a phase."""

    @phase_docs(
        operation_id="remove_phase_cycle",
        summary="Remove cycle from phase",
        description="Unlink a cycle from a phase. The cycle itself is not changed.",
        parameters=[PHASE_ID_PARAMETER, CYCLE_ID_PARAMETER],
        responses={204: DELETED_RESPONSE},
    )
    def delete(self, request, slug, project_id, phase_id, cycle_id):
        """Remove cycle from phase"""
        if error := self.phases_disabled_response():
            return error
        PhaseCycle.objects.get(phase_id=phase_id, phase__project=self.project, cycle_id=cycle_id).delete()
        return Response(status=status.HTTP_204_NO_CONTENT)
