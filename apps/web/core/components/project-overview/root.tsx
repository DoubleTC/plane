/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useEffect, useState } from "react";
import { observer } from "mobx-react";
import { PanelRightOpen } from "lucide-react";
import { useTranslation } from "@plane/i18n";
import { Loader } from "@plane/ui";
import { useCycle } from "@/hooks/store/use-cycle";
import { useModule } from "@/hooks/store/use-module";
import { usePhase } from "@/hooks/store/use-phase";
import { useProject } from "@/hooks/store/use-project";
import { useWorkspace } from "@/hooks/store/use-workspace";
import { useWorkspaceProjectState } from "@/hooks/store/use-workspace-project-state";
import { ProjectOverviewHero } from "./hero";
import { MetricsModules } from "./metrics-modules";
import { MetricsOverall } from "./metrics-overall";
import { MetricsPhases } from "./metrics-phases";
import { ProjectOverviewRightSidebar } from "./right-sidebar";

type Props = {
  workspaceSlug: string;
  projectId: string;
};

/**
 * Root container for the Project Overview page. Owns the data-loading
 * lifecycle (cycles, phases, modules) and lays out hero + metrics sections.
 *
 * We deliberately keep this dumb: each section reads what it needs from the
 * MobX stores directly, so the root only needs to make sure those stores
 * have been hydrated.
 */
export const ProjectOverviewRoot = observer(function ProjectOverviewRoot({ workspaceSlug, projectId }: Props) {
  const { t } = useTranslation();
  // On mobile the right sidebar is an overlay; keep it closed by default so the main content is visible.
  const [isPropertiesOpen, setIsPropertiesOpen] = useState(false);
  const { getProjectById, currentProjectDetails } = useProject();
  const { fetchAllCycles } = useCycle();
  const { fetchPhases, getPhaseFetchStatusByProjectId } = usePhase();
  const { fetchModules } = useModule();
  const { currentWorkspace } = useWorkspace();
  const { fetchStates } = useWorkspaceProjectState();

  const project = getProjectById(projectId) ?? currentProjectDetails;
  const phasesFetched = getPhaseFetchStatusByProjectId(projectId);
  const projectStatesEnabled = !!currentWorkspace?.project_states_enabled;

  // Bootstrap stores. Each fetcher is idempotent on the store side; we
  // re-trigger whenever the project changes so navigating between projects
  // does not show stale data. (Overall state distribution is fetched
  // independently via SWR inside MetricsOverall.)
  useEffect(() => {
    if (!workspaceSlug || !projectId) return;
    fetchAllCycles(workspaceSlug, projectId).catch(() => undefined);
    fetchModules(workspaceSlug, projectId).catch(() => undefined);
    if (!phasesFetched) {
      fetchPhases(workspaceSlug, projectId).catch(() => undefined);
    }
    // Workspace project states power the State picker in the right sidebar.
    // The list endpoint isn't called automatically when entering the overview
    // page directly (e.g. via sidebar nav), so we trigger it here.
    if (projectStatesEnabled) {
      fetchStates(workspaceSlug).catch(() => undefined);
    }
  }, [
    workspaceSlug,
    projectId,
    phasesFetched,
    projectStatesEnabled,
    fetchAllCycles,
    fetchModules,
    fetchPhases,
    fetchStates,
  ]);

  if (!project) {
    return (
      <Loader className="h-full w-full p-8">
        <Loader.Item height="120px" />
        <Loader.Item height="60px" />
        <Loader.Item height="200px" />
      </Loader>
    );
  }

  return (
    <div className="relative flex h-full w-full overflow-hidden">
      <div className="flex h-full w-full flex-col overflow-y-auto">
        {/* Mobile-only trigger to reveal the right sidebar, which is an off-canvas overlay on small screens. */}
        <div className="mb-3 flex items-center justify-end px-4 pt-3 sm:hidden">
          <button
            type="button"
            onClick={() => setIsPropertiesOpen(true)}
            className="flex items-center gap-1.5 rounded-md border border-subtle bg-surface-1 px-2.5 py-1 text-13 font-medium text-secondary hover:bg-layer-transparent-hover"
          >
            <PanelRightOpen className="size-4" aria-hidden />
            {t("common.properties")}
          </button>
        </div>
        <ProjectOverviewHero project={project} />
        <div className="flex w-full flex-col px-10 py-8">
          <MetricsOverall workspaceSlug={workspaceSlug} projectId={projectId} />
          <MetricsPhases workspaceSlug={workspaceSlug} projectId={projectId} />
          <MetricsModules projectId={projectId} />
        </div>
      </div>
      <ProjectOverviewRightSidebar
        project={project}
        isMobileOpen={isPropertiesOpen}
        onMobileClose={() => setIsPropertiesOpen(false)}
      />
    </div>
  );
});
