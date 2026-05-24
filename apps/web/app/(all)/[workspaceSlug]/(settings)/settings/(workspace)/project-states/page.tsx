/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { observer } from "mobx-react";
import useSWR from "swr";
// plane imports
import { EUserPermissions, EUserPermissionsLevel } from "@plane/constants";
import { useTranslation } from "@plane/i18n";
// components
import { NotAuthorizedView } from "@/components/auth-screens/not-authorized-view";
import { PageHead } from "@/components/core/page-title";
import { SettingsContentWrapper } from "@/components/settings/content-wrapper";
import { ProjectStatesRoot } from "@/components/workspace/settings/project-states/root";
// hooks
import { useWorkspace } from "@/hooks/store/use-workspace";
import { useWorkspaceProjectState } from "@/hooks/store/use-workspace-project-state";
import { useUserPermissions } from "@/hooks/store/user";
// local imports
import type { Route } from "./+types/page";
import { ProjectStatesWorkspaceSettingsHeader } from "./header";

function ProjectStatesSettingsPage({ params }: Route.ComponentProps) {
  const { workspaceSlug } = params;
  const { t } = useTranslation();

  const { workspaceUserInfo, allowPermissions } = useUserPermissions();
  const { currentWorkspace } = useWorkspace();
  const { fetchStates } = useWorkspaceProjectState();

  const canAdmin = allowPermissions([EUserPermissions.ADMIN], EUserPermissionsLevel.WORKSPACE);

  // Fetch states when feature is enabled
  useSWR(
    canAdmin && currentWorkspace?.project_states_enabled ? `WORKSPACE_PROJECT_STATES_${workspaceSlug}` : null,
    canAdmin && currentWorkspace?.project_states_enabled ? () => fetchStates(workspaceSlug) : null
  );

  const pageTitle = currentWorkspace?.name
    ? `${currentWorkspace.name} - ${t("workspace_settings.settings.project_states.title")}`
    : undefined;

  if (workspaceUserInfo && !canAdmin) {
    return <NotAuthorizedView section="settings" className="h-auto" />;
  }

  return (
    <SettingsContentWrapper header={<ProjectStatesWorkspaceSettingsHeader />}>
      <PageHead title={pageTitle} />
      <ProjectStatesRoot workspaceSlug={workspaceSlug} />
    </SettingsContentWrapper>
  );
}

export default observer(ProjectStatesSettingsPage);
