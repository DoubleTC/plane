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
};

export const ProjectStateItem = observer(function ProjectStateItem({ workspaceSlug, state, group }: Props) {
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

  if (isEditing) {
    return (
      <div className="border-custom-border-100 flex items-center gap-3 border-t px-4 py-3">
        {/* Inline color picker */}
        <label
          aria-label="Pick color"
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
          className="border-custom-border-300 bg-custom-background-100 text-sm text-custom-text-100 focus:border-custom-primary-100 flex-grow rounded border px-2.5 py-1 outline-none"
        />
        <div className="flex flex-shrink-0 items-center gap-2">
          <button
            type="button"
            onClick={() => void handleSave()}
            className="border-custom-primary-100 bg-custom-primary-100 text-xs hover:bg-custom-primary-200 rounded border px-3 py-1 font-medium text-white"
          >
            {t("workspace_settings.settings.project_states.save")}
          </button>
          <button
            type="button"
            onClick={handleCancel}
            className="border-custom-border-200 text-xs text-custom-text-300 hover:bg-custom-background-80 rounded border px-3 py-1 font-medium"
          >
            {t("workspace_settings.settings.project_states.cancel")}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="group/state-item border-custom-border-100 flex items-center gap-3 border-t px-4 py-3">
      {/* State icon: same shape as group, colored by state.color */}
      <GroupIcon group={group} color={state.color} size={18} />

      <span className="text-sm text-custom-text-100 flex-grow truncate">{state.name}</span>

      {/* Right side: default badge (always) + hover actions */}
      <div className="flex flex-shrink-0 items-center gap-2">
        {/* "Default" badge — always visible when this state is the default */}
        {state.is_default && (
          <span className="border-custom-primary-100/30 bg-custom-primary-100/10 text-xs text-custom-primary-100 rounded border px-1.5 py-0.5 font-medium">
            {t("workspace_settings.settings.project_states.default_badge")}
          </span>
        )}

        {/* Actions — visible on hover */}
        <div className="flex items-center gap-1.5 opacity-0 transition-opacity group-hover/state-item:opacity-100">
          {/* "Mark as default" only shown when this is NOT the current default */}
          {!state.is_default && (
            <button
              type="button"
              onClick={() => void handleMarkAsDefault()}
              className="text-xs text-custom-text-300 hover:text-custom-primary-100"
            >
              {t("workspace_settings.settings.project_states.mark_as_default")}
            </button>
          )}
          <button
            type="button"
            onClick={() => setIsEditing(true)}
            className="text-custom-text-400 hover:bg-custom-background-80 hover:text-custom-text-200 flex items-center rounded p-0.5"
            title="Edit"
          >
            <Pencil className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={() => void handleDelete()}
            disabled={isDeleting}
            className="text-custom-text-400 hover:bg-custom-background-80 hover:text-red-500 flex items-center rounded p-0.5 disabled:opacity-50"
            title="Delete"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
});
