# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

"""
GAC ViewSets — Permission Schemes & Custom Roles
================================================
All endpoints sit under /api/workspaces/<slug>/...
Access is restricted to workspace Admin (role=20).
"""

from django.core.cache import cache
from django.db import transaction
from rest_framework import status
from rest_framework.decorators import action
from rest_framework.response import Response

from plane.app.permissions import WorkspaceEntityPermission, allow_permission, ROLE
from plane.app.serializers import (
    PermissionSchemeSerializer,
    CustomRoleSerializer,
    CustomRoleSchemeSerializer,
)
from plane.db.models import (
    PermissionScheme,
    CustomRole,
    CustomRoleScheme,
    WorkspaceMember,
    ProjectMember,
)
from plane.db.constants.permissions import PERMISSION_GROUPS

from ..base import BaseViewSet, BaseAPIView


# ---------------------------------------------------------------------------
# Permission Scheme ViewSet
# ---------------------------------------------------------------------------


class PermissionSchemeViewSet(BaseViewSet):
    """
    CRUD for Permission Schemes.
    System schemes (is_system=True) are read-only.

    Query params:
        scope=workspace|project  — filter by scope
    """

    serializer_class = PermissionSchemeSerializer
    model = PermissionScheme
    permission_classes = [WorkspaceEntityPermission]

    def get_queryset(self):
        qs = (
            super()
            .get_queryset()
            .filter(workspace__slug=self.kwargs["slug"])
            .order_by("-is_system", "name")
        )
        scope = self.request.query_params.get("scope")
        if scope in ("workspace", "project"):
            qs = qs.filter(scope=scope)
        return qs

    @allow_permission(allowed_roles=[ROLE.ADMIN, ROLE.MEMBER, ROLE.GUEST], level="WORKSPACE")
    def list(self, request, slug):
        schemes = self.get_queryset()
        serializer = PermissionSchemeSerializer(schemes, many=True)
        return Response(serializer.data, status=status.HTTP_200_OK)

    @allow_permission(allowed_roles=[ROLE.ADMIN, ROLE.MEMBER, ROLE.GUEST], level="WORKSPACE")
    def retrieve(self, request, slug, pk):
        scheme = self.get_object()
        serializer = PermissionSchemeSerializer(scheme)
        return Response(serializer.data, status=status.HTTP_200_OK)

    @allow_permission(allowed_roles=[ROLE.ADMIN], level="WORKSPACE")
    def create(self, request, slug):
        from plane.db.models import Workspace

        workspace = Workspace.objects.get(slug=slug)
        serializer = PermissionSchemeSerializer(data=request.data)
        if serializer.is_valid():
            serializer.save(workspace=workspace)
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    @allow_permission(allowed_roles=[ROLE.ADMIN], level="WORKSPACE")
    def partial_update(self, request, slug, pk):
        scheme = self.get_object()
        if scheme.is_system:
            return Response(
                {"error": "System schemes cannot be modified."},
                status=status.HTTP_403_FORBIDDEN,
            )
        serializer = PermissionSchemeSerializer(scheme, data=request.data, partial=True)
        if serializer.is_valid():
            serializer.save()
            # Invalidate effective-permissions cache for all roles using this scheme
            for rs in scheme.scheme_roles.select_related("role").all():
                cache.delete(f"gac:role_perms:{rs.role_id}")
            return Response(serializer.data, status=status.HTTP_200_OK)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    @allow_permission(allowed_roles=[ROLE.ADMIN], level="WORKSPACE")
    def destroy(self, request, slug, pk):
        scheme = self.get_object()
        if scheme.is_system:
            return Response(
                {"error": "System schemes cannot be deleted."},
                status=status.HTTP_403_FORBIDDEN,
            )
        scheme.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)

    @action(detail=False, methods=["get"], url_path="permission-groups")
    @allow_permission(allowed_roles=[ROLE.ADMIN, ROLE.MEMBER, ROLE.GUEST], level="WORKSPACE")
    def permission_groups(self, request, slug):
        """
        Return the full permission group definitions for the UI.
        Query param: scope=workspace|project
        """
        scope = request.query_params.get("scope", "workspace")
        groups = PERMISSION_GROUPS.get(scope, [])
        return Response({"scope": scope, "groups": groups}, status=status.HTTP_200_OK)


# ---------------------------------------------------------------------------
# Custom Role ViewSet
# ---------------------------------------------------------------------------


