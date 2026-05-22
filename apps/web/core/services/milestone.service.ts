/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { API_BASE_URL } from "@plane/constants";
import type { IMilestone, IMilestoneCreate, IMilestoneIssue, IMilestoneUpdate } from "@plane/types";
import { APIService } from "@/services/api.service";

export class MilestoneService extends APIService {
  constructor() {
    super(API_BASE_URL);
  }

  // -------------------------------------------------------------------------
  // Milestone CRUD
  // -------------------------------------------------------------------------

  async getMilestones(
    workspaceSlug: string,
    projectId: string,
    milestoneView?: "all" | "upcoming" | "overdue" | "archived"
  ): Promise<IMilestone[]> {
    const params = milestoneView && milestoneView !== "all" ? `?milestone_view=${milestoneView}` : "";
    return this.get(`/api/workspaces/${workspaceSlug}/projects/${projectId}/milestones/${params}`)
      .then((response) => response?.data)
      .catch((error) => {
        throw error?.response?.data;
      });
  }

  async getMilestoneDetails(workspaceSlug: string, projectId: string, milestoneId: string): Promise<IMilestone> {
    return this.get(`/api/workspaces/${workspaceSlug}/projects/${projectId}/milestones/${milestoneId}/`)
      .then((response) => response?.data)
      .catch((error) => {
        throw error?.response?.data;
      });
  }

  async createMilestone(workspaceSlug: string, projectId: string, data: IMilestoneCreate): Promise<IMilestone> {
    return this.post(`/api/workspaces/${workspaceSlug}/projects/${projectId}/milestones/`, data)
      .then((response) => response?.data)
      .catch((error) => {
        throw error?.response?.data;
      });
  }

  async updateMilestone(
    workspaceSlug: string,
    projectId: string,
    milestoneId: string,
    data: IMilestoneUpdate
  ): Promise<IMilestone> {
    return this.patch(`/api/workspaces/${workspaceSlug}/projects/${projectId}/milestones/${milestoneId}/`, data)
      .then((response) => response?.data)
      .catch((error) => {
        throw error?.response?.data;
      });
  }

  async deleteMilestone(workspaceSlug: string, projectId: string, milestoneId: string): Promise<void> {
    return this.delete(`/api/workspaces/${workspaceSlug}/projects/${projectId}/milestones/${milestoneId}/`)
      .then((response) => response?.data)
      .catch((error) => {
        throw error?.response?.data;
      });
  }

  // -------------------------------------------------------------------------
  // Archive / Unarchive
  // -------------------------------------------------------------------------

  async archiveMilestone(
    workspaceSlug: string,
    projectId: string,
    milestoneId: string
  ): Promise<{ archived_at: string }> {
    return this.post(
      `/api/workspaces/${workspaceSlug}/projects/${projectId}/milestones/${milestoneId}/archive/`,
      {}
    )
      .then((response) => response?.data)
      .catch((error) => {
        throw error?.response?.data;
      });
  }

  async unarchiveMilestone(workspaceSlug: string, projectId: string, milestoneId: string): Promise<void> {
    return this.delete(
      `/api/workspaces/${workspaceSlug}/projects/${projectId}/milestones/${milestoneId}/archive/`
    )
      .then((response) => response?.data)
      .catch((error) => {
        throw error?.response?.data;
      });
  }

  // -------------------------------------------------------------------------
  // Milestone Issues
  // -------------------------------------------------------------------------

  async getMilestoneIssues(
    workspaceSlug: string,
    projectId: string,
    milestoneId: string
  ): Promise<IMilestoneIssue[]> {
    return this.get(
      `/api/workspaces/${workspaceSlug}/projects/${projectId}/milestones/${milestoneId}/milestone-issues/`
    )
      .then((response) => response?.data)
      .catch((error) => {
        throw error?.response?.data;
      });
  }

  async addIssuesToMilestone(
    workspaceSlug: string,
    projectId: string,
    milestoneId: string,
    issueIds: string[]
  ): Promise<IMilestoneIssue[]> {
    return this.post(
      `/api/workspaces/${workspaceSlug}/projects/${projectId}/milestones/${milestoneId}/milestone-issues/`,
      { issues: issueIds }
    )
      .then((response) => response?.data)
      .catch((error) => {
        throw error?.response?.data;
      });
  }

  async removeIssueFromMilestone(
    workspaceSlug: string,
    projectId: string,
    milestoneId: string,
    milestoneIssueId: string
  ): Promise<void> {
    return this.delete(
      `/api/workspaces/${workspaceSlug}/projects/${projectId}/milestones/${milestoneId}/milestone-issues/${milestoneIssueId}/`
    )
      .then((response) => response?.data)
      .catch((error) => {
        throw error?.response?.data;
      });
  }
}
