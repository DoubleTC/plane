/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { observer } from "mobx-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArchiveRestoreIcon, CalendarDays, Settings } from "lucide-react";
// plane imports
import { EUserPermissions } from "@plane/constants";
import { useTranslation } from "@plane/i18n";
import { Logo } from "@plane/propel/emoji-icon-picker";
import { LockIcon } from "@plane/propel/icons";
import type { IProject, IWorkspaceProjectState } from "@plane/types";
import { Avatar, AvatarGroup } from "@plane/ui";
import { cn, getFileURL, renderFormattedDate } from "@plane/utils";
// local imports
import { GroupIcon } from "@/components/workspace/settings/project-states/group-icon";
import { useMember } from "@/hooks/store/use-member";
import { useWorkspace } from "@/hooks/store/use-workspace";
import { useWorkspaceProjectState } from "@/hooks/store/use-workspace-project-state";
import { ProjectStatePicker } from "./state-picker";

// ── Single list row ───────────────────────────────────────────────────────────

type RowProps = {
  project: IProject;
  projectStatesEnabled: boolean;
};

const ProjectListRow = observer(function ProjectListRow({ project, projectStatesEnabled }: RowProps) {
  const { t } = useTranslation();
  const { workspaceSlug } = useParams();
  const { getUserDetails } = useMember();

  const isArchived = !!project.archived_at;
  const isMemberOfProject = !!project.member_role;
  const hasAdminRole = project.member_role === EUserPermissions.ADMIN;
  const hasMemberRole = project.member_role === EUserPermissions.MEMBER;
  const projectMembersIds = project.members ?? [];

  const projectLead =
    typeof project.project_lead === "string"
      ? getUserDetails(project.project_lead)
      : (project.project_lead ?? undefined);

  return (
    <Link
      href={isMemberOfProject && !isArchived ? `/${workspaceSlug}/projects/${project.id}/issues` : "#"}
      onClick={(e) => {
        if (!isMemberOfProject || isArchived) {
          e.preventDefault();
          e.stopPropagation();
        }
      }}
      className={cn(
        "group flex min-h-[52px] items-center gap-3 border-b border-subtle px-4 py-2 transition-colors hover:bg-layer-1",
        { "opacity-70": isArchived }
      )}
    >
      {/* Logo */}
      <div className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-sm bg-layer-1">
        <Logo logo={project.logo_props} size={14} />
      </div>

      {/* Name + identifier */}
      <div className="flex flex-1 flex-col justify-center gap-0.5 truncate">
        <span className="truncate text-13 font-medium text-primary">{project.name}</span>
        <span className="flex items-center gap-1 text-11 text-tertiary">
          <span>{project.identifier}</span>
          {project.network === 0 && <LockIcon className="h-2.5 w-2.5" />}
        </span>
      </div>

      {/* Right side: state, lead, members, dates, settings */}
      <div className="flex flex-shrink-0 items-center gap-3">
        {/* State picker — only when states feature is on */}
        {projectStatesEnabled && !isArchived && <ProjectStatePicker project={project} />}

        {/* Date range — role="presentation" because it only stops link propagation, not truly interactive */}
        {(project.start_date || project.end_date) && (
          // eslint-disable-next-line jsx-a11y/no-static-element-interactions
          <span
            role="presentation"
            className="hidden items-center gap-1 text-11 text-tertiary sm:flex"
            data-prevent-progress
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
            }}
          >
            <CalendarDays className="h-3 w-3 flex-shrink-0" />
            {project.start_date ? renderFormattedDate(project.start_date) : "—"}
            {" → "}
            {project.end_date ? renderFormattedDate(project.end_date) : "—"}
          </span>
        )}

        {/* Lead avatar */}
        {projectLead && (
          <Avatar
            name={projectLead.display_name}
            src={getFileURL(projectLead.avatar_url)}
            size="sm"
            className="hidden sm:block"
          />
        )}

        {/* Member avatars */}
        {projectMembersIds.length > 0 && (
          <div className="hidden sm:flex">
            <AvatarGroup showTooltip={false}>
              {projectMembersIds.slice(0, 4).map((memberId) => {
                const member = getUserDetails(memberId);
                if (!member) return null;
                return <Avatar key={member.id} name={member.display_name} src={getFileURL(member.avatar_url)} />;
              })}
            </AvatarGroup>
          </div>
        )}

        {/* Settings / archived actions */}
        {isArchived && hasAdminRole ? (
          <button
            type="button"
            data-prevent-progress
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
            }}
            className="flex items-center gap-1 text-11 text-placeholder hover:text-secondary"
          >
            <ArchiveRestoreIcon className="h-3.5 w-3.5" />
            {t("workspace_projects.archived.restore")}
          </button>
        ) : (
          isMemberOfProject &&
          (hasAdminRole || hasMemberRole) && (
            <Link
              href={`/${workspaceSlug}/settings/projects/${project.id}`}
              data-prevent-progress
              onClick={(e) => e.stopPropagation()}
              className="hidden items-center rounded-sm p-1 text-placeholder opacity-0 group-hover:opacity-100 hover:bg-layer-1 hover:text-secondary sm:flex"
            >
              <Settings className="h-3.5 w-3.5" />
            </Link>
          )
        )}
      </div>
    </Link>
  );
});

