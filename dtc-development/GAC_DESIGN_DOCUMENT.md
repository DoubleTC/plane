# Granular Access Control (GAC) — Tài liệu Thiết kế & Prompt cho Claude Code

> Nguồn tham khảo: Plane Enterprise Grid — Roles & Permissions  
> Mục tiêu: Implement tính năng Custom Roles + Permission Schemes cho self-hosted Plane (open-source)  
> Version: 2.0 (đã audit so khớp hoàn toàn với mã nguồn thực tế)

---

## ⚠️ Ghi chú audit (Phiên bản 2.0)

Bản thiết kế gốc (v1.0) chứa nhiều điểm **không khớp với codebase thực tế**. Tất cả đã được sửa trong bản này:

| Vấn đề                   | v1.0 (sai)                                     | v2.0 (đã sửa)                                                  |
| ------------------------ | ---------------------------------------------- | -------------------------------------------------------------- |
| Hệ thống roles           | Owner/Admin/Member/Guest/Contributor/Commenter | Chỉ có **Admin=20, Member=15, Guest=5**                        |
| Teamspace                | Có `+lead` conditional                         | Teamspace **không tồn tại** trong CE backend → loại bỏ         |
| Django app mới           | `apps/iam/` không đăng ký                      | Models vào `plane.db`, views/URLs vào `plane.app`              |
| Đường dẫn Python         | `apps/db/models/roles.py`                      | `apps/api/plane/db/models/roles.py`                            |
| Frontend routing         | Next.js-style filesystem                       | React Router 7: **phải đăng ký trong `routes/core.ts`**        |
| Frontend paths           | `web/components/...`, `web/store/...`          | `apps/web/core/components/...`, `apps/web/core/store/...`      |
| Types file               | `roles.d.ts`                                   | `roles.ts` (regular TS file, export bình thường)               |
| Settings nav             | Tự động thêm                                   | Phải cập nhật `packages/constants` + `packages/types`          |
| API URL prefix           | `/api/v1/workspaces/`                          | `/api/workspaces/` (trong `plane.app`, không phải `plane.api`) |
| `unique_together`        | Không xét soft delete                          | Dùng `UniqueConstraint(condition=Q(deleted_at__isnull=True))`  |
| `authority_level` values | 100/80/60/40/20/10                             | **20=Admin, 15=Member, 5=Guest** (khớp ROLE_CHOICES)           |

---

## Phần 1 — Tóm tắt tính năng cần xây dựng

Plane Enterprise Grid có hệ thống kiểm soát quyền truy cập hai tầng:

| Tầng              | Mô tả                                                        |
| ----------------- | ------------------------------------------------------------ |
| **RBAC** (có sẵn) | Các role cố định: Admin (20), Member (15), Guest (5)         |
| **GAC** (cần xây) | Custom roles + Permission schemes tùy chỉnh, kết hợp (union) |

Tính năng cần xây dựng gồm 4 phần:

1. **Permission Schemes** — Bundle quyền có thể tái sử dụng (scope: workspace hoặc project)
2. **Custom Roles** — Role tùy chỉnh, gắn từ 1..N schemes, quyền = union của tất cả schemes
3. **Role Assignment** — Gán custom role cho member ở workspace/project level
4. **Permission Evaluation Engine** — Kiểm tra quyền theo scope hierarchy (project → workspace)

---

## Phần 2 — Kiến trúc hệ thống

### 2.1 Scope Hierarchy (thực tế trong CE)

```
Workspace
  └── Project (kế thừa từ Workspace nếu user là Admin)
```

> **Lưu ý:** Teamspace **không tồn tại** trong mã nguồn open-source (CE). Không implement
> `+lead` conditional grant. Tính năng này chỉ có trong Enterprise Edition (EE).

**Quy tắc kế thừa thực tế:**

- Workspace Admin: wildcard access toàn bộ project, không cần explicit membership (đã implement trong `allow_permission`)
- Khi member join public project → được map role tự động:
  - Workspace Admin → Project Admin
  - Workspace Member/Custom → Project Member (role=15)
  - Workspace Guest → không được join (đã check trong `ProjectMemberViewSet.create`)

### 2.2 Conditional Grants

Chỉ hỗ trợ một điều kiện (Teamspace đã loại bỏ):

- `+creator` — chỉ áp dụng nếu user là người tạo resource (`created_by = user`)

**Quy tắc ưu tiên:** Unconditional grant luôn thắng conditional grant.

### 2.3 Permission Identifier Format

```
<resource>:<action>[+condition]

Ví dụ:
  workitem:view
  workitem:edit
  workitem:delete           ← unconditional
  workitem:delete+creator   ← chỉ được xóa item mình tạo
  module:delete+creator
```

### 2.4 Union Semantics khi kết hợp Schemes

```
Role = Scheme A ∪ Scheme B ∪ Scheme C
- Nếu A có workitem:delete+creator và B có workitem:delete → kết quả: workitem:delete (unconditional thắng)
- Scheme combination chỉ là UNION, không có subtract
- Enabling một permission tự động enable prerequisite (edit → view)
- Disabling prerequisite tự động disable các permission phụ thuộc
```

---

## Phần 3 — Data Models (Django Backend)

### 3.1 Vị trí file thực tế

```
apps/api/plane/db/models/roles.py       ← file mới
apps/api/plane/db/models/__init__.py    ← cập nhật export
apps/api/plane/db/models/workspace.py  ← thêm custom_role FK vào WorkspaceMember
apps/api/plane/db/models/project.py    ← thêm custom_role FK vào ProjectMember
apps/api/plane/db/migrations/          ← chạy makemigrations để tạo migration
```

### 3.2 Models

```python
# apps/api/plane/db/models/roles.py

from django.db import models
from django.db.models import Q
from .base import BaseModel


class PermissionScheme(BaseModel):
    """
    Bundle of permissions, reusable across custom roles.
    scope: 'workspace' | 'project'
    is_system: True = không được edit/delete (hệ thống tự tạo)
    permissions là list các permission identifier strings
    VD: ["workitem:view", "workitem:edit", "workitem:delete+creator"]
    """
    workspace = models.ForeignKey(
        "db.Workspace", on_delete=models.CASCADE, related_name="permission_schemes"
    )
    name = models.CharField(max_length=255)
    description = models.TextField(blank=True)
    scope = models.CharField(
        max_length=20,
        choices=[("workspace", "Workspace"), ("project", "Project")],
    )
    is_system = models.BooleanField(default=False)
    permissions = models.JSONField(default=list)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["workspace", "name", "scope"],
                condition=Q(deleted_at__isnull=True),
                name="permission_scheme_unique_ws_name_scope_when_not_deleted",
            )
        ]
        verbose_name = "Permission Scheme"
        verbose_name_plural = "Permission Schemes"
        db_table = "permission_schemes"
        ordering = ("-created_at",)


class CustomRole(BaseModel):
    """
    Custom role definition. Effective permissions = union of all attached schemes.
    scope: 'workspace' | 'project'
    is_system: True = không được delete/edit permissions (Admin, Member, Guest built-ins)
    authority_level: enforce "chỉ role cao hơn mới manage được role thấp hơn"
      Align với ROLE_CHOICES thực tế: 20=Admin, 15=Member, 5=Guest, 0=custom (default)
    """
    workspace = models.ForeignKey(
        "db.Workspace", on_delete=models.CASCADE, related_name="custom_roles"
    )
    name = models.CharField(max_length=255)
    description = models.TextField(blank=True)
    scope = models.CharField(
        max_length=20,
        choices=[("workspace", "Workspace"), ("project", "Project")],
    )
    is_system = models.BooleanField(default=False)
    # Align với ROLE_CHOICES: Admin=20, Member=15, Guest=5, custom=0
    authority_level = models.PositiveIntegerField(default=0)
    schemes = models.ManyToManyField(
        PermissionScheme,
        through="CustomRoleScheme",
        related_name="roles",
    )

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["workspace", "name", "scope"],
                condition=Q(deleted_at__isnull=True),
                name="custom_role_unique_ws_name_scope_when_not_deleted",
            )
        ]
        verbose_name = "Custom Role"
        verbose_name_plural = "Custom Roles"
        db_table = "custom_roles"
        ordering = ("-created_at",)


class CustomRoleScheme(BaseModel):
    """Junction table: role ↔ scheme"""
    role = models.ForeignKey(CustomRole, on_delete=models.CASCADE, related_name="role_schemes")
    scheme = models.ForeignKey(PermissionScheme, on_delete=models.CASCADE, related_name="scheme_roles")

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["role", "scheme"],
                condition=Q(deleted_at__isnull=True),
                name="custom_role_scheme_unique_role_scheme_when_not_deleted",
            )
        ]
        verbose_name = "Custom Role Scheme"
        verbose_name_plural = "Custom Role Schemes"
        db_table = "custom_role_schemes"
        ordering = ("-created_at",)
```

