/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useEffect, useRef, useState } from "react";
import { observer } from "mobx-react";
import { Pencil, X } from "lucide-react";
// plane imports
import { useTranslation } from "@plane/i18n";
import { setToast, TOAST_TYPE } from "@plane/propel/toast";
import type { IWorkspaceProjectState, TProjectStateGroup } from "@plane/types";
// hooks
import { useWorkspaceProjectState } from "@/hooks/store/use-workspace-project-state";
// local
import { GroupIcon } from "./group-icon";

type Props = {
  workspaceSlug: string;
  state: IWorkspaceProjectState;
  group: TProjectStateGroup;
  isLastInGroup: boolean;
};

export const ProjectStateItem = observer(function ProjectStateItem({
  workspaceSlug,
  state,
  group,
  isLastInGroup,
}: Props) {
  const { t } = useTranslation();
  const { updateState, deleteState } = useWorkspaceProjectState();

  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState(state.name);
  const [editColor, setEditColor] = useState(state.color);
  const [isDeleting, setIsDeleting] = useState(false);
  const editInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isEditing) editInputRef.current?.focus();
  }, [isEditing]);

  const handleSave = async () => {
    if (!editName.trim()) return;
    try {
      await updateState(workspaceSlug, state.id, { name: editName.trim(), color: editColor });
      setIsEditing(false);
      setToast({ type: TOAST_TYPE.SUCCESS, title: t("workspace_settings.settings.project_states.toast.updated") });
    } catch {
      setToast({ type: TOAST_TYPE.ERROR, title: t("workspace_settings.settings.project_states.toast.update_error") });
    }
  };

  const handleCancel = () => {
    setEditName(state.name);
    setEditColor(state.color);
    setIsEditing(false);
  };

  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      await deleteState(workspaceSlug, state.id);
      setToast({ type: TOAST_TYPE.SUCCESS, title: t("workspace_settings.settings.project_states.toast.deleted") });
    } catch {
      setToast({ type: TOAST_TYPE.ERROR, title: t("workspace_settings.settings.project_states.toast.delete_error") });
      setIsDeleting(false);
    }
  };

  const handleMarkAsDefault = async () => {
    try {
      await updateState(workspaceSlug, state.id, { is_default: true });
      setToast({
        type: TOAST_TYPE.SUCCESS,
        title: t("workspace_settings.settings.project_states.toast.marked_as_default"),
      });
    } catch {
      setToast({
        type: TOAST_TYPE.ERROR,
        title: t("workspace_settings.settings.project_states.toast.update_error"),
      });
    }
  };

  // ── Edit mode ────────────────────────────────────────────────────────────────
  if (isEditing) {
    return (
      <div className="relative flex items-center gap-2 rounded-sm border border-subtle bg-surface-1 p-3 px-3.5">
        {/* Inline color picker */}
        <label
          aria-label={t("workspace_settings.settings.project_states.pick_color")}
          className="relative h-5 w-5 flex-shrink-0 cursor-pointer overflow-hidden rounded"
        >
          <span className="absolute inset-0 rounded" style={{ backgroundColor: editColor }} />
          <input
            type="color"
            value={editColor}
            onChange={(e) => setEditColor(e.target.value)}
            className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
          />
        </label>
        <input
          ref={editInputRef}
          type="text"
          value={editName}
          onChange={(e) => setEditName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") void handleSave();
            if (e.key === "Escape") handleCancel();
          }}
          className="focus:border-accent-primary flex-grow rounded border border-subtle bg-transparent px-2 py-1 text-13 text-primary outline-none"
        />
        <div className="flex flex-shrink-0 items-center gap-2">
          <button
            type="button"
            onClick={() => void handleSave()}
            className="border-accent-primary rounded border bg-accent-primary px-3 py-1 text-13 font-medium text-white hover:bg-accent-primary/90"
          >
            {t("workspace_settings.settings.project_states.save")}
          </button>
          <button
            type="button"
            onClick={handleCancel}
            className="rounded border border-subtle px-3 py-1 text-13 font-medium text-secondary hover:bg-layer-1"
          >
            {t("workspace_settings.settings.project_states.cancel")}
          </button>
        </div>
      </div>
    );
  }

  // ── View mode ────────────────────────────────────────────────────────────────
  return (
    <div className="group relative flex cursor-auto items-center gap-2 rounded-sm border border-subtle bg-surface-1 p-3 px-3.5">
      {/* State group icon colored by state.color */}
      <div className="flex-shrink-0">
        <GroupIcon group={group} fill={state.color} size={16} />
      </div>

      {/* State name */}
      <div className="min-h-5 w-full px-2">
        <h6 className="text-13 font-medium text-primary">{state.name}</h6>
      </div>

      {/* Hover-only actions */}
      <div className="hidden flex-shrink-0 items-center gap-2 group-hover:flex">
        {/* Default indicator / mark-as-default button */}
        {state.is_default ? (
          <button type="button" disabled className="cursor-default text-13 whitespace-nowrap text-tertiary">
            {t("workspace_settings.settings.project_states.default_badge")}
          </button>
        ) : (
          <button
            type="button"
            onClick={() => void handleMarkAsDefault()}
            className="text-13 whitespace-nowrap text-secondary hover:text-primary"
          >
            {t("workspace_settings.settings.project_states.mark_as_default")}
          </button>
        )}

        {/* Edit button */}
        <button
          type="button"
          onClick={() => setIsEditing(true)}
          className="flex h-5 w-5 items-center justify-center rounded-sm text-secondary hover:bg-layer-1 hover:text-primary"
          title={t("workspace_settings.settings.project_states.edit")}
        >
          <Pencil className="h-3 w-3" />
        </button>

        {/* Delete button — disabled when this is the only state or is marked as default */}
        <button
          type="button"
          onClick={() => void handleDelete()}
          disabled={isDeleting || isLastInGroup || state.is_default}
          className="hover:text-red-500 flex h-5 w-5 items-center justify-center rounded-sm bg-layer-1 text-secondary disabled:cursor-not-allowed disabled:opacity-40"
          title={t("workspace_settings.settings.project_states.delete")}
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
});
