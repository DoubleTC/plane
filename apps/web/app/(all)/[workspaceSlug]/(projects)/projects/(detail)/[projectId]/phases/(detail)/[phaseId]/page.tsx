// Copyright (c) 2023-present Plane Software, Inc. and contributors
// SPDX-License-Identifier: AGPL-3.0-only

import { observer } from "mobx-react";
import useSWR from "swr";
// plane imports
import { cn } from "@plane/utils";
// assets
import emptyPhase from "@/app/assets/empty-state/module.svg?url";
// components
import { EmptyState } from "@/components/common/empty-state";
import { PageHead } from "@/components/core/page-title";
import { PhaseDetailSidebar } from "@/components/phases/phase-detail-sidebar";
import { PhaseCyclesList } from "@/components/phases/phase-cycles-list";
// hooks
import { usePhase } from "@/hooks/store/use-phase";
import { useProject } from "@/hooks/store/use-project";
import { useAppRouter } from "@/hooks/use-app-router";
import useLocalStorage from "@/hooks/use-local-storage";
import type { Route } from "./+types/page";

function PhaseDetailPage({ params }: Route.ComponentProps) {
  const { workspaceSlug, projectId, phaseId } = params;
  // router
  const router = useAppRouter();
  // store hooks
  const { fetchPhaseDetails, fetchPhaseCycles, getPhaseById } = usePhase();
  const { getProjectById } = useProject();
  // sidebar state
  const { storedValue } = useLocalStorage("phase_detail_sidebar_collapsed", "false");
  const isSidebarCollapsed = storedValue === "true";

  // Fetch phase details
  const { error } = useSWR(`PHASE_DETAILS_${phaseId}`, () => fetchPhaseDetails(workspaceSlug, projectId, phaseId));

  // Fetch linked cycles (into phaseCyclesMap)
  useSWR(`PHASE_CYCLES_${phaseId}`, () => fetchPhaseCycles(workspaceSlug, projectId, phaseId));

  // derived values
  const phase = getPhaseById(phaseId);
  const project = getProjectById(projectId);
  const pageTitle = project?.name && phase?.name ? `${project.name} - ${phase.name}` : undefined;

  return (
    <>
      <PageHead title={pageTitle} />
      {error ? (
        <EmptyState
          image={emptyPhase}
          title="Phase does not exist"
          description="The phase you are looking for does not exist or has been deleted."
          primaryButton={{
            text: "View all phases",
            onClick: () => router.push(`/${workspaceSlug}/projects/${projectId}/phases`),
          }}
        />
      ) : (
        <div className="flex h-full w-full overflow-hidden">
          {/* Main content */}
          <div className="h-full w-full overflow-y-auto px-6 py-4">
            <PhaseCyclesList workspaceSlug={workspaceSlug} projectId={projectId} phaseId={phaseId} />
          </div>

          {/* Right sidebar */}
          {!isSidebarCollapsed && (
            <div
              className={cn(
                "vertical-scrollbar absolute right-0 z-13 flex scrollbar-sm h-full w-[24rem] flex-shrink-0 flex-col overflow-y-auto border-l border-subtle bg-surface-1 px-6 shadow-raised-200 duration-300"
              )}
            >
              <PhaseDetailSidebar
                phaseId={phaseId}
                handleClose={() => {
                  // The header controls the sidebar state via localStorage;
                  // writing "true" directly here as a fallback close.
                  localStorage.setItem("phase_detail_sidebar_collapsed", "true");
                  window.dispatchEvent(new Event("storage"));
                }}
              />
            </div>
          )}
        </div>
      )}
    </>
  );
}

export default observer(PhaseDetailPage);
