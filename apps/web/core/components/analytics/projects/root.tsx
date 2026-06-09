/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useEffect } from "react";
import { observer } from "mobx-react";
import { useParams } from "next/navigation";
import { useTranslation } from "@plane/i18n";
import { Loader } from "@plane/ui";
import { useAnalytics } from "@/hooks/store/use-analytics";
import { useProject } from "@/hooks/store/use-project";
import { useWorkspace } from "@/hooks/store/use-workspace";
import { useWorkspaceProjectState } from "@/hooks/store/use-workspace-project-state";
import AnalyticsWrapper from "../analytics-wrapper";
import { ProjectCard } from "./project-card";
import { isTodayWithin } from "./utils";

/**
 * Analytics → Projects tab. Lists the projects the current user is a member of
 * as collapsible cards; expanding one reveals its full BI dashboard (ProjectCard body).
 */
export const ProjectsAnalytics = observer(function ProjectsAnalytics() {
  const { t } = useTranslation();
  const params = useParams();
  const workspaceSlug = params.workspaceSlug?.toString();
  const { workspaceProjectIds, joinedProjectIds, loader, fetchStatus, fetchProjects, getProjectById } = useProject();
  const { selectedProjects } = useAnalytics();
  const { currentWorkspace } = useWorkspace();
  const { fetchStates } = useWorkspaceProjectState();
  const projectStatesEnabled = !!currentWorkspace?.project_states_enabled;

  // The workspace project list may have been hydrated from the *lite* endpoint,
  // which omits start_date/end_date — so the per-card date range would render
  // for some projects (detail already fetched) but not others. Pull the full
  // project details once so every card has the dates. The store merges, so this
  // only enriches existing entries.
  useEffect(() => {
    if (!workspaceSlug || fetchStatus === "complete") return;
    fetchProjects(workspaceSlug).catch(() => undefined);
  }, [workspaceSlug, fetchStatus, fetchProjects]);

  // Project states power the state label shown beside each project name; the
  // list endpoint isn't auto-called when landing on Analytics directly.
  useEffect(() => {
    if (!workspaceSlug || !projectStatesEnabled) return;
    fetchStates(workspaceSlug).catch(() => undefined);
  }, [workspaceSlug, projectStatesEnabled, fetchStates]);

  // Only the projects the current user is a member of (joinedProjectIds), then honor the header
  // "All projects" filter; when nothing is selected, show all joined ones. Order by start_date
  // descending (latest start first), with date-less projects sinking to the bottom.
  const orderedProjectIds = joinedProjectIds
    .filter((id) => selectedProjects.length === 0 || selectedProjects.includes(id))
    .slice()
    // eslint-disable-next-line no-array-sort-mutation -- operating on a copy
    .sort((a, b) => {
      const aStart = getProjectById(a)?.start_date ?? null;
      const bStart = getProjectById(b)?.start_date ?? null;
      if (!aStart && !bStart) return 0;
      if (!aStart) return 1;
      if (!bStart) return -1;
      return aStart < bStart ? 1 : aStart > bStart ? -1 : 0;
    });

  return (
    <AnalyticsWrapper i18nTitle="analytics_project.title">
      {!workspaceProjectIds || loader === "init-loader" ? (
        <Loader className="flex flex-col gap-3">
          <Loader.Item height="64px" />
          <Loader.Item height="64px" />
          <Loader.Item height="64px" />
        </Loader>
      ) : orderedProjectIds.length === 0 ? (
        <p className="text-13 text-placeholder">{t("analytics_project.no_projects")}</p>
      ) : (
        <div className="flex flex-col gap-3">
          {orderedProjectIds.map((projectId) => {
            const project = getProjectById(projectId);
            return (
              <ProjectCard
                key={projectId}
                workspaceSlug={workspaceSlug ?? ""}
                projectId={projectId}
                defaultOpen={isTodayWithin(project?.start_date, project?.end_date)}
              />
            );
          })}
        </div>
      )}
    </AnalyticsWrapper>
  );
});
