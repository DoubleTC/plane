/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { observer } from "mobx-react";
import { useParams } from "next/navigation";
// plane imports
import { useTranslation } from "@plane/i18n";
import type { IProject, IWorkspaceProjectState } from "@plane/types";
// local imports
import { GroupIcon } from "@/components/workspace/settings/project-states/group-icon";
import { useWorkspaceProjectState } from "@/hooks/store/use-workspace-project-state";
import { ProjectCard } from "../card";

type Props = {
  projectIds: string[];
  getProjectById: (id: string) => IProject | undefined;
};

type ColumnProps = {
  state: IWorkspaceProjectState | null; // null = unassigned
  projects: IProject[];
};

const BoardColumn = observer(function BoardColumn({ state, projects }: ColumnProps) {
  const { t } = useTranslation();

  return (
    <div className="flex w-80 flex-shrink-0 flex-col overflow-hidden rounded-lg border border-subtle bg-layer-1">
      {/* Column header */}
      <div className="flex items-center gap-2 border-b border-subtle px-3 py-2.5">
        {state ? (
          <GroupIcon group={state.group} fill={state.color} size={14} />
        ) : (
          <span className="border-tertiary h-3.5 w-3.5 flex-shrink-0 rounded-full border-2 border-dashed" />
        )}
        <span className="flex-1 truncate text-14 font-medium text-secondary">
          {state ? state.name : t("workspace_projects.project_state.unassigned")}
        </span>
        <span className="flex-shrink-0 text-13 text-tertiary">{projects.length}</span>
      </div>

      {/* Cards */}
      <div className="vertical-scrollbar flex scrollbar-sm flex-col gap-2 overflow-y-auto p-2">
        {projects.map((project) => (
          <ProjectCard key={project.id} project={project} />
        ))}
        {projects.length === 0 && (
          <div className="flex h-16 items-center justify-center">
            <span className="text-13 text-placeholder">{t("workspace_projects.board.empty_column")}</span>
          </div>
        )}
      </div>
    </div>
  );
});

/**
 * Board view — horizontal kanban, one column per workspace project state.
 * Projects without a state go into the "Unassigned" column on the far right.
 */
export const ProjectBoardView = observer(function ProjectBoardView({ projectIds, getProjectById }: Props) {
  const { workspaceSlug } = useParams();
  const { getStatesByWorkspace } = useWorkspaceProjectState();

  const workspaceStates = workspaceSlug ? getStatesByWorkspace(workspaceSlug.toString()) : [];

  // Bucket projects into columns
  const stateColumns = new Map<string, IProject[]>();
  const unassigned: IProject[] = [];

  for (const id of projectIds) {
    const project = getProjectById(id);
    if (!project) continue;
    if (project.project_status) {
      const list = stateColumns.get(project.project_status) ?? [];
      list.push(project);
      stateColumns.set(project.project_status, list);
    } else {
      unassigned.push(project);
    }
  }

  return (
    <div className="horizontal-scrollbar flex scrollbar-md h-full gap-3 overflow-x-auto pb-4">
      {workspaceStates.map((state) => (
        <BoardColumn key={state.id} state={state} projects={stateColumns.get(state.id) ?? []} />
      ))}
      {/* Unassigned column — always last */}
      <BoardColumn state={null} projects={unassigned} />
    </div>
  );
});
