/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useEffect, useRef, useState } from "react";
import { observer } from "mobx-react";
import { Plus, X, Check } from "lucide-react";
// plane imports
import { useTranslation } from "@plane/i18n";
import { setToast, TOAST_TYPE } from "@plane/propel/toast";
import type { IWorkspaceProjectState, TProjectStateGroup } from "@plane/types";
import { PROJECT_STATE_GROUPS } from "@plane/types";
// components
import { ProjectStateItem } from "./state-item";
// hooks
import { useWorkspaceProjectState } from "@/hooks/store/use-workspace-project-state";

type Props = {
  workspaceSlug: string;
  group: TProjectStateGroup;
  states: IWorkspaceProjectState[];
};

export const ProjectStateGroupSection = observer(function ProjectStateGroupSection({
  workspaceSlug,
  group,
  states,
}: Props) {
  const { t } = useTranslation();
  const { createState } = useWorkspaceProjectState();

  const [isAdding, setIsAdding] = useState(false);
  const [newName, setNewName] = useState("");
  const [newColor, setNewColor] = useState("#64748B");
  const addInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isAdding) addInputRef.current?.focus();
  }, [isAdding]);

  const groupMeta = PROJECT_STATE_GROUPS.find((g) => g.key === group);

  const handleAdd = async () => {
    if (!newName.trim()) return;
    try {
      await createState(workspaceSlug, { name: newName.trim(), group, color: newColor });
      setNewName("");
      setNewColor("#64748B");
      setIsAdding(false);
      setToast({ type: TOAST_TYPE.SUCCESS, title: t("workspace_settings.settings.project_states.toast.created") });
    } catch {
      setToast({ type: TOAST_TYPE.ERROR, title: t("workspace_settings.settings.project_states.toast.create_error") });
    }
  };

  const handleCancelAdd = () => {
    setNewName("");
    setNewColor("#64748B");
    setIsAdding(false);
  };

  return (
    <div className="flex flex-col gap-2">
      {/* Group header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: groupMeta?.color ?? "#94A3B8" }} />
          <h4 className="text-sm text-custom-text-200 font-medium">{groupMeta?.label ?? group}</h4>
          <span className="text-xs text-custom-text-400">({states.length})</span>
        </div>
        {!isAdding && (
          <button
            type="button"
            onClick={() => setIsAdding(true)}
            className="text-xs text-custom-primary-100 hover:bg-custom-primary-100/10 flex items-center gap-1 rounded px-2 py-0.5"
          >
            <Plus className="h-3 w-3" />
            {t("workspace_settings.settings.project_states.add_state")}
          </button>
        )}
      </div>

      {/* State items */}
      <div className="flex flex-col gap-1.5 pl-5">
        {states.map((state) => (
          <ProjectStateItem key={state.id} workspaceSlug={workspaceSlug} state={state} />
        ))}

        {/* Add new state inline */}
        {isAdding && (
          <div className="border-custom-primary-100/30 bg-custom-background-100 flex items-center gap-3 rounded-md border px-3 py-2.5">
            <input
              type="color"
              value={newColor}
              onChange={(e) => setNewColor(e.target.value)}
              className="h-5 w-5 flex-shrink-0 cursor-pointer rounded border-0 bg-transparent p-0"
              title="Pick color"
            />
            <input
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") void handleAdd();
                if (e.key === "Escape") handleCancelAdd();
              }}
              ref={addInputRef}
              placeholder={t("workspace_settings.settings.project_states.state_name_placeholder")}
              className="border-custom-border-200 bg-custom-background-80 text-sm text-custom-text-100 focus:border-custom-primary-100 flex-grow rounded border px-2 py-0.5 outline-none"
            />
            <button
              type="button"
              onClick={() => void handleAdd()}
              className="text-green-500 hover:text-green-600 flex-shrink-0"
              title="Add"
            >
              <Check className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={handleCancelAdd}
              className="text-custom-text-400 hover:text-custom-text-200 flex-shrink-0"
              title="Cancel"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        )}

        {states.length === 0 && !isAdding && (
          <p className="text-xs text-custom-text-400 italic">
            {t("workspace_settings.settings.project_states.no_states_in_group")}
          </p>
        )}
      </div>
    </div>
  );
});
