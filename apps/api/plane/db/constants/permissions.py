# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

"""
GAC Permission Registry.

Permission identifier format: "<resource>:<action>[+condition]"
  - Unconditional: "workitem:delete"
  - Conditional:   "workitem:delete+creator"  (only if user created the resource)

Note: "+lead" condition is NOT supported in CE (Teamspace is EE-only).
"""

WORKSPACE_PERMISSIONS: list[str] = [
    # Workspace Settings
    "workspace:view_settings",
    "workspace:edit_settings",
    # workspace:delete and workspace:transfer_ownership are RESERVED — never assignable
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
    # Custom Roles (meta-permission)
    "custom_role:view",
    "custom_role:create",
    "custom_role:edit",
    "custom_role:delete",
]

PROJECT_PERMISSIONS: list[str] = [
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
    # Project Admin only
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

# Permissions that can NEVER be assigned to any custom role.
RESERVED_PERMISSIONS: frozenset[str] = frozenset(
    [
        "workspace:delete",
        "workspace:transfer_ownership",
    ]
)

# All valid permission identifiers (union of workspace + project).
ALL_PERMISSIONS: frozenset[str] = frozenset(WORKSPACE_PERMISSIONS + PROJECT_PERMISSIONS)

# Dependency map: enabling a permission auto-enables these prerequisites.
# Key = permission, Value = list of permissions that must also be enabled.
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
    "comment:delete": ["comment:create"],
    "cycle:edit": ["cycle:view"],
    "cycle:delete": ["cycle:view"],
    "cycle:delete+creator": ["cycle:view"],
    "module:edit": ["module:view"],
    "module:delete": ["module:view"],
    "module:delete+creator": ["module:view"],
    "page:edit": ["page:view"],
    "page:delete": ["page:view"],
}

# UI display groups — used by frontend PermissionGroupToggle component.
PERMISSION_GROUPS: dict[str, list[dict]] = {
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
                {
                    "id": "workitem:edit+creator",
                    "label": "Edit own work items",
                    "conditional": "creator",
                },
                {"id": "workitem:delete", "label": "Delete any work item"},
                {
                    "id": "workitem:delete+creator",
                    "label": "Delete own work items",
                    "conditional": "creator",
                },
                {"id": "workitem:bulk_edit", "label": "Bulk edit work items"},
                {"id": "workitem:archive", "label": "Archive work items"},
                {"id": "workitem:export", "label": "Export work items"},
            ],
        },
        {
            "group_name": "Comments",
            "permissions": [
                {"id": "comment:create", "label": "Create comments"},
                {
                    "id": "comment:edit+creator",
                    "label": "Edit own comments",
                    "conditional": "creator",
                },
                {
                    "id": "comment:delete+creator",
                    "label": "Delete own comments",
                    "conditional": "creator",
                },
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
                {
                    "id": "cycle:delete+creator",
                    "label": "Delete own cycles",
                    "conditional": "creator",
                },
            ],
        },
        {
            "group_name": "Modules",
            "permissions": [
                {"id": "module:view", "label": "View modules"},
                {"id": "module:create", "label": "Create modules"},
                {"id": "module:edit", "label": "Edit modules"},
                {"id": "module:delete", "label": "Delete any module"},
                {
                    "id": "module:delete+creator",
                    "label": "Delete own modules",
                    "conditional": "creator",
                },
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
