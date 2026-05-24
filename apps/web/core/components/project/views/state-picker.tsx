/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useEffect, useRef, useState } from "react";
import { observer } from "mobx-react";
import { useParams } from "next/navigation";
import { Check, Search } from "lucide-react";
// plane imports
import { useTranslation } from "@plane/i18n";
import { Popover } from "@plane/propel/popover";
import type { IProject } from "@plane/types";
import { cn } from "@plane/utils";
// local imports
import { GroupIcon } from "@/components/workspace/settings/project-states/group-icon";
import { useProject } from "@/hooks/store/use-project";
import { useWorkspaceProjectState } from "@/hooks/store/use-workspace-project-state";

type Props = {
  project: IProject;
  className?: string;
};

/**
 * A compact state-picker button that renders the project's current workspace state.
 * Clicking it opens a popover with a search box and a list of all workspace states;
 * the active state is marked with a checkmark. Selecting one patches the project.
 *
 * Used in all four project view modes whenever `project_states_enabled` is ON.
 * Must be rendered inside a context that stops link navigation.
 */
export const ProjectStatePicker = observer(function ProjectStatePicker({ project, className }: Props) {
  const { t } = useTranslation();
  const { workspaceSlug } = useParams();

  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const { updateProject } = useProject();
  const { getStatesByWorkspace, getStateById } = useWorkspaceProjectState();

  const currentState = project.project_status ? getStateById(project.project_status) : undefined;
  const workspaceStates = workspaceSlug ? getStatesByWorkspace(workspaceSlug.toString()) : [];

  const filteredStates = search.trim()
    ? workspaceStates.filter((s) => s.name.toLowerCase().includes(search.toLowerCase()))
    : workspaceStates;

  // Reset search when the popover closes
  const handleOpenChange = (isOpen: boolean) => {
    setOpen(isOpen);
    if (!isOpen) setSearch("");
  };

  // Auto-focus the search input when the popover opens
  useEffect(() => {
    if (open) {
      // Defer one tick so the panel has fully mounted into the DOM
      const id = setTimeout(() => inputRef.current?.focus(), 0);
      return () => clearTimeout(id);
    }
  }, [open]);

  const handleSelectState = async (stateId: string) => {
    if (!workspaceSlug || !project.id) return;
    // Close the panel immediately so the UI feels snappy
    setOpen(false);
    setSearch("");
    try {
      await updateProject(workspaceSlug.toString(), project.id, { project_status: stateId });
    } catch {
      // silently ignore — updateProject shows its own error toast
    }
  };

  return (
    // role="presentation": purely structural — stops Link navigation; the actual interactive
    // element is Popover.Button (renders as <button>), so no additional keyboard handling needed.
    // eslint-disable-next-line jsx-a11y/no-static-element-interactions
    <div
      role="presentation"
      data-prevent-progress
      className="contents"
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
      }}
    >
      <Popover open={open} onOpenChange={handleOpenChange}>
        <Popover.Button
          render={
            <button
              type="button"
              className={cn(
                "inline-flex h-5 items-center gap-1 rounded-sm border-[0.5px] border-strong px-2 text-11 text-secondary hover:bg-layer-1 focus:outline-none",
                className
              )}
            />
          }
        >
          {currentState ? (
            <>
              <GroupIcon group={currentState.group} fill={currentState.color} size={12} />
              <span>{currentState.name}</span>
            </>
          ) : (
            <span className="text-placeholder">{t("workspace_projects.project_state.no_state")}</span>
          )}
        </Popover.Button>

        <Popover.Panel
          side="bottom"
          align="start"
          sideOffset={6}
          className="shadow-lg z-20 min-w-48 overflow-hidden rounded-md border border-subtle bg-layer-2 py-2.5 whitespace-nowrap"
        >
          {/* Search bar */}
          <div className="mx-2 mb-2 flex items-center gap-1.5 rounded-sm border border-subtle px-2">
            <Search className="h-3.5 w-3.5 flex-shrink-0 text-placeholder" />
            <input
              ref={inputRef}
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t("search")}
              className="w-full bg-transparent py-1 text-11 text-secondary placeholder:text-placeholder focus:outline-none"
            />
          </div>

          {/* State list */}
          <div className="vertical-scrollbar scrollbar-xs max-h-48 space-y-1 overflow-y-scroll px-2">
            {filteredStates.map((state) => (
              <button
                key={state.id}
                type="button"
                onClick={() => void handleSelectState(state.id)}
                className="flex w-full cursor-pointer items-center justify-between gap-2 truncate rounded-sm px-1 py-1.5 text-13 text-secondary select-none hover:bg-layer-1"
              >
                <span className="grow truncate">
                  <span className="flex items-center gap-2 truncate">
                    <GroupIcon group={state.group} fill={state.color} size={12} className="flex-shrink-0" />
                    <span className="max-w-[100px] flex-grow truncate">{state.name}</span>
                  </span>
                </span>
                {project.project_status === state.id && <Check className="size-3.5 shrink-0" />}
              </button>
            ))}

            {filteredStates.length === 0 && (
              <p className="px-1 py-2 text-center text-11 text-placeholder">
                {t("workspace_projects.project_state.no_state")}
              </p>
            )}
          </div>
        </Popover.Panel>
      </Popover>
    </div>
  );
});
