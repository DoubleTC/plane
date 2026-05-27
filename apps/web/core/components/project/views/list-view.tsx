/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useRef, useState } from "react";
import { observer } from "mobx-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArchiveRestoreIcon, MoreHorizontal, Settings, UserPlus } from "lucide-react";
// plane imports
import { EUserPermissions, EUserPermissionsLevel, IS_FAVORITE_MENU_OPEN } from "@plane/constants";
import { useLocalStorage } from "@plane/hooks";
import { useTranslation } from "@plane/i18n";
import { Logo } from "@plane/propel/emoji-icon-picker";
import { LinkIcon, LockIcon, NewTabIcon, TrashIcon } from "@plane/propel/icons";
import { setPromiseToast, setToast, TOAST_TYPE } from "@plane/propel/toast";
import type { IProject, IWorkspaceProjectState } from "@plane/types";
import type { TContextMenuItem } from "@plane/ui";
import { Avatar, AvatarGroup, ContextMenu, CustomMenu, FavoriteStar } from "@plane/ui";
import { cn, copyUrlToClipboard, getFileURL } from "@plane/utils";
// local imports
import { GroupIcon } from "@/components/workspace/settings/project-states/group-icon";
import { useProject } from "@/hooks/store/use-project";
import { useMember } from "@/hooks/store/use-member";
import { useWorkspace } from "@/hooks/store/use-workspace";
import { useWorkspaceProjectState } from "@/hooks/store/use-workspace-project-state";
import { useUserPermissions } from "@/hooks/store/user";
import { useAppRouter } from "@/hooks/use-app-router";
import { ArchiveRestoreProjectModal } from "../archive-restore-modal";
import { DeleteProjectModal } from "../delete-project-modal";
import { JoinProjectModal } from "../join-project-modal";
import { ProjectDatePicker } from "./date-picker";
import { ProjectLeadPicker } from "./lead-picker";
import { ProjectStatePicker } from "./state-picker";

// ── Single list row ───────────────────────────────────────────────────────────

type RowProps = {
  project: IProject;
  projectStatesEnabled: boolean;
};

