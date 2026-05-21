/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import type {
  IPermissionScheme,
  IPermissionSchemeCreate,
  ICustomRole,
  ICustomRoleCreate,
  IPermissionGroupsResponse,
} from "@plane/types";
import { APIService } from "./api.service";

const API_BASE_URL = typeof window !== "undefined" ? window.location.origin : "";

export class RolesService extends APIService {
  constructor() {
    super(API_BASE_URL);
  }

  // ---------------------------------------------------------------------------
  // Permission Schemes
  // ---------------------------------------------------------------------------

  async listSchemes(workspaceSlug: string, scope?: "workspace" | "project"): Promise<IPermissionScheme[]> {
    const query = scope ? `?scope=${scope}` : "";
    return this.get(`/api/workspaces/${workspaceSlug}/permission-schemes/${query}`)
      .then((res) => res.data)
      .catch((err) => {
        throw err?.response;
      });
  }

  async getScheme(workspaceSlug: string, schemeId: string): Promise<IPermissionScheme> {
    return this.get(`/api/workspaces/${workspaceSlug}/permission-schemes/${schemeId}/`)
      .then((res) => res.data)
      .catch((err) => {
        throw err?.response;
      });
  }

  async createScheme(workspaceSlug: string, data: IPermissionSchemeCreate): Promise<IPermissionScheme> {
    return this.post(`/api/workspaces/${workspaceSlug}/permission-schemes/`, data)
      .then((res) => res.data)
      .catch((err) => {
        throw err?.response;
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
        throw err?.response;
      });
  }

  async deleteScheme(workspaceSlug: string, schemeId: string): Promise<void> {
    return this.delete(`/api/workspaces/${workspaceSlug}/permission-schemes/${schemeId}/`)
      .then((res) => res.data)
      .catch((err) => {
        throw err?.response;
      });
  }

  async getPermissionGroups(workspaceSlug: string, scope: "workspace" | "project"): Promise<IPermissionGroupsResponse> {
    return this.get(`/api/workspaces/${workspaceSlug}/permission-schemes/permission-groups/?scope=${scope}`)
      .then((res) => res.data)
      .catch((err) => {
        throw err?.response;
      });
  }

  // ---------------------------------------------------------------------------
  // Custom Roles
  // ---------------------------------------------------------------------------

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

  async getEffectivePermissions(workspaceSlug: string, roleId: string): Promise<string[]> {
    return this.get(`/api/workspaces/${workspaceSlug}/custom-roles/${roleId}/effective-permissions/`)
      .then((res) => res.data?.permissions ?? [])
      .catch((err) => {
        throw err?.response;
      });
  }

  // ---------------------------------------------------------------------------
  // Scheme attachment
  // ---------------------------------------------------------------------------

  async attachScheme(workspaceSlug: string, roleId: string, schemeId: string): Promise<void> {
    return this.post(`/api/workspaces/${workspaceSlug}/custom-roles/${roleId}/schemes/`, {
      scheme_id: schemeId,
    })
      .then((res) => res.data)
      .catch((err) => {
        throw err?.response;
      });
  }

  async detachScheme(workspaceSlug: string, roleId: string, schemeId: string): Promise<void> {
    return this.delete(`/api/workspaces/${workspaceSlug}/custom-roles/${roleId}/schemes/${schemeId}/`)
      .then((res) => res.data)
      .catch((err) => {
        throw err?.response;
      });
  }
}

export const rolesService = new RolesService();