### 3.3 Cập nhật WorkspaceMember và ProjectMember

```python
# Trong apps/api/plane/db/models/workspace.py — thêm vào class WorkspaceMember:
custom_role = models.ForeignKey(
    "db.CustomRole",
    null=True,
    blank=True,
    on_delete=models.SET_NULL,
    related_name="workspace_members",
)

# Trong apps/api/plane/db/models/project.py — thêm vào class ProjectMember:
custom_role = models.ForeignKey(
    "db.CustomRole",
    null=True,
    blank=True,
    on_delete=models.SET_NULL,
    related_name="project_members",
)
```

### 3.4 Export từ `__init__.py`

```python
# Thêm vào cuối apps/api/plane/db/models/__init__.py:
from .roles import PermissionScheme, CustomRole, CustomRoleScheme
```

### 3.5 Permissions Registry

```python
# apps/api/plane/db/constants/permissions.py
# (Tạo mới file này trong thư mục constants của plane.db)

WORKSPACE_PERMISSIONS = [
    # Workspace Settings
    "workspace:view_settings",
    "workspace:edit_settings",
    # workspace:delete và workspace:transfer_ownership là RESERVED — không được gán cho custom role

    # Members
    "workspace_member:view",
    "workspace_member:invite",
    "workspace_member:change_role",
    "workspace_member:remove",

    # Projects (workspace-level)
    "project:browse",
    "project:create",
    "project:self_join_public",
    "project:edit_settings",
    "project:archive",
    "project:delete",
    "project:publish",

    # Custom Roles
    "custom_role:view",
    "custom_role:create",
    "custom_role:edit",
    "custom_role:delete",
]

PROJECT_PERMISSIONS = [
    # Work Items
    "workitem:view",
    "workitem:create",
    "workitem:edit",
    "workitem:edit+creator",
    "workitem:delete",
    "workitem:delete+creator",
    "workitem:bulk_edit",
    "workitem:archive",
    "workitem:export",

    # Comments
    "comment:create",
    "comment:edit+creator",
    "comment:delete+creator",
    "comment:delete",

    # Cycles
    "cycle:view",
    "cycle:create",
    "cycle:edit",
    "cycle:delete",
    "cycle:delete+creator",

    # Modules
    "module:view",
    "module:create",
    "module:edit",
    "module:delete",
    "module:delete+creator",

    # Pages
    "page:view",
    "page:create",
    "page:edit",
    "page:delete",

    # States, Labels, Estimates (admin-only)
    "state:create",
    "state:edit",
    "state:delete",
    "label:create",
    "label:edit",
    "label:delete",
    "estimate:create",
    "estimate:edit",
    "estimate:delete",
]

# Reserved permissions — không được phép gán cho bất kỳ custom role nào
RESERVED_PERMISSIONS = {
    "workspace:delete",
    "workspace:transfer_ownership",
}

# Dependency map: enable X → auto-enable prerequisites
PERMISSION_DEPENDENCIES: dict[str, list[str]] = {
    "workitem:edit": ["workitem:view"],
    "workitem:edit+creator": ["workitem:view"],
    "workitem:delete": ["workitem:view"],
    "workitem:delete+creator": ["workitem:view"],
    "workitem:bulk_edit": ["workitem:view", "workitem:edit"],
    "workitem:archive": ["workitem:view"],
    "workitem:export": ["workitem:view"],
    "comment:edit+creator": ["comment:create"],
    "comment:delete+creator": ["comment:create"],
    "cycle:edit": ["cycle:view"],
    "cycle:delete": ["cycle:view"],
    "cycle:delete+creator": ["cycle:view"],
    "module:edit": ["module:view"],
    "module:delete": ["module:view"],
    "module:delete+creator": ["module:view"],
    "page:edit": ["page:view"],
    "page:delete": ["page:view"],
}

# Nhóm permissions theo UI display groups
PERMISSION_GROUPS = {
    "workspace": [
        {
            "group_name": "Workspace Settings",
            "permissions": [
                {"id": "workspace:view_settings", "label": "View settings"},
                {"id": "workspace:edit_settings", "label": "Edit settings"},
            ],
        },
        {
            "group_name": "Members",
            "permissions": [
                {"id": "workspace_member:view", "label": "View members"},
                {"id": "workspace_member:invite", "label": "Invite members"},
                {"id": "workspace_member:change_role", "label": "Change member roles"},
                {"id": "workspace_member:remove", "label": "Remove members"},
            ],
        },
        {
            "group_name": "Projects",
            "permissions": [
                {"id": "project:browse", "label": "Browse projects"},
                {"id": "project:create", "label": "Create projects"},
                {"id": "project:self_join_public", "label": "Self-join public projects"},
                {"id": "project:edit_settings", "label": "Edit project settings"},
                {"id": "project:archive", "label": "Archive projects"},
                {"id": "project:delete", "label": "Delete projects"},
                {"id": "project:publish", "label": "Publish projects"},
            ],
        },
        {
            "group_name": "Custom Roles",
            "permissions": [
                {"id": "custom_role:view", "label": "View custom roles"},
                {"id": "custom_role:create", "label": "Create custom roles"},
                {"id": "custom_role:edit", "label": "Edit custom roles"},
                {"id": "custom_role:delete", "label": "Delete custom roles"},
            ],
        },
    ],
    "project": [
        {
            "group_name": "Work Items",
            "permissions": [
                {"id": "workitem:view", "label": "View work items"},
                {"id": "workitem:create", "label": "Create work items"},
                {"id": "workitem:edit", "label": "Edit any work item"},
                {"id": "workitem:edit+creator", "label": "Edit own work items", "conditional": "creator"},
                {"id": "workitem:delete", "label": "Delete any work item"},
                {"id": "workitem:delete+creator", "label": "Delete own work items", "conditional": "creator"},
                {"id": "workitem:bulk_edit", "label": "Bulk edit work items"},
                {"id": "workitem:archive", "label": "Archive work items"},
                {"id": "workitem:export", "label": "Export work items"},
            ],
        },
        {
            "group_name": "Comments",
            "permissions": [
                {"id": "comment:create", "label": "Create comments"},
                {"id": "comment:edit+creator", "label": "Edit own comments", "conditional": "creator"},
                {"id": "comment:delete+creator", "label": "Delete own comments", "conditional": "creator"},
                {"id": "comment:delete", "label": "Delete any comment"},
            ],
        },
        {
            "group_name": "Cycles",
            "permissions": [
                {"id": "cycle:view", "label": "View cycles"},
                {"id": "cycle:create", "label": "Create cycles"},
                {"id": "cycle:edit", "label": "Edit cycles"},
                {"id": "cycle:delete", "label": "Delete any cycle"},
                {"id": "cycle:delete+creator", "label": "Delete own cycles", "conditional": "creator"},
            ],
        },
        {
            "group_name": "Modules",
            "permissions": [
                {"id": "module:view", "label": "View modules"},
                {"id": "module:create", "label": "Create modules"},
                {"id": "module:edit", "label": "Edit modules"},
                {"id": "module:delete", "label": "Delete any module"},
                {"id": "module:delete+creator", "label": "Delete own modules", "conditional": "creator"},
            ],
        },
        {
            "group_name": "Pages",
            "permissions": [
                {"id": "page:view", "label": "View pages"},
                {"id": "page:create", "label": "Create pages"},
                {"id": "page:edit", "label": "Edit pages"},
                {"id": "page:delete", "label": "Delete pages"},
            ],
        },
        {
            "group_name": "Project Admin",
            "permissions": [
                {"id": "state:create", "label": "Create states"},
                {"id": "state:edit", "label": "Edit states"},
                {"id": "state:delete", "label": "Delete states"},
                {"id": "label:create", "label": "Create labels"},
                {"id": "label:edit", "label": "Edit labels"},
                {"id": "label:delete", "label": "Delete labels"},
                {"id": "estimate:create", "label": "Create estimates"},
                {"id": "estimate:edit", "label": "Edit estimates"},
                {"id": "estimate:delete", "label": "Delete estimates"},
            ],
        },
    ],
}
```

