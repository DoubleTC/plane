/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useEffect, useRef, useState } from "react";
import {
  draggable,
  dropTargetForElements,
  monitorForElements,
} from "@atlaskit/pragmatic-drag-and-drop/element/adapter";
import { observer } from "mobx-react";
import { useParams } from "next/navigation";
// plane imports
import { useTranslation } from "@plane/i18n";
import type { IProject, IWorkspaceProjectState } from "@plane/types";
import { cn } from "@plane/utils";
// local imports
import { GroupIcon } from "@/components/workspace/settings/project-states/group-icon";
import { useProject } from "@/hooks/store/use-project";
import { useWorkspaceProjectState } from "@/hooks/store/use-workspace-project-state";
import { ProjectCard } from "../card";

// ── Types ──────────────────────────────────────────────────────────────────────

/** Payload attached to every draggable project card. */
type DragData = { type: "project-card"; projectId: string };

/** Payload attached to every column drop target. */
type DropData = { type: "column"; stateId: string | null };

const DRAG_TYPE = "project-card";

// ── Helper: type-guards ────────────────────────────────────────────────────────

function isDragData(data: Record<string, unknown>): data is DragData {
  return data.type === DRAG_TYPE;
}

function isDropData(data: Record<string, unknown>): data is DropData {
  return data.type === "column";
}

// ── DraggableProjectCard ───────────────────────────────────────────────────────

type DraggableCardProps = {
  project: IProject;
};

const DraggableProjectCard = function DraggableProjectCard({ project }: DraggableCardProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    return draggable({
      element: el,
      getInitialData: (): DragData => ({ type: DRAG_TYPE, projectId: project.id }),
      onDragStart: () => setIsDragging(true),
      onDrop: () => setIsDragging(false),
    });
  }, [project.id]);

  return (
    <div ref={ref} className={cn("cursor-grab active:cursor-grabbing", isDragging && "opacity-40")}>
      <ProjectCard project={project} />
    </div>
  );
};

// ── BoardColumn ────────────────────────────────────────────────────────────────

type ColumnProps = {
  state: IWorkspaceProjectState | null; // null = unassigned
  projects: IProject[];
};

const BoardColumn = observer(function BoardColumn({ state, projects }: ColumnProps) {
  const { t } = useTranslation();
  const dropRef = useRef<HTMLDivElement>(null);
  const [isDragOver, setIsDragOver] = useState(false);

  const stateId = state?.id ?? null;

  useEffect(() => {
    const el = dropRef.current;
    if (!el) return;

    return dropTargetForElements({
      element: el,
      canDrop: ({ source }) => isDragData(source.data as Record<string, unknown>),
      getData: (): DropData => ({ type: "column", stateId }),
      onDragEnter: () => setIsDragOver(true),
      onDragLeave: () => setIsDragOver(false),
      onDrop: () => setIsDragOver(false),
    });
  }, [stateId]);

  return (
    <div
      ref={dropRef}
      className={cn(
        "flex w-80 flex-shrink-0 flex-col overflow-hidden rounded-lg border border-subtle bg-layer-1 transition-colors duration-150",
        isDragOver && "border-accent-primary/50 bg-accent-primary/5"
      )}
    >
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
      <div className="vertical-scrollbar flex scrollbar-sm min-h-16 flex-col gap-2 overflow-y-auto p-2">
        {projects.map((project) => (
          <DraggableProjectCard key={project.id} project={project} />
        ))}
        {projects.length === 0 && (
          <div className="flex h-12 items-center justify-center">
            <span className="text-13 text-placeholder">{t("workspace_projects.board.empty_column")}</span>
          </div>
        )}
      </div>
    </div>
  );
});

// ── Props ──────────────────────────────────────────────────────────────────────

type Props = {
  projectIds: string[];
  getProjectById: (id: string) => IProject | undefined;
};

/**
 * Board view — horizontal kanban, one column per workspace project state.
 * Projects without a state go into the "Unassigned" column on the far right.
 * Supports drag-and-drop to move a project between state columns.
 */
export const ProjectBoardView = observer(function ProjectBoardView({ projectIds, getProjectById }: Props) {
  const { workspaceSlug } = useParams();
  const { getStatesByWorkspace } = useWorkspaceProjectState();
  const { updateProject } = useProject();

  const workspaceStates = workspaceSlug ? getStatesByWorkspace(workspaceSlug.toString()) : [];

  // ── Global DnD monitor ────────────────────────────────────────────────────────

  useEffect(() => {
    return monitorForElements({
      canMonitor: ({ source }) => isDragData(source.data as Record<string, unknown>),
      onDrop: ({ source, location }) => {
        const dropTargets = location.current.dropTargets;
        if (!dropTargets.length || !workspaceSlug) return;

        const sourceData = source.data as Record<string, unknown>;
        const targetData = dropTargets[0].data as Record<string, unknown>;

        if (!isDragData(sourceData) || !isDropData(targetData)) return;

        const { projectId } = sourceData;
        const { stateId } = targetData;

        // Skip if dropped in the same column the project already belongs to
        const project = getProjectById(projectId);
        const currentStateId = project?.project_status ?? null;
        if (stateId === currentStateId) return;

        updateProject(workspaceSlug.toString(), projectId, {
          project_status: stateId,
        }).catch(() => {
          // updateProject surfaces its own error toast
        });
      },
    });
  }, [workspaceSlug, updateProject, getProjectById]);

  // ── Bucket projects into columns ──────────────────────────────────────────────

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

  // ── Render ────────────────────────────────────────────────────────────────────

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
