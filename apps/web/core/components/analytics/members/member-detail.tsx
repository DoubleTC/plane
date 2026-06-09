/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import useSWR from "swr";
import { useTranslation } from "@plane/i18n";
import { LineChart } from "@plane/propel/charts/line-chart";
import { RadarChart } from "@plane/propel/charts/radar-chart";
import { ScatterChart } from "@plane/propel/charts/scatter-chart";
import { Loader } from "@plane/ui";
import { cn } from "@plane/utils";
import {
  MemberAnalyticsService,
  type TMemberMetrics,
  type TMemberPeriod,
  type TMemberPillars,
} from "@/services/analytics/member-analytics.service";
import { PILLAR_META, compactNumber } from "./metrics";

const memberAnalyticsService = new MemberAnalyticsService();

type Props = {
  workspaceSlug: string;
  memberId: string;
  period: TMemberPeriod;
  projectIds: string[];
  pillars: TMemberPillars;
  metrics: TMemberMetrics;
};

const Panel = ({ title, children, className }: { title: string; children: React.ReactNode; className?: string }) => (
  <div className={cn("flex flex-col gap-3 rounded-lg border-[0.5px] border-subtle bg-surface-1 p-4", className)}>
    <h5 className="text-13 font-medium text-secondary">{title}</h5>
    {children}
  </div>
);

const Stat = ({ label, value }: { label: string; value: string }) => (
  <div className="flex flex-col gap-0.5">
    <span className="text-13 text-tertiary">{label}</span>
    <span className="text-14 font-semibold text-primary">{value}</span>
  </div>
);

const TIMELINESS_SEGMENTS: { key: "early" | "on_time" | "delayed"; i18nKey: string; color: string }[] = [
  { key: "early", i18nKey: "members_analytics.timeliness.early", color: "rgb(59, 130, 246)" },
  { key: "on_time", i18nKey: "members_analytics.timeliness.on_time", color: "rgb(34, 197, 94)" },
  { key: "delayed", i18nKey: "members_analytics.timeliness.delayed", color: "rgb(239, 68, 68)" },
];

