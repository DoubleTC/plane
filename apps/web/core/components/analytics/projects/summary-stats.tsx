/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useTranslation } from "@plane/i18n";
import type { TScheduleBuckets } from "@/services/project/project-analytics.service";
import { type TStateCounts } from "../../project-overview/metrics-utils";

type StatItem = {
  label: string;
  value: number | string;
  caption?: string;
};

type Props = {
  counts: TStateCounts;
  schedule: TScheduleBuckets;
  memberCount: number;
  moduleCount: number;
  phaseCount: number;
  cycleCount: number;
};

const StatCard = ({ label, value, caption }: StatItem) => (
  <div className="flex flex-col gap-1 rounded-lg border-[0.5px] border-subtle bg-surface-1 p-4">
    <div className="text-14 text-tertiary">{label}</div>
    <div className="text-20 font-bold text-primary">{value}</div>
    {caption ? <div className="text-12 text-placeholder">{caption}</div> : null}
  </div>
);

/**
 * Headline figures for a project: structural counts (members / modules /
 * phases / cycles) and the work-item distribution. The "completed" card carries
 * a caption summarising the early / on-time / late split.
 */
export const SummaryStats = ({ counts, schedule, memberCount, moduleCount, phaseCount, cycleCount }: Props) => {
  const { t } = useTranslation();

  const stats: StatItem[] = [
    { label: t("analytics_project.stat.members"), value: memberCount },
    { label: t("analytics_project.stat.modules"), value: moduleCount },
    { label: t("analytics_project.stat.phases"), value: phaseCount },
    { label: t("analytics_project.stat.cycles"), value: cycleCount },
    { label: t("analytics_project.stat.total_work_items"), value: counts.total_issues },
    { label: t("common.unstarted"), value: counts.unstarted_issues },
    { label: t("common.started"), value: counts.started_issues },
    {
      label: t("common.completed"),
      value: counts.completed_issues,
      caption: t("analytics_project.stat.completed_caption", {
        early: schedule.early,
        on_time: schedule.on_time,
        delayed: schedule.delayed,
      }),
    },
    { label: t("common.backlog"), value: counts.backlog_issues },
  ];

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
      {stats.map((stat) => (
        <StatCard key={stat.label} {...stat} />
      ))}
    </div>
  );
};
