/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { observer } from "mobx-react";
import { useParams } from "next/navigation";
// icons
import { Milestone } from "lucide-react";
// plane imports
import { EUserPermissions, EUserPermissionsLevel } from "@plane/constants";
import { useTranslation } from "@plane/i18n";
import { Button } from "@plane/propel/button";
import { Breadcrumbs, Header } from "@plane/ui";
// components
import { BreadcrumbLink } from "@/components/common/breadcrumb-link";
// hooks
import { useMilestone } from "@/hooks/store/use-milestone";
import { useProject } from "@/hooks/store/use-project";
import { useUserPermissions } from "@/hooks/store/user";
import { useAppRouter } from "@/hooks/use-app-router";
// plane web imports
import { CommonProjectBreadcrumbs } from "@/plane-web/components/breadcrumbs/common";

export const MilestonesListHeader = observer(function MilestonesListHeader() {
  // router
  const router = useAppRouter();
  const { workspaceSlug, projectId } = useParams();
  // store hooks
  const { loader } = useProject();
  const { toggleCreateMilestoneModal } = useMilestone();
  const { allowPermissions } = useUserPermissions();
  const { t } = useTranslation();

  // auth
  const canCreateMilestone = allowPermissions(
    [EUserPermissions.ADMIN, EUserPermissions.MEMBER],
    EUserPermissionsLevel.PROJECT
  );

  return (
    <Header>
      <Header.LeftItem>
        <Breadcrumbs onBack={router.back} isLoading={loader === "init-loader"}>
          <CommonProjectBreadcrumbs workspaceSlug={workspaceSlug?.toString()} projectId={projectId?.toString()} />
          <Breadcrumbs.Item
            component={
              <BreadcrumbLink
                label={t("milestone.page_title")}
                href={`/${workspaceSlug}/projects/${projectId}/milestones/`}
                icon={<Milestone className="h-4 w-4 text-tertiary" />}
                isLast
              />
            }
            isLast
          />
        </Breadcrumbs>
      </Header.LeftItem>
      {canCreateMilestone && (
        <Header.RightItem>
          <Button
            variant="primary"
            size="lg"
            onClick={() => toggleCreateMilestoneModal(true)}
          >
            <div className="block sm:hidden">{t("add")}</div>
            <div className="hidden sm:block">{t("milestone.add_milestone")}</div>
          </Button>
        </Header.RightItem>
      )}
    </Header>
  );
});