---

## Phần 4 — API Endpoints (Django REST Framework)

### 4.1 Vị trí file mới

```
apps/api/plane/app/views/workspace/roles.py     ← ViewSets mới
apps/api/plane/app/serializers/roles.py         ← Serializers mới
apps/api/plane/app/urls/workspace.py            ← Thêm URL patterns vào file có sẵn
apps/api/plane/app/permissions/engine.py        ← PermissionEngine
```

> **Quan trọng:** KHÔNG tạo `plane.iam` app mới. Dùng `plane.app` đã tồn tại và đã đăng ký
> trong `INSTALLED_APPS`. Models thêm vào `plane.db` (đã có sẵn).

### 4.2 URL Pattern (thêm vào `apps/api/plane/app/urls/workspace.py`)

```
# URL prefix: /api/workspaces/{slug}/... (không phải /api/v1/)

GET    /api/workspaces/{slug}/permission-schemes/?scope=workspace
POST   /api/workspaces/{slug}/permission-schemes/
GET    /api/workspaces/{slug}/permission-schemes/{id}/
PATCH  /api/workspaces/{slug}/permission-schemes/{id}/
DELETE /api/workspaces/{slug}/permission-schemes/{id}/

GET    /api/workspaces/{slug}/custom-roles/?scope=workspace
POST   /api/workspaces/{slug}/custom-roles/
GET    /api/workspaces/{slug}/custom-roles/{id}/
PATCH  /api/workspaces/{slug}/custom-roles/{id}/
DELETE /api/workspaces/{slug}/custom-roles/{id}/   ← body: {"replacement_role_id": "uuid"}

POST   /api/workspaces/{slug}/custom-roles/{id}/schemes/
DELETE /api/workspaces/{slug}/custom-roles/{id}/schemes/{scheme_id}/
GET    /api/workspaces/{slug}/custom-roles/{id}/effective-permissions/
```

**Request body (POST/PATCH scheme):**

```json
{
  "name": "Release Publisher",
  "description": "Cho phép publish releases",
  "scope": "workspace",
  "permissions": ["project:publish", "project:create"]
}
```

### 4.3 Assign Custom Role cho Member (cập nhật endpoint đã có)

```
# Workspace member — endpoint đã có, thêm field custom_role_id:
PATCH /api/workspaces/{slug}/members/{member_id}/
Body: { "custom_role_id": "uuid" }   // null để dùng system role

# Project member — endpoint đã có, thêm field custom_role_id:
PATCH /api/workspaces/{slug}/projects/{project_id}/members/{member_id}/
Body: { "custom_role_id": "uuid" }
```

---

## Phần 5 — Permission Evaluation Engine

