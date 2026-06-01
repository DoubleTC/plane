/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useTranslation } from "@plane/i18n";
import type { TMemberAnalyticsResponse } from "@/services/analytics/member-analytics.service";
import { compactNumber, indexTier, INDEX_TIER_TEXT_CLASS } from "./metrics";

type Props = {
  data: TMemberAnalyticsResponse;
};

const Card = ({
  label,
  value,
  sub,
  valueClassName,
}: {
  label: string;
  value: string;
  sub?: string;
  valueClassName?: string;
}) => (
  <div className="flex flex-col gap-1 rounded-lg border-[0.5px] border-subtle bg-surface-1 p-4">
    <div className="text-13 text-tertiary">{label}</div>
    <div className={`text-20 font-bold text-primary ${valueClassName ?? ""}`}>{value}</div>
    {sub ? <div className="truncate text-13 text-placeholder">{sub}</div> : null}
  </div>
);

/**
 * Team-level headline: average index, evaluated count, the top performer and
 * the member most in need of support — plus a 4-band distribution of the index.
 */
export const TeamSummary = ({ data }: Props) => {
  const { t } = useTranslation();
  const { members, team } = data;
  const top = members[0];
  const bottom = members.length > 1 ? members[members.length - 1] : undefined;

  // Distribution across the four index tiers.
  const bands = [
    { key: "top", label: "75–100", min: 75, color: "rgb(34, 197, 94)" },
    { key: "strong", label: "50–74", min: 50, color: "rgb(59, 130, 246)" },
    { key: "mid", label: "25–49", min: 25, color: "rgb(245, 158, 11)" },
    { key: "low", label: "0–24", min: 0, color: "rgb(239, 68, 68)" },
  ];
  const bandCount = (min: number, max: number) => members.filter((m) => m.index >= min && m.index < max).length;
  const counts = [bandCount(75, 101), bandCount(50, 75), bandCount(25, 50), bandCount(0, 25)];
  const total = Math.max(members.length, 1);

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Card
          label={t("members_analytics.summary.avg_index")}
          value={compactNumber(team.avg_index)}
          valueClassName={INDEX_TIER_TEXT_CLASS[indexTier(team.avg_index)]}
        />
        <Card label={t("members_analytics.summary.evaluated")} value={String(team.evaluated)} />
        {top && (
          <Card
            label={t("members_analytics.summary.top_performer")}
            value={compactNumber(top.index)}
            sub={top.display_name}
            valueClassName={INDEX_TIER_TEXT_CLASS[indexTier(top.index)]}
          />
        )}
        {bottom && (
          <Card
            label={t("members_analytics.summary.needs_support")}
            value={compactNumber(bottom.index)}
            sub={bottom.display_name}
            valueClassName={INDEX_TIER_TEXT_CLASS[indexTier(bottom.index)]}
          />
        )}
      </div>

      <div className="rounded-lg border-[0.5px] border-subtle bg-surface-1 p-4">
        <h4 className="mb-3 text-13 font-medium text-secondary">{t("members_analytics.summary.distribution")}</h4>
        <div className="flex h-3 w-full overflow-hidden rounded-sm bg-layer-3">
          {bands.map((band, i) =>
            counts[i] > 0 ? (
              <div
                key={band.key}
                style={{ width: `${(counts[i] / total) * 100}%`, backgroundColor: band.color }}
                title={`${band.label}: ${counts[i]}`}
              />
            ) : null
          )}
        </div>
        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
          {bands.map((band, i) => (
            <div key={band.key} className="flex items-center gap-1.5 text-12 text-tertiary">
              <span className="size-2.5 rounded-xs" style={{ backgroundColor: band.color }} />
              {band.label}
              <span className="font-medium text-secondary">{counts[i]}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
