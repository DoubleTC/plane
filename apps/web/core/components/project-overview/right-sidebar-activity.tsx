/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { observer } from "mobx-react";
import useSWR from "swr";
import { useTranslation } from "@plane/i18n";
import { Avatar, Loader } from "@plane/ui";
import { calculateTimeAgo, getFileURL } from "@plane/utils";
import { ProjectOverviewService, type TProjectActivity } from "@/services/project/project-overview.service";

type Props = {
  workspaceSlug: string;
  projectId: string;
};

const projectOverviewService = new ProjectOverviewService();

// Stable keys for the loading skeleton (avoids array-index keys).
const SKELETON_ROWS = ["s1", "s2", "s3", "s4", "s5", "s6"];

/**
 * Project activity feed rendered inside the right-sidebar Activity tab.
 *
 * The backend endpoint aggregates IssueActivity rows scoped to this project
 * and skips comment/vote/reaction/draft entries — so each row here is a
 * meaningful state/field change. We render a compact one-line summary
 * per row (actor + action + relative time) because the sidebar is narrow.
 */
export const RightSidebarActivity = observer(function RightSidebarActivity({ workspaceSlug, projectId }: Props) {
  const { t } = useTranslation();

  const { data: activities, isLoading } = useSWR(
    workspaceSlug && projectId ? ["projectActivity", workspaceSlug, projectId] : null,
    () => projectOverviewService.getProjectActivity(workspaceSlug, projectId, 50),
    { revalidateOnFocus: false }
  );

  if (isLoading) {
    return (
      <Loader className="space-y-3 py-2">
        {SKELETON_ROWS.map((id) => (
          <Loader.Item key={id} height="40px" />
        ))}
      </Loader>
    );
  }

  if (!activities || activities.length === 0) {
    return <p className="py-4 text-center text-13 text-placeholder">{t("overview.no_activity")}</p>;
  }

  return (
    <ul className="space-y-3">
      {activities.map((a) => (
        <ActivityRow key={a.id} activity={a} />
      ))}
    </ul>
  );
});

type ActivityRowProps = {
  activity: TProjectActivity;
};

const ActivityRow = ({ activity }: ActivityRowProps) => {
  const actorName =
    activity.actor_detail?.display_name ??
    [activity.actor_detail?.first_name, activity.actor_detail?.last_name].filter(Boolean).join(" ") ??
    "Unknown";
  const description = buildActivityDescription(activity);
  const timeAgo = calculateTimeAgo(activity.created_at);

  return (
    <li className="flex gap-2.5">
      <Avatar
        name={actorName}
        src={getFileURL(activity.actor_detail?.avatar_url ?? "")}
        size={20}
        className="mt-0.5 flex-shrink-0"
      />
      <div className="min-w-0 flex-1">
        <p className="text-13 leading-snug text-secondary">
          <span className="font-medium text-primary">{actorName}</span>{" "}
          <span className="text-tertiary">{description}</span>
        </p>
        <p className="mt-0.5 text-11 text-placeholder">{timeAgo}</p>
      </div>
    </li>
  );
};

/**
 * Compose a short sentence fragment for one activity row.
 *
 * Plane stores activity comments as a verb phrase that expects the value to
 * be appended by the client — e.g. comment "updated the state to" with the
 * resolved state name in `new_value` ("In Progress"), or "added assignee "
 * (note the trailing space) with the member name in `new_value`. The value
 * is therefore appended when the comment signals it wants one (ends with
 * "to", or carries a trailing space). Removals carry the value in `old_value`
 * while `new_value` is blank, so we fall back to `old_value`.
 */
const buildActivityDescription = (a: TProjectActivity): string => {
  const raw = a.comment ?? "";
  const comment = raw.trim();
  const value = (a.new_value ?? "").trim() || (a.old_value ?? "").trim();

  if (!comment) {
    const base = [a.verb, a.field].filter(Boolean).join(" ");
    return value ? `${base} ${value}` : base || a.verb || "updated";
  }

  const expectsValue = /\sto$/.test(` ${comment}`) || /\s$/.test(raw);
  if (value && expectsValue && !comment.includes(value)) {
    return `${comment} ${value}`;
  }
  return comment;
};
