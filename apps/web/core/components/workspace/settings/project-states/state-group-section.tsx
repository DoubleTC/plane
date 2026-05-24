/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useEffect, useRef, useState } from "react";
import { observer } from "mobx-react";
import { ChevronDown, ChevronRight, Plus } from "lucide-react";
// plane imports
import { useTranslation } from "@plane/i18n";
import { setToast, TOAST_TYPE } from "@plane/propel/toast";
import type { IWorkspaceProjectState, TProjectStateGroup } from "@plane/types";
import { PROJECT_STATE_GROUPS } from "@plane/types";
// components
import { GroupIcon } from "./group-icon";
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

  const [isExpanded, setIsExpanded] = useState(true);
  const [isAdding, setIsAdding] = useState(false);
  const [newName, setNewName] = useState("");
  const [newColor, setNewColor] = useState("#64748B");
  const [newDescription, setNewDescription] = useState("");
  const addInputRef = useRef<HTMLInputElement>(null);

  const groupMeta = PROJECT_STATE_GROUPS.find((g) => g.key === group);

  useEffect(() => {
    if (isAdding) addInputRef.current?.focus();
  }, [isAdding]);

  const handleOpenAdd = () => {
    setIsExpanded(true);
    setIsAdding(true);
  };

  const handleCreate = async () => {
    if (!newName.trim()) return;
    try {
      await createState(workspaceSlug, {
        name: newName.trim(),
        description: newDescription.trim() || undefined,
        group,
        color: newColor,
      });
      setNewName("");
      setNewColor("#64748B");
      setNewDescription("");
      setIsAdding(false);
      setToast({ type: TOAST_TYPE.SUCCESS, title: t("workspace_settings.settings.project_states.toast.created") });
    } catch {
      setToast({ type: TOAST_TYPE.ERROR, title: t("workspace_settings.settings.project_states.toast.create_error") });
    }
  };

  const handleCancelAdd = () => {
    setNewName("");
    setNewColor("#64748B");
    setNewDescription("");
    setIsAdding(false);
  };

  return (
    <div className="border-custom-border-200 overflow-hidden rounded-md border">
      {/* ── Accordion header ── */}
      <div className="bg-custom-background-90 hover:bg-custom-background-80 flex w-full items-center px-4 py-3 transition-colors">
        {/* Left: collapse toggle (takes up all the flex-grow space) */}
        <button
          type="button"
          onClick={() => setIsExpanded((v) => !v)}
          className="flex flex-grow items-center gap-2.5 text-left"
        >
          {/* Collapse/expand chevron */}
          {isExpanded ? (
            <ChevronDown className="text-custom-text-400 h-4 w-4 flex-shrink-0" />
          ) : (
            <ChevronRight className="text-custom-text-400 h-4 w-4 flex-shrink-0" />
          )}

          {/* Group icon */}
          <GroupIcon group={group} color={groupMeta?.color} size={16} />

          {/* Group label */}
          <span className="text-sm text-custom-text-100 font-medium">{groupMeta?.label ?? group}</span>
        </button>

        {/* Right: + add button — separate button, not nested */}
        <button
          type="button"
          onClick={() => handleOpenAdd()}
          className="text-custom-text-400 hover:bg-custom-background-70 hover:text-custom-primary-100 flex h-6 w-6 flex-shrink-0 items-center justify-center rounded"
          title={t("workspace_settings.settings.project_states.add_state")}
        >
          <Plus className="h-4 w-4" />
        </button>
      </div>

      {/* ── Expanded body ── */}
      {isExpanded && (
        <div className="bg-custom-background-100">
          {/* Existing states */}
          {states.map((state) => (
            <ProjectStateItem key={state.id} workspaceSlug={workspaceSlug} state={state} group={group} />
          ))}

          {/* Add-state form */}
          {isAdding && (
            <div className="border-custom-border-100 border-t px-4 py-4">
              <div className="border-custom-border-300 rounded-md border border-dashed p-4">
                {/* Color square + name row */}
                <div className="flex items-center gap-3">
                  <label
                    aria-label="Pick color"
                    className="relative h-8 w-8 flex-shrink-0 cursor-pointer overflow-hidden rounded"
                  >
                    <span className="absolute inset-0 rounded" style={{ backgroundColor: newColor }} />
                    <input
                      type="color"
                      value={newColor}
                      onChange={(e) => setNewColor(e.target.value)}
                      className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
                    />
                  </label>
                  <input
                    ref={addInputRef}
                    type="text"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") void handleCreate();
                      if (e.key === "Escape") handleCancelAdd();
                    }}
                    placeholder={t("workspace_settings.settings.project_states.state_name_placeholder")}
                    className="border-custom-border-200 text-sm text-custom-text-100 placeholder-custom-text-400 focus:border-custom-primary-100 flex-grow border-b bg-transparent py-1 outline-none"
                  />
                </div>

                {/* Description textarea */}
                <textarea
                  value={newDescription}
                  onChange={(e) => setNewDescription(e.target.value)}
                  placeholder={t("workspace_settings.settings.project_states.state_description_placeholder")}
                  rows={2}
                  className="border-custom-border-200 text-sm text-custom-text-100 placeholder-custom-text-400 focus:border-custom-primary-100 mt-3 w-full resize-none rounded border bg-transparent px-2.5 py-2 outline-none"
                />

                {/* Create / cancel */}
                <div className="mt-3 flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => void handleCreate()}
                    className="bg-custom-primary-100 text-sm hover:bg-custom-primary-200 rounded px-4 py-1.5 font-medium text-white"
                  >
                    {t("workspace_settings.settings.project_states.create")}
                  </button>
                  <button
                    type="button"
                    onClick={handleCancelAdd}
                    className="border-custom-border-200 text-sm text-custom-text-300 hover:bg-custom-background-80 rounded border px-4 py-1.5 font-medium"
                  >
                    {t("workspace_settings.settings.project_states.cancel")}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
});