```python
# apps/api/plane/app/permissions/engine.py

from typing import Optional
from django.core.cache import cache

from plane.db.models import WorkspaceMember, ProjectMember, CustomRole


class PermissionEngine:
    """
    Centralized permission evaluation engine.
    Không dùng lru_cache (không thread-safe với Django requests).
    Dùng Django cache framework (Redis) với TTL.
    """

    USER_PERM_TTL = 300    # 5 phút
    ROLE_PERM_TTL = 86400  # 24 giờ

    def check(
        self,
        user_id: str,
        permission: str,
        workspace_id: str,
        project_id: Optional[str] = None,
        resource_creator_id: Optional[str] = None,
    ) -> bool:
        """
        Evaluation order:
        1. Workspace Admin → always True (wildcard) — align với existing allow_permission logic
        2. Project-level check (nếu có project_id)
        3. Workspace-level check
        4. Default: False

        Lưu ý: "Workspace Admin" trong codebase thực tế = role=20.
        Không có "Owner" tách biệt — user tạo workspace cũng là Admin (role=20).
        """
        # 1. Workspace Admin bypass (align với existing allow_permission decorator)
        ws_member = self._get_workspace_member(user_id, workspace_id)
        if ws_member and ws_member.role == 20:  # ROLE.ADMIN.value
            return True

        # 2. Project-level
        if project_id:
            result = self._check_project_level(
                user_id, permission, workspace_id, project_id, resource_creator_id
            )
            if result is not None:
                return result

        # 3. Workspace-level
        result = self._check_workspace_level(
            user_id, permission, workspace_id, resource_creator_id
        )
        return result if result is not None else False

    def _get_workspace_member(self, user_id: str, workspace_id: str):
        cache_key = f"gac:ws_member:{user_id}:{workspace_id}"
        cached = cache.get(cache_key)
        if cached is not None:
            return cached
        try:
            member = WorkspaceMember.objects.select_related("custom_role").get(
                member_id=user_id, workspace_id=workspace_id, is_active=True
            )
            cache.set(cache_key, member, self.USER_PERM_TTL)
            return member
        except WorkspaceMember.DoesNotExist:
            return None

    def _check_project_level(
        self, user_id, permission, workspace_id, project_id, resource_creator_id
    ) -> Optional[bool]:
        try:
            proj_member = ProjectMember.objects.select_related("custom_role").get(
                member_id=user_id, workspace_id=workspace_id,
                project_id=project_id, is_active=True
            )
        except ProjectMember.DoesNotExist:
            return None

        if proj_member.custom_role_id:
            perms = self._get_effective_permissions(proj_member.custom_role)
            return self._has_permission(perms, permission, user_id, resource_creator_id)

        # Fallback: map system role → check via permission registry
        return self._check_system_role_permission(
            proj_member.role, permission, user_id, resource_creator_id
        )

    def _check_workspace_level(
        self, user_id, permission, workspace_id, resource_creator_id
    ) -> Optional[bool]:
        ws_member = self._get_workspace_member(user_id, workspace_id)
        if not ws_member:
            return None

        if ws_member.custom_role_id:
            perms = self._get_effective_permissions(ws_member.custom_role)
            return self._has_permission(perms, permission, user_id, resource_creator_id)

        return self._check_system_role_permission(
            ws_member.role, permission, user_id, resource_creator_id
        )

    def _get_effective_permissions(self, role: "CustomRole") -> set[str]:
        """Union tất cả permissions từ tất cả schemes của role. Cached 24h."""
        cache_key = f"gac:role_perms:{role.pk}"
        cached = cache.get(cache_key)
        if cached is not None:
            return cached

        # QUAN TRỌNG: dùng prefetch để tránh N+1 query
        role_with_schemes = (
            CustomRole.objects.prefetch_related("schemes")
            .get(pk=role.pk)
        )
        all_perms: set[str] = set()
        for scheme in role_with_schemes.schemes.all():
            all_perms.update(scheme.permissions)

        resolved = self._resolve_conditional_conflicts(all_perms)
        cache.set(cache_key, resolved, self.ROLE_PERM_TTL)
        return resolved

    def _resolve_conditional_conflicts(self, permissions: set[str]) -> set[str]:
        """Unconditional thắng conditional: workitem:delete thắng workitem:delete+creator"""
        base_unconditional = {p for p in permissions if "+" not in p}
        resolved = set()
        for perm in permissions:
            if "+" in perm:
                base = perm.split("+")[0]
                if base in base_unconditional:
                    continue  # unconditional đã có → bỏ conditional
            resolved.add(perm)
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

    def _check_system_role_permission(
        self, role_value: int, permission: str, user_id: str,
        resource_creator_id: Optional[str]
    ) -> Optional[bool]:
        """
        Fallback cho users chưa có custom_role: tra cứu theo system role.
        Implement logic này dựa trên permission registry và role mặc định.
        """
        # TODO: Map system roles → default permission sets
        # Tạm thời trả None để fallback lên layer cao hơn
        return None


# Decorator để sử dụng engine trong views:
def require_gac_permission(permission: str):
    """
    Decorator dùng PermissionEngine để check GAC permissions.
    Dùng song song với allow_permission hiện tại — không thay thế.
    """
    from functools import wraps
    from rest_framework.response import Response
    from rest_framework import status

    def decorator(view_func):
        @wraps(view_func)
        def _wrapped_view(instance, request, *args, **kwargs):
            from plane.db.models import Workspace

            slug = kwargs.get("slug")
            project_id = kwargs.get("project_id")

            try:
                workspace = Workspace.objects.get(slug=slug)
            except Workspace.DoesNotExist:
                return Response({"error": "Workspace not found"}, status=status.HTTP_404_NOT_FOUND)

            engine = PermissionEngine()
            has_perm = engine.check(
                user_id=str(request.user.id),
                permission=permission,
                workspace_id=str(workspace.id),
                project_id=project_id,
            )

            if not has_perm:
                return Response(
                    {"error": "You don't have the required permissions."},
                    status=status.HTTP_403_FORBIDDEN,
                )
            return view_func(instance, request, *args, **kwargs)

        return _wrapped_view
    return decorator
```

### 5.1 Cache Invalidation Signals

```python
# Thêm vào apps/api/plane/app/permissions/engine.py (hoặc file signals riêng):

from django.db.models.signals import post_save, post_delete
from django.dispatch import receiver
from django.core.cache import cache

# Import ở đây để tránh circular import — dùng lazy import trong signal handler

@receiver(post_save, sender="db.CustomRoleScheme")
@receiver(post_delete, sender="db.CustomRoleScheme")
def invalidate_role_cache(sender, instance, **kwargs):
    cache.delete(f"gac:role_perms:{instance.role_id}")
    # Invalidate tất cả workspace member caches có role này
    from plane.db.models import WorkspaceMember, ProjectMember
    ws_member_ids = WorkspaceMember.objects.filter(
        custom_role_id=instance.role_id
    ).values_list("member_id", flat=True)
    proj_member_ids = ProjectMember.objects.filter(
        custom_role_id=instance.role_id
    ).values_list("member_id", flat=True)
    for uid in set(list(ws_member_ids) + list(proj_member_ids)):
        cache.delete_pattern(f"gac:ws_member:{uid}:*")
```

---

## Phần 6 — Migration & Seed Data

### 6.1 Django Migration

```bash
# Chạy từ apps/api/ (trong Docker container hoặc venv)
python manage.py makemigrations db --name="add_gac_models"
python manage.py migrate
```

Migration sẽ tự động tạo:

1. Bảng `permission_schemes`
2. Bảng `custom_roles`
3. Bảng `custom_role_schemes` (junction)
4. Thêm column `custom_role_id` vào `workspace_members`
5. Thêm column `custom_role_id` vào `project_members`

### 6.2 Seed Script

```python
# apps/api/plane/db/management/commands/seed_system_roles.py

from django.core.management.base import BaseCommand
from plane.db.models import Workspace, PermissionScheme, CustomRole, CustomRoleScheme
from plane.db.constants.permissions import (
    WORKSPACE_PERMISSIONS, PROJECT_PERMISSIONS
)


SYSTEM_SCHEMES = [
    {
        "name": "Workspace Admin",
        "scope": "workspace",
        "permissions": WORKSPACE_PERMISSIONS,  # all workspace permissions
        "authority_level": 20,  # align với Admin=20
    },
    {
        "name": "Workspace Member",
        "scope": "workspace",
        "permissions": [
            "workspace:view_settings", "workspace_member:view",
            "project:browse", "project:create", "project:self_join_public",
        ],
        "authority_level": 15,  # align với Member=15
    },
    {
        "name": "Workspace Guest",
        "scope": "workspace",
        "permissions": ["workspace_member:view", "project:browse"],
        "authority_level": 5,  # align với Guest=5
    },
    {
        "name": "Project Admin",
        "scope": "project",
        "permissions": PROJECT_PERMISSIONS,
        "authority_level": 20,
    },
    {
        "name": "Project Member",
        "scope": "project",
        "permissions": [
            "workitem:view", "workitem:create", "workitem:edit",
            "workitem:delete+creator", "comment:create", "comment:edit+creator",
            "comment:delete+creator", "cycle:view", "cycle:create", "cycle:edit",
            "module:view", "module:create", "module:edit", "page:view", "page:create",
        ],
        "authority_level": 15,
    },
    {
        "name": "Project Guest",
        "scope": "project",
        "permissions": [
            "workitem:view", "comment:create", "comment:edit+creator",
            "comment:delete+creator", "cycle:view", "module:view", "page:view",
        ],
        "authority_level": 5,
    },
]


class Command(BaseCommand):
    help = "Seed system permission schemes and roles for all workspaces (idempotent)"

    def handle(self, *args, **options):
        workspaces = Workspace.objects.all()
        for workspace in workspaces:
            self.seed_workspace(workspace)
        self.stdout.write(self.style.SUCCESS("System roles seeded successfully."))

    def seed_workspace(self, workspace):
        for scheme_data in SYSTEM_SCHEMES:
            authority_level = scheme_data.pop("authority_level")
            scheme, _ = PermissionScheme.objects.get_or_create(
                workspace=workspace,
                name=scheme_data["name"],
                scope=scheme_data["scope"],
                defaults={
                    "permissions": scheme_data["permissions"],
                    "is_system": True,
                },
            )
            # Tạo system CustomRole map 1-1 với scheme
            role, _ = CustomRole.objects.get_or_create(
                workspace=workspace,
                name=scheme_data["name"],
                scope=scheme_data["scope"],
                defaults={
                    "is_system": True,
                    "authority_level": authority_level,
                },
            )
            CustomRoleScheme.objects.get_or_create(role=role, scheme=scheme)
```

