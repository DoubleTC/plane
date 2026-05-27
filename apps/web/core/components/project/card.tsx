/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import React, { useRef, useState } from "react";
import { observer } from "mobx-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArchiveRestoreIcon, MoreHorizontal, Settings, Users, UserPlus } from "lucide-react";
// plane imports
import { EUserPermissions, EUserPermissionsLevel, IS_FAVORITE_MENU_OPEN } from "@plane/constants";
import { useLocalStorage } from "@plane/hooks";
import { useTranslation } from "@plane/i18n";
import { Logo } from "@plane/propel/emoji-icon-picker";
import { LinkIcon, LockIcon, NewTabIcon, TrashIcon } from "@plane/propel/icons";
import { setPromiseToast, setToast, TOAST_TYPE } from "@plane/propel/toast";
import type { IProject } from "@plane/types";
import type { TContextMenuItem } from "@plane/ui";
import { ContextMenu, CustomMenu, FavoriteStar } from "@plane/ui";
import { cn, copyUrlToClipboard } from "@plane/utils";
// components
import { CoverImage } from "@/components/common/cover-image";
import { useProject } from "@/hooks/store/use-project";
import { useWorkspace } from "@/hooks/store/use-workspace";
import { useUserPermissions } from "@/hooks/store/user";
import { useAppRouter } from "@/hooks/use-app-router";
// local imports
import { ArchiveRestoreProjectModal } from "./archive-restore-modal";
import { DeleteProjectModal } from "./delete-project-modal";
import { JoinProjectModal } from "./join-project-modal";
import { ProjectDatePicker } from "./views/date-picker";
import { ProjectLeadPicker } from "./views/lead-picker";
import { ProjectStatePicker } from "./views/state-picker";

type Props = {
  project: IProject;
};

