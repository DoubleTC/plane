/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

// ---------------------------------------------------------------------------
// Permission Scheme
// ---------------------------------------------------------------------------

export interface IPermissionScheme {
  id: string;
  workspace: string;
  name: string;
  description: string;
  /** "workspace" | "project" */
  scope: "workspace" | "project";
  /** System schemes are read-only — created by the seed command. */
  is_system: boolean;
  /** List of permission identifier strings e.g. ["workitem:view", "workitem:delete+creator"] */
  permissions: string[];
  created_at: string;
  updated_at: string;
}

export interface IPermissionSchemeCreate {
  name: string;
  description?: string;
  scope: "workspace" | "project";
  permissions: string[];
}

// ---------------------------------------------------------------------------
// Custom Role
// ---------------------------------------------------------------------------

export interface ICustomRole {
  id: string;
  workspace: string;
  name: string;
  description: string;
  scope: "workspace" | "project";
  /** System roles mirror the three built-in RBAC roles and cannot be deleted. */
  is_system: boolean;
  /**
   * Mirrors ROLE_CHOICES on the backend:
   *   20 = Admin, 15 = Member, 5 = Guest, 0 = user-created custom role
   */
  authority_level: number;
  /** Schemes attached to this role (M2M). */
  schemes: IPermissionScheme[];
  /** Server-computed union of all scheme permissions (with unconditional-wins logic). */
  effective_permissions: string[];
  /** Total number of workspace + project members assigned to this role. */
  member_count?: number;
  created_at: string;
  updated_at: string;
}

export interface ICustomRoleCreate {
  name: string;
  description?: string;
  scope: "workspace" | "project";
}

// ---------------------------------------------------------------------------
// Permission definition (used by the UI checkbox list)
// ---------------------------------------------------------------------------

export interface IPermissionDef {
  /** Identifier e.g. "workitem:delete+creator" */
  id: string;
  /** Human-readable label e.g. "Delete own work items" */
  label: string;
  description?: string;
  /**
   * Conditional type. Only "creator" is supported in CE.
   * "lead" is intentionally omitted (EE-only, requires Teamspace).
   */
  conditional?: "creator";
  /** Identifiers that must also be enabled when this permission is checked. */
  prerequisites?: string[];
}

export interface IPermissionGroup {
  group_name: string;
  permissions: IPermissionDef[];
}

export interface IPermissionGroupsResponse {
  scope: "workspace" | "project";
  groups: IPermissionGroup[];
}
