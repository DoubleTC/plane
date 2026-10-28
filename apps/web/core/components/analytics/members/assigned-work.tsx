/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { observer } from "mobx-react";
import { ArrowRight } from "lucide-react";
import { EIconSize } from "@plane/constants";
import { useTranslation } from "@plane/i18n";
import { Logo } from "@plane/propel/emoji-icon-picker";
import { ProjectIcon, StateGroupIcon } from "@plane/propel/icons";
import { cn, renderFormattedDate } from "@plane/utils";
import { useProject } from "@/hooks/store/use-project";
import type { TMemberAssignedWorkItem } from "@/services/analytics/member-analytics.service";

type Props = {
  items: TMemberAssignedWorkItem[];
};

type TProjectGroup = {
  projectId: string;
  items: TMemberAssignedWorkItem[];
};

// Rows sit under their project, indented behind a guide line (border-l + pl-3); the indent
// is narrower on mobile to leave room for the text. The column header (sm+ only) reuses the
// same offsets so its labels line up with the row cells.
const INDENT_CLASS = "ml-2 border-l pl-3 sm:ml-6";

const formatDate = (value: string | null): string => (value ? (renderFormattedDate(value) ?? "—") : "—");

/**
 * The member's assigned work items for the selected period, grouped by
 * project. Only projects that contain at least one item are rendered; the
 * item order inside a project is the backend's (state group, then due date).
 */
export const AssignedWorkList = observer(function AssignedWorkList({ items }: Props) {
  const { t } = useTranslation();
  const { getProjectById } = useProject();

  // Grouped on every render (O(n)) rather than memoized, so the project order
  // reacts to project names arriving in the MobX store.
  const byProject = new Map<string, TMemberAssignedWorkItem[]>();
  for (const item of items) {
    const bucket = byProject.get(item.project_id);
    if (bucket) bucket.push(item);
    else byProject.set(item.project_id, [item]);
  }
  const groups: TProjectGroup[] = Array.from(byProject, ([projectId, projectItems]) => ({
    projectId,
    items: projectItems,
  }));
  // In-place sort of the freshly built array (the web tsconfig lib predates Array#toSorted).
  groups.sort((a, b) =>
    (getProjectById(a.projectId)?.name ?? "").localeCompare(getProjectById(b.projectId)?.name ?? "")
  );

  if (groups.length === 0) {
    return <p className="text-13 text-placeholder">{t("members_analytics.no_assigned_work")}</p>;
  }

  return (
    <div className="vertical-scrollbar flex scrollbar-sm max-h-[520px] flex-col gap-3">
      {/* Column header (desktop only), sticky inside the scroll area so it stays aligned with the rows. */}
      <div
        className={cn(
          INDENT_CLASS,
          "sticky top-0 z-[1] hidden items-center gap-3 border-transparent bg-surface-1 py-1 text-12 font-medium text-tertiary sm:flex"
        )}
      >
        <span className="min-w-0 flex-1">{t("work_items")}</span>
        <span className="w-36 shrink-0">{t("state")}</span>
        <span className="w-24 shrink-0">{t("start_date")}</span>
        <span className="w-24 shrink-0">{t("end_date")}</span>
      </div>

      {groups.map((group) => {
        const project = getProjectById(group.projectId);
        return (
          <div key={group.projectId} className="flex flex-col">
            <div className="flex items-center gap-2 py-1.5">
              {project?.logo_props ? (
                <Logo logo={project.logo_props} size={16} />
              ) : (
                <ProjectIcon className="size-4 shrink-0 text-tertiary" />
              )}
              <span className="truncate text-13 font-medium text-primary">{project?.name ?? "—"}</span>
              <span className="shrink-0 rounded-sm bg-layer-3 px-1.5 text-12 text-tertiary">{group.items.length}</span>
            </div>

            <div className={cn(INDENT_CLASS, "flex flex-col border-subtle")}>
              {group.items.map((item) => (
                <div
                  key={item.id}
                  className="flex flex-col gap-1 border-b border-subtle-1 py-2 text-13 last:border-0 sm:flex-row sm:items-center sm:gap-3"
                >
                  <div className="flex min-w-0 flex-1 items-center gap-2">
                    <span className="shrink-0 text-12 text-tertiary">
                      {project ? `${project.identifier}-${item.sequence_id}` : `#${item.sequence_id}`}
                    </span>
                    <span className="truncate text-secondary" title={item.name}>
                      {item.name}
                    </span>
                  </div>

                  {/* Mobile: state and dates share a line and wrap as whole units when it gets too narrow. */}
                  <div className="flex shrink-0 flex-wrap items-center gap-x-3 gap-y-1 text-12 sm:contents sm:text-13">
                    <span className="flex min-w-0 items-center gap-1.5 sm:w-36 sm:shrink-0">
                      {item.state ? (
                        <>
                          <StateGroupIcon stateGroup={item.state.group} color={item.state.color} size={EIconSize.SM} />
                          <span className="truncate text-secondary">{item.state.name}</span>
                        </>
                      ) : (
                        <span className="text-tertiary">—</span>
                      )}
                    </span>
                    {/* Mobile shows "start → end"; on sm+ the dates become their own columns. */}
                    <span className="flex items-center gap-1 whitespace-nowrap text-tertiary sm:contents">
                      <span className="sm:w-24 sm:shrink-0" title={t("start_date")}>
                        {formatDate(item.start_date)}
                      </span>
                      <ArrowRight className="size-3 shrink-0 sm:hidden" aria-hidden />
                      <span className="sm:w-24 sm:shrink-0" title={t("end_date")}>
                        {formatDate(item.target_date)}
                      </span>
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
});
