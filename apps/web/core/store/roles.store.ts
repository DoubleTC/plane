/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { makeObservable, observable, action, computed } from "mobx";
import type { ICustomRole, ICustomRoleCreate } from "@plane/types";
import { rolesService } from "@/services/roles.service";

export interface IRolesStore {
  customRoles: Record<string, ICustomRole>;
  isLoadingRoles: boolean;

  getRoleById(id: string): ICustomRole | undefined;
  getRolesByScope(scope: "workspace" | "project"): ICustomRole[];

  fetchRoles(workspaceSlug: string, scope?: "workspace" | "project"): Promise<void>;
  fetchRole(workspaceSlug: string, roleId: string): Promise<ICustomRole>;
  createRole(workspaceSlug: string, data: ICustomRoleCreate): Promise<ICustomRole>;
  updateRole(workspaceSlug: string, roleId: string, data: Partial<ICustomRoleCreate>): Promise<ICustomRole>;
  deleteRole(workspaceSlug: string, roleId: string, replacementRoleId?: string): Promise<void>;
}

export class RolesStore implements IRolesStore {
  customRoles: Record<string, ICustomRole> = {};
  isLoadingRoles = false;

  constructor() {
    makeObservable(this, {
      customRoles: observable,
      isLoadingRoles: observable,
      getRolesByScope: computed,
      fetchRoles: action,
      fetchRole: action,
      createRole: action,
      updateRole: action,
      deleteRole: action,
    });
  }

  getRoleById = (id: string): ICustomRole | undefined => this.customRoles[id];

  get getRolesByScope(): (scope: "workspace" | "project") => ICustomRole[] {
    return (scope) => Object.values(this.customRoles).filter((r) => r.scope === scope);
  }

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
}