---

## Phần 7 — Frontend (React/TypeScript + MobX)

### 7.1 Cấu trúc thư mục thực tế

```
# Types (packages/types)
packages/types/src/roles.ts                   ← file mới (không phải .d.ts)
packages/types/src/index.ts                   ← thêm export

# Constants (packages/constants)
packages/constants/src/settings/workspace.ts  ← thêm "roles" vào nav

# Services
apps/web/core/services/roles.service.ts       ← service class mới

# Store
apps/web/core/store/roles.store.ts            ← MobX store mới
apps/web/core/store/root.store.ts             ← đăng ký store mới

# Components
apps/web/core/components/roles/               ← thư mục components mới

# Pages (react-router route files)
apps/web/app/(all)/[workspaceSlug]/(settings)/settings/(workspace)/roles/page.tsx
apps/web/app/(all)/[workspaceSlug]/(settings)/settings/(workspace)/roles/[roleId]/page.tsx

# Route config (BẮTBUỘC — routes không tự động!)
apps/web/app/routes/core.ts                   ← thêm route entries
```

### 7.2 Types

```typescript
// packages/types/src/roles.ts

export interface IPermissionScheme {
  id: string;
  workspace: string;
  name: string;
  description: string;
  scope: "workspace" | "project";
  is_system: boolean;
  permissions: string[];
  created_at: string;
  updated_at: string;
}

export interface ICustomRole {
  id: string;
  workspace: string;
  name: string;
  description: string;
  scope: "workspace" | "project";
  is_system: boolean;
  authority_level: number; // 20=Admin, 15=Member, 5=Guest, 0=custom
  schemes: IPermissionScheme[];
  effective_permissions: string[]; // computed union (returned by API)
  member_count?: number;
}

export interface IPermissionGroup {
  group_name: string;
  permissions: IPermissionDef[];
}

export interface IPermissionDef {
  id: string; // "workitem:delete+creator"
  label: string; // "Delete own work items"
  description?: string;
  conditional?: "creator"; // NOTE: "lead" KHÔNG hỗ trợ trong CE
  prerequisites?: string[];
}

export interface ICustomRoleCreate {
  name: string;
  description?: string;
  scope: "workspace" | "project";
}

export interface IPermissionSchemeCreate {
  name: string;
  description?: string;
  scope: "workspace" | "project";
  permissions: string[];
}
```

```typescript
// Thêm vào packages/types/src/index.ts:
export type {
  IPermissionScheme,
  ICustomRole,
  IPermissionGroup,
  IPermissionDef,
  ICustomRoleCreate,
  IPermissionSchemeCreate,
} from "./roles";
```

```typescript
// Cập nhật packages/types/src/settings.ts — thêm "roles" vào union:
export type TWorkspaceSettingsTabs = "general" | "members" | "billing-and-plans" | "export" | "webhooks" | "roles"; // ← thêm mới
```

### 7.3 Settings Navigation (packages/constants)

```typescript
// Cập nhật packages/constants/src/settings/workspace.ts

// 1. Thêm vào WORKSPACE_SETTINGS:
roles: {
  key: "roles",
  i18n_label: "workspace_settings.settings.roles.title",
  href: `/settings/roles`,
  access: [EUserWorkspaceRoles.ADMIN],
  highlight: (pathname: string, baseUrl: string) =>
    pathname.startsWith(`${baseUrl}/settings/roles`),
},

// 2. Thêm vào GROUPED_WORKSPACE_SETTINGS (trong ADMINISTRATION):
WORKSPACE_SETTINGS_CATEGORY.ADMINISTRATION: [
  WORKSPACE_SETTINGS["general"],
  WORKSPACE_SETTINGS["members"],
  WORKSPACE_SETTINGS["roles"],        // ← thêm vào đây
  WORKSPACE_SETTINGS["billing-and-plans"],
  WORKSPACE_SETTINGS["export"],
],
```

```typescript
// Thêm icon vào apps/web/core/components/settings/workspace/sidebar/item-icon.tsx:
import { ShieldCheck } from "lucide-react"; // hoặc icon phù hợp

export const WORKSPACE_SETTINGS_ICONS = {
  // ...existing icons...
  roles: ShieldCheck,
};
```

### 7.4 Service

