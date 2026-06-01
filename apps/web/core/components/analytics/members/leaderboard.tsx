/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useState } from "react";
import { ChevronDown, Minus, TrendingDown, TrendingUp, UserRound } from "lucide-react";
import { useTranslation } from "@plane/i18n";
import { Avatar } from "@plane/ui";
import { cn, getFileURL } from "@plane/utils";
import type { TMemberPeriod, TMemberRow } from "@/services/analytics/member-analytics.service";
import { ROLE_I18N_KEY } from "../projects/utils";
import { MemberDetail } from "./member-detail";
import {
  INDEX_TIER_BG_CLASS,
  INDEX_TIER_TEXT_CLASS,
  PILLAR_META,
  compactNumber,
  computeDelta,
  indexTier,
} from "./metrics";

type Props = {
  workspaceSlug: string;
  period: TMemberPeriod;
  projectIds: string[];
  members: TMemberRow[];
};

const DeltaPill = ({ current, previous, suffix = "" }: { current: number; previous: number; suffix?: string }) => {
  const delta = computeDelta(current, previous);
  const Icon = delta.dir === "up" ? TrendingUp : delta.dir === "down" ? TrendingDown : Minus;
  return (
    <div className="flex flex-col items-end">
      <span className="text-13 font-medium text-primary">
        {compactNumber(current)}
        {suffix}
      </span>
      <span
        className={cn(
          "flex items-center gap-0.5 text-12",
          delta.dir === "flat" ? "text-tertiary" : delta.positive ? "text-success-primary" : "text-danger-primary"
        )}
      >
        <Icon className="size-2.5" />
        {delta.label}
      </span>
    </div>
  );
};

/** Five-bar micro chart of the pillar scores. */
const PillarBars = ({ member }: { member: TMemberRow }) => {
  const { t } = useTranslation();
  return (
    <div
      className="flex items-end gap-1"
      title={PILLAR_META.map((p) => `${t(p.i18nKey)}: ${compactNumber(member.pillars[p.key])}`).join("  ")}
    >
      {PILLAR_META.map((p) => (
        <span key={p.key} className="flex h-8 w-2 items-end rounded-xs bg-layer-3">
          <span
            className="w-full rounded-xs"
            style={{ height: `${Math.max(member.pillars[p.key], 4)}%`, backgroundColor: p.color }}
          />
        </span>
      ))}
    </div>
  );
};

type RowProps = {
  workspaceSlug: string;
  period: TMemberPeriod;
  projectIds: string[];
  member: TMemberRow;
  rank: number;
};

const MemberRow = ({ workspaceSlug, period, projectIds, member, rank }: RowProps) => {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const tier = indexTier(member.index);
  const role = member.custom_role ?? (ROLE_I18N_KEY[member.role] ? t(ROLE_I18N_KEY[member.role]) : "—");

  return (
    <div className="border-b border-subtle-1 last:border-0">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-3 px-3 py-2.5 text-left outline-none hover:bg-surface-2"
      >
        <span className="w-6 shrink-0 text-center text-13 font-semibold text-tertiary">{rank}</span>

        <div className="flex min-w-0 flex-1 items-center gap-2">
          {member.avatar_url ? (
            <Avatar name={member.display_name} src={getFileURL(member.avatar_url)} size={24} shape="circle" />
          ) : (
            <span className="flex size-6 shrink-0 items-center justify-center overflow-hidden rounded-full bg-layer-1 text-13 capitalize">
              {member.display_name?.[0] ?? <UserRound size={12} className="text-secondary" />}
            </span>
          )}
          <div className="flex min-w-0 flex-col">
            <span className="truncate text-13 font-medium text-primary">{member.display_name}</span>
            <span className="truncate text-12 text-tertiary">{role}</span>
          </div>
        </div>

        <div className="flex w-16 shrink-0 flex-col items-center">
          <span
            className={cn(
              "flex h-7 min-w-10 items-center justify-center rounded-md px-1.5 text-14 font-bold",
              INDEX_TIER_BG_CLASS[tier],
              INDEX_TIER_TEXT_CLASS[tier]
            )}
          >
            {compactNumber(member.index)}
          </span>
          <span className="text-12 text-placeholder" title={t("members_analytics.legend_percentile")}>
            P{compactNumber(member.percentile)}
          </span>
        </div>

        <div className="hidden shrink-0 sm:block">
          <PillarBars member={member} />
        </div>

        <div className="hidden w-20 shrink-0 md:block">
          <DeltaPill current={member.metrics.completed_count} previous={member.prev.completed_count} />
        </div>
        <div className="hidden w-20 shrink-0 lg:block">
          <DeltaPill current={member.metrics.completed_points} previous={member.prev.completed_points} />
        </div>
        <div className="w-20 shrink-0">
          <DeltaPill current={member.metrics.on_time_rate} previous={member.prev.on_time_rate} suffix="%" />
        </div>

        <ChevronDown
          className={cn("size-4 shrink-0 text-tertiary transition-transform", open ? "" : "-rotate-90")}
          aria-hidden
        />
      </button>

      {open && (
        <div className="bg-surface-2/40 px-3 pt-1 pb-4">
          <MemberDetail
            workspaceSlug={workspaceSlug}
            memberId={member.member_id}
            period={period}
            projectIds={projectIds}
            pillars={member.pillars}
            metrics={member.metrics}
          />
        </div>
      )}
    </div>
  );
};

export const Leaderboard = ({ workspaceSlug, period, projectIds, members }: Props) => {
  const { t } = useTranslation();

  if (members.length === 0) {
    return <p className="text-13 text-placeholder">{t("members_analytics.no_members")}</p>;
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="overflow-hidden rounded-lg border-[0.5px] border-subtle">
        {/* Column header */}
        <div className="flex items-center gap-3 border-b border-subtle bg-surface-2 px-3 py-2 text-12 font-medium text-tertiary">
          <span className="w-6 shrink-0 text-center">#</span>
          <span className="flex-1">{t("members_analytics.member")}</span>
          <span className="w-16 shrink-0 text-center">{t("members_analytics.index")}</span>
          <span className="hidden w-[52px] shrink-0 text-center sm:block">{t("members_analytics.pillars")}</span>
          <span className="hidden w-20 shrink-0 text-right md:block">
            {t("members_analytics.metric.completed_count")}
          </span>
          <span className="hidden w-20 shrink-0 text-right lg:block">
            {t("members_analytics.metric.completed_points")}
          </span>
          <span className="w-20 shrink-0 text-right">{t("members_analytics.metric.on_time_rate")}</span>
          <span className="size-4 shrink-0" />
        </div>

        {members.map((member, idx) => (
          <MemberRow
            key={member.member_id}
            workspaceSlug={workspaceSlug}
            period={period}
            projectIds={projectIds}
            member={member}
            rank={idx + 1}
          />
        ))}
      </div>

      {/* Legend explaining the Index and the P (percentile) marker. */}
      <div className="flex flex-col gap-0.5 px-1 text-12 text-placeholder">
        <span>{t("members_analytics.legend_index")}</span>
        <span>{t("members_analytics.legend_percentile")}</span>
      </div>
    </div>
  );
};
