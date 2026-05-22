# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

"""
Custom Role ViewSet — metadata-only role labels.

All endpoints live under /api/workspaces/<slug>/custom-roles/. Read access is
open to any workspace member; mutations require workspace Admin (role=20).
"""

from django.db import transaction
from rest_framework import status
from rest_framework.response import Response

from plane.app.permissions import WorkspaceEntityPermission, allow_permission, ROLE
from plane.app.serializers import CustomRoleSerializer
from plane.db.models import CustomRole, WorkspaceMember, ProjectMember

from ..base import BaseViewSet


class CustomRoleViewSet(BaseViewSet):
    """
    CRUD for Custom Roles (metadata labels — no enforced permissions).

    Query params:
        scope=workspace|project  — filter by scope

    DELETE accepts an optional body ``{"replacement_role_id": "<uuid>"}`` to
    reassign affected members before deletion.
    """

    serializer_class = CustomRoleSerializer
    model = CustomRole
    permission_classes = [WorkspaceEntityPermission]

    def get_queryset(self):
        qs = (
            super()
            .get_queryset()
            .filter(workspace__slug=self.kwargs["slug"])
            .order_by("-is_system", "-authority_level", "name")
        )
        scope = self.request.query_params.get("scope")
        if scope in ("workspace", "project"):
            qs = qs.filter(scope=scope)
        return qs

    @allow_permission(allowed_roles=[ROLE.ADMIN, ROLE.MEMBER, ROLE.GUEST], level="WORKSPACE")
    def list(self, request, slug):
        roles = self.get_queryset()
        serializer = CustomRoleSerializer(roles, many=True)
        return Response(serializer.data, status=status.HTTP_200_OK)

    @allow_permission(allowed_roles=[ROLE.ADMIN, ROLE.MEMBER, ROLE.GUEST], level="WORKSPACE")
    def retrieve(self, request, slug, pk):
        role = self.get_object()
        serializer = CustomRoleSerializer(role)
        return Response(serializer.data, status=status.HTTP_200_OK)

    @allow_permission(allowed_roles=[ROLE.ADMIN], level="WORKSPACE")
    def create(self, request, slug):
        from plane.db.models import Workspace

        workspace = Workspace.objects.get(slug=slug)
        serializer = CustomRoleSerializer(data=request.data)
        if serializer.is_valid():
            serializer.save(workspace=workspace)
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    @allow_permission(allowed_roles=[ROLE.ADMIN], level="WORKSPACE")
    def partial_update(self, request, slug, pk):
        role = self.get_object()
        if role.is_system:
            return Response(
                {"error": "System roles cannot be modified."},
                status=status.HTTP_403_FORBIDDEN,
            )
        serializer = CustomRoleSerializer(role, data=request.data, partial=True)
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data, status=status.HTTP_200_OK)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    @allow_permission(allowed_roles=[ROLE.ADMIN], level="WORKSPACE")
    def destroy(self, request, slug, pk):
        role = self.get_object()
        if role.is_system:
            return Response(
                {"error": "System roles cannot be deleted."},
                status=status.HTTP_403_FORBIDDEN,
            )

        replacement_role_id = request.data.get("replacement_role_id")

        with transaction.atomic():
            if replacement_role_id:
                try:
                    replacement = CustomRole.objects.get(
                        pk=replacement_role_id,
                        workspace__slug=slug,
                    )
                except CustomRole.DoesNotExist:
                    return Response(
                        {"error": "Replacement role not found in this workspace."},
                        status=status.HTTP_400_BAD_REQUEST,
                    )
                WorkspaceMember.objects.filter(custom_role=role).update(custom_role=replacement)
                ProjectMember.objects.filter(custom_role=role).update(custom_role=replacement)
            else:
                WorkspaceMember.objects.filter(custom_role=role).update(custom_role=None)
                ProjectMember.objects.filter(custom_role=role).update(custom_role=None)

            role.delete()

        return Response(status=status.HTTP_204_NO_CONTENT)
