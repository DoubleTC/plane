/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { observer } from "mobx-react";
import { MODULE_STATUS } from "@plane/constants";
import { useTranslation } from "@plane/i18n";
import { cn } from "@plane/utils";
import { useModule } from "@/hooks/store/use-module";
import type { TScheduleBuckets } from "@/services/project/project-analytics.service";
import { MetricsProgressBar } from "../../project-overview/metrics-progress-bar";
import {
  compareByStartDateAsc,
  completionPercent,
  formatDateRange,
  type TStateCounts,
} from "../../project-overview/metrics-utils";
import { RatingBadge } from "./rating";
import { isTodayWithin } from "./utils";

type Props = {
  projectId: string;
  moduleSchedule: Record<string, TScheduleBuckets>;
};

/**
 * Item 12 — one progress bar per module (reusing the shared bar), with the
 * module's lifecycle status chip, a timeliness rating badge and a "current"
 * highlight when today falls within its date range.
 */
export const ModulesProgress = observer(function ModulesProgress({ projectId, moduleSchedule }: Props) {
  const { t } = useTranslation();
  const { getProjectModuleIds, getModuleById } = useModule();

  const modules = (getProjectModuleIds(projectId) ?? [])
    .map((id) => getModuleById(id))
    .filter((m): m is NonNullable<ReturnType<typeof getModuleById>> => !!m)
    .slice()
    // eslint-disable-next-line no-array-sort-mutation -- target is ES2022, no toSorted yet
    .sort(compareByStartDateAsc);

  if (modules.length === 0) {
    return <p className="text-12 text-placeholder">{t("overview.no_modules")}</p>;
  }

  return (
    <div className="space-y-3">
      {modules.map((m) => {
        const counts = m as unknown as TStateCounts;
        const pct = completionPercent(counts);
        const dateRange = formatDateRange(m.start_date, m.target_date);
        const isCurrent = isTodayWithin(m.start_date, m.target_date);
        const statusInfo = m.status ? MODULE_STATUS.find((s) => s.value === m.status) : undefined;
        return (
          <div
            key={m.id}
            className={cn(
              "rounded-lg border-[0.5px] border-subtle bg-surface-1 p-4 transition-shadow hover:shadow-raised-200",
              isCurrent && "border-accent-strong ring-1 ring-accent-subtle"
            )}
          >
            <div className="mb-3 flex items-center justify-between gap-3">
              <div className="flex min-w-0 flex-col">
                <div className="flex items-center gap-2">
                  <span className="truncate text-13 font-medium text-primary">{m.name}</span>
                  {statusInfo && (
                    <span
                      className="flex shrink-0 items-center gap-1 rounded-sm border-[0.5px] border-subtle px-1.5 py-0.5 text-11 font-medium text-secondary"
                      style={{ borderColor: `${statusInfo.color}66` }}
                    >
                      <span className="size-2 shrink-0 rounded-full" style={{ backgroundColor: statusInfo.color }} />
                      {t(statusInfo.i18n_label)}
                    </span>
                  )}
                  {isCurrent && (
                    <span className="shrink-0 rounded-sm bg-accent-subtle px-1 text-11 text-accent-primary">
                      {t("analytics_project.current")}
                    </span>
                  )}
                </div>
                {dateRange && <span className="truncate text-11 text-tertiary">{dateRange}</span>}
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <RatingBadge schedule={moduleSchedule[m.id]} />
                <span className="text-12 text-tertiary">
                  {t("overview.completion_summary", {
                    completed: counts.completed_issues,
                    total: counts.total_issues,
                    percent: pct,
                  })}
                </span>
              </div>
            </div>
            <MetricsProgressBar counts={counts} />
          </div>
        );
      })}
    </div>
  );
});
