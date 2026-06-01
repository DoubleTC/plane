/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useTranslation } from "@plane/i18n";
import type { TProjectAnalyticsStateBreakdown } from "@/services/project/project-analytics.service";
import { MetricsLegend } from "../../project-overview/metrics-legend";
import { MetricsProgressBar } from "../../project-overview/metrics-progress-bar";
import { type TStateCounts } from "../../project-overview/metrics-utils";

type Props = {
  counts: TStateCounts;
  breakdown: TProjectAnalyticsStateBreakdown[];
};

// Canonical state-group order so stages in the same group sit together,
// regardless of when each state was created. States within a group keep their
// backend (sequence) order because the incoming array is sequence-sorted and
// Array.prototype.sort is stable.
const GROUP_ORDER: Record<string, number> = {
  backlog: 0,
  unstarted: 1,
  started: 2,
  completed: 3,
  cancelled: 4,
};

const groupRank = (group: string): number => GROUP_ORDER[group] ?? Number.MAX_SAFE_INTEGER;

/**
 * Item 8 — overall progress (5 state-groups) reusing the shared bar + legend,
 * paired with a secondary table listing every individual project stage and its
 * work-item count, each with a proportional inline bar in the stage's colour.
 */
export const StateBreakdown = ({ counts, breakdown }: Props) => {
  const { t } = useTranslation();
  const total = counts.total_issues;
  const sortedBreakdown = breakdown
    .slice()
    // eslint-disable-next-line no-array-sort-mutation -- operating on a copy
    .sort((a, b) => groupRank(a.group) - groupRank(b.group));

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-4">
        <MetricsProgressBar counts={counts} />
        <MetricsLegend counts={counts} />
      </div>

      <div className="rounded-lg border-[0.5px] border-subtle bg-surface-1 p-4">
        <h4 className="mb-3 text-14 font-medium text-secondary">{t("analytics_project.section.stage_breakdown")}</h4>
        {sortedBreakdown.length === 0 ? (
          <p className="text-12 text-placeholder">{t("analytics_project.no_stages")}</p>
        ) : (
          <div className="flex flex-col gap-2.5">
            {sortedBreakdown.map((state) => {
              const share = total > 0 ? (state.count / total) * 100 : 0;
              return (
                <div key={state.id} className="flex items-center gap-3 text-12">
                  <div className="flex w-40 shrink-0 items-center gap-1.5">
                    <span className="size-2.5 shrink-0 rounded-xs" style={{ backgroundColor: state.color }} />
                    <span className="truncate text-secondary">{state.name}</span>
                  </div>
                  <div className="h-2 flex-1 overflow-hidden rounded-sm bg-layer-3">
                    <div className="h-full rounded-sm" style={{ width: `${share}%`, backgroundColor: state.color }} />
                  </div>
                  <span className="w-8 shrink-0 text-right font-medium text-primary">{state.count}</span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
