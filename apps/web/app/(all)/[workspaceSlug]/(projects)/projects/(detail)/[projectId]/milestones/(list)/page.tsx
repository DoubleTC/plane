/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useEffect } from "react";
import { observer } from "mobx-react";
// plane imports
import { EUserPermissionsLevel } from "@plane/constants";
import { useTranslation } from "@plane/i18n";
import { EUserProjectRoles } from "@plane/types";
// components
import { PageHead } from "@/components/core/page-title";
import { CreateUpdateMilestoneModal } from "@/components/milestones/create-update-milestone-modal";
import { MilestonesListView } from "@/components/milestones";
// hooks
import { useMilestone } from "@/hooks/store/use-milestone";
import { useProject } from "@/hooks/store/use-project";
import { useUserPermissions } from "@/hooks/store/user";
import { useAppRouter } from "@/hooks/use-app-router";
import type { Route } from "./+types/page";

function ProjectMilestonesPage({ params }: Route.ComponentProps) {
  const { workspaceSlug, projectId } = params;
  // plane hooks
  const { t } = useTranslation();
  // store
  const { getProjectById, currentProjectDetails } = useProject();
  const {
    fetchMilestones,
    getMilestoneFetchStatusByProjectId,
    createMilestoneModalOpen,
    toggleCreateMilestoneModal,
  } = useMilestone();
  const { allowPermissions } = useUserPermissions();
  const router = useAppRouter();

  // derived values
  const project = getProjectById(projectId);
  const pageTitle = project?.name ? `${project.name} - ${t("milestone.page_title")}` : undefined;
  const hasFetched = getMilestoneFetchStatusByProjectId(projectId);
  const canPerformEmptyStateActions = allowPermissions([EUserProjectRoles.ADMIN], EUserPermissionsLevel.PROJECT);

  // Fetch milestones on mount
  useEffect(() => {
    if (!hasFetched && workspaceSlug && projectId) {
      fetchMilestones(workspaceSlug, projectId);
    }
  }, [workspaceSlug, projectId, hasFetched, fetchMilestones]);

  // Feature gate
  if (currentProjectDetails?.milestone_view === false)
    return (
      <div className="flex h-full w-full items-center justify-center">
        <div className="flex flex-col items-center gap-y-4 py-20 text-center">
          <p className="text-lg text-custom-text-200 font-semibold">{t("milestone.disabled.title")}</p>
          <p className="text-sm text-custom-text-400 max-w-sm">{t("milestone.disabled.description")}</p>
          {canPerformEmptyStateActions && (
            <button
              className="text-sm text-custom-primary-100 underline"
              onClick={() => router.push(`/${workspaceSlug}/settings/projects/${projectId}/features`)}
            >
              {t("milestone.disabled.cta")}
            </button>
          )}
        </div>
      </div>
    );

  return (
    <>
      <PageHead title={pageTitle} />
      <CreateUpdateMilestoneModal
        isOpen={createMilestoneModalOpen}
        onClose={() => toggleCreateMilestoneModal(false)}
        workspaceSlug={workspaceSlug}
        projectId={projectId}
      />
      <MilestonesListView />
    </>
  );
}

export default observer(ProjectMilestonesPage);
