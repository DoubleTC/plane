/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { observer } from "mobx-react";
import { useTranslation } from "@plane/i18n";
import { useModule } from "@/hooks/store/use-module";
import { MetricsProgressBar } from "./metrics-progress-bar";
import { compareByStartDateAsc, completionPercent, formatDateRange, type TStateCounts } from "./metrics-utils";

type Props = {
  projectId: string;
};

/**
 * Modules section: one progress bar per module, with completion percentage.
 * Each module's state counts are read directly from its store entry
 * (modules expose backlog/started/completed/etc. counters on `IModule`).
 */
export const MetricsModules = observer(function MetricsModules({ projectId }: Props) {
  const { t } = useTranslation();
  const { getProjectModuleIds, getModuleById } = useModule();

  const moduleIds = getProjectModuleIds(projectId) ?? [];
  // Sort modules by start_date ascending; modules without one drop to the end.
  // (slice() before sort to avoid mutating the array returned by .filter())
  const modules = moduleIds
    .map((id) => getModuleById(id))
    .filter((m): m is NonNullable<ReturnType<typeof getModuleById>> => !!m)
    .slice()
    // eslint-disable-next-line no-array-sort-mutation -- target is ES2022, no toSorted yet
    .sort(compareByStartDateAsc);

  if (modules.length === 0) {
    return (
      <div className="flex w-full flex-col gap-4 border-b border-subtle py-6 first:pt-0 last:border-0">
        <div className="flex items-center gap-3">
          <h3 className="text-14 font-medium text-tertiary">{t("common.modules")}</h3>
        </div>
        <p className="text-13 text-placeholder">{t("overview.no_modules")}</p>
      </div>
    );
  }

  return (
    <div className="flex w-full flex-col gap-4 border-b border-subtle py-6 first:pt-0 last:border-0">
      <div className="flex items-center gap-3">
        <h3 className="text-14 font-medium text-tertiary">{t("common.modules")}</h3>
      </div>
      <div className="space-y-3">
        {modules.map((m) => {
          const counts = m as unknown as TStateCounts;
          const pct = completionPercent(counts);
          const moduleDateRange = formatDateRange(m.start_date, m.target_date);
          return (
            <div
              key={m.id}
              className="rounded-lg border-[0.5px] border-subtle bg-surface-1 p-4 transition-shadow hover:shadow-raised-200"
            >
              <div className="mb-3 flex items-center justify-between gap-3">
                <div className="flex min-w-0 flex-col">
                  <span className="truncate text-13 font-medium text-primary">{m.name}</span>
                  {moduleDateRange && <span className="truncate text-10 text-tertiary">{moduleDateRange}</span>}
                </div>
                <span className="shrink-0 text-11 text-tertiary">
                  {t("overview.completion_summary", {
                    completed: counts.completed_issues,
                    total: counts.total_issues,
                    percent: pct,
                  })}
                </span>
              </div>
              <MetricsProgressBar counts={counts} />
            </div>
          );
        })}
      </div>
    </div>
  );
});
