# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only

from rest_framework import status
from rest_framework.response import Response

from plane.app.permissions import ROLE, allow_permission
from plane.app.serializers import WorkspaceProjectStateSerializer, WorkspaceProjectStateWriteSerializer
from plane.app.views.base import BaseAPIView, BaseViewSet
from plane.db.models import DEFAULT_PROJECT_STATES, Workspace, WorkspaceProjectState


class WorkspaceProjectStateViewSet(BaseViewSet):
    serializer_class = WorkspaceProjectStateSerializer
    model = WorkspaceProjectState

    def get_queryset(self):
        return WorkspaceProjectState.objects.filter(
            workspace__slug=self.kwargs["slug"],
            deleted_at__isnull=True,
        ).order_by("sequence")

    @allow_permission([ROLE.ADMIN, ROLE.MEMBER, ROLE.GUEST], level="WORKSPACE")
    def list(self, request, slug):
        states = self.get_queryset()
        serializer = WorkspaceProjectStateSerializer(states, many=True)
        return Response(serializer.data, status=status.HTTP_200_OK)

    @allow_permission([ROLE.ADMIN], level="WORKSPACE")
    def create(self, request, slug):
        workspace = Workspace.objects.get(slug=slug)
        serializer = WorkspaceProjectStateWriteSerializer(data=request.data)
        if serializer.is_valid():
            serializer.save(workspace=workspace, created_by=request.user, updated_by=request.user)
            full = WorkspaceProjectStateSerializer(WorkspaceProjectState.objects.get(pk=serializer.instance.pk))
            return Response(full.data, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    @allow_permission([ROLE.ADMIN, ROLE.MEMBER, ROLE.GUEST], level="WORKSPACE")
    def retrieve(self, request, slug, pk):
        state = self.get_queryset().filter(pk=pk).first()
        if not state:
            return Response({"error": "State not found."}, status=status.HTTP_404_NOT_FOUND)
        serializer = WorkspaceProjectStateSerializer(state)
        return Response(serializer.data, status=status.HTTP_200_OK)

    @allow_permission([ROLE.ADMIN], level="WORKSPACE")
    def partial_update(self, request, slug, pk):
        state = self.get_queryset().filter(pk=pk).first()
        if not state:
            return Response({"error": "State not found."}, status=status.HTTP_404_NOT_FOUND)
        serializer = WorkspaceProjectStateWriteSerializer(state, data=request.data, partial=True)
        if serializer.is_valid():
            serializer.save(updated_by=request.user)
            full = WorkspaceProjectStateSerializer(WorkspaceProjectState.objects.get(pk=state.pk))
            return Response(full.data, status=status.HTTP_200_OK)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    @allow_permission([ROLE.ADMIN], level="WORKSPACE")
    def destroy(self, request, slug, pk):
        state = self.get_queryset().filter(pk=pk).first()
        if not state:
            return Response({"error": "State not found."}, status=status.HTTP_404_NOT_FOUND)
        state.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class WorkspaceProjectStateFeatureToggleEndpoint(BaseAPIView):
    @allow_permission([ROLE.ADMIN], level="WORKSPACE")
    def post(self, request, slug):
        workspace = Workspace.objects.get(slug=slug, deleted_at__isnull=True)
        enabled = request.data.get("project_states_enabled")
        if enabled is None:
            return Response(
                {"error": "project_states_enabled is required."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        workspace.project_states_enabled = bool(enabled)
        workspace.save(update_fields=["project_states_enabled", "updated_at"])

        # Seed defaults on first enable if no states exist yet
        if workspace.project_states_enabled and not workspace.project_states.filter(deleted_at__isnull=True).exists():
            WorkspaceProjectState.objects.bulk_create(
                [
                    WorkspaceProjectState(
                        workspace=workspace,
                        name=s["name"],
                        group=s["group"],
                        color=s["color"],
                        sequence=s["sequence"],
                        created_by=request.user,
                        updated_by=request.user,
                    )
                    for s in DEFAULT_PROJECT_STATES
                ]
            )

        return Response(
            {"project_states_enabled": workspace.project_states_enabled},
            status=status.HTTP_200_OK,
        )
