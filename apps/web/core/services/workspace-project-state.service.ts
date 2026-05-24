/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { API_BASE_URL } from "@plane/constants";
import type { IWorkspaceProjectState, IWorkspaceProjectStateCreate, IWorkspaceProjectStateUpdate } from "@plane/types";
import { APIService } from "./api.service";

export class WorkspaceProjectStateService extends APIService {
  constructor() {
    super(API_BASE_URL);
  }

  async list(workspaceSlug: string): Promise<IWorkspaceProjectState[]> {
    return this.get(`/api/workspaces/${workspaceSlug}/project-states/`)
      .then((res) => res.data)
      .catch((err) => {
        throw err?.response;
      });
  }

  async create(workspaceSlug: string, data: IWorkspaceProjectStateCreate): Promise<IWorkspaceProjectState> {
    return this.post(`/api/workspaces/${workspaceSlug}/project-states/`, data)
      .then((res) => res.data)
      .catch((err) => {
        throw err?.response;
      });
  }

  async update(
    workspaceSlug: string,
    stateId: string,
    data: IWorkspaceProjectStateUpdate
  ): Promise<IWorkspaceProjectState> {
    return this.patch(`/api/workspaces/${workspaceSlug}/project-states/${stateId}/`, data)
      .then((res) => res.data)
      .catch((err) => {
        throw err?.response;
      });
  }

  async destroy(workspaceSlug: string, stateId: string): Promise<void> {
    return this.delete(`/api/workspaces/${workspaceSlug}/project-states/${stateId}/`)
      .then((res) => res.data)
      .catch((err) => {
        throw err?.response;
      });
  }

  async toggleFeature(workspaceSlug: string, enabled: boolean): Promise<{ project_states_enabled: boolean }> {
    return this.post(`/api/workspaces/${workspaceSlug}/project-states/toggle/`, {
      project_states_enabled: enabled,
    })
      .then((res) => res.data)
      .catch((err) => {
        throw err?.response;
      });
  }
}

export const workspaceProjectStateService = new WorkspaceProjectStateService();
