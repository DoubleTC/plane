/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useMemo } from "react";
import { observer } from "mobx-react";
import useSWR from "swr";
import { useTranslation } from "@plane/i18n";
import { ProjectOverviewService } from "@/services/project/project-overview.service";
import { MetricsLegend } from "./metrics-legend";
import { MetricsProgressBar } from "./metrics-progress-bar";
import { type TStateCounts } from "./metrics-utils";

type Props = {
  workspaceSlug: string;
  projectId: string;
};

// Singleton — services are stateless and exposed via class instances elsewhere.
const projectOverviewService = new ProjectOverviewService();

/**
 * Project-level overall progress.
 *
 * Calls the dedicated `advance-analytics` endpoint which returns accurate
 * counts grouped by state at the project scope — far more reliable than
 * summing cycle/module data (which only covers issues attached to those
 * containers). Cancelled is derived as `total - sum(other four)` because
 * the backend payload doesn't ship it explicitly.
 *
 * Layout follows the Plane Pro template: section title, the 5-segment bar,
 * and a per-state legend grid underneath.
 */
export const MetricsOverall = observer(function MetricsOverall({ workspaceSlug, projectId }: Props) {
  const { t } = useTranslation();

  const { data } = useSWR(
    workspaceSlug && projectId ? ["projectStateDistribution", workspaceSlug, projectId] : null,
    () => projectOverviewService.getStateDistribution(workspaceSlug, projectId)
  );

  const counts: TStateCounts = useMemo(
    () => ({
      backlog_issues: data?.backlog ?? 0,
      unstarted_issues: data?.unstarted ?? 0,
      started_issues: data?.started ?? 0,
      completed_issues: data?.completed ?? 0,
      cancelled_issues: data?.cancelled ?? 0,
      total_issues: data?.total ?? 0,
    }),
    [data]
  );

  return (
    <div className="flex w-full flex-col gap-4 border-b border-subtle py-6 first:pt-0 last:border-0">
      <div className="flex items-center gap-2">
        <h3 className="text-14 font-semibold text-tertiary">{t("common.progress")}</h3>
      </div>
      <div className="flex flex-col gap-4">
        <MetricsProgressBar counts={counts} />
        <MetricsLegend counts={counts} />
      </div>
    </div>
  );
});
