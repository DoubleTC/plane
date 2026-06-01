/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { API_BASE_URL } from "@plane/constants";
import { APIService } from "@/services/api.service";

/**
 * Completion-timeliness buckets for a scope (project / cycle / module /
 * member). Only completed work items that carry BOTH a start_date and a
 * target_date contribute. See the backend `classify_timeliness` helper:
 * finished >=2 days early → `early`, 0–1 day early → `on_time`, late →
 * `delayed`.
 */
export type TScheduleBuckets = {
  early: number;
  on_time: number;
  delayed: number;
};

export type TProjectAnalyticsStateBreakdown = {
  id: string;
  name: string;
  group: string;
  color: string;
  count: number;
};

export type TProjectAnalyticsMember = {
  member_id: string;
  display_name: string;
  avatar_url: string | null;
  role: number;
  custom_role: string | null;
  /** 0–100: share of the member's last-30-day workload spent on this project. */
  allocation_pct: number;
  completed: number;
  total_assigned: number;
  /** 0–100, over dated completed items only. */
  on_time_rate: number;
  schedule: TScheduleBuckets;
};

/**
 * Aggregated payload for the Analytics → Projects dashboard, scoped to one
 * project. Backend: ProjectAnalyticsOverviewEndpoint in
 * apps/api/plane/app/views/analytic/project_analytics.py.
 */
export type TProjectAnalyticsOverview = {
  schedule: TScheduleBuckets;
  cycle_schedule: Record<string, TScheduleBuckets>;
  module_schedule: Record<string, TScheduleBuckets>;
  state_breakdown: TProjectAnalyticsStateBreakdown[];
  members: TProjectAnalyticsMember[];
};

export class ProjectAnalyticsService extends APIService {
  constructor() {
    super(API_BASE_URL);
  }

  /**
   * Fetch the full BI dashboard payload for a single project: timeliness
   * buckets (project + per cycle/module/member), state breakdown and the
   * member performance table.
   */
  async getProjectAnalyticsOverview(workspaceSlug: string, projectId: string): Promise<TProjectAnalyticsOverview> {
    return this.get(`/api/workspaces/${workspaceSlug}/projects/${projectId}/analytics-overview/`).then(
      (res) => res?.data
    );
  }
}
