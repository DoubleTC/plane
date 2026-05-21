/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { observer } from "mobx-react";
import useSWR from "swr";
// plane imports
import { EUserPermissions, EUserPermissionsLevel } from "@plane/constants";
// components
import { NotAuthorizedView } from "@/components/auth-screens/not-authorized-view";
import { LogoSpinner } from "@/components/common/logo-spinner";
import { PageHead } from "@/components/core/page-title";
import { SettingsContentWrapper } from "@/components/settings/content-wrapper";
import { RoleDetail } from "@/components/roles";
// hooks
import { useRoles } from "@/hooks/store/use-roles";
import { useWorkspace } from "@/hooks/store/use-workspace";
import { useUserPermissions } from "@/hooks/store/user";
// local imports
import type { Route } from "./+types/page";
import { RoleDetailWorkspaceSettingsHeader } from "./header";

function RoleDetailPage({ params }: Route.ComponentProps) {
  const { workspaceSlug, roleId } = params;

  const { workspaceUserInfo, allowPermissions } = useUserPermissions();
  const { currentWorkspace } = useWorkspace();
  const { fetchRole, getRoleById } = useRoles();

  const canAdmin = allowPermissions([EUserPermissions.ADMIN], EUserPermissionsLevel.WORKSPACE);

  useSWR(
    canAdmin && roleId ? `ROLE_DETAIL_${workspaceSlug}_${roleId}` : null,
    canAdmin && roleId ? () => fetchRole(workspaceSlug, roleId) : null
  );

  const role = getRoleById(roleId);

  const pageTitle = role && currentWorkspace?.name ? `${currentWorkspace.name} - ${role.name}` : undefined;

  if (workspaceUserInfo && !canAdmin) {
    return <NotAuthorizedView section="settings" className="h-auto" />;
  }

  if (!role) {
    return (
      <div className="flex h-full items-center justify-center">
        <LogoSpinner />
      </div>
    );
  }

  return (
    <SettingsContentWrapper
      header={<RoleDetailWorkspaceSettingsHeader workspaceSlug={workspaceSlug} roleName={role.name} />}
    >
      <PageHead title={pageTitle} />
      <RoleDetail workspaceSlug={workspaceSlug} role={role} />
    </SettingsContentWrapper>
  );
}

export default observer(RoleDetailPage);
