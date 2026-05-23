/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { observer } from "mobx-react";
import { useParams } from "next/navigation";
// plane imports
import { EUserPermissions, EUserPermissionsLevel } from "@plane/constants";
import { useTranslation } from "@plane/i18n";
import { EmptyStateDetailed } from "@plane/propel/empty-state";
import { EUserProjectRoles } from "@plane/types";
import { ContentWrapper, ERowVariant } from "@plane/ui";
// components
import { ListLayout } from "@/components/core/list";
import { MilestoneListItem } from "@/components/milestones/milestone-list-item";
import { CycleModuleListLayoutLoader } from "@/components/ui/loader/cycle-module-list-loader";
// hooks
import { useMilestone } from "@/hooks/store/use-milestone";
import { useUserPermissions } from "@/hooks/store/user";

export const MilestonesListView = observer(function MilestonesListView() {
  // router
  const { projectId } = useParams();
  // store hooks
  const { getProjectMilestoneIds, loader, toggleCreateMilestoneModal } = useMilestone();
  const { allowPermissions } = useUserPermissions();
  const { t } = useTranslation();

  const milestoneIds = getProjectMilestoneIds(projectId?.toString() ?? "");
  const canCreateMilestone = allowPermissions(
    [EUserProjectRoles.ADMIN, EUserProjectRoles.MEMBER],
    EUserPermissionsLevel.PROJECT
  );

  if (loader) return <CycleModuleListLayoutLoader />;

  if (!milestoneIds || milestoneIds.length === 0)
    return (
      <EmptyStateDetailed
        assetKey="module"
        title={t("milestone.empty_state.title")}
        description={t("milestone.empty_state.description")}
        actions={[
          {
            label: t("milestone.add_milestone"),
            onClick: () => toggleCreateMilestoneModal(true),
            disabled: !canCreateMilestone,
            variant: "primary",
          },
        ]}
      />
    );

  return (
    <ContentWrapper variant={ERowVariant.HUGGING}>
      <div className="flex size-full justify-between">
        <ListLayout>
          {milestoneIds.map((milestoneId) => (
            <MilestoneListItem key={milestoneId} milestoneId={milestoneId} />
          ))}
        </ListLayout>
      </div>
    </ContentWrapper>
  );
});
