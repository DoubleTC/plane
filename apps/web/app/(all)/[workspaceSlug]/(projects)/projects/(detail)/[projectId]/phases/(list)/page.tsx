// Copyright (c) 2023-present Plane Software, Inc. and contributors
// SPDX-License-Identifier: AGPL-3.0-only

import { useEffect } from "react";
import { observer } from "mobx-react";
import { EUserPermissionsLevel } from "@plane/constants";
import { useTranslation } from "@plane/i18n";
import { EUserProjectRoles } from "@plane/types";
import { PageHead } from "@/components/core/page-title";
import { CreateUpdatePhaseModal } from "@/components/phases/create-update-phase-modal";
import { PhasesListView } from "@/components/phases/phases-list-view";
import { usePhase } from "@/hooks/store/use-phase";
import { useProject } from "@/hooks/store/use-project";
import { useUserPermissions } from "@/hooks/store/user";
import { useAppRouter } from "@/hooks/use-app-router";
import type { Route } from "./+types/page";

function ProjectPhasesPage({ params }: Route.ComponentProps) {
  const { workspaceSlug, projectId } = params;
  const { t } = useTranslation();
  const { getProjectById, currentProjectDetails } = useProject();
  const { fetchPhases, getPhaseFetchStatusByProjectId, createPhaseModalOpen, toggleCreatePhaseModal } = usePhase();
  const { allowPermissions } = useUserPermissions();
  const router = useAppRouter();

  const project = getProjectById(projectId);
  const pageTitle = project?.name ? `${project.name} - ${t("phase.page_title")}` : undefined;
  const hasFetched = getPhaseFetchStatusByProjectId(projectId);
  const canSettings = allowPermissions([EUserProjectRoles.ADMIN], EUserPermissionsLevel.PROJECT);

  useEffect(() => {
    if (!hasFetched && workspaceSlug && projectId) {
      fetchPhases(workspaceSlug, projectId);
    }
  }, [workspaceSlug, projectId, hasFetched, fetchPhases]);

  if (currentProjectDetails?.phase_view === false)
    return (
      <div className="flex h-full w-full items-center justify-center">
        <div className="flex flex-col items-center gap-y-4 py-20 text-center">
          <p className="text-lg text-custom-text-200 font-semibold">{t("phase.disabled.title")}</p>
          <p className="text-sm text-custom-text-400 max-w-sm">{t("phase.disabled.description")}</p>
          {canSettings && (
            <button
              className="text-sm text-custom-primary-100 underline"
              onClick={() => router.push(`/${workspaceSlug}/settings/projects/${projectId}/features/phases`)}
            >
              {t("phase.disabled.cta")}
            </button>
          )}
        </div>
      </div>
    );

  return (
    <>
      <PageHead title={pageTitle} />
      <CreateUpdatePhaseModal
        isOpen={createPhaseModalOpen}
        onClose={() => toggleCreatePhaseModal(false)}
        workspaceSlug={workspaceSlug}
        projectId={projectId}
      />
      <PhasesListView />
    </>
  );
}

export default observer(ProjectPhasesPage);