// ── Group section ─────────────────────────────────────────────────────────────

type SectionProps = {
  state: IWorkspaceProjectState | null; // null = unassigned
  projects: IProject[];
  projectStatesEnabled: boolean;
};

const ProjectListSection = observer(function ProjectListSection({
  state,
  projects,
  projectStatesEnabled,
}: SectionProps) {
  const { t } = useTranslation();

  return (
    <div>
      {/* Sticky section header */}
      <div className="sticky top-0 z-10 flex items-center gap-2 border-b border-subtle bg-layer-1 px-4 py-2">
        {state ? (
          <GroupIcon group={state.group} fill={state.color} size={14} />
        ) : (
          <span className="border-tertiary h-3.5 w-3.5 flex-shrink-0 rounded-full border-2 border-dashed" />
        )}
        <span className="text-13 font-medium text-secondary">
          {state ? state.name : t("workspace_projects.project_state.unassigned")}
        </span>
        <span className="text-13 text-tertiary">{projects.length}</span>
      </div>

      {/* Rows */}
      {projects.map((project) => (
        <ProjectListRow key={project.id} project={project} projectStatesEnabled={projectStatesEnabled} />
      ))}
    </div>
  );
});

// ── Root ─────────────────────────────────────────────────────────────────────

type Props = {
  projectIds: string[];
  getProjectById: (id: string) => IProject | undefined;
};

/**
 * List view — projects grouped by workspace project state, with sticky section headers.
 * When project states are disabled, all projects appear in a single ungrouped list.
 */
export const ProjectListView = observer(function ProjectListView({ projectIds, getProjectById }: Props) {
  const { workspaceSlug } = useParams();
  const { currentWorkspace } = useWorkspace();
  const { getStatesByWorkspace } = useWorkspaceProjectState();

  const projectStatesEnabled = !!currentWorkspace?.project_states_enabled;
  const workspaceStates = workspaceSlug ? getStatesByWorkspace(workspaceSlug.toString()) : [];

  // When project states are disabled, render one flat list (no grouping)
  if (!projectStatesEnabled) {
    const allProjects = projectIds.map((id) => getProjectById(id)).filter((p): p is IProject => !!p);

    return (
      <div className="flex flex-col overflow-hidden rounded-lg border border-subtle">
        {allProjects.map((project) => (
          <ProjectListRow key={project.id} project={project} projectStatesEnabled={false} />
        ))}
      </div>
    );
  }

  // Bucket into state columns
  const stateMap = new Map<string, IProject[]>();
  const unassigned: IProject[] = [];

  for (const id of projectIds) {
    const project = getProjectById(id);
    if (!project) continue;
    if (project.project_status) {
      const list = stateMap.get(project.project_status) ?? [];
      list.push(project);
      stateMap.set(project.project_status, list);
    } else {
      unassigned.push(project);
    }
  }

  return (
    <div className="flex flex-col overflow-hidden rounded-lg border border-subtle">
      {workspaceStates.map((state) => {
        const projects = stateMap.get(state.id) ?? [];
        if (projects.length === 0) return null;
        return (
          <ProjectListSection
            key={state.id}
            state={state}
            projects={projects}
            projectStatesEnabled={projectStatesEnabled}
          />
        );
      })}
      {unassigned.length > 0 && (
        <ProjectListSection state={null} projects={unassigned} projectStatesEnabled={projectStatesEnabled} />
      )}
    </div>
  );
});
