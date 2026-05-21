# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

"""
GAC Permission Evaluation Engine
=================================
Evaluates whether a user holds a specific permission inside a workspace or
project, taking custom roles and permission schemes into account.

Evaluation order
----------------
1. Workspace Admin (role=20) → unconditional True  (matches existing allow_permission behaviour)
2. Project-level membership  → check custom_role or system role
3. Workspace-level membership → check custom_role or system role
4. Default → False
"""

from __future__ import annotations

from functools import wraps
from typing import Optional

from django.core.cache import cache


# Cache TTLs
_USER_PERM_TTL = 300    # 5 minutes
_ROLE_PERM_TTL = 86400  # 24 hours


# ---------------------------------------------------------------------------
# Engine
# ---------------------------------------------------------------------------


class PermissionEngine:
    """Thread-safe, cache-backed permission evaluator."""

    def check(
        self,
        user_id: str,
        permission: str,
        workspace_id: str,
        project_id: Optional[str] = None,
        resource_creator_id: Optional[str] = None,
    ) -> bool:
        """
        Return ``True`` if *user_id* holds *permission* in the given context.

        Parameters
        ----------
        user_id:
            UUID string of the requesting user.
        permission:
            Identifier such as ``"workitem:delete"`` or
            ``"workitem:delete+creator"``.
        workspace_id:
            UUID string of the target workspace.
        project_id:
            UUID string of the target project (optional).
        resource_creator_id:
            UUID string of the resource's creator, required when evaluating
            ``+creator`` conditional grants.
        """
        # 1. Workspace Admin bypass
        ws_member = self._get_workspace_member(user_id, workspace_id)
        if ws_member and ws_member.role == 20:
            return True

        # 2. Project-level check
        if project_id:
            result = self._check_project_level(
                user_id, permission, workspace_id, project_id, resource_creator_id
            )
            if result is not None:
                return result

        # 3. Workspace-level check
        result = self._check_workspace_level(user_id, permission, workspace_id, resource_creator_id)
        return result if result is not None else False

    # ---------------------------------------------------------------------- #
    # Internal helpers
    # ---------------------------------------------------------------------- #

    def _get_workspace_member(self, user_id: str, workspace_id: str):
        cache_key = f"gac:ws_member:{user_id}:{workspace_id}"
        cached = cache.get(cache_key)
        if cached is not None:
            return cached

        from plane.db.models import WorkspaceMember

        try:
            member = WorkspaceMember.objects.select_related("custom_role").get(
                member_id=user_id,
                workspace_id=workspace_id,
                is_active=True,
            )
            cache.set(cache_key, member, _USER_PERM_TTL)
            return member
        except WorkspaceMember.DoesNotExist:
            return None

    def _check_project_level(
        self,
        user_id: str,
        permission: str,
        workspace_id: str,
        project_id: str,
        resource_creator_id: Optional[str],
    ) -> Optional[bool]:
        from plane.db.models import ProjectMember

        try:
            proj_member = ProjectMember.objects.select_related("custom_role").get(
                member_id=user_id,
                workspace_id=workspace_id,
                project_id=project_id,
                is_active=True,
            )
        except ProjectMember.DoesNotExist:
            return None

        if proj_member.custom_role_id:
            perms = self._get_effective_permissions(proj_member.custom_role)
            return self._has_permission(perms, permission, user_id, resource_creator_id)

        # Fallback: use system-role permission set
        return self._system_role_has_permission(
            proj_member.role, permission, user_id, resource_creator_id
        )

    def _check_workspace_level(
        self,
        user_id: str,
        permission: str,
        workspace_id: str,
        resource_creator_id: Optional[str],
    ) -> Optional[bool]:
        ws_member = self._get_workspace_member(user_id, workspace_id)
        if not ws_member:
            return None

        if ws_member.custom_role_id:
            perms = self._get_effective_permissions(ws_member.custom_role)
            return self._has_permission(perms, permission, user_id, resource_creator_id)

        return self._system_role_has_permission(
            ws_member.role, permission, user_id, resource_creator_id
        )

    def _get_effective_permissions(self, role) -> set[str]:
        """
        Return the union of all permissions from the role's attached schemes.
        Uses a 24-hour Redis cache keyed by role PK.
        Uses prefetch_related to avoid N+1 queries.
        """
        cache_key = f"gac:role_perms:{role.pk}"
        cached = cache.get(cache_key)
        if cached is not None:
            return cached

        from plane.db.models import CustomRole

        role_obj = CustomRole.objects.prefetch_related("schemes").get(pk=role.pk)
        all_perms: set[str] = set()
        for scheme in role_obj.schemes.all():
            all_perms.update(scheme.permissions)

        resolved = _resolve_conditional_conflicts(all_perms)
        cache.set(cache_key, resolved, _ROLE_PERM_TTL)
        return resolved

    def _has_permission(
        self,
        effective_perms: set[str],
        target: str,
        user_id: str,
        resource_creator_id: Optional[str],
    ) -> bool:
        for perm in effective_perms:
            if "+" not in perm:
                if perm == target:
                    return True
            else:
                base, condition = perm.split("+", 1)
                if base != target:
                    continue
                if condition == "creator" and resource_creator_id == user_id:
                    return True
        return False

    def _system_role_has_permission(
        self,
        role_value: int,
        permission: str,
        user_id: str,
        resource_creator_id: Optional[str],
    ) -> Optional[bool]:
        """
        Fallback for members who have not been assigned a custom role.
        Maps the integer system role to a default permission set.
        Returns None to defer to the caller when no mapping exists.
        """
        from plane.db.constants.permissions import (
            WORKSPACE_PERMISSIONS,
            PROJECT_PERMISSIONS,
            _WORKSPACE_MEMBER_PERMS,
            _WORKSPACE_GUEST_PERMS,
            _PROJECT_MEMBER_PERMS,
            _PROJECT_GUEST_PERMS,
        )

        # We re-use the same sets defined in the seed command.
        # Import them lazily to avoid circular import at module load time.
        _SYSTEM_PERMISSION_MAP: dict[int, list[str]] = {
            20: WORKSPACE_PERMISSIONS + PROJECT_PERMISSIONS,  # Admin
            15: _WORKSPACE_MEMBER_PERMS + _PROJECT_MEMBER_PERMS,  # Member
            5: _WORKSPACE_GUEST_PERMS + _PROJECT_GUEST_PERMS,  # Guest
        }

        perms_list = _SYSTEM_PERMISSION_MAP.get(role_value)
        if perms_list is None:
            return None

        perms = _resolve_conditional_conflicts(set(perms_list))
        return self._has_permission(perms, permission, user_id, resource_creator_id)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _resolve_conditional_conflicts(permissions: set[str]) -> set[str]:
    """
    If both ``workitem:delete`` and ``workitem:delete+creator`` are present,
    keep only the unconditional variant (unconditional wins).
    """
    base_unconditional = {p for p in permissions if "+" not in p}
    resolved: set[str] = set()
    for perm in permissions:
        if "+" in perm:
            base = perm.split("+", 1)[0]
            if base in base_unconditional:
                continue  # unconditional already present → drop conditional
        resolved.add(perm)
    return resolved


