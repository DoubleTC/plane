/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useState } from "react";
import { observer } from "mobx-react";
import { Archive, Link2, MoreHorizontal, Pencil, Trash2 } from "lucide-react";
// plane imports
import { EUserPermissions, EUserPermissionsLevel } from "@plane/constants";
import { IconButton } from "@plane/propel/icon-button";
import { TOAST_TYPE, setToast } from "@plane/propel/toast";
import type { ISearchIssueResponse } from "@plane/types";
import type { TContextMenuItem } from "@plane/ui";
import { ContextMenu, CustomMenu } from "@plane/ui";
import { cn } from "@plane/utils";
import { useTranslation } from "@plane/i18n";
// components
import { ExistingIssuesListModal } from "@/components/core/modals/existing-issues-list-modal";
import { CreateUpdateMilestoneModal } from "@/components/milestones/create-update-milestone-modal";
import { DeleteMilestoneModal } from "@/components/milestones/delete-milestone-modal";
// hooks
import { useMilestone } from "@/hooks/store/use-milestone";
import { useUserPermissions } from "@/hooks/store/user";

type Props = {
  parentRef: React.RefObject<HTMLDivElement>;
  milestoneId: string;
  projectId: string;
  workspaceSlug: string;
};

export const MilestoneQuickActions = observer(function MilestoneQuickActions(props: Props) {
  const { parentRef, milestoneId, projectId, workspaceSlug } = props;
  // states
  const [editModal, setEditModal] = useState(false);
  const [deleteModal, setDeleteModal] = useState(false);
  const [addIssuesModal, setAddIssuesModal] = useState(false);
  const [linkedIssueIds, setLinkedIssueIds] = useState<string[]>([]);
  // store hooks
  const { getMilestoneById, archiveMilestone, unarchiveMilestone, getMilestoneIssues, addIssuesToMilestone } =
    useMilestone();
  const { allowPermissions } = useUserPermissions();
  const { t } = useTranslation();

  const milestone = getMilestoneById(milestoneId);

  // auth
  const isEditingAllowed = allowPermissions(
    [EUserPermissions.ADMIN, EUserPermissions.MEMBER],
    EUserPermissionsLevel.PROJECT,
    workspaceSlug,
    projectId
  );

  if (!milestone) return null;

  const handleArchiveToggle = async () => {
    try {
      if (milestone.archived_at) {
        await unarchiveMilestone(workspaceSlug, projectId, milestoneId);
        setToast({ type: TOAST_TYPE.SUCCESS, title: t("milestone.toast.unarchived_title") });
      } else {
        await archiveMilestone(workspaceSlug, projectId, milestoneId);
        setToast({ type: TOAST_TYPE.SUCCESS, title: t("milestone.toast.archived_title") });
      }
    } catch {
      setToast({ type: TOAST_TYPE.ERROR, title: t("common.error") });
    }
  };

  const handleOpenAddIssues = async () => {
    try {
      const existing = await getMilestoneIssues(workspaceSlug, projectId, milestoneId);
      setLinkedIssueIds(existing.map((mi) => mi.issue));
    } catch {
      setLinkedIssueIds([]);
    }
    setAddIssuesModal(true);
  };

  const handleAddIssues = async (selected: ISearchIssueResponse[]) => {
    if (selected.length === 0) return;
    try {
      await addIssuesToMilestone(workspaceSlug, projectId, milestoneId, selected.map((i) => i.id));
      setToast({ type: TOAST_TYPE.SUCCESS, title: t("milestone.toast.issues_added") });
    } catch {
      setToast({ type: TOAST_TYPE.ERROR, title: t("milestone.toast.issues_add_error") });
    }
  };

  const MENU_ITEMS: TContextMenuItem[] = [
    {
      key: "add-issues",
      title: t("milestone.add_issues"),
      icon: Link2,
      action: handleOpenAddIssues,
      shouldRender: isEditingAllowed && !milestone.archived_at,
    },
    {
      key: "edit",
      title: t("common.edit"),
      icon: Pencil,
      action: () => setEditModal(true),
      shouldRender: isEditingAllowed && !milestone.archived_at,
    },
    {
      key: "archive",
      title: milestone.archived_at ? t("common.unarchive") : t("common.archive"),
      icon: Archive,
      action: handleArchiveToggle,
      shouldRender: isEditingAllowed,
    },
    {
      key: "delete",
      title: t("common.delete"),
      icon: Trash2,
      action: () => setDeleteModal(true),
      shouldRender: isEditingAllowed,
      className: "text-red-500",
      iconClassName: "text-red-500",
    },
  ];

  return (
    <>
      <div className="fixed">
        <CreateUpdateMilestoneModal
          isOpen={editModal}
          onClose={() => setEditModal(false)}
          data={milestone}
          workspaceSlug={workspaceSlug}
          projectId={projectId}
        />
        <DeleteMilestoneModal data={milestone} isOpen={deleteModal} onClose={() => setDeleteModal(false)} />
        <ExistingIssuesListModal
          workspaceSlug={workspaceSlug}
          projectId={projectId}
          isOpen={addIssuesModal}
          handleClose={() => setAddIssuesModal(false)}
          searchParams={{}}
          handleOnSubmit={handleAddIssues}
          shouldHideIssue={(issue) => linkedIssueIds.includes(issue.id)}
        />
      </div>
      <ContextMenu parentRef={parentRef} items={MENU_ITEMS} />
      <CustomMenu
        customButton={<IconButton variant="tertiary" size="lg" icon={MoreHorizontal} />}
        placement="bottom-end"
        closeOnSelect
      >
        {MENU_ITEMS.map((item) => {
          if (item.shouldRender === false) return null;
          return (
            <CustomMenu.MenuItem
              key={item.key}
              onClick={() => item.action()}
              className={cn("flex items-center gap-2", item.className)}
            >
              {item.icon && <item.icon className={cn("h-3 w-3 flex-shrink-0", item.iconClassName)} />}
              <span>{item.title}</span>
            </CustomMenu.MenuItem>
          );
        })}
      </CustomMenu>
    </>
  );
});
