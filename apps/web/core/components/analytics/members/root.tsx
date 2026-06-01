/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useState } from "react";
import { observer } from "mobx-react";
import { useParams } from "next/navigation";
import useSWR from "swr";
import { useTranslation } from "@plane/i18n";
import { Loader } from "@plane/ui";
import { cn } from "@plane/utils";
import { useAnalytics } from "@/hooks/store/use-analytics";
import { MemberAnalyticsService, type TMemberPeriod } from "@/services/analytics/member-analytics.service";
import AnalyticsWrapper from "../analytics-wrapper";
import { Leaderboard } from "./leaderboard";
import { TeamSummary } from "./team-summary";

const memberAnalyticsService = new MemberAnalyticsService();

const PERIODS: TMemberPeriod[] = ["week", "month", "year"];

/**
 * Analytics → Members tab: a workspace-wide performance scorecard for the
 * selected period (week/month/year), honouring the header project filter.
 * The leaderboard rows expand into a per-member drill-down.
 */
export const MembersAnalytics = observer(function MembersAnalytics() {
  const { t } = useTranslation();
  const params = useParams();
  const workspaceSlug = params.workspaceSlug?.toString() ?? "";
  const { selectedProjects } = useAnalytics();
  const [period, setPeriod] = useState<TMemberPeriod>("month");

  const projectKey = selectedProjects.join(",");
  const { data, isLoading } = useSWR(
    workspaceSlug ? ["memberAnalytics", workspaceSlug, period, projectKey] : null,
    () => memberAnalyticsService.getMemberAnalytics(workspaceSlug, { period, projectIds: selectedProjects })
  );

  return (
    <AnalyticsWrapper i18nTitle="members_analytics.title">
      <div className="mb-5 flex items-center justify-between gap-3">
        {/* Period segmented control */}
        <div className="flex items-center gap-0.5 rounded-md border border-subtle bg-surface-2 p-0.5">
          {PERIODS.map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => setPeriod(p)}
              className={cn(
                "rounded-sm px-3 py-1 text-13 font-medium transition-colors",
                period === p ? "bg-surface-1 text-primary shadow-raised-100" : "text-tertiary hover:text-secondary"
              )}
            >
              {t(`members_analytics.period.${p}`)}
            </button>
          ))}
        </div>
      </div>

      {isLoading || !data ? (
        <Loader className="flex flex-col gap-4">
          <Loader.Item height="90px" />
          <Loader.Item height="320px" />
        </Loader>
      ) : data.members.length === 0 ? (
        <p className="text-13 text-placeholder">{t("members_analytics.no_members")}</p>
      ) : (
        <div className="flex flex-col gap-6">
          <TeamSummary data={data} />
          <Leaderboard
            workspaceSlug={workspaceSlug}
            period={period}
            projectIds={selectedProjects}
            members={data.members}
          />
        </div>
      )}
    </AnalyticsWrapper>
  );
});
