/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { EUserPermissions } from "@plane/constants";
import type { TProjectAnalyticsStateBreakdown } from "@/services/project/project-analytics.service";
import { EMPTY_STATE_COUNTS, type TStateCounts } from "../../project-overview/metrics-utils";

/**
 * Whether local-today falls within `[start, end]` (inclusive). Used to
 * highlight the phase / cycle / module that is currently in flight. Both
 * endpoints are required — an open-ended range is treated as "not current".
 */
export const isTodayWithin = (start?: string | null, end?: string | null): boolean => {
  if (!start || !end) return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const startDate = new Date(start);
  startDate.setHours(0, 0, 0, 0);
  const endDate = new Date(end);
  endDate.setHours(0, 0, 0, 0);
  return startDate.getTime() <= today.getTime() && today.getTime() <= endDate.getTime();
};

/** Built-in project role → i18n label key (fallback when no custom role is set). */
export const ROLE_I18N_KEY: Record<number, string> = {
  [EUserPermissions.ADMIN]: "analytics_project.role.admin",
  [EUserPermissions.MEMBER]: "analytics_project.role.member",
  [EUserPermissions.GUEST]: "analytics_project.role.guest",
};

/** Format a 0–100 number as a short percentage label (no decimals when whole). */
export const formatPercent = (value: number): string => {
  const rounded = Math.round(value * 10) / 10;
  return `${Number.isInteger(rounded) ? rounded : rounded.toFixed(1)}%`;
};

/**
 * Roll the per-state breakdown up into the 5-group `TStateCounts` shape used by
 * the shared progress bar / legend, so we don't need a second request for the
 * overall distribution.
 */
export const deriveStateCounts = (breakdown: TProjectAnalyticsStateBreakdown[]): TStateCounts => {
  const counts: TStateCounts = { ...EMPTY_STATE_COUNTS };
  for (const state of breakdown) {
    counts.total_issues += state.count;
    switch (state.group) {
      case "backlog":
        counts.backlog_issues += state.count;
        break;
      case "unstarted":
        counts.unstarted_issues += state.count;
        break;
      case "started":
        counts.started_issues += state.count;
        break;
      case "completed":
        counts.completed_issues += state.count;
        break;
      case "cancelled":
        counts.cancelled_issues += state.count;
        break;
    }
  }
  return counts;
};
