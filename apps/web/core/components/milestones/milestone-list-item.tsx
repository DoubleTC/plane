/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useRef } from "react";
import { observer } from "mobx-react";
import { useParams } from "next/navigation";
// icons
import { CalendarDays } from "lucide-react";
// plane imports
import { useTranslation } from "@plane/i18n";
import { CheckIcon } from "@plane/propel/icons";
import { CircularProgressIndicator } from "@plane/ui";
import { renderFormattedDate } from "@plane/utils";
// components
import { ListItem } from "@/components/core/list";
import { MilestoneQuickActions } from "@/components/milestones/milestone-quick-actions";
// hooks
import { useMilestone } from "@/hooks/store/use-milestone";
import { usePlatformOS } from "@/hooks/use-platform-os";

type Props = {
  milestoneId: string;
};

export const MilestoneListItem = observer(function MilestoneListItem(props: Props) {
  const { milestoneId } = props;
  // refs
  const parentRef = useRef<HTMLDivElement>(null);
  // router
  const { workspaceSlug, projectId } = useParams();
  // store hooks
  const { getMilestoneById } = useMilestone();
  const { isMobile } = usePlatformOS();
  const { t } = useTranslation();

  const milestone = getMilestoneById(milestoneId);
  if (!milestone) return null;

  const completionPercentage =
    milestone.total_issues > 0
      ? Math.floor(((milestone.completed_issues + milestone.cancelled_issues) / milestone.total_issues) * 100)
      : 0;

  const isOverdue =
    milestone.target_date != null && new Date(milestone.target_date) < new Date() && completionPercentage < 100;

  return (
    <ListItem
      title={milestone.name}
      itemLink=""
      disableLink
      prependTitleElement={
        <CircularProgressIndicator size={30} percentage={completionPercentage} strokeWidth={3}>
          {completionPercentage === 100 ? (
            <CheckIcon className="h-3 w-3 stroke-[2] text-accent-primary" />
          ) : (
            <span className="text-9 text-tertiary">{completionPercentage}%</span>
          )}
        </CircularProgressIndicator>
      }
      appendTitleElement={
        milestone.color ? (
          <span
            className="inline-block h-2.5 w-2.5 flex-shrink-0 rounded-full"
            style={{ backgroundColor: milestone.color }}
          />
        ) : undefined
      }
      actionableItems={
        <>
          {/* Archived badge */}
          {milestone.archived_at && (
            <span className="bg-custom-background-80 text-xs text-custom-text-300 rounded px-1.5 py-0.5 whitespace-nowrap">
              {t("common.archived")}
            </span>
          )}

          {/* Issue count */}
          <div className="text-xs text-custom-text-300 flex items-center gap-x-1 whitespace-nowrap">
            <span>
              {milestone.completed_issues}/{milestone.total_issues}
            </span>
            <span>{t("milestone.issues_label")}</span>
          </div>

          {/* Target date */}
          {milestone.target_date && (
            <div
              className={`text-xs flex items-center gap-x-1 whitespace-nowrap ${
                isOverdue ? "text-red-500" : "text-custom-text-300"
              }`}
            >
              <CalendarDays className="h-3.5 w-3.5 flex-shrink-0" />
              <span>{renderFormattedDate(milestone.target_date)}</span>
            </div>
          )}

          {/* Quick actions — desktop */}
          {workspaceSlug && projectId && (
            <div className="hidden md:block">
              <MilestoneQuickActions
                parentRef={parentRef}
                milestoneId={milestoneId}
                projectId={projectId.toString()}
                workspaceSlug={workspaceSlug.toString()}
              />
            </div>
          )}
        </>
      }
      quickActionElement={
        workspaceSlug && projectId ? (
          <div className="block md:hidden">
            <MilestoneQuickActions
              parentRef={parentRef}
              milestoneId={milestoneId}
              projectId={projectId.toString()}
              workspaceSlug={workspaceSlug.toString()}
            />
          </div>
        ) : undefined
      }
      isMobile={isMobile}
      parentRef={parentRef}
    />
  );
});
