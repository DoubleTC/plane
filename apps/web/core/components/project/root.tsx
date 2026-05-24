/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useCallback, useEffect } from "react";
import { observer } from "mobx-react";
import { useParams, usePathname } from "next/navigation";
// plane imports
import { useLocalStorage } from "@plane/hooks";
import { useTranslation } from "@plane/i18n";
import { EUserPermissions, EUserPermissionsLevel } from "@plane/constants";
import { EmptyStateDetailed } from "@plane/propel/empty-state";
import { ContentWrapper } from "@plane/ui";
import { calculateTotalFilters } from "@plane/utils";
import type { TProjectAppliedDisplayFilterKeys, TProjectFilters } from "@plane/types";
// components
import { PageHead } from "@/components/core/page-title";
import { ProjectsLoader } from "@/components/ui/loader/projects-loader";
// hooks
import { useCommandPalette } from "@/hooks/store/use-command-palette";
import { useProject } from "@/hooks/store/use-project";
import { useProjectFilter } from "@/hooks/store/use-project-filter";
import { useWorkspace } from "@/hooks/store/use-workspace";
import { useUserPermissions } from "@/hooks/store/user";
// local imports
import { ProjectAppliedFiltersList } from "./applied-filters";
import { PROJECT_VIEW_MODE_KEY, type TProjectViewMode } from "./views/types";
import { ProjectGalleryView } from "./views/gallery-view";
import { ProjectBoardView } from "./views/board-view";
import { ProjectListView } from "./views/list-view";
import { ProjectTimelineView } from "./views/timeline-view";