const ProjectListRow = observer(function ProjectListRow({ project, projectStatesEnabled }: RowProps) {
  const { t } = useTranslation();
  const { workspaceSlug } = useParams();
  const router = useAppRouter();

  // ── Modal state ────────────────────────────────────────────────────────────
  const [deleteModalOpen, setDeleteModal] = useState(false);
  const [joinModalOpen, setJoinModal] = useState(false);
  const [restoreModalOpen, setRestoreModal] = useState(false);

  // ── Refs ───────────────────────────────────────────────────────────────────
  const rowRef = useRef<HTMLDivElement>(null);

  // ── Store hooks ────────────────────────────────────────────────────────────
  const { addProjectToFavorites, removeProjectFromFavorites } = useProject();
  const { getUserDetails } = useMember();
  const { allowPermissions } = useUserPermissions();

  // ── Derived values ─────────────────────────────────────────────────────────
  const isArchived = !!project.archived_at;
  const isMemberOfProject = !!project.member_role;
  const hasAdminRole = project.member_role === EUserPermissions.ADMIN;
  const hasMemberRole = project.member_role === EUserPermissions.MEMBER;
  const projectMembersIds = project.members ?? [];
  const shouldRenderFavorite = allowPermissions(
    [EUserPermissions.ADMIN, EUserPermissions.MEMBER],
    EUserPermissionsLevel.WORKSPACE
  );

  // ── Favorite ───────────────────────────────────────────────────────────────
  const { setValue: toggleFavoriteMenu, storedValue: isFavoriteMenuOpen } = useLocalStorage<boolean>(
    IS_FAVORITE_MENU_OPEN,
    false
  );

  const handleAddToFavorites = () => {
    if (!workspaceSlug) return;
    const promise = addProjectToFavorites(workspaceSlug.toString(), project.id);
    setPromiseToast(promise, {
      loading: "Adding project to favorites...",
      success: {
        title: "Success!",
        message: () => "Project added to favorites.",
        actionItems: () => {
          if (!isFavoriteMenuOpen) toggleFavoriteMenu(true);
          return <></>;
        },
      },
      error: { title: "Error!", message: () => "Couldn't add the project to favorites. Please try again." },
    });
  };

  const handleRemoveFromFavorites = () => {
    if (!workspaceSlug) return;
    const promise = removeProjectFromFavorites(workspaceSlug.toString(), project.id);
    setPromiseToast(promise, {
      loading: "Removing project from favorites...",
      success: { title: "Success!", message: () => "Project removed from favorites." },
      error: { title: "Error!", message: () => "Couldn't remove the project from favorites. Please try again." },
    });
  };

  // ── Copy / open ────────────────────────────────────────────────────────────
  const projectLink = `${workspaceSlug}/projects/${project.id}/issues`;
  const handleCopyText = () =>
    copyUrlToClipboard(projectLink).then(() =>
      setToast({ type: TOAST_TYPE.INFO, title: "Link Copied!", message: "Project link copied to clipboard." })
    );
  const handleOpenInNewTab = () => window.open(`/${projectLink}`, "_blank");

  // ── Context / dropdown menu items ──────────────────────────────────────────
  const MENU_ITEMS: TContextMenuItem[] = [
    {
      key: "settings",
      action: () => router.push(`/${workspaceSlug}/settings/projects/${project.id}`),
      title: "Settings",
      icon: Settings,
      shouldRender: !isArchived && (hasAdminRole || hasMemberRole),
    },
    {
      key: "join",
      action: () => setJoinModal(true),
      title: "Join",
      icon: UserPlus,
      shouldRender: !isMemberOfProject && !isArchived,
    },
    {
      key: "open-new-tab",
      action: handleOpenInNewTab,
      title: "Open in new tab",
      icon: NewTabIcon,
      shouldRender: !isArchived,
    },
    {
      key: "copy-link",
      action: handleCopyText,
      title: "Copy link",
      icon: LinkIcon,
      shouldRender: !isArchived,
    },
    {
      key: "restore",
      action: () => setRestoreModal(true),
      title: "Restore",
      icon: ArchiveRestoreIcon,
      shouldRender: isArchived && hasAdminRole,
    },
    {
      key: "delete",
      action: () => setDeleteModal(true),
      title: "Delete",
      icon: TrashIcon,
      shouldRender: isArchived && hasAdminRole,
    },
  ];

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <>
      {/* Modals */}
      <DeleteProjectModal project={project} isOpen={deleteModalOpen} onClose={() => setDeleteModal(false)} />
      {workspaceSlug && (
        <JoinProjectModal
          workspaceSlug={workspaceSlug.toString()}
          project={project}
          isOpen={joinModalOpen}
          handleClose={() => setJoinModal(false)}
        />
      )}
      {workspaceSlug && project && (
        <ArchiveRestoreProjectModal
          workspaceSlug={workspaceSlug.toString()}
          projectId={project.id}
          isOpen={restoreModalOpen}
          onClose={() => setRestoreModal(false)}
          archive={false}
        />
      )}

      {/* Row wrapper — provides context menu + named group for hover effects */}
      <div ref={rowRef} className="group/list-row">
        <ContextMenu parentRef={rowRef} items={MENU_ITEMS} />

        <Link
          href={isMemberOfProject && !isArchived ? `/${workspaceSlug}/projects/${project.id}/issues` : "#"}
          draggable={false}
          onClick={(e) => {
            if (!isMemberOfProject || isArchived) {
              e.preventDefault();
              e.stopPropagation();
            }
          }}
          className={cn(
            "flex min-h-[52px] items-center gap-3 border-b border-subtle px-4 py-2 transition-colors hover:bg-layer-1",
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

          {/* ── Right-side attributes & actions ───────────────────────── */}
          <div className="flex flex-shrink-0 items-center gap-2">
            {/* ── Pickers — hidden for archived (no editing while archived) ── */}
            {!isArchived && (
              <>
                {/* State picker — className="h-5" overrides the button's built-in h-5 */}
                {projectStatesEnabled && (
                  <div className="my-auto h-5 flex-shrink-0">
                    <ProjectStatePicker project={project} />
                  </div>
                )}

                {/* Lead picker — md+ */}
                <div className="my-auto hidden h-5 flex-shrink-0 md:block">
                  <ProjectLeadPicker project={project} />
                </div>

                {/* Date picker — lg+ */}
                <div className="my-auto hidden h-5 flex-shrink-0 lg:block">
                  <ProjectDatePicker project={project} />
                </div>
              </>
            )}

            {/* Members AvatarGroup — xl+ */}
            {projectMembersIds.length > 0 && (
              <div className="hidden h-5 items-center xl:flex">
                <AvatarGroup showTooltip={false}>
                  {projectMembersIds.slice(0, 4).map((memberId) => {
                    const member = getUserDetails(memberId);
                    if (!member) return null;
                    return <Avatar key={member.id} name={member.display_name} src={getFileURL(member.avatar_url)} />;
                  })}
                </AvatarGroup>
              </div>
            )}

            {/* ── Contextual right-side content ── */}

            {/* Archived: restore + delete */}
            {isArchived && hasAdminRole && (
              <>
                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setRestoreModal(true);
                  }}
                  className="flex h-5 items-center gap-1 text-11 text-placeholder hover:text-secondary"
                >
                  <ArchiveRestoreIcon className="h-3.5 w-3.5" />
                  {t("workspace_projects.archived.restore")}
                </button>
                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setDeleteModal(true);
                  }}
                  className="flex h-5 items-center text-11 text-placeholder hover:text-secondary"
                >
                  <TrashIcon className="h-3.5 w-3.5" />
                </button>
              </>
            )}

            {/* Join button — non-members on non-archived */}
            {!isArchived && !isMemberOfProject && (
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setJoinModal(true);
                }}
                className="flex h-5 items-center text-13 font-semibold text-accent-primary hover:text-accent-primary/90"
              >
                {t("common.join")}
              </button>
            )}

            {/* Joined indicator — member with viewer/below role */}
            {!isArchived && isMemberOfProject && !(hasAdminRole || hasMemberRole) && (
              <span className="flex h-5 items-center gap-1 text-13 text-placeholder">
                <span className="h-3.5 w-3.5">✓</span>
                {t("workspace_projects.member.joined")}
              </span>
            )}

            {/* ── Hover-only actions ── */}

            {/* Favorite star */}
            {shouldRenderFavorite && !isArchived && (
              // eslint-disable-next-line jsx-a11y/no-static-element-interactions
              <div
                role="presentation"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                }}
              >
                <FavoriteStar
                  buttonClassName="flex place-items-center justify-center items-center opacity-0 pointer-events-none group-hover/list-row:opacity-100 group-hover/list-row:pointer-events-auto rounded-sm h-5 w-6 hover:bg-layer-1"
                  iconClassName="h-3.5 w-3.5 transition-all"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    if (project.is_favorite) handleRemoveFromFavorites();
                    else handleAddToFavorites();
                  }}
                  selected={!!project.is_favorite}
                />
              </div>
            )}

            {/* 3-dot menu */}
            {/* eslint-disable-next-line jsx-a11y/no-static-element-interactions */}
            <div
              role="presentation"
              className="pointer-events-none opacity-0 group-hover/list-row:pointer-events-auto group-hover/list-row:opacity-100"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
              }}
            >
              <CustomMenu
                customButton={<MoreHorizontal className="size-4" />}
                customButtonClassName="grid h-5 w-6 place-items-center rounded-sm text-secondary hover:bg-layer-1"
                placement="bottom-end"
                closeOnSelect
              >
                {MENU_ITEMS.map((item) => {
                  if (item.shouldRender === false) return null;
                  return (
                    <CustomMenu.MenuItem
                      key={item.key}
                      onClick={(e) => {
                        e.stopPropagation();
                        item.action();
                      }}
                      className="flex items-center gap-2"
                    >
                      {item.icon && <item.icon className="h-3 w-3" />}
                      {item.title}
                    </CustomMenu.MenuItem>
                  );
                })}
              </CustomMenu>
            </div>
          </div>
        </Link>
      </div>
    </>
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

// ── Root ──────────────────────────────────────────────────────────────────────

type Props = {
  projectIds: string[];
  getProjectById: (id: string) => IProject | undefined;
};

/**
 * List view — projects grouped by workspace project state, with sticky section headers.
 * When project states are disabled, all projects appear in a single ungrouped list.
 * Each row includes state picker, lead picker, date picker, member avatars,
 * favorite star, 3-dot menu, and context menu — matching the gallery card's capabilities.
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