export const ProjectCard = observer(function ProjectCard(props: Props) {
  const { project } = props;
  // states
  const [deleteProjectModalOpen, setDeleteProjectModal] = useState(false);
  const [joinProjectModalOpen, setJoinProjectModal] = useState(false);
  const [restoreProject, setRestoreProject] = useState(false);
  // refs
  const projectCardRef = useRef<HTMLDivElement>(null);
  // router
  const router = useAppRouter();
  const { workspaceSlug } = useParams();
  // store hooks
  const { addProjectToFavorites, removeProjectFromFavorites } = useProject();
  const { currentWorkspace } = useWorkspace();
  const { allowPermissions } = useUserPermissions();
  // hooks
  const { t } = useTranslation();
  // derived values
  const projectMembersIds = project.members ?? [];
  const projectStatesEnabled = !!currentWorkspace?.project_states_enabled;
  const shouldRenderFavorite = allowPermissions(
    [EUserPermissions.ADMIN, EUserPermissions.MEMBER],
    EUserPermissionsLevel.WORKSPACE
  );
  // auth
  const isMemberOfProject = !!project.member_role;
  const hasAdminRole = project.member_role === EUserPermissions.ADMIN;
  const hasMemberRole = project.member_role === EUserPermissions.MEMBER;
  // archive
  const isArchived = !!project.archived_at;
  // local storage
  const { setValue: toggleFavoriteMenu, storedValue: isFavoriteMenuOpen } = useLocalStorage<boolean>(
    IS_FAVORITE_MENU_OPEN,
    false
  );

  // ── Handlers ─────────────────────────────────────────────────────────────────

  const handleAddToFavorites = () => {
    if (!workspaceSlug) return;
    const addToFavoritePromise = addProjectToFavorites(workspaceSlug.toString(), project.id);
    setPromiseToast(addToFavoritePromise, {
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
    const removeFromFavoritePromise = removeProjectFromFavorites(workspaceSlug.toString(), project.id);
    setPromiseToast(removeFromFavoritePromise, {
      loading: "Removing project from favorites...",
      success: { title: "Success!", message: () => "Project removed from favorites." },
      error: { title: "Error!", message: () => "Couldn't remove the project from favorites. Please try again." },
    });
  };

  const projectLink = `${workspaceSlug}/projects/${project.id}/issues`;
  const handleCopyText = () =>
    copyUrlToClipboard(projectLink).then(() =>
      setToast({ type: TOAST_TYPE.INFO, title: "Link Copied!", message: "Project link copied to clipboard." })
    );
  const handleOpenInNewTab = () => window.open(`/${projectLink}`, "_blank");

  // ── Context menu items ────────────────────────────────────────────────────────

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
      action: () => setJoinProjectModal(true),
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
      action: () => setRestoreProject(true),
      title: "Restore",
      icon: ArchiveRestoreIcon,
      shouldRender: isArchived && hasAdminRole,
    },
    {
      key: "delete",
      action: () => setDeleteProjectModal(true),
      title: "Delete",
      icon: TrashIcon,
      shouldRender: isArchived && hasAdminRole,
    },
  ];

  // ── Render ────────────────────────────────────────────────────────────────────

  return (
    <>
      {/* Modals */}
      <DeleteProjectModal
        project={project}
        isOpen={deleteProjectModalOpen}
        onClose={() => setDeleteProjectModal(false)}
      />
      {workspaceSlug && (
        <JoinProjectModal
          workspaceSlug={workspaceSlug.toString()}
          project={project}
          isOpen={joinProjectModalOpen}
          handleClose={() => setJoinProjectModal(false)}
        />
      )}
      {workspaceSlug && project && (
        <ArchiveRestoreProjectModal
          workspaceSlug={workspaceSlug.toString()}
          projectId={project.id}
          isOpen={restoreProject}
          onClose={() => setRestoreProject(false)}
          archive={false}
        />
      )}

      {/* Card outer wrapper — provides border, shadow and `group/project-card` for hover effects */}
      <div
        ref={projectCardRef}
        className="group/project-card flex w-full flex-col justify-between overflow-hidden rounded-lg border border-subtle bg-layer-2 transition-all duration-300 hover:border-strong hover:shadow-raised-200"
      >
        <ContextMenu parentRef={projectCardRef} items={MENU_ITEMS} />

        <Link
          href={`/${workspaceSlug}/projects/${project.id}/issues`}
          onClick={(e) => {
            if (!isMemberOfProject || isArchived) {
              e.preventDefault();
              e.stopPropagation();
              if (!isArchived) setJoinProjectModal(true);
            }
          }}
          data-prevent-progress={!isMemberOfProject || isArchived}
          className="group/project-card flex w-full flex-col justify-between hover:cursor-pointer"
          draggable={false}
        >
          {/* ── Top: cover image + action buttons + name strip ── */}
          <div>
            {/* Cover image */}
            <div className="w-full rounded-t">
              <div className="relative">
                <div>
                  <CoverImage
                    src={project.cover_image_url}
                    alt={project.name}
                    className="relative h-[120px] w-full rounded-t object-cover"
                    draggable={false}
                  />
                  {/* Gradient — only on hover */}
                  <div className="absolute inset-0 z-[1] hidden rounded-sm bg-gradient-to-t from-transparent to-black/60 group-hover/project-card:flex" />
                </div>

                {/* Action buttons — top-right, hover-only */}
                {!isArchived && (
                  // eslint-disable-next-line jsx-a11y/no-static-element-interactions
                  <div
                    role="presentation"
                    className="absolute top-2 right-2 z-[10] flex gap-2"
                    data-prevent-progress
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                    }}
                  >
                    {/* 3-dot context menu */}
                    <CustomMenu
                      customButton={<MoreHorizontal className="size-4" />}
                      customButtonClassName="flex justify-center items-center opacity-0 z-[10] pointer-events-none flex-shrink-0 group-hover/project-card:opacity-100 group-hover/project-card:pointer-events-auto my-auto bg-white/30 rounded-sm h-6 w-6 text-on-color"
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

                    {/* Favorite star */}
                    {shouldRenderFavorite && (
                      <div data-prevent-progress>
                        <FavoriteStar
                          buttonClassName="place-items-center relative flex justify-center items-center opacity-0 z-[2] pointer-events-none flex-shrink-0 group-hover/project-card:opacity-100 group-hover/project-card:pointer-events-auto my-auto bg-white/30 rounded-sm h-6 w-6"
                          iconClassName={cn("h-4 w-4 transition-all", {
                            "text-on-color": !project.is_favorite,
                          })}
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
                  </div>
                )}
              </div>
            </div>

            {/* Project name + identifier — below image */}
            <div className="mt-3 flex h-10 w-full items-center justify-between gap-3 p-4">
              <div className="flex flex-grow items-center gap-2.5 truncate">
                {/* Logo / emoji */}
                <div className="grid h-9 w-9 flex-shrink-0 place-items-center rounded-sm bg-layer-1">
                  <Logo logo={project.logo_props} size={18} />
                </div>
                {/* Name + identifier */}
                <div className="flex w-full flex-col justify-between gap-0.5 truncate">
                  <div className="flex justify-between">
                    <h3 className="w-full truncate font-medium">{project.name}</h3>
                  </div>
                  <span className="flex items-center gap-1.5">
                    <p className="text-11 font-medium">{project.identifier}</p>
                    {project.network === 0 && <LockIcon className="h-2.5 w-2.5" />}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* ── Attributes strip ── */}
          {/* role="presentation" + onClick to stop link navigation when interacting with pickers */}
          {/* eslint-disable-next-line jsx-a11y/no-static-element-interactions */}
          <div
            role="presentation"
            className="flex flex-wrap gap-2 p-4"
            data-prevent-progress
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
            }}
          >
            {/* Project state — only when feature is enabled */}
            {projectStatesEnabled && (
              <div className="my-auto h-5" role="presentation">
                <ProjectStatePicker project={project} />
              </div>
            )}

            {/* Lead — clickable picker */}
            <div className="my-auto h-5">
              <ProjectLeadPicker project={project} />
            </div>

            {/* Members count */}
            <div className="my-auto h-5" role="presentation">
              <button type="button" disabled className="block h-full w-full cursor-not-allowed outline-none">
                <div className="flex h-full cursor-not-allowed items-center gap-2 rounded border-[0.5px] border-subtle-1 px-2 text-11 text-secondary hover:bg-layer-1">
                  <Users className="h-3 w-3 shrink-0" />
                  <span>{projectMembersIds.length}</span>
                </div>
              </button>
            </div>

            {/* Date range — clickable picker */}
            <div className="my-auto h-5">
              <ProjectDatePicker project={project} />
            </div>

            {/* Archived restore / delete actions */}
            {isArchived && hasAdminRole && (
              <>
                <button
                  type="button"
                  className="flex h-5 items-center gap-1 text-11 text-placeholder hover:text-secondary"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setRestoreProject(true);
                  }}
                >
                  <ArchiveRestoreIcon className="h-3.5 w-3.5" />
                  {t("workspace_projects.archived.restore")}
                </button>
                <button
                  type="button"
                  className="flex h-5 items-center justify-center text-11 text-placeholder hover:text-secondary"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setDeleteProjectModal(true);
                  }}
                >
                  <TrashIcon className="h-3.5 w-3.5" />
                </button>
              </>
            )}

            {/* Member/joined indicator for non-archived */}
            {!isArchived && isMemberOfProject && !(hasAdminRole || hasMemberRole) && (
              <span className="flex h-5 items-center gap-1 text-13 text-placeholder">
                <span className="h-3.5 w-3.5">✓</span>
                {t("workspace_projects.member.joined")}
              </span>
            )}

            {/* Settings link for admins/members */}
            {/*{!isArchived && isMemberOfProject && (hasAdminRole || hasMemberRole) && (*/}
            {/*  <Link*/}
            {/*    href={`/${workspaceSlug}/settings/projects/${project.id}`}*/}
            {/*    className="ml-auto flex items-center rounded-sm p-1 text-placeholder hover:bg-layer-1 hover:text-secondary"*/}
            {/*    onClick={(e) => e.stopPropagation()}*/}
            {/*  >*/}
            {/*    <Settings className="h-3.5 w-3.5" />*/}
            {/*  </Link>*/}
            {/*)}*/}

            {/* Join button for non-members */}
            {!isArchived && !isMemberOfProject && (
              <button
                type="button"
                className="ml-auto flex h-5 items-center text-13 font-semibold text-accent-primary hover:text-accent-primary/90"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setJoinProjectModal(true);
                }}
              >
                {t("common.join")}
              </button>
            )}
          </div>
        </Link>
      </div>
    </>
  );
});
