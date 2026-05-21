/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { makeObservable, observable, action, computed } from "mobx";
import type {
  IPermissionScheme,
  IPermissionSchemeCreate,
  ICustomRole,
  ICustomRoleCreate,
  IPermissionGroup,
  IPermissionGroupsResponse,
} from "@plane/types";
import { rolesService } from "@/services/roles.service";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Union unconditional-wins: "workitem:delete" trumps "workitem:delete+creator". */
function resolveConditionalConflicts(permissions: Set<string>): Set<string> {
  const unconditional = new Set([...permissions].filter((p) => !p.includes("+")));
  const resolved = new Set<string>();
  for (const perm of permissions) {
    if (perm.includes("+")) {
      const base = perm.split("+")[0];
      if (unconditional.has(base)) continue;
    }
    resolved.add(perm);
  }
  return resolved;
}

// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

export interface IRolesStore {
  // State
  permissionSchemes: Record<string, IPermissionScheme>;
  customRoles: Record<string, ICustomRole>;
  permissionGroups: Record<string, IPermissionGroup[]>;
  isLoadingSchemes: boolean;
  isLoadingRoles: boolean;

  // Computed getters
  getSchemeById(id: string): IPermissionScheme | undefined;
  getRoleById(id: string): ICustomRole | undefined;
  getSchemesByScope(scope: "workspace" | "project"): IPermissionScheme[];
  getRolesByScope(scope: "workspace" | "project"): ICustomRole[];

  // Client-side union preview (before saving)
  computeEffectivePermissions(roleId: string): string[];

  // Scheme actions
  fetchSchemes(workspaceSlug: string, scope?: "workspace" | "project"): Promise<void>;
  createScheme(workspaceSlug: string, data: IPermissionSchemeCreate): Promise<IPermissionScheme>;
  updateScheme(
    workspaceSlug: string,
    schemeId: string,
    data: Partial<IPermissionSchemeCreate>
  ): Promise<IPermissionScheme>;
  deleteScheme(workspaceSlug: string, schemeId: string): Promise<void>;

  // Role actions
  fetchRoles(workspaceSlug: string, scope?: "workspace" | "project"): Promise<void>;
  fetchRole(workspaceSlug: string, roleId: string): Promise<ICustomRole>;
  createRole(workspaceSlug: string, data: ICustomRoleCreate): Promise<ICustomRole>;
  updateRole(
    workspaceSlug: string,
    roleId: string,
    data: Partial<ICustomRoleCreate>
  ): Promise<ICustomRole>;
  deleteRole(workspaceSlug: string, roleId: string, replacementRoleId?: string): Promise<void>;

  // Scheme attachment
  attachScheme(workspaceSlug: string, roleId: string, schemeId: string): Promise<void>;
  detachScheme(workspaceSlug: string, roleId: string, schemeId: string): Promise<void>;

  // Permission groups (for UI checkbox list)
  fetchPermissionGroups(
    workspaceSlug: string,
    scope: "workspace" | "project"
  ): Promise<IPermissionGroup[]>;
}

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

export class RolesStore implements IRolesStore {
  permissionSchemes: Record<string, IPermissionScheme> = {};
  customRoles: Record<string, ICustomRole> = {};
  /** Keyed by scope: "workspace" | "project" */
  permissionGroups: Record<string, IPermissionGroup[]> = {};
  isLoadingSchemes = false;
  isLoadingRoles = false;

  constructor() {
    makeObservable(this, {
      permissionSchemes: observable,
      customRoles: observable,
      permissionGroups: observable,
      isLoadingSchemes: observable,
      isLoadingRoles: observable,
      getSchemesByScope: computed,
      getRolesByScope: computed,
      fetchSchemes: action,
      createScheme: action,
      updateScheme: action,
      deleteScheme: action,
      fetchRoles: action,
      fetchRole: action,
      createRole: action,
      updateRole: action,
      deleteRole: action,
      attachScheme: action,
      detachScheme: action,
      fetchPermissionGroups: action,
    });
  }

  // ---------------------------------------------------------------------------
  // Computed getters
  // ---------------------------------------------------------------------------

  getSchemeById(id: string): IPermissionScheme | undefined {
    return this.permissionSchemes[id];
  }

  getRoleById(id: string): ICustomRole | undefined {
    return this.customRoles[id];
  }

  get getSchemesByScope(): (scope: "workspace" | "project") => IPermissionScheme[] {
    return (scope) => Object.values(this.permissionSchemes).filter((s) => s.scope === scope);
  }

