/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { API_BASE_URL } from "@plane/constants";
import type { ICustomRole, ICustomRoleCreate } from "@plane/types";
import { APIService } from "./api.service";

export class RolesService extends APIService {
  constructor() {
    super(API_BASE_URL);
  }

  async listRoles(workspaceSlug: string, scope?: "workspace" | "project"): Promise<ICustomRole[]> {
    const query = scope ? `?scope=${scope}` : "";
    return this.get(`/api/workspaces/${workspaceSlug}/custom-roles/${query}`)
      .then((res) => res.data)
      .catch((err) => {
        throw err?.response;
      });
  }

  async getRole(workspaceSlug: string, roleId: string): Promise<ICustomRole> {
    return this.get(`/api/workspaces/${workspaceSlug}/custom-roles/${roleId}/`)
      .then((res) => res.data)
      .catch((err) => {
        throw err?.response;
      });
  }

  async createRole(workspaceSlug: string, data: ICustomRoleCreate): Promise<ICustomRole> {
    return this.post(`/api/workspaces/${workspaceSlug}/custom-roles/`, data)
      .then((res) => res.data)
      .catch((err) => {
        throw err?.response;
      });
  }

  async updateRole(workspaceSlug: string, roleId: string, data: Partial<ICustomRoleCreate>): Promise<ICustomRole> {
    return this.patch(`/api/workspaces/${workspaceSlug}/custom-roles/${roleId}/`, data)
      .then((res) => res.data)
      .catch((err) => {
        throw err?.response;
      });
  }

  async deleteRole(workspaceSlug: string, roleId: string, replacementRoleId?: string): Promise<void> {
    return this.delete(`/api/workspaces/${workspaceSlug}/custom-roles/${roleId}/`, {
      replacement_role_id: replacementRoleId,
    })
      .then((res) => res.data)
      .catch((err) => {
        throw err?.response;
      });
  }
}

export const rolesService = new RolesService();
