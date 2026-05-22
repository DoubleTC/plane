/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

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
  /** Total number of workspace + project members tagged with this role. */
  member_count?: number;
  created_at: string;
  updated_at: string;
}

export interface ICustomRoleCreate {
  name: string;
  description?: string;
  scope: "workspace" | "project";
}
