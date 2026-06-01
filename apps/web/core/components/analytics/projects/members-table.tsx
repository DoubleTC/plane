/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { UserRound } from "lucide-react";
import { useTranslation } from "@plane/i18n";
import { Avatar } from "@plane/ui";
import { getFileURL } from "@plane/utils";
import type { TProjectAnalyticsMember } from "@/services/project/project-analytics.service";
import { RatingBadge } from "./rating";
import { formatPercent, ROLE_I18N_KEY } from "./utils";

type Props = {
  members: TProjectAnalyticsMember[];
};

/**
 * Item 13 — member performance table: avatar/name, role (custom role wins over
 * the built-in role), 30-day allocation share (with an inline bar), completed
 * vs. assigned, on-time rate and an overall performance rating.
 */
export const MembersTable = ({ members }: Props) => {
  const { t } = useTranslation();

  if (members.length === 0) {
    return <p className="text-12 text-placeholder">{t("analytics_project.no_members")}</p>;
  }

  return (
    <div className="overflow-x-auto rounded-lg border-[0.5px] border-subtle">
      <table className="w-full min-w-[640px] border-collapse text-12">
        <thead>
          <tr className="border-b border-subtle bg-surface-2 text-left text-tertiary">
            <th className="px-3 py-2 font-medium">{t("analytics_project.member.name")}</th>
            <th className="px-3 py-2 font-medium">{t("analytics_project.member.role")}</th>
            <th className="px-3 py-2 font-medium">{t("analytics_project.member.allocation")}</th>
            <th className="px-3 py-2 text-right font-medium">{t("analytics_project.member.completed")}</th>
            <th className="px-3 py-2 text-right font-medium">{t("analytics_project.member.on_time_rate")}</th>
            <th className="px-3 py-2 font-medium">{t("analytics_project.member.performance")}</th>
          </tr>
        </thead>
        <tbody>
          {members.map((member) => {
            const role = member.custom_role ?? (ROLE_I18N_KEY[member.role] ? t(ROLE_I18N_KEY[member.role]) : "—");
            return (
              <tr key={member.member_id} className="border-b border-subtle-1 last:border-0 hover:bg-surface-2">
                <td className="px-3 py-2">
                  <div className="flex items-center gap-2">
                    {member.avatar_url ? (
                      <Avatar name={member.display_name} src={getFileURL(member.avatar_url)} size={20} shape="circle" />
                    ) : (
                      <span className="flex size-5 shrink-0 items-center justify-center overflow-hidden rounded-full bg-layer-1 text-11 capitalize">
                        {member.display_name?.[0] ?? <UserRound size={11} className="text-secondary" />}
                      </span>
                    )}
                    <span className="truncate text-secondary">{member.display_name}</span>
                  </div>
                </td>
                <td className="px-3 py-2 text-secondary">{role}</td>
                <td className="px-3 py-2">
                  <div className="flex items-center gap-2">
                    <div className="h-1.5 w-20 overflow-hidden rounded-sm bg-layer-3">
                      <div
                        className="h-full rounded-sm bg-accent-primary"
                        style={{ width: `${Math.min(member.allocation_pct, 100)}%` }}
                      />
                    </div>
                    <span className="text-secondary">{formatPercent(member.allocation_pct)}</span>
                  </div>
                </td>
                <td className="px-3 py-2 text-right text-secondary">
                  {member.completed}/{member.total_assigned}
                </td>
                <td className="px-3 py-2 text-right text-secondary">{formatPercent(member.on_time_rate)}</td>
                <td className="px-3 py-2">
                  <RatingBadge schedule={member.schedule} />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};
