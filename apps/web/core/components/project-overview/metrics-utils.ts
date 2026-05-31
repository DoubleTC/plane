/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { renderFormattedDate } from "@plane/utils";

/**
 * Aggregate state counts for the project metrics progress bar.
 *
 * Each segment matches Plane's PROGRESS_STATE_GROUPS — Backlog / Unstarted /
 * Started / Completed / Cancelled. We keep our own copy here (not imported
 * from `@plane/constants`) so the overview can adopt a softer palette without
 * affecting the active-cycle widget.
 */
export type TStateCounts = {
  backlog_issues: number;
  unstarted_issues: number;
  started_issues: number;
  completed_issues: number;
  cancelled_issues: number;
  total_issues: number;
};

export const EMPTY_STATE_COUNTS: TStateCounts = {
  backlog_issues: 0,
  unstarted_issues: 0,
  started_issues: 0,
  completed_issues: 0,
  cancelled_issues: 0,
  total_issues: 0,
};

export type TStateSegmentKey =
  | "backlog_issues"
  | "unstarted_issues"
  | "started_issues"
  | "completed_issues"
  | "cancelled_issues";

export type TStateSegment = {
  key: TStateSegmentKey;
  i18nKey: string;
  color: string;
};

/** Order matches the mockup: Backlog → Unstarted → Started → Completed → Cancelled */
export const STATE_SEGMENTS: TStateSegment[] = [
  { key: "backlog_issues", i18nKey: "common.backlog", color: "rgb(235, 237, 242)" },
  { key: "unstarted_issues", i18nKey: "common.unstarted", color: "rgba(110, 110, 110, 0.5)" },
  { key: "started_issues", i18nKey: "common.started", color: "rgba(255, 129, 51, 0.5)" },
  { key: "completed_issues", i18nKey: "common.completed", color: "rgba(38, 217, 80, 0.5)" },
  { key: "cancelled_issues", i18nKey: "common.cancelled", color: "rgba(255, 51, 51, 0.314)" },
];

/** Sum a list of counts into a single TStateCounts. */
export const sumStateCounts = (counts: Partial<TStateCounts>[]): TStateCounts =>
  counts.reduce<TStateCounts>(
    (acc, c) => ({
      backlog_issues: acc.backlog_issues + (c.backlog_issues ?? 0),
      unstarted_issues: acc.unstarted_issues + (c.unstarted_issues ?? 0),
      started_issues: acc.started_issues + (c.started_issues ?? 0),
      completed_issues: acc.completed_issues + (c.completed_issues ?? 0),
      cancelled_issues: acc.cancelled_issues + (c.cancelled_issues ?? 0),
      total_issues: acc.total_issues + (c.total_issues ?? 0),
    }),
    { ...EMPTY_STATE_COUNTS }
  );

/** Percentage of completed work items (0–100, integer). */
export const completionPercent = (counts: TStateCounts): number => {
  if (counts.total_issues <= 0) return 0;
  return Math.round((counts.completed_issues / counts.total_issues) * 100);
};

/**
 * Comparator that orders items by `start_date` ascending, with null/empty
 * start dates pushed to the end. Used to sort the phases and modules lists
 * on the overview page so the timeline reads left-to-right top-to-bottom.
 */
export const compareByStartDateAsc = <T extends { start_date?: string | null }>(a: T, b: T): number => {
  const av = a.start_date;
  const bv = b.start_date;
  if (!av && !bv) return 0;
  if (!av) return 1;
  if (!bv) return -1;
  return av < bv ? -1 : av > bv ? 1 : 0;
};

/**
 * Build a "dd/MM/yyyy - dd/MM/yyyy" range label for a phase/cycle/module
 * subtitle. Returns null when neither endpoint is set; when only one endpoint
 * is present it falls back to showing just that single date.
 */
export const formatDateRange = (start?: string | null, end?: string | null): string | null => {
  const startLabel = renderFormattedDate(start, "dd/MM/yyyy");
  const endLabel = renderFormattedDate(end, "dd/MM/yyyy");
  if (startLabel && endLabel) return `${startLabel} - ${endLabel}`;
  return startLabel ?? endLabel ?? null;
};