# ---------------------------------------------------------------------------
# Cache invalidation signals
# ---------------------------------------------------------------------------


def _register_signals() -> None:
    """
    Register post-save / post-delete signals to invalidate cached role
    permissions whenever a CustomRoleScheme is modified.
    Called from plane.app.apps.AppConfig.ready() or directly at module load.
    """
    from django.db.models.signals import post_save, post_delete
    from django.dispatch import receiver

    def _invalidate(sender, instance, **kwargs):
        cache.delete(f"gac:role_perms:{instance.role_id}")
        # Best-effort invalidation of per-user workspace member caches.
        # We use delete_pattern if the cache backend supports it (e.g. django-redis).
        _delete_user_caches_for_role(instance.role_id)

    from plane.db.models import CustomRoleScheme

    post_save.connect(_invalidate, sender=CustomRoleScheme, weak=False)
    post_delete.connect(_invalidate, sender=CustomRoleScheme, weak=False)


def _delete_user_caches_for_role(role_id: str) -> None:
    """Delete gac:ws_member caches for all members assigned to *role_id*."""
    try:
        from plane.db.models import WorkspaceMember, ProjectMember

        user_ids = set()
        user_ids.update(
            WorkspaceMember.objects.filter(custom_role_id=role_id).values_list("member_id", flat=True)
        )
        user_ids.update(
            ProjectMember.objects.filter(custom_role_id=role_id).values_list("member_id", flat=True)
        )
        for uid in user_ids:
            # Delete all workspace-scoped member cache keys for this user.
            # Pattern deletion is supported by django-redis; fall back to
            # deleting per-workspace keys is not feasible without extra data,
            # so we accept eventual consistency after TTL expiry for the
            # workspace-specific keys.
            try:
                cache.delete_pattern(f"gac:ws_member:{uid}:*")
            except AttributeError:
                pass  # cache backend does not support delete_pattern
    except Exception:
        pass  # never let cache cleanup crash the request


# ---------------------------------------------------------------------------
# Decorator
# ---------------------------------------------------------------------------


def require_gac_permission(permission: str):
    """
    View decorator that checks a GAC permission before allowing access.

    Works alongside the existing ``allow_permission`` decorator — it does not
    replace it.  Use when you need fine-grained, scheme-based access control
    beyond the three built-in system roles.

    Usage::

        @require_gac_permission("project:delete")
        def destroy(self, request, slug, project_id):
            ...
    """

    def decorator(view_func):
        @wraps(view_func)
        def _wrapped_view(instance, request, *args, **kwargs):
            from rest_framework import status
            from rest_framework.response import Response
            from plane.db.models import Workspace

            slug = kwargs.get("slug")
            project_id = kwargs.get("project_id")

            try:
                workspace = Workspace.objects.only("id").get(slug=slug)
            except Workspace.DoesNotExist:
                return Response({"error": "Workspace not found."}, status=status.HTTP_404_NOT_FOUND)

            engine = PermissionEngine()
            allowed = engine.check(
                user_id=str(request.user.id),
                permission=permission,
                workspace_id=str(workspace.id),
                project_id=project_id,
            )

            if not allowed:
                return Response(
                    {"error": "You don't have the required permissions."},
                    status=status.HTTP_403_FORBIDDEN,
                )

            return view_func(instance, request, *args, **kwargs)

        return _wrapped_view

    return decorator
