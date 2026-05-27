// Copyright (c) 2023-present Plane Software, Inc. and contributors
// SPDX-License-Identifier: AGPL-3.0-only

import { observer } from "mobx-react";
import { useTranslation } from "@plane/i18n";
import { PageHead } from "@/components/core/page-title";
import { ProjectOverviewRoot } from "@/components/project-overview/root";
import { useProject } from "@/hooks/store/use-project";
import type { Route } from "./+types/page";

function ProjectOverviewPage({ params }: Route.ComponentProps) {
  const { workspaceSlug, projectId } = params;
  const { t } = useTranslation();
  const { getProjectById } = useProject();

  const project = getProjectById(projectId);
  const pageTitle = project?.name ? `${project.name} - ${t("sidebar.overview")}` : undefined;

  return (
    <>
      <PageHead title={pageTitle} />
      <ProjectOverviewRoot workspaceSlug={workspaceSlug} projectId={projectId} />
    </>
  );
}

export default observer(ProjectOverviewPage);
