/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useState } from "react";
import { observer } from "mobx-react";
import useSWR from "swr";
// plane imports
import { EUserPermissions, EUserPermissionsLevel } from "@plane/constants";
import { useTranslation } from "@plane/i18n";
// components
import { NotAuthorizedView } from "@/components/auth-screens/not-authorized-view";
import { PageHead } from "@/components/core/page-title";
import { SettingsHeading } from "@/components/settings/heading";
import { SettingsContentWrapper } from "@/components/settings/content-wrapper";
import { RolesList } from "@/components/roles";
import { SchemesList } from "@/components/roles";
// hooks
import { useRoles } from "@/hooks/store/use-roles";
import { useWorkspace } from "@/hooks/store/use-workspace";
import { useUserPermissions } from "@/hooks/store/user";
// local imports
import type { Route } from "./+types/page";
import { RolesWorkspaceSettingsHeader } from "./header";

type ScopeTab = "workspace" | "project";
type ContentTab = "roles" | "schemes";

function RolesSettingsPage({ params }: Route.ComponentProps) {
  const { workspaceSlug } = params;
  const { t } = useTranslation();

  const { workspaceUserInfo, allowPermissions } = useUserPermissions();
  const { currentWorkspace } = useWorkspace();
  const { fetchRoles, fetchSchemes } = useRoles();

  const [scopeTab, setScopeTab] = useState<ScopeTab>("workspace");
  const [contentTab, setContentTab] = useState<ContentTab>("roles");

  const canAdmin = allowPermissions([EUserPermissions.ADMIN], EUserPermissionsLevel.WORKSPACE);

  // Fetch roles and schemes for the current scope
  useSWR(
    canAdmin ? `ROLES_LIST_${workspaceSlug}_${scopeTab}` : null,
    canAdmin ? () => fetchRoles(workspaceSlug, scopeTab) : null
  );
  useSWR(
    canAdmin ? `SCHEMES_LIST_${workspaceSlug}_${scopeTab}` : null,
    canAdmin ? () => fetchSchemes(workspaceSlug, scopeTab) : null
  );

  const pageTitle = currentWorkspace?.name
    ? `${currentWorkspace.name} - ${t("workspace_settings.settings.roles.title")}`
    : undefined;

  if (workspaceUserInfo && !canAdmin) {
    return <NotAuthorizedView section="settings" className="h-auto" />;
  }

  return (
    <SettingsContentWrapper header={<RolesWorkspaceSettingsHeader />}>
      <PageHead title={pageTitle} />

      <SettingsHeading
        title={t("workspace_settings.settings.roles.title")}
        description={t("workspace_settings.settings.roles.description")}
      />

      <div className="mt-6">
        {/* Scope tabs: Workspace / Project */}
        <div className="border-custom-border-200 bg-custom-background-80 mb-6 flex w-fit gap-1 rounded-lg border p-1">
          {(["workspace", "project"] as ScopeTab[]).map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => setScopeTab(tab)}
              className={`text-sm rounded-md px-4 py-1.5 font-medium transition-colors ${
                scopeTab === tab
                  ? "bg-custom-background-100 text-custom-text-100 shadow-sm"
                  : "text-custom-text-300 hover:text-custom-text-200"
              }`}
            >
              {tab === "workspace"
                ? t("workspace_settings.settings.roles.role.scope_workspace")
                : t("workspace_settings.settings.roles.role.scope_project")}
            </button>
          ))}
        </div>

        {/* Content tabs: Roles / Schemes */}
        <div className="border-custom-border-200 mb-6 border-b">
          <div className="flex gap-6">
            {(["roles", "schemes"] as ContentTab[]).map((tab) => (
              <button
                key={tab}
                type="button"
                onClick={() => setContentTab(tab)}
                className={`text-sm -mb-px border-b-2 pb-3 font-medium transition-colors ${
                  contentTab === tab
                    ? "border-custom-primary-100 text-custom-primary-100"
                    : "text-custom-text-300 hover:text-custom-text-200 border-transparent"
                }`}
              >
                {tab === "roles"
                  ? t("workspace_settings.settings.roles.roles_tab")
                  : t("workspace_settings.settings.roles.schemes_tab")}
              </button>
            ))}
          </div>
        </div>

        {/* Content */}
        {contentTab === "roles" ? (
          <RolesList workspaceSlug={workspaceSlug} scope={scopeTab} />
        ) : (
          <SchemesList workspaceSlug={workspaceSlug} scope={scopeTab} />
        )}
      </div>
    </SettingsContentWrapper>
  );
}

export default observer(RolesSettingsPage);