```typescript
// apps/web/core/services/roles.service.ts

import { API_BASE_URL } from "@plane/constants";
import type { IPermissionScheme, ICustomRole, ICustomRoleCreate, IPermissionSchemeCreate } from "@plane/types";
import { APIService } from "./api.service";

export class RolesService extends APIService {
  constructor() {
    super(API_BASE_URL);
  }

  // Permission Schemes
  async listSchemes(workspaceSlug: string, scope?: "workspace" | "project"): Promise<IPermissionScheme[]> {
    const params = scope ? `?scope=${scope}` : "";
    return this.get(`/api/workspaces/${workspaceSlug}/permission-schemes/${params}`)
      .then((res) => res.data)
      .catch((err) => {
        throw err.response;
      });
  }

  async createScheme(workspaceSlug: string, data: IPermissionSchemeCreate): Promise<IPermissionScheme> {
    return this.post(`/api/workspaces/${workspaceSlug}/permission-schemes/`, data)
      .then((res) => res.data)
      .catch((err) => {
        throw err.response;
      });
  }

  async updateScheme(
    workspaceSlug: string,
    schemeId: string,
    data: Partial<IPermissionSchemeCreate>
  ): Promise<IPermissionScheme> {
    return this.patch(`/api/workspaces/${workspaceSlug}/permission-schemes/${schemeId}/`, data)
      .then((res) => res.data)
      .catch((err) => {
        throw err.response;
      });
  }

  async deleteScheme(workspaceSlug: string, schemeId: string): Promise<void> {
    return this.delete(`/api/workspaces/${workspaceSlug}/permission-schemes/${schemeId}/`)
      .then((res) => res.data)
      .catch((err) => {
        throw err.response;
      });
  }

  // Custom Roles
  async listRoles(workspaceSlug: string, scope?: "workspace" | "project"): Promise<ICustomRole[]> {
    const params = scope ? `?scope=${scope}` : "";
    return this.get(`/api/workspaces/${workspaceSlug}/custom-roles/${params}`)
      .then((res) => res.data)
      .catch((err) => {
        throw err.response;
      });
  }

  async createRole(workspaceSlug: string, data: ICustomRoleCreate): Promise<ICustomRole> {
    return this.post(`/api/workspaces/${workspaceSlug}/custom-roles/`, data)
      .then((res) => res.data)
      .catch((err) => {
        throw err.response;
      });
  }

  async updateRole(workspaceSlug: string, roleId: string, data: Partial<ICustomRoleCreate>): Promise<ICustomRole> {
    return this.patch(`/api/workspaces/${workspaceSlug}/custom-roles/${roleId}/`, data)
      .then((res) => res.data)
      .catch((err) => {
        throw err.response;
      });
  }

  async deleteRole(workspaceSlug: string, roleId: string, replacementRoleId?: string): Promise<void> {
    return this.delete(`/api/workspaces/${workspaceSlug}/custom-roles/${roleId}/`, {
      replacement_role_id: replacementRoleId,
    })
      .then((res) => res.data)
      .catch((err) => {
        throw err.response;
      });
  }

  // Attach/Detach Schemes
  async attachScheme(workspaceSlug: string, roleId: string, schemeId: string): Promise<void> {
    return this.post(`/api/workspaces/${workspaceSlug}/custom-roles/${roleId}/schemes/`, { scheme_id: schemeId })
      .then((res) => res.data)
      .catch((err) => {
        throw err.response;
      });
  }

  async detachScheme(workspaceSlug: string, roleId: string, schemeId: string): Promise<void> {
    return this.delete(`/api/workspaces/${workspaceSlug}/custom-roles/${roleId}/schemes/${schemeId}/`)
      .then((res) => res.data)
      .catch((err) => {
        throw err.response;
      });
  }

  async getEffectivePermissions(workspaceSlug: string, roleId: string): Promise<string[]> {
    return this.get(`/api/workspaces/${workspaceSlug}/custom-roles/${roleId}/effective-permissions/`)
      .then((res) => res.data.permissions)
      .catch((err) => {
        throw err.response;
      });
  }
}

export const rolesService = new RolesService();
```

### 7.5 MobX Store

```typescript
// apps/web/core/store/roles.store.ts

import { makeObservable, observable, action, computed } from "mobx";
import type { IPermissionScheme, ICustomRole, ICustomRoleCreate, IPermissionSchemeCreate } from "@plane/types";
import { rolesService } from "@/services/roles.service";

export interface IRolesStore {
  permissionSchemes: Record<string, IPermissionScheme>;
  customRoles: Record<string, ICustomRole>;
  isLoading: boolean;
  // getters
  getSchemeById: (id: string) => IPermissionScheme | undefined;
  getRoleById: (id: string) => ICustomRole | undefined;
  getEffectivePermissions: (roleId: string) => string[];
  // actions
  fetchSchemes: (workspaceSlug: string, scope?: "workspace" | "project") => Promise<void>;
  fetchRoles: (workspaceSlug: string, scope?: "workspace" | "project") => Promise<void>;
  createScheme: (workspaceSlug: string, data: IPermissionSchemeCreate) => Promise<IPermissionScheme>;
  updateScheme: (workspaceSlug: string, schemeId: string, data: Partial<IPermissionSchemeCreate>) => Promise<void>;
  deleteScheme: (workspaceSlug: string, schemeId: string) => Promise<void>;
  createRole: (workspaceSlug: string, data: ICustomRoleCreate) => Promise<ICustomRole>;
  updateRole: (workspaceSlug: string, roleId: string, data: Partial<ICustomRoleCreate>) => Promise<void>;
  deleteRole: (workspaceSlug: string, roleId: string, replacementRoleId?: string) => Promise<void>;
  attachScheme: (workspaceSlug: string, roleId: string, schemeId: string) => Promise<void>;
  detachScheme: (workspaceSlug: string, roleId: string, schemeId: string) => Promise<void>;
}

export class RolesStore implements IRolesStore {
  permissionSchemes: Record<string, IPermissionScheme> = {};
  customRoles: Record<string, ICustomRole> = {};
  isLoading: boolean = false;

  constructor() {
    makeObservable(this, {
      permissionSchemes: observable,
      customRoles: observable,
      isLoading: observable,
      getSchemeById: computed,
      getRoleById: computed,
      fetchSchemes: action,
      fetchRoles: action,
      createScheme: action,
      updateScheme: action,
      deleteScheme: action,
      createRole: action,
      updateRole: action,
      deleteRole: action,
      attachScheme: action,
      detachScheme: action,
    });
  }

  get getSchemeById() {
    return (id: string) => this.permissionSchemes[id];
  }

  get getRoleById() {
    return (id: string) => this.customRoles[id];
  }

  // Client-side union preview (trước khi save)
  getEffectivePermissions(roleId: string): string[] {
    const role = this.customRoles[roleId];
    if (!role) return [];
    const allPerms = new Set<string>();
    role.schemes.forEach((scheme) => scheme.permissions.forEach((p) => allPerms.add(p)));
    // Resolve unconditional wins
    const unconditional = new Set([...allPerms].filter((p) => !p.includes("+")));
    return [...allPerms].filter((p) => {
      if (!p.includes("+")) return true;
      const base = p.split("+")[0];
      return !unconditional.has(base);
    });
  }

  fetchSchemes = action(async (workspaceSlug: string, scope?: "workspace" | "project") => {
    this.isLoading = true;
    try {
      const schemes = await rolesService.listSchemes(workspaceSlug, scope);
      schemes.forEach((s) => {
        this.permissionSchemes[s.id] = s;
      });
    } finally {
      this.isLoading = false;
    }
  });

  fetchRoles = action(async (workspaceSlug: string, scope?: "workspace" | "project") => {
    this.isLoading = true;
    try {
      const roles = await rolesService.listRoles(workspaceSlug, scope);
      roles.forEach((r) => {
        this.customRoles[r.id] = r;
      });
    } finally {
      this.isLoading = false;
    }
  });

  createScheme = action(async (workspaceSlug: string, data: IPermissionSchemeCreate) => {
    const scheme = await rolesService.createScheme(workspaceSlug, data);
    this.permissionSchemes[scheme.id] = scheme;
    return scheme;
  });

  updateScheme = action(async (workspaceSlug: string, schemeId: string, data: Partial<IPermissionSchemeCreate>) => {
    const scheme = await rolesService.updateScheme(workspaceSlug, schemeId, data);
    this.permissionSchemes[schemeId] = scheme;
  });

  deleteScheme = action(async (workspaceSlug: string, schemeId: string) => {
    await rolesService.deleteScheme(workspaceSlug, schemeId);
    delete this.permissionSchemes[schemeId];
  });

  createRole = action(async (workspaceSlug: string, data: ICustomRoleCreate) => {
    const role = await rolesService.createRole(workspaceSlug, data);
    this.customRoles[role.id] = role;
    return role;
  });

  updateRole = action(async (workspaceSlug: string, roleId: string, data: Partial<ICustomRoleCreate>) => {
    const role = await rolesService.updateRole(workspaceSlug, roleId, data);
    this.customRoles[roleId] = role;
  });

  deleteRole = action(async (workspaceSlug: string, roleId: string, replacementRoleId?: string) => {
    await rolesService.deleteRole(workspaceSlug, roleId, replacementRoleId);
    delete this.customRoles[roleId];
  });

  attachScheme = action(async (workspaceSlug: string, roleId: string, schemeId: string) => {
    await rolesService.attachScheme(workspaceSlug, roleId, schemeId);
    // Refresh role để lấy schemes mới
    const roles = await rolesService.listRoles(workspaceSlug);
    const updated = roles.find((r) => r.id === roleId);
    if (updated) this.customRoles[roleId] = updated;
  });

  detachScheme = action(async (workspaceSlug: string, roleId: string, schemeId: string) => {
    await rolesService.detachScheme(workspaceSlug, roleId, schemeId);
    const role = this.customRoles[roleId];
    if (role) {
      this.customRoles[roleId] = {
        ...role,
        schemes: role.schemes.filter((s) => s.id !== schemeId),
      };
    }
  });
}
```

