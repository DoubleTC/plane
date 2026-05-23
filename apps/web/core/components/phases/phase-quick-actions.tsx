// Copyright (c) 2023-present Plane Software, Inc. and contributors
// SPDX-License-Identifier: AGPL-3.0-only

import { useState } from "react";
import { observer } from "mobx-react";
import { Archive, Layers, MoreHorizontal, Pencil, Trash2 } from "lucide-react";
// plane imports
import { EUserPermissions, EUserPermissionsLevel } from "@plane/constants";
import { IconButton } from "@plane/propel/icon-button";
import { TOAST_TYPE, setToast } from "@plane/propel/toast";
import type { TContextMenuItem } from "@plane/ui";
import { ContextMenu, CustomMenu } from "@plane/ui";
import { cn } from "@plane/utils";
import { useTranslation } from "@plane/i18n";
// components
import { AddCyclesToPhaseModal } from "@/components/phases/add-cycles-to-phase-modal";
import { CreateUpdatePhaseModal } from "@/components/phases/create-update-phase-modal";
import { DeletePhaseModal } from "@/components/phases/delete-phase-modal";
// hooks
import { usePhase } from "@/hooks/store/use-phase";
import { useUserPermissions } from "@/hooks/store/user";

type Props = {
  parentRef: React.RefObject<HTMLDivElement>;
  phaseId: string;
  projectId: string;
  workspaceSlug: string;
};

export const PhaseQuickActions = observer(function PhaseQuickActions(props: Props) {
  const { parentRef, phaseId, projectId, workspaceSlug } = props;
  const [editModal, setEditModal] = useState(false);
  const [deleteModal, setDeleteModal] = useState(false);
  const [addCyclesModal, setAddCyclesModal] = useState(false);
  const [linkedCycleIds, setLinkedCycleIds] = useState<string[]>([]);
  const { getPhaseById, archivePhase, unarchivePhase, getPhaseCycles } = usePhase();
  const { allowPermissions } = useUserPermissions();
  const { t } = useTranslation();

  const phase = getPhaseById(phaseId);
  const isEditingAllowed = allowPermissions(
    [EUserPermissions.ADMIN, EUserPermissions.MEMBER],
    EUserPermissionsLevel.PROJECT,
    workspaceSlug,
    projectId
  );

  if (!phase) return null;

  const handleArchiveToggle = async () => {
    try {
      if (phase.archived_at) {
        await unarchivePhase(workspaceSlug, projectId, phaseId);
        setToast({ type: TOAST_TYPE.SUCCESS, title: t("phase.toast.unarchived_title") });
      } else {
        await archivePhase(workspaceSlug, projectId, phaseId);
        setToast({ type: TOAST_TYPE.SUCCESS, title: t("phase.toast.archived_title") });
      }
    } catch {
      setToast({ type: TOAST_TYPE.ERROR, title: t("common.error") });
    }
  };

  const handleOpenAddCycles = async () => {
    try {
      const existing = await getPhaseCycles(workspaceSlug, projectId, phaseId);
      setLinkedCycleIds(existing.map((pc) => pc.cycle));
    } catch {
      setLinkedCycleIds([]);
    }
    setAddCyclesModal(true);
  };

  const MENU_ITEMS: TContextMenuItem[] = [
    {
      key: "add-cycles",
      title: t("phase.add_cycles"),
      icon: Layers,
      action: handleOpenAddCycles,
      shouldRender: isEditingAllowed && !phase.archived_at,
    },
    {
      key: "edit",
      title: t("common.edit"),
      icon: Pencil,
      action: () => setEditModal(true),
      shouldRender: isEditingAllowed && !phase.archived_at,
    },
    {
      key: "archive",
      title: phase.archived_at ? t("common.unarchive") : t("common.archive"),
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
        <CreateUpdatePhaseModal
          isOpen={editModal}
          onClose={() => setEditModal(false)}
          data={phase}
          workspaceSlug={workspaceSlug}
          projectId={projectId}
        />
        <DeletePhaseModal data={phase} isOpen={deleteModal} onClose={() => setDeleteModal(false)} />
        <AddCyclesToPhaseModal
          isOpen={addCyclesModal}
          onClose={() => setAddCyclesModal(false)}
          workspaceSlug={workspaceSlug}
          projectId={projectId}
          phaseId={phaseId}
          linkedCycleIds={linkedCycleIds}
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