/** Early / on-time / late split of the dated completed items, as a stacked bar. */
const TimelinessBar = ({ metrics }: { metrics: TMemberMetrics }) => {
  const { t } = useTranslation();
  const dated = metrics.early + metrics.on_time + metrics.delayed;
  return (
    <div className="flex flex-col gap-2">
      <div className="flex h-3 w-full overflow-hidden rounded-sm bg-layer-3">
        {dated > 0 &&
          TIMELINESS_SEGMENTS.map((seg) =>
            metrics[seg.key] > 0 ? (
              <div
                key={seg.key}
                style={{ width: `${(metrics[seg.key] / dated) * 100}%`, backgroundColor: seg.color }}
              />
            ) : null
          )}
      </div>
      <div className="flex flex-wrap gap-x-4 gap-y-1">
        {TIMELINESS_SEGMENTS.map((seg) => (
          <div key={seg.key} className="flex items-center gap-1.5 text-12 text-tertiary">
            <span className="size-2.5 rounded-xs" style={{ backgroundColor: seg.color }} />
            {t(seg.i18nKey)}
            <span className="font-medium text-secondary">
              {metrics[seg.key]} ({dated > 0 ? Math.round((metrics[seg.key] / dated) * 100) : 0}%)
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};

export const MemberDetail = ({ workspaceSlug, memberId, period, projectIds, pillars, metrics }: Props) => {
  const { t } = useTranslation();
  const { data, isLoading } = useSWR(
    ["memberAnalyticsDetail", workspaceSlug, memberId, period, projectIds.join(",")],
    () => memberAnalyticsService.getMemberDetail(workspaceSlug, memberId, { period, projectIds })
  );

  // Radar of the five pillar scores.
  const radarData = PILLAR_META.map((p) => ({ key: p.key, name: t(p.i18nKey), score: pillars[p.key] }));

  // Shorten the trend x-axis labels so 12 monthly / 8 weekly buckets don't
  // collide in the half-width panel ("2026-01" → "01/26", week ISO → "dd/MM").
  const shortLabel = (key: string): string => {
    if (period === "year") return key;
    const parts = key.split("-");
    if (period === "month") return parts.length >= 2 ? `${parts[1]}/${parts[0].slice(2)}` : key;
    return parts.length >= 3 ? `${parts[2]}/${parts[1]}` : key;
  };
  const trendData = (data?.trend ?? []).map((point) => ({
    label: shortLabel(point.key),
    completed: point.completed,
    points: point.points,
    on_time_rate: point.on_time_rate,
  }));

  if (isLoading || !data) {
    return (
      <Loader className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Loader.Item height="240px" />
        <Loader.Item height="240px" />
      </Loader>
    );
  }

  const maxHeat = Math.max(1, ...data.heatmap.map((h) => h.count));

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Panel title={t("members_analytics.detail.profile")}>
          <RadarChart
            className="h-[280px] w-full text-accent-primary"
            data={radarData}
            dataKey="key"
            radars={[
              {
                key: "score",
                name: t("members_analytics.index"),
                fill: "var(--text-color-accent-primary)",
                stroke: "var(--text-color-accent-primary)",
                fillOpacity: 0.5,
                dot: { r: 3, fillOpacity: 1 },
              },
            ]}
            angleAxis={{ key: "name" }}
            margin={{ top: 28, right: 64, bottom: 28, left: 64 }}
            showTooltip
          />
          {/* Legend explaining what each pillar measures and how the scores are derived. */}
          <div className="mt-3 space-y-2 border-t border-subtle pt-3">
            {PILLAR_META.map((p) => (
              <div key={p.key} className="flex items-start gap-2 text-12">
                <span className="mt-1 size-2 flex-shrink-0 rounded-full" style={{ backgroundColor: p.color }} />
                <span className="text-secondary">
                  <span className="font-medium text-primary">{t(p.i18nKey)}</span>
                  {" — "}
                  {t(`${p.i18nKey}_hint`)}
                </span>
              </div>
            ))}
            <p className="pt-1 text-11 text-tertiary">{t("members_analytics.pillar.note")}</p>
          </div>
        </Panel>

        <Panel title={t("members_analytics.detail.throughput_trend")}>
          {trendData.length > 0 ? (
            <>
              {/* Custom legend rendered outside the chart to avoid overlapping the axes. */}
              <div className="flex items-center justify-end gap-4 text-12 text-tertiary">
                <span className="flex items-center gap-1.5">
                  <span className="size-2.5 rounded-full" style={{ backgroundColor: "rgb(59, 130, 246)" }} />
                  {t("members_analytics.metric.completed_count")}
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="size-2.5 rounded-full" style={{ backgroundColor: "rgb(34, 197, 94)" }} />
                  {t("members_analytics.metric.completed_points")}
                </span>
              </div>
              <LineChart
                className="h-[230px] w-full"
                data={trendData}
                margin={{ top: 8, right: 16, bottom: 12, left: 0 }}
                xAxis={{ key: "label" }}
                yAxis={{ key: "completed", allowDecimals: false }}
                lines={[
                  {
                    key: "completed",
                    label: t("members_analytics.metric.completed_count"),
                    stroke: "rgb(59, 130, 246)",
                    fill: "rgb(59, 130, 246)",
                    dashedLine: false,
                    showDot: true,
                    smoothCurves: true,
                  },
                  {
                    key: "points",
                    label: t("members_analytics.metric.completed_points"),
                    stroke: "rgb(34, 197, 94)",
                    fill: "rgb(34, 197, 94)",
                    dashedLine: false,
                    showDot: true,
                    smoothCurves: true,
                  },
                ]}
                showTooltip
              />
            </>
          ) : (
            <p className="py-10 text-center text-13 text-placeholder">{t("members_analytics.no_data")}</p>
          )}
        </Panel>
      </div>

      <Panel title={t("members_analytics.detail.completion")}>
        <div className="grid grid-cols-3 gap-3">
          <Stat label={t("members_analytics.metric.assigned_count")} value={String(metrics.assigned_count)} />
          <Stat label={t("members_analytics.metric.completed_count")} value={String(metrics.completed_count)} />
          <Stat
            label={t("members_analytics.metric.completion_rate")}
            value={`${compactNumber(metrics.completion_rate)}%`}
          />
        </div>
        <TimelinessBar metrics={metrics} />
      </Panel>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Panel title={t("members_analytics.detail.cycle_time")}>
          <div className="grid grid-cols-4 gap-3">
            <Stat label="P50" value={`${compactNumber(data.cycle_time.p50)}d`} />
            <Stat label="P85" value={`${compactNumber(data.cycle_time.p85)}d`} />
            <Stat label={t("members_analytics.detail.max")} value={`${compactNumber(data.cycle_time.max)}d`} />
            <Stat label={t("members_analytics.detail.samples")} value={String(data.cycle_time.count)} />
          </div>
          <p className="text-12 text-placeholder">{t("members_analytics.detail.cycle_time_hint")}</p>
        </Panel>

        <Panel title={t("members_analytics.detail.estimate_accuracy")}>
          {data.estimate_scatter.length > 0 ? (
            <ScatterChart
              className="h-[200px] w-full"
              data={data.estimate_scatter}
              xAxis={{ key: "point", label: t("members_analytics.detail.estimate") }}
              yAxis={{ key: "cycle_time_days", label: t("members_analytics.detail.actual_days") }}
              scatterPoints={[
                {
                  key: "cycle_time_days",
                  label: t("members_analytics.detail.cycle_time"),
                  fill: "rgb(168, 85, 247)",
                  stroke: "rgb(168, 85, 247)",
                },
              ]}
              showTooltip
            />
          ) : (
            <p className="py-10 text-center text-13 text-placeholder">{t("members_analytics.no_estimate_data")}</p>
          )}
        </Panel>
      </div>

      <Panel title={t("members_analytics.detail.activity")}>
        {data.heatmap.length > 0 ? (
          <div className="flex flex-wrap gap-1">
            {data.heatmap.map((cell) => (
              <span
                key={cell.date}
                title={`${cell.date}: ${cell.count}`}
                className="size-3.5 rounded-xs"
                style={{
                  backgroundColor: "rgb(34, 197, 94)",
                  opacity: 0.2 + (cell.count / maxHeat) * 0.8,
                }}
              />
            ))}
          </div>
        ) : (
          <p className="text-13 text-placeholder">{t("members_analytics.no_data")}</p>
        )}
      </Panel>

      <Panel title={t("members_analytics.detail.key_metrics")}>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Stat label={t("members_analytics.metric.reopen_count")} value={String(metrics.reopen_count)} />
          <Stat label={t("members_analytics.metric.bug_ratio")} value={`${compactNumber(metrics.bug_ratio)}%`} />
          <Stat
            label={t("members_analytics.metric.scope_adherence")}
            value={`${compactNumber(metrics.scope_adherence)}%`}
          />
          <Stat
            label={t("members_analytics.metric.avg_lead_time")}
            value={`${compactNumber(metrics.avg_lead_time)}d`}
          />
          <Stat label={t("members_analytics.metric.wip")} value={String(metrics.wip)} />
          <Stat label={t("members_analytics.metric.comments")} value={String(metrics.comments)} />
          <Stat label={t("members_analytics.metric.projects_touched")} value={String(metrics.projects_touched)} />
          <Stat label={t("members_analytics.metric.ownership")} value={String(metrics.ownership)} />
        </div>
      </Panel>

      {data.recent_issues.length > 0 && (
        <Panel title={t("members_analytics.detail.recent_issues")}>
          <div className="flex flex-col">
            {data.recent_issues.map((issue) => (
              <div
                key={issue.id}
                className="flex items-center justify-between gap-3 border-b border-subtle-1 py-2 text-13 last:border-0"
              >
                <span className="truncate text-secondary">{issue.name}</span>
                <div className="flex shrink-0 items-center gap-3">
                  {issue.on_time !== null && (
                    <span
                      className={cn(
                        "rounded-sm px-1 text-12",
                        issue.on_time
                          ? "bg-success-subtle text-success-primary"
                          : "bg-danger-subtle text-danger-primary"
                      )}
                    >
                      {issue.on_time ? t("members_analytics.on_time") : t("members_analytics.late")}
                    </span>
                  )}
                  <span className="text-tertiary">{issue.completed_at?.slice(0, 10)}</span>
                </div>
              </div>
            ))}
          </div>
        </Panel>
      )}
    </div>
  );
};
