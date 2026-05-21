/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { observer } from "mobx-react";
import { Link } from "react-router";
// plane imports
import { WORKSPACE_SETTINGS } from "@plane/constants";
import { useTranslation } from "@plane/i18n";
import { Breadcrumbs } from "@plane/ui";
// components
import { BreadcrumbLink } from "@/components/common/breadcrumb-link";
import { SettingsPageHeader } from "@/components/settings/page-header";
import { WORKSPACE_SETTINGS_ICONS } from "@/components/settings/workspace/sidebar/item-icon";

interface Props {
  workspaceSlug: string;
  roleName?: string;
}

export const RoleDetailWorkspaceSettingsHeader = observer(function RoleDetailWorkspaceSettingsHeader({
  workspaceSlug,
  roleName,
}: Props) {
  const { t } = useTranslation();
  const settingsDetails = WORKSPACE_SETTINGS.roles;
  const Icon = WORKSPACE_SETTINGS_ICONS.roles;

  return (
    <SettingsPageHeader
      leftItem={
        <div className="flex items-center gap-2">
          <Breadcrumbs>
            <Breadcrumbs.Item
              component={
                <Link to={`/${workspaceSlug}/settings/roles`}>
                  <BreadcrumbLink
                    label={t(settingsDetails.i18n_label)}
                    icon={<Icon className="size-4 text-tertiary" />}
                  />
                </Link>
              }
            />
            {roleName && <Breadcrumbs.Item component={<BreadcrumbLink label={roleName} />} />}
          </Breadcrumbs>
        </div>
      }
    />
  );
});