### 7.6 Đăng ký Store vào CoreRootStore

```typescript
// Cập nhật apps/web/core/store/root.store.ts

// Thêm import:
import type { IRolesStore } from "./roles.store";
import { RolesStore } from "./roles.store";

// Thêm vào class CoreRootStore:
roles: IRolesStore;

// Trong constructor:
this.roles = new RolesStore();

// Trong resetOnSignOut():
this.roles = new RolesStore();
```

### 7.7 Route Registration (BẮT BUỘC)

```typescript
// Cập nhật apps/web/app/routes/core.ts — thêm vào trong block settings:

// Sau route webhooks:
route(
  ":workspaceSlug/settings/roles",
  "./(all)/[workspaceSlug]/(settings)/settings/(workspace)/roles/page.tsx"
),
route(
  ":workspaceSlug/settings/roles/:roleId",
  "./(all)/[workspaceSlug]/(settings)/settings/(workspace)/roles/[roleId]/page.tsx"
),
```

---

## Phần 8 — Checklist Triển khai

### Phase 1 — Backend Core (tuần 1-2)

- [ ] **`plane/db/constants/permissions.py`**: `WORKSPACE_PERMISSIONS`, `PROJECT_PERMISSIONS`, `RESERVED_PERMISSIONS`, `PERMISSION_DEPENDENCIES`, `PERMISSION_GROUPS`
- [ ] **`plane/db/models/roles.py`**: `PermissionScheme`, `CustomRole`, `CustomRoleScheme` với `UniqueConstraint` soft-delete aware
- [ ] **`plane/db/models/__init__.py`**: thêm export 3 models mới
- [ ] **`plane/db/models/workspace.py`**: thêm `custom_role FK` vào `WorkspaceMember`
- [ ] **`plane/db/models/project.py`**: thêm `custom_role FK` vào `ProjectMember`
- [ ] Chạy `makemigrations db --name=add_gac_models` + `migrate`
- [ ] **`plane/db/management/commands/seed_system_roles.py`**: tạo system schemes/roles (idempotent)
- [ ] **`plane/app/permissions/engine.py`**: `PermissionEngine` + `require_gac_permission` decorator + cache invalidation signals
- [ ] **`plane/app/serializers/roles.py`**: serializers cho 3 models + `effective_permissions` computed field
- [ ] **`plane/app/views/workspace/roles.py`**: ViewSets cho schemes, roles, role-schemes
- [ ] **`plane/app/urls/workspace.py`**: thêm URL patterns
- [ ] Unit tests: `plane/tests/unit/test_gac_engine.py`

### Phase 2 — Frontend (tuần 3-4)

- [ ] **`packages/types/src/roles.ts`**: interfaces + export từ `index.ts`
- [ ] **`packages/types/src/settings.ts`**: thêm `"roles"` vào `TWorkspaceSettingsTabs`
- [ ] **`packages/constants/src/settings/workspace.ts`**: thêm nav item "Roles"
- [ ] **`apps/web/core/components/settings/workspace/sidebar/item-icon.tsx`**: thêm icon cho "roles"
- [ ] **`apps/web/core/services/roles.service.ts`**: service class
- [ ] **`apps/web/core/store/roles.store.ts`**: MobX store
- [ ] **`apps/web/core/store/root.store.ts`**: đăng ký store
- [ ] **`apps/web/app/routes/core.ts`**: đăng ký 2 route mới
- [ ] Components: `PermissionGroupToggle`, `SchemeCreateForm`, `SchemeAttachPanel`, `RoleDeleteModal`, `RolesList`, `RoleCard`, `SchemesList`, `SchemeCard`
- [ ] Pages: `roles/page.tsx` (list với tabs), `roles/[roleId]/page.tsx` (detail)
- [ ] Member role picker: update để hiện custom roles trong dropdown
- [ ] `pnpm check:types` pass
- [ ] `pnpm check:lint` pass (không tăng max-warnings ceiling)

### Phase 3 — Integration & Polish (tuần 5)

- [ ] E2E: tạo role → gán scheme → gán member → verify access
- [ ] Permission gate frontend: ẩn/disable UI element theo permission
- [ ] Guest ceiling: validate custom role không vượt quá quyền Guest-level
- [ ] Authority enforcement: user chỉ gán role có `authority_level` thấp hơn của bản thân
- [ ] Reserved permissions guard: block `workspace:delete` và `workspace:transfer_ownership` khỏi custom roles
- [ ] i18n keys: thêm vào tất cả language files trong `packages/i18n/src/locales/`

---

## Phần 9 — Constraints & Business Rules

- **Không** thêm billing/plan checks — feature available cho tất cả self-hosted users
- **Reserved permissions**: `workspace:delete` và `workspace:transfer_ownership` — block hard-coded, không được gán cho bất kỳ custom role nào
- **Guest ceiling**: Workspace Guest không được gán custom role có project permissions cao hơn Guest level
- **Authority enforcement**: User chỉ có thể gán/thay đổi role có `authority_level` thấp hơn `authority_level` của bản thân
- **System protection**: `is_system=True` → không edit permissions, không delete, hiển thị badge "System" trong UI
- **Soft delete**: Tất cả models extend `BaseModel` (→ `AuditModel` → `SoftDeleteModel`). Tất cả `UniqueConstraint` phải có `condition=Q(deleted_at__isnull=True)`
- **Teamspace/+lead**: **KHÔNG implement** trong CE. Đây là EE-only feature. Nếu cần, tạo feature flag riêng

---

## Phần 10 — PROMPT cho Claude Code

