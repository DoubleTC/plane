/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useEffect, useRef, useState } from "react";
import { observer } from "mobx-react";
import { ChevronRight, Plus } from "lucide-react";
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

// Fixed fill colors for the group header icon — one per group, from the design system.
const GROUP_ICON_COLORS: Record<TProjectStateGroup, string> = {
  draft: "#60646C",
  planning: "#60646C",
  execution: "#F59E0B",
  monitoring: "#00838F",
  completed: "#46A758",
  cancelled: "#9AA4BC",
};

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
  // Default new-state color = the design-system color for this group
  const [newColor, setNewColor] = useState(GROUP_ICON_COLORS[group]);
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
        group,
        color: newColor,
      });
      setNewName("");
      setNewColor(GROUP_ICON_COLORS[group]);
      setIsAdding(false);
      setToast({ type: TOAST_TYPE.SUCCESS, title: t("workspace_settings.settings.project_states.toast.created") });
    } catch {
      setToast({ type: TOAST_TYPE.ERROR, title: t("workspace_settings.settings.project_states.toast.create_error") });
    }
  };

  const handleCancelAdd = () => {
    setNewName("");
    setNewColor(GROUP_ICON_COLORS[group]);
    setIsAdding(false);
  };

  return (
    <div className="space-y-1 rounded-lg border border-subtle bg-layer-1 p-2 transition-all">
      {/* ── Accordion header ── */}
      <div className="flex items-center justify-between gap-2">
        {/* Left: collapse toggle — fills remaining space */}
        <button
          type="button"
          onClick={() => setIsExpanded((v) => !v)}
          className="flex w-full cursor-pointer items-center border-none bg-transparent py-1 text-left"
        >
          {/* Chevron — rotates when collapsed */}
          <div className="flex h-5 w-5 flex-shrink-0 items-center justify-center overflow-hidden rounded-sm transition-all">
            <ChevronRight
              className={`h-3.5 w-3.5 text-secondary transition-transform ${isExpanded ? "rotate-90" : ""}`}
            />
          </div>

          {/* Group icon (fixed design-system color) */}
          <div className="flex h-6 w-6 flex-shrink-0 items-center justify-center overflow-hidden rounded-sm">
            <GroupIcon group={group} fill={GROUP_ICON_COLORS[group]} size={14} />
          </div>

          {/* Group label */}
          <span className="px-1 text-14 font-medium text-secondary capitalize">{groupMeta?.label ?? group}</span>
        </button>

        {/* Right: add-state button */}
        <button
          type="button"
          onClick={handleOpenAdd}
          className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-sm text-accent-primary/80 hover:bg-layer-1 hover:text-accent-primary"
          title={t("workspace_settings.settings.project_states.add_state")}
        >
          <Plus className="h-4 w-4" />
        </button>
      </div>

      {/* ── Expanded body ── */}
      {isExpanded && (
        <div className="flex flex-col gap-1">
          {/* Existing state items */}
          {states.map((state) => (
            <ProjectStateItem
              key={state.id}
              workspaceSlug={workspaceSlug}
              state={state}
              group={group}
              isLastInGroup={states.length === 1}
            />
          ))}

          {/* Add-state inline form */}
          {isAdding && (
            <div className="flex flex-col gap-3 rounded-sm border border-dashed border-subtle bg-surface-1 p-3 px-3.5">
              {/* Color swatch + name input row */}
              <div className="flex items-center gap-3">
                <label
                  aria-label={t("workspace_settings.settings.project_states.pick_color")}
                  className="relative h-5 w-5 flex-shrink-0 cursor-pointer overflow-hidden rounded"
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
                  className="focus:border-accent-primary flex-grow border-b border-subtle bg-transparent py-1 text-13 text-primary outline-none placeholder:text-tertiary"
                />
              </div>

              {/* Create / cancel buttons */}
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => void handleCreate()}
                  className="rounded bg-accent-primary px-4 py-1.5 text-13 font-medium text-white hover:bg-accent-primary/90"
                >
                  {t("workspace_settings.settings.project_states.create")}
                </button>
                <button
                  type="button"
                  onClick={handleCancelAdd}
                  className="rounded border border-subtle px-4 py-1.5 text-13 font-medium text-secondary hover:bg-layer-1"
                >
                  {t("workspace_settings.settings.project_states.cancel")}
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
});