  get getRolesByScope(): (scope: "workspace" | "project") => ICustomRole[] {
    return (scope) => Object.values(this.customRoles).filter((r) => r.scope === scope);
  }

  /**
   * Client-side union preview — useful for the SchemeAttachPanel to show what
   * the effective permissions would be after attaching a set of schemes.
   */
  computeEffectivePermissions(roleId: string): string[] {
    const role = this.customRoles[roleId];
    if (!role) return [];
    const all = new Set<string>();
    role.schemes.forEach((s) => s.permissions.forEach((p) => all.add(p)));
    return [...resolveConditionalConflicts(all)].toSorted();
  }

  // ---------------------------------------------------------------------------
  // Scheme actions
  // ---------------------------------------------------------------------------

  fetchSchemes = action(async (workspaceSlug: string, scope?: "workspace" | "project") => {
    this.isLoadingSchemes = true;
    try {
      const schemes = await rolesService.listSchemes(workspaceSlug, scope);
      schemes.forEach((s) => {
        this.permissionSchemes[s.id] = s;
      });
    } finally {
      this.isLoadingSchemes = false;
    }
  });

  createScheme = action(async (workspaceSlug: string, data: IPermissionSchemeCreate) => {
    const scheme = await rolesService.createScheme(workspaceSlug, data);
    this.permissionSchemes[scheme.id] = scheme;
    return scheme;
  });

  updateScheme = action(
    async (workspaceSlug: string, schemeId: string, data: Partial<IPermissionSchemeCreate>) => {
      const scheme = await rolesService.updateScheme(workspaceSlug, schemeId, data);
      this.permissionSchemes[schemeId] = scheme;
      // Update the scheme inside any role that has it attached
      Object.values(this.customRoles).forEach((role) => {
        const idx = role.schemes.findIndex((s) => s.id === schemeId);
        if (idx !== -1) {
          role.schemes[idx] = scheme;
        }
      });
      return scheme;
    }
  );

  deleteScheme = action(async (workspaceSlug: string, schemeId: string) => {
    await rolesService.deleteScheme(workspaceSlug, schemeId);
    delete this.permissionSchemes[schemeId];
    // Remove from any role
    Object.values(this.customRoles).forEach((role) => {
      role.schemes = role.schemes.filter((s) => s.id !== schemeId);
    });
  });

  // ---------------------------------------------------------------------------
  // Role actions
  // ---------------------------------------------------------------------------

  fetchRoles = action(async (workspaceSlug: string, scope?: "workspace" | "project") => {
    this.isLoadingRoles = true;
    try {
      const roles = await rolesService.listRoles(workspaceSlug, scope);
      roles.forEach((r) => {
        this.customRoles[r.id] = r;
      });
    } finally {
      this.isLoadingRoles = false;
    }
  });

  fetchRole = action(async (workspaceSlug: string, roleId: string) => {
    const role = await rolesService.getRole(workspaceSlug, roleId);
    this.customRoles[roleId] = role;
    return role;
  });

  createRole = action(async (workspaceSlug: string, data: ICustomRoleCreate) => {
    const role = await rolesService.createRole(workspaceSlug, data);
    this.customRoles[role.id] = role;
    return role;
  });

  updateRole = action(async (workspaceSlug: string, roleId: string, data: Partial<ICustomRoleCreate>) => {
    const role = await rolesService.updateRole(workspaceSlug, roleId, data);
    this.customRoles[roleId] = role;
    return role;
  });

  deleteRole = action(async (workspaceSlug: string, roleId: string, replacementRoleId?: string) => {
    await rolesService.deleteRole(workspaceSlug, roleId, replacementRoleId);
    delete this.customRoles[roleId];
  });

  // ---------------------------------------------------------------------------
  // Scheme attachment
  // ---------------------------------------------------------------------------

  attachScheme = action(async (workspaceSlug: string, roleId: string, schemeId: string) => {
    await rolesService.attachScheme(workspaceSlug, roleId, schemeId);
    // Refresh the role from server to get the updated schemes list
    await this.fetchRole(workspaceSlug, roleId);
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

  // ---------------------------------------------------------------------------
  // Permission groups
  // ---------------------------------------------------------------------------

  fetchPermissionGroups = action(
    async (workspaceSlug: string, scope: "workspace" | "project"): Promise<IPermissionGroup[]> => {
      if (this.permissionGroups[scope]) return this.permissionGroups[scope];
      const response: IPermissionGroupsResponse = await rolesService.getPermissionGroups(
        workspaceSlug,
        scope
      );
      this.permissionGroups[scope] = response.groups;
      return response.groups;
    }
  );
}