```
Bạn đang làm việc trong repo makeplane/plane — một monorepo TypeScript/Python
(pnpm workspaces + Django). Đọc CLAUDE.md trước để hiểu quy ước.

## Nhiệm vụ

Implement tính năng Granular Access Control (GAC) — Custom Roles và Permission Schemes
cho Plane self-hosted. Tham khảo thiết kế chi tiết trong dtc-development/GAC_DESIGN_DOCUMENT.md.

## Thứ tự thực hiện

### Bước 1: Constants & Models

1. Tạo `apps/api/plane/db/constants/permissions.py` với:
   - `WORKSPACE_PERMISSIONS`, `PROJECT_PERMISSIONS`, `RESERVED_PERMISSIONS`
   - `PERMISSION_DEPENDENCIES`, `PERMISSION_GROUPS`

2. Tạo `apps/api/plane/db/models/roles.py` với 3 models:
   - `PermissionScheme(BaseModel)` — dùng `UniqueConstraint` với `condition=Q(deleted_at__isnull=True)`, không dùng `unique_together`
   - `CustomRole(BaseModel)` — `authority_level` align với ROLE_CHOICES: 20=Admin, 15=Member, 5=Guest, 0=custom
   - `CustomRoleScheme(BaseModel)` — junction table

3. Cập nhật `apps/api/plane/db/models/__init__.py`: export 3 models mới

4. Thêm `custom_role = ForeignKey(CustomRole, null=True, blank=True, on_delete=SET_NULL)` vào:
   - `WorkspaceMember` trong `workspace.py`
   - `ProjectMember` trong `project.py`

5. Tạo migration: `python manage.py makemigrations db --name=add_gac_models`

6. Management command `plane/db/management/commands/seed_system_roles.py` (idempotent)

### Bước 2: Permission Engine

7. Tạo `apps/api/plane/app/permissions/engine.py`:
   - Class `PermissionEngine` với method `check(user_id, permission, workspace_id, project_id=None, resource_creator_id=None)`
   - KHÔNG import hay dùng `lru_cache`
   - Dùng Django cache framework (`from django.core.cache import cache`)
   - `_get_effective_permissions` PHẢI dùng `prefetch_related("schemes")` để tránh N+1
   - Decorator `require_gac_permission(permission: str)`
   - Cache invalidation signals cho `CustomRoleScheme`

### Bước 3: Serializers & Views

8. Tạo `apps/api/plane/app/serializers/roles.py`:
   - `PermissionSchemeSerializer`
   - `CustomRoleSerializer` (include `schemes` nested, `effective_permissions` computed)
   - `CustomRoleSchemeSerializer`

9. Tạo `apps/api/plane/app/views/workspace/roles.py`:
   - `PermissionSchemeViewSet`: CRUD, filter by scope, block edit/delete on `is_system`
   - `CustomRoleViewSet`: CRUD, block delete on `is_system`, DELETE nhận `replacement_role_id`
   - `RoleSchemeViewSet`: attach/detach schemes + GET effective-permissions

10. Thêm URL patterns vào `apps/api/plane/app/urls/workspace.py`
    URL prefix: `/api/workspaces/{slug}/...` (KHÔNG phải `/api/v1/`)

### Bước 4: Frontend Types & Constants

11. Tạo `packages/types/src/roles.ts`:
    - `IPermissionScheme`, `ICustomRole`, `IPermissionGroup`, `IPermissionDef`
    - `ICustomRoleCreate`, `IPermissionSchemeCreate`
    - Export từ `packages/types/src/index.ts`

12. Cập nhật `packages/types/src/settings.ts`:
    - Thêm `"roles"` vào union `TWorkspaceSettingsTabs`

13. Cập nhật `packages/constants/src/settings/workspace.ts`:
    - Thêm `roles` vào `WORKSPACE_SETTINGS` (access: [EUserWorkspaceRoles.ADMIN])
    - Thêm vào `GROUPED_WORKSPACE_SETTINGS[ADMINISTRATION]`

14. Thêm icon cho "roles" vào `apps/web/core/components/settings/workspace/sidebar/item-icon.tsx`

### Bước 5: Frontend Service & Store

15. Tạo `apps/web/core/services/roles.service.ts` (extends `APIService`)

16. Tạo `apps/web/core/store/roles.store.ts` (MobX observable):
    - State: `permissionSchemes`, `customRoles` (Record<string, ...>)
    - `getEffectivePermissions(roleId)` — client-side union preview
    - Actions: CRUD + attach/detach

17. Cập nhật `apps/web/core/store/root.store.ts`:
    - Import và khởi tạo `RolesStore`
    - Thêm vào `resetOnSignOut()`

### Bước 6: Routes & Pages

18. Cập nhật `apps/web/app/routes/core.ts`:
    - Thêm route `:workspaceSlug/settings/roles`
    - Thêm route `:workspaceSlug/settings/roles/:roleId`

19. Tạo page `apps/web/app/(all)/[workspaceSlug]/(settings)/settings/(workspace)/roles/page.tsx`:
    - Hai tabs: "Workspace" và "Project"
    - Mỗi tab: sub-tabs "Roles" và "Permission Schemes"
    - Accessible cho Admin only

20. Tạo page `apps/web/app/(all)/[workspaceSlug]/(settings)/settings/(workspace)/roles/[roleId]/page.tsx`:
    - Role detail: name, description, schemes attached
    - "Attach Permission Schemes" button → SchemeAttachPanel
    - Effective Permissions preview (read-only, grouped)

### Bước 7: Components

21. `apps/web/core/components/roles/PermissionGroupToggle.tsx`:
    - Props: `group: IPermissionGroup`, `selected: string[]`, `onChange`
    - "Select All" toggle, checkbox rows, conditional badge
    - Auto-check prerequisites (dimmed, không bỏ được)
    - Collapse/expand animation

22. `apps/web/core/components/roles/SchemeCreateForm.tsx`
23. `apps/web/core/components/roles/SchemeAttachPanel.tsx` (slide-over)
24. `apps/web/core/components/roles/RoleDeleteModal.tsx` (với replacement picker)
25. `apps/web/core/components/roles/RolesList.tsx`, `RoleCard.tsx`
26. `apps/web/core/components/roles/SchemesList.tsx`, `SchemeCard.tsx`

## Constraints

- Không tạo `plane.iam` Django app mới — dùng `plane.app` và `plane.db` đã có
- Không dùng `unique_together` — dùng `UniqueConstraint` với soft-delete condition
- Không implement `+lead` conditional grant (Teamspace không tồn tại trong CE)
- `authority_level`: 20=Admin, 15=Member, 5=Guest, 0=custom (không dùng 100/80/60/40)
- Mọi route React Router 7 PHẢI được đăng ký trong `apps/web/app/routes/core.ts`
- Service files của app-level: `apps/web/core/services/`, không phải `packages/services/src/`
- TypeScript strict mode, MobX patterns, `workspace:*` imports, `catalog:` cho external deps
- Sau khi implement: chạy `pnpm check:types` và `pnpm check:lint`
- Thêm i18n keys vào tất cả language files trong `packages/i18n/src/locales/`
```

---

## Phần 11 — Ví dụ Use Cases để Test

### Use Case 1: "Release Manager" role

```
1. Workspace settings → Roles → Workspace tab → Create Role "Release Manager"
2. Tạo scheme "Release Publishing": permissions = [project:publish, project:create]
3. Attach system scheme "Workspace Member" (base permissions)
4. Attach scheme "Release Publishing"
5. Gán role cho user → user có đúng permissions
```

### Use Case 2: "QA Reviewer" role

```
1. Tạo project scheme "QA Access":
   - workitem:view ✓
   - comment:create ✓
   - workitem:edit+creator ✓
   - workitem:create ✗ (không check)
2. Tạo role "QA Reviewer" → attach scheme "QA Access"
3. Add QA engineers vào project với role "QA Reviewer"
```

### Use Case 3: "Billing Admin" workspace role

```
1. Tạo workspace scheme "Billing Only":
   - workspace:view_settings ✓
2. Tạo role "Billing Admin" → attach "Billing Only"
3. Gán cho kế toán viên
```

---

_Tài liệu này đã được audit và sửa lại hoàn toàn so với v1.0._  
_Version: 2.0 | Ngày: 2026-05-21 | Audited by: Claude Code (Sonnet 4.6)_
