/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { API_BASE_URL } from "@plane/constants";
import { APIService } from "@/services/api.service";

/** Time bucket for the member scorecard; each compared to the previous one. */
export type TMemberPeriod = "week" | "month" | "year";

/** The five scorecard pillars (each 0–100). */
export type TMemberPillars = {
  delivery: number;
  quality: number;
  predictability: number;
  flow: number;
  collaboration: number;
};

/**
 * Raw per-member metrics. Backend: WorkspaceMemberAnalyticsEndpoint in
 * apps/api/plane/app/views/analytic/member_analytics.py. Cycle/lead time are in
 * days; rates and ratios are 0–100; WIP/overdue are point-in-time snapshots.
 */
export type TMemberMetrics = {
  assigned_count: number;
  completed_count: number;
  completion_rate: number;
  completed_points: number;
  early: number;
  on_time: number;
  delayed: number;
  early_rate: number;
  on_time_rate: number;
  delayed_rate: number;
  reopen_count: number;
  bug_ratio: number;
  overdue_open: number;
  scope_adherence: number;
  cycle_time_stddev: number;
  avg_cycle_time: number;
  avg_lead_time: number;
  wip: number;
  comments: number;
  mentions_received: number;
  projects_touched: number;
  ownership: number;
};

/** Headline metrics from the previous period, for delta arrows. */
export type TMemberPrev = {
  completed_count: number;
  completed_points: number;
  on_time_rate: number;
};

export type TMemberRow = {
  member_id: string;
  display_name: string;
  avatar_url: string | null;
  role: number;
  custom_role: string | null;
  metrics: TMemberMetrics;
  prev: TMemberPrev;
  pillars: TMemberPillars;
  /** Composite Performance Index, 0–100. */
  index: number;
  /** Rank within the evaluated team, 0–100. */
  percentile: number;
};

export type TMemberAnalyticsResponse = {
  period: {
    type: TMemberPeriod;
    start: string;
    end: string;
    prev_start: string;
    prev_end: string;
  };
  members: TMemberRow[];
  team: { evaluated: number; avg_index: number };
};

export type TMemberTrendPoint = {
  key: string;
  completed: number;
  points: number;
  on_time_rate: number;
};

export type TMemberDetail = {
  trend: TMemberTrendPoint[];
  cycle_time: { p50: number; p85: number; max: number; count: number };
  estimate_scatter: { point: number; cycle_time_days: number }[];
  heatmap: { date: string; count: number }[];
  recent_issues: {
    id: string;
    name: string;
    sequence_id: number;
    project_id: string;
    completed_at: string | null;
    on_time: boolean | null;
  }[];
};

type MemberAnalyticsParams = {
  period: TMemberPeriod;
  projectIds?: string[];
};

export class MemberAnalyticsService extends APIService {
  constructor() {
    super(API_BASE_URL);
  }

  /** Workspace-wide member scorecard leaderboard for the given period. */
  async getMemberAnalytics(workspaceSlug: string, params: MemberAnalyticsParams): Promise<TMemberAnalyticsResponse> {
    return this.get(`/api/workspaces/${workspaceSlug}/member-analytics/`, {
      params: {
        period: params.period,
        ...(params.projectIds && params.projectIds.length > 0 ? { project_ids: params.projectIds.join(",") } : {}),
      },
    }).then((res) => res?.data);
  }

  /** Drill-down series (trend / cycle time / scatter / heatmap / recent) for one member. */
  async getMemberDetail(
    workspaceSlug: string,
    memberId: string,
    params: MemberAnalyticsParams
  ): Promise<TMemberDetail> {
    return this.get(`/api/workspaces/${workspaceSlug}/member-analytics/${memberId}/`, {
      params: {
        period: params.period,
        ...(params.projectIds && params.projectIds.length > 0 ? { project_ids: params.projectIds.join(",") } : {}),
      },
    }).then((res) => res?.data);
  }
}
