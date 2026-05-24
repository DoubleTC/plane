/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { observer } from "mobx-react";
import { useParams } from "next/navigation";
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
 * Clicking it opens a popover listing all workspace states; selecting one patches the project.
 *
 * This component is used in all four project view modes (Gallery card body, Board card body,
 * List row, and Timeline sidebar) whenever `project_states_enabled` is ON.
 *
 * Must be rendered inside a context that stops link navigation (e.g. `data-prevent-progress`
 * + `onClick` propagation stop) because ProjectCard is a `<Link>`.
 */
export const ProjectStatePicker = observer(function ProjectStatePicker({ project, className }: Props) {
  const { t } = useTranslation();
  const { workspaceSlug } = useParams();

  const { updateProject } = useProject();
  const { getStatesByWorkspace, getStateById } = useWorkspaceProjectState();

  const currentState = project.project_status ? getStateById(project.project_status) : undefined;
  const workspaceStates = workspaceSlug ? getStatesByWorkspace(workspaceSlug.toString()) : [];

  const handleSelectState = async (stateId: string) => {
    if (!workspaceSlug || !project.id) return;
    try {
      await updateProject(workspaceSlug.toString(), project.id, { project_status: stateId });
    } catch {
      // silently ignore — the toast is shown by updateProject internally if it errors
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
      <Popover>
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
          className="shadow-lg z-20 min-w-[180px] overflow-hidden rounded-md border border-subtle bg-layer-2"
        >
          <div className="flex flex-col gap-0.5 p-1">
            {workspaceStates.map((state) => (
              <button
                key={state.id}
                type="button"
                onClick={() => void handleSelectState(state.id)}
                className={cn(
                  "flex w-full items-center gap-2 rounded px-2 py-1.5 text-13 text-secondary hover:bg-layer-1",
                  project.project_status === state.id && "bg-layer-1 text-primary"
                )}
              >
                <GroupIcon group={state.group} fill={state.color} size={14} />
                <span>{state.name}</span>
              </button>
            ))}
          </div>
        </Popover.Panel>
      </Popover>
    </div>
  );
});