export const ProjectRoot = observer(function ProjectRoot() {
  const { currentWorkspace } = useWorkspace();
  const { workspaceSlug } = useParams();
  const pathname = usePathname();
  const { t } = useTranslation();

  // View mode from localStorage (shared with the header switcher)
  const { storedValue: viewMode } = useLocalStorage<TProjectViewMode>(PROJECT_VIEW_MODE_KEY, "gallery");
  const activeMode: TProjectViewMode = viewMode ?? "gallery";

  // Store hooks
  const { loader, fetchStatus, workspaceProjectIds, filteredProjectIds, getProjectById } = useProject();
  const {
    currentWorkspaceFilters,
    currentWorkspaceAppliedDisplayFilters,
    currentWorkspaceDisplayFilters,
    clearAllFilters,
    clearAllAppliedDisplayFilters,
    updateFilters,
    updateDisplayFilters,
  } = useProjectFilter();
  const { toggleCreateProjectModal } = useCommandPalette();
  const { allowPermissions } = useUserPermissions();

  const isArchived = pathname.includes("/archives");

  const pageTitle = currentWorkspace?.name
    ? `${currentWorkspace.name} - ${t("workspace_projects.label", { count: 2 })}`
    : undefined;

  const allowedDisplayFilters =
    currentWorkspaceAppliedDisplayFilters?.filter((filter) => filter !== "archived_projects") ?? [];

  const canPerformEmptyStateActions = allowPermissions(
    [EUserPermissions.ADMIN, EUserPermissions.MEMBER],
    EUserPermissionsLevel.WORKSPACE
  );

  const handleRemoveFilter = useCallback(
    (key: keyof TProjectFilters, value: string | null) => {
      if (!workspaceSlug) return;
      let newValues = currentWorkspaceFilters?.[key] ?? [];
      if (!value) newValues = [];
      else newValues = newValues.filter((val) => val !== value);
      updateFilters(workspaceSlug.toString(), { [key]: newValues });
    },
    [currentWorkspaceFilters, updateFilters, workspaceSlug]
  );

  const handleRemoveDisplayFilter = useCallback(
    (key: TProjectAppliedDisplayFilterKeys) => {
      if (!workspaceSlug) return;
      updateDisplayFilters(workspaceSlug.toString(), { [key]: false });
    },
    [updateDisplayFilters, workspaceSlug]
  );

  const handleClearAllFilters = useCallback(() => {
    if (!workspaceSlug) return;
    clearAllFilters(workspaceSlug.toString());
    clearAllAppliedDisplayFilters(workspaceSlug.toString());
    if (isArchived) updateDisplayFilters(workspaceSlug.toString(), { archived_projects: true });
  }, [clearAllFilters, clearAllAppliedDisplayFilters, isArchived, updateDisplayFilters, workspaceSlug]);

  useEffect(() => {
    updateDisplayFilters(workspaceSlug.toString(), { archived_projects: isArchived });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  // ── Loading / empty states ────────────────────────────────────────────────

  if (!filteredProjectIds || !workspaceProjectIds || loader === "init-loader" || fetchStatus !== "complete")
    return <ProjectsLoader />;

  if (workspaceProjectIds.length === 0 && !currentWorkspaceDisplayFilters?.archived_projects) {
    return (
      <EmptyStateDetailed
        title={t("workspace_projects.empty_state.general.title")}
        description={t("workspace_projects.empty_state.general.description")}
        assetKey="project"
        assetClassName="size-40"
        actions={[
          {
            label: t("workspace_projects.empty_state.general.primary_button.text"),
            onClick: () => toggleCreateProjectModal(true),
            disabled: !canPerformEmptyStateActions,
            variant: "primary",
          },
        ]}
      />
    );
  }

  if (filteredProjectIds.length === 0) {
    return (
      <EmptyStateDetailed
        title={
          currentWorkspaceDisplayFilters?.archived_projects &&
          calculateTotalFilters(currentWorkspaceFilters ?? {}) === 0
            ? t("workspace_empty_state.projects_archived.title")
            : t("common_empty_state.search.title")
        }
        description={
          currentWorkspaceDisplayFilters?.archived_projects &&
          calculateTotalFilters(currentWorkspaceFilters ?? {}) === 0
            ? t("workspace_empty_state.projects_archived.description")
            : t("common_empty_state.search.description")
        }
        assetKey={
          currentWorkspaceDisplayFilters?.archived_projects &&
          calculateTotalFilters(currentWorkspaceFilters ?? {}) === 0
            ? "archived-work-item"
            : "search"
        }
        assetClassName="size-40"
      />
    );
  }

  // ── Applied filters bar ───────────────────────────────────────────────────

  const filtersBar =
    calculateTotalFilters(currentWorkspaceFilters ?? {}) !== 0 || allowedDisplayFilters.length > 0 ? (
      <ProjectAppliedFiltersList
        appliedFilters={currentWorkspaceFilters ?? {}}
        appliedDisplayFilters={allowedDisplayFilters}
        handleClearAllFilters={handleClearAllFilters}
        handleRemoveFilter={handleRemoveFilter}
        handleRemoveDisplayFilter={handleRemoveDisplayFilter}
        filteredProjects={filteredProjectIds.length}
        totalProjects={workspaceProjectIds.length}
        alwaysAllowEditing
      />
    ) : null;

  // ── Board / Timeline need a h-full container without inner scroll re-wrap ──
  if (activeMode === "board" || activeMode === "timeline") {
    return (
      <>
        <PageHead title={pageTitle} />
        <div className="flex h-full w-full flex-col overflow-hidden">
          {filtersBar}
          <div className="min-h-0 flex-1 px-page-x py-4">
            {activeMode === "board" ? (
              <ProjectBoardView projectIds={filteredProjectIds} getProjectById={getProjectById} />
            ) : (
              <ProjectTimelineView projectIds={filteredProjectIds} getProjectById={getProjectById} />
            )}
          </div>
        </div>
      </>
    );
  }

  // ── Gallery / List use standard ContentWrapper scrolling ─────────────────
  return (
    <>
      <PageHead title={pageTitle} />
      <div className="flex h-full w-full flex-col">
        {filtersBar}
        <ContentWrapper>
          {activeMode === "list" ? (
            <ProjectListView projectIds={filteredProjectIds} getProjectById={getProjectById} />
          ) : (
            <ProjectGalleryView projectIds={filteredProjectIds} getProjectById={getProjectById} />
          )}
        </ContentWrapper>
      </div>
    </>
  );
});
