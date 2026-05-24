/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useEffect, useRef, useState } from "react";
import { observer } from "mobx-react";
import { GripVertical, Pencil, Trash2, X, Check } from "lucide-react";
// plane imports
import { useTranslation } from "@plane/i18n";
import { setToast, TOAST_TYPE } from "@plane/propel/toast";
import type { IWorkspaceProjectState } from "@plane/types";
// hooks
import { useWorkspaceProjectState } from "@/hooks/store/use-workspace-project-state";

type Props = {
  workspaceSlug: string;
  state: IWorkspaceProjectState;
};

export const ProjectStateItem = observer(function ProjectStateItem({ workspaceSlug, state }: Props) {
  const { t } = useTranslation();
  const { updateState, deleteState } = useWorkspaceProjectState();

  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState(state.name);
  const [editColor, setEditColor] = useState(state.color);
  const editInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isEditing) editInputRef.current?.focus();
  }, [isEditing]);
  const [isDeleting, setIsDeleting] = useState(false);

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

  return (
    <div className="group border-custom-border-200 bg-custom-background-100 flex items-center gap-3 rounded-md border px-3 py-2.5">
      <GripVertical className="text-custom-text-400 h-4 w-4 flex-shrink-0 opacity-0 transition-opacity group-hover:opacity-100" />

      {isEditing ? (
        <>
          <input
            type="color"
            value={editColor}
            onChange={(e) => setEditColor(e.target.value)}
            className="h-5 w-5 flex-shrink-0 cursor-pointer rounded border-0 bg-transparent p-0"
            title="Pick color"
          />
          <input
            type="text"
            value={editName}
            onChange={(e) => setEditName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") void handleSave();
              if (e.key === "Escape") handleCancel();
            }}
            ref={editInputRef}
            className="border-custom-border-200 bg-custom-background-80 text-sm text-custom-text-100 focus:border-custom-primary-100 flex-grow rounded border px-2 py-0.5 outline-none"
          />
          <button
            type="button"
            onClick={() => void handleSave()}
            className="text-green-500 hover:text-green-600 flex-shrink-0"
            title="Save"
          >
            <Check className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={handleCancel}
            className="text-custom-text-400 hover:text-custom-text-200 flex-shrink-0"
            title="Cancel"
          >
            <X className="h-4 w-4" />
          </button>
        </>
      ) : (
        <>
          <span
            className="h-3.5 w-3.5 flex-shrink-0 rounded-full border border-white/20"
            style={{ backgroundColor: state.color }}
          />
          <span className="text-sm text-custom-text-100 flex-grow truncate">{state.name}</span>
          <div className="flex flex-shrink-0 items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
            <button
              type="button"
              onClick={() => setIsEditing(true)}
              className="text-custom-text-400 hover:bg-custom-background-80 hover:text-custom-text-200 rounded p-0.5"
              title="Edit"
            >
              <Pencil className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={() => void handleDelete()}
              disabled={isDeleting}
              className="text-custom-text-400 hover:bg-custom-background-80 hover:text-red-500 rounded p-0.5 disabled:opacity-50"
              title="Delete"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        </>
      )}
    </div>
  );
});