class CustomRoleViewSet(BaseViewSet):
    """
    CRUD for Custom Roles.
    System roles (is_system=True) cannot be deleted.

    Query params:
        scope=workspace|project  — filter by scope

    DELETE accepts an optional body ``{"replacement_role_id": "<uuid>"}`` to
    reassign members before deletion.
    """

    serializer_class = CustomRoleSerializer
    model = CustomRole
    permission_classes = [WorkspaceEntityPermission]

    def get_queryset(self):
        qs = (
            super()
            .get_queryset()
            .filter(workspace__slug=self.kwargs["slug"])
            .prefetch_related("schemes")
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
                # Validate replacement role belongs to same workspace
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
                WorkspaceMember.objects.filter(custom_role=role).update(
                    custom_role=replacement
                )
                ProjectMember.objects.filter(custom_role=role).update(
                    custom_role=replacement
                )
            else:
                # Clear the custom role (members fall back to system role)
                WorkspaceMember.objects.filter(custom_role=role).update(custom_role=None)
                ProjectMember.objects.filter(custom_role=role).update(custom_role=None)

            cache.delete(f"gac:role_perms:{role.pk}")
            role.delete()

        return Response(status=status.HTTP_204_NO_CONTENT)

    @action(detail=True, methods=["get"], url_path="effective-permissions")
    @allow_permission(allowed_roles=[ROLE.ADMIN, ROLE.MEMBER, ROLE.GUEST], level="WORKSPACE")
    def effective_permissions(self, request, slug, pk):
        """Return the union of all permissions from the role's attached schemes."""
        role = self.get_object()
        all_perms: set[str] = set()
        for scheme in role.schemes.all():
            all_perms.update(scheme.permissions)

        # Resolve unconditional wins
        base_unconditional = {p for p in all_perms if "+" not in p}
        resolved = [
            p for p in all_perms
            if "+" not in p or p.split("+", 1)[0] not in base_unconditional
        ]
        return Response({"permissions": sorted(resolved)}, status=status.HTTP_200_OK)


# ---------------------------------------------------------------------------
# Role ↔ Scheme management
# ---------------------------------------------------------------------------


class RoleSchemeViewSet(BaseViewSet):
    """
    Attach / detach Permission Schemes to/from a Custom Role.

    POST   /workspaces/<slug>/custom-roles/<role_pk>/schemes/
    DELETE /workspaces/<slug>/custom-roles/<role_pk>/schemes/<pk>/
    """

    serializer_class = CustomRoleSchemeSerializer
    model = CustomRoleScheme
    permission_classes = [WorkspaceEntityPermission]

    def get_queryset(self):
        return (
            super()
            .get_queryset()
            .filter(role__workspace__slug=self.kwargs["slug"], role_id=self.kwargs["role_pk"])
            .select_related("scheme")
        )

    @allow_permission(allowed_roles=[ROLE.ADMIN], level="WORKSPACE")
    def create(self, request, slug, role_pk):
        scheme_id = request.data.get("scheme_id")
        if not scheme_id:
            return Response({"error": "scheme_id is required."}, status=status.HTTP_400_BAD_REQUEST)

        try:
            role = CustomRole.objects.get(pk=role_pk, workspace__slug=slug)
        except CustomRole.DoesNotExist:
            return Response({"error": "Role not found."}, status=status.HTTP_404_NOT_FOUND)

        if role.is_system:
            return Response(
                {"error": "Cannot attach schemes to system roles."},
                status=status.HTTP_403_FORBIDDEN,
            )

        try:
            scheme = PermissionScheme.objects.get(pk=scheme_id, workspace__slug=slug)
        except PermissionScheme.DoesNotExist:
            return Response({"error": "Scheme not found."}, status=status.HTTP_404_NOT_FOUND)

        if scheme.scope != role.scope:
            return Response(
                {"error": "Scheme scope must match role scope."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        rs, created = CustomRoleScheme.objects.get_or_create(role=role, scheme=scheme)
        if not created:
            return Response(
                {"error": "Scheme already attached to this role."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        cache.delete(f"gac:role_perms:{role.pk}")
        serializer = CustomRoleSchemeSerializer(rs)
        return Response(serializer.data, status=status.HTTP_201_CREATED)

    @allow_permission(allowed_roles=[ROLE.ADMIN], level="WORKSPACE")
    def destroy(self, request, slug, role_pk, pk):
        try:
            role = CustomRole.objects.get(pk=role_pk, workspace__slug=slug)
        except CustomRole.DoesNotExist:
            return Response({"error": "Role not found."}, status=status.HTTP_404_NOT_FOUND)

        if role.is_system:
            return Response(
                {"error": "Cannot detach schemes from system roles."},
                status=status.HTTP_403_FORBIDDEN,
            )

        try:
            rs = self.get_queryset().get(scheme_id=pk)
        except CustomRoleScheme.DoesNotExist:
            return Response({"error": "Scheme not attached to this role."}, status=status.HTTP_404_NOT_FOUND)

        rs.delete()
        cache.delete(f"gac:role_perms:{role.pk}")
        return Response(status=status.HTTP_204_NO_CONTENT)
