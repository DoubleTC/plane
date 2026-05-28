/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { API_BASE_URL } from "@plane/constants";
import { APIService } from "@/services/api.service";

/**
 * Response shape returned by the backend project advance-analytics endpoint.
 * Each bucket comes wrapped in `{ count }`. `cancelled` is not part of the
 * payload; we compute it client-side as `total - sum(other four)`.
 *
 * Backend reference: ProjectAdvanceAnalyticsEndpoint in
 * apps/api/plane/app/views/analytic/project_analytics.py.
 */
export type TProjectStateDistributionRaw = {
  total_work_items: { count: number };
  started_work_items: { count: number };
  backlog_work_items: { count: number };
  un_started_work_items: { count: number };
  completed_work_items: { count: number };
};

export type TProjectStateDistribution = {
  total: number;
  backlog: number;
  unstarted: number;
  started: number;
  completed: number;
  cancelled: number;
};

/**
 * Single activity row returned by the project activity endpoint. Mirrors the
 * Django `IssueActivitySerializer` shape, narrowed to the fields the right
 * sidebar actually renders.
 */
export type TProjectActivity = {
  id: string;
  verb: string;
  field: string | null;
  new_value: string | null;
  old_value: string | null;
  comment: string;
  created_at: string;
  actor_detail?: {
    id: string;
    display_name?: string;
    first_name?: string;
    last_name?: string;
    avatar_url?: string | null;
  } | null;
  issue_detail?: {
    id: string;
    name: string;
    sequence_id?: number;
  } | null;
};

export class ProjectOverviewService extends APIService {
  constructor() {
    super(API_BASE_URL);
  }

  /**
   * Fetch the per-state work-item distribution for a project. Returns
   * normalised totals with `cancelled` derived from the residual so the
   * five buckets always sum to `total`.
   */
  async getStateDistribution(workspaceSlug: string, projectId: string): Promise<TProjectStateDistribution> {
    return this.fetchStateDistribution(workspaceSlug, projectId);
  }

  /**
   * Same endpoint scoped to a single cycle: returns state distribution for
   * the work items attached to that cycle. The backend supports cycle_id
   * and module_id query params on the project-level advance-analytics view.
   */
  async getCycleStateDistribution(
    workspaceSlug: string,
    projectId: string,
    cycleId: string
  ): Promise<TProjectStateDistribution> {
    return this.fetchStateDistribution(workspaceSlug, projectId, { cycle_id: cycleId });
  }

  /** Scoped to a single module — see `getCycleStateDistribution`. */
  async getModuleStateDistribution(
    workspaceSlug: string,
    projectId: string,
    moduleId: string
  ): Promise<TProjectStateDistribution> {
    return this.fetchStateDistribution(workspaceSlug, projectId, { module_id: moduleId });
  }

  /**
   * Recent project activity (issue history rows aggregated across the
   * project). The endpoint accepts an optional `limit` query (default 50,
   * server-side cap 200) — kept small because the sidebar surface only
   * shows a recent feed.
   */
  async getProjectActivity(workspaceSlug: string, projectId: string, limit?: number): Promise<TProjectActivity[]> {
    return this.get(`/api/workspaces/${workspaceSlug}/projects/${projectId}/activity/`, {
      params: { limit },
    }).then((res) => res?.data ?? []);
  }

  private async fetchStateDistribution(
    workspaceSlug: string,
    projectId: string,
    params?: { cycle_id?: string; module_id?: string }
  ): Promise<TProjectStateDistribution> {
    const data: TProjectStateDistributionRaw = await this.get(
      `/api/workspaces/${workspaceSlug}/projects/${projectId}/advance-analytics/`,
      { params }
    ).then((res) => res?.data);

    const total = data?.total_work_items?.count ?? 0;
    const backlog = data?.backlog_work_items?.count ?? 0;
    const unstarted = data?.un_started_work_items?.count ?? 0;
    const started = data?.started_work_items?.count ?? 0;
    const completed = data?.completed_work_items?.count ?? 0;
    const cancelled = Math.max(total - (backlog + unstarted + started + completed), 0);

    return { total, backlog, unstarted, started, completed, cancelled };
  }
}
