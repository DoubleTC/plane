/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useState } from "react";
import { observer } from "mobx-react";
import { useParams } from "next/navigation";
// icons
import { Archive, CalendarDays, Pencil, Trash2 } from "lucide-react";
// plane imports
import { useTranslation } from "@plane/i18n";
import { TOAST_TYPE, setToast } from "@plane/propel/toast";
import { CircularProgressIndicator, CustomMenu } from "@plane/ui";
import { renderFormattedDate } from "@plane/utils";
// components
import { CreateUpdateMilestoneModal } from "@/components/milestones/create-update-milestone-modal";
import { DeleteMilestoneModal } from "@/components/milestones/delete-milestone-modal";
// hooks
import { useMilestone } from "@/hooks/store/use-milestone";

type Props = {
  milestoneId: string;
};

export const MilestoneListItem = observer(function MilestoneListItem(props: Props) {
  const { milestoneId } = props;
  // states
  const [editModal, setEditModal] = useState(false);
  const [deleteModal, setDeleteModal] = useState(false);
  // router
  const { workspaceSlug, projectId } = useParams();
  // store hooks
  const { getMilestoneById, archiveMilestone, unarchiveMilestone } = useMilestone();
  const { t } = useTranslation();

  const milestone = getMilestoneById(milestoneId);
  if (!milestone) return null;

  const completionPercentage =
    milestone.total_issues > 0
      ? Math.floor(((milestone.completed_issues + milestone.cancelled_issues) / milestone.total_issues) * 100)
      : 0;

  const isOverdue =
    milestone.target_date != null &&
    new Date(milestone.target_date) < new Date() &&
    completionPercentage < 100;

  const handleArchiveToggle = async () => {
    if (!workspaceSlug || !projectId) return;
    try {
      if (milestone.archived_at) {
        await unarchiveMilestone(workspaceSlug.toString(), projectId.toString(), milestoneId);
        setToast({ type: TOAST_TYPE.SUCCESS, title: t("milestone.toast.unarchived_title") });
      } else {
        await archiveMilestone(workspaceSlug.toString(), projectId.toString(), milestoneId);
        setToast({ type: TOAST_TYPE.SUCCESS, title: t("milestone.toast.archived_title") });
      }
    } catch {
      setToast({ type: TOAST_TYPE.ERROR, title: t("common.error") });
    }
  };

  return (
    <>
      {/* Edit Modal */}
      <CreateUpdateMilestoneModal
        isOpen={editModal}
        onClose={() => setEditModal(false)}
        data={milestone}
        workspaceSlug={workspaceSlug?.toString() ?? ""}
        projectId={projectId?.toString() ?? ""}
      />
      {/* Delete Modal */}
      <DeleteMilestoneModal
        data={milestone}
        isOpen={deleteModal}
        onClose={() => setDeleteModal(false)}
      />

      <div className="group flex items-center justify-between gap-x-3 rounded-lg border border-custom-border-200 bg-custom-background-100 px-4 py-3 hover:bg-custom-background-90 transition-colors">
        {/* Left: progress + info */}
        <div className="flex items-center gap-x-3 min-w-0">
          <CircularProgressIndicator size={36} percentage={completionPercentage} strokeWidth={3}>
            <span className="text-[9px] font-semibold text-custom-text-200">{completionPercentage}%</span>
          </CircularProgressIndicator>

          <div className="min-w-0">
            <div className="flex items-center gap-x-2">
              {milestone.color && (
                <span
                  className="inline-block h-2.5 w-2.5 flex-shrink-0 rounded-full"
                  style={{ backgroundColor: milestone.color }}
                />
              )}
              <span className="truncate font-medium text-custom-text-100">{milestone.name}</span>
              {milestone.archived_at && (
                <span className="rounded bg-custom-background-80 px-1.5 py-0.5 text-xs text-custom-text-300">
                  {t("common.archived")}
                </span>
              )}
            </div>
            {milestone.description ? (
              <p className="mt-0.5 truncate text-xs text-custom-text-300">{milestone.description}</p>
            ) : null}
          </div>
        </div>

        {/* Right: stats + date + menu */}
        <div className="flex flex-shrink-0 items-center gap-x-4">
          {/* Issue counts */}
          <div className="hidden sm:flex items-center gap-x-2 text-xs text-custom-text-300">
            <span>{milestone.completed_issues}/{milestone.total_issues}</span>
            <span>{t("milestone.issues_label")}</span>
          </div>

          {/* Target date */}
          {milestone.target_date && (
            <div
              className={`hidden sm:flex items-center gap-x-1 text-xs ${
                isOverdue ? "text-red-500" : "text-custom-text-300"
              }`}
            >
              <CalendarDays className="h-3 w-3" />
              <span>{renderFormattedDate(milestone.target_date)}</span>
            </div>
          )}

          {/* Context menu */}
          <CustomMenu ellipsis placement="bottom-end">
            <CustomMenu.MenuItem onClick={() => setEditModal(true)}>
              <span className="flex items-center gap-x-2 text-custom-text-200">
                <Pencil className="h-3.5 w-3.5" />
                {t("common.edit")}
              </span>
            </CustomMenu.MenuItem>
            <CustomMenu.MenuItem onClick={handleArchiveToggle}>
              <span className="flex items-center gap-x-2 text-custom-text-200">
                <Archive className="h-3.5 w-3.5" />
                {milestone.archived_at ? t("common.unarchive") : t("common.archive")}
              </span>
            </CustomMenu.MenuItem>
            <CustomMenu.MenuItem onClick={() => setDeleteModal(true)}>
              <span className="flex items-center gap-x-2 text-red-500">
                <Trash2 className="h-3.5 w-3.5" />
                {t("common.delete")}
              </span>
            </CustomMenu.MenuItem>
          </CustomMenu>
        </div>
      </div>
    </>
  );
});
