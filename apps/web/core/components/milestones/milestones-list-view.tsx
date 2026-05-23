/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useState } from "react";
import { observer } from "mobx-react";
import { useParams } from "next/navigation";
// icons
import { Plus } from "lucide-react";
// plane imports
import { useTranslation } from "@plane/i18n";
import { Button, Loader } from "@plane/ui";
// components
import { CreateUpdateMilestoneModal } from "@/components/milestones/create-update-milestone-modal";
import { MilestoneListItem } from "@/components/milestones/milestone-list-item";
// hooks
import { useMilestone } from "@/hooks/store/use-milestone";
import { useUserPermissions } from "@/hooks/store/user";
import { EUserPermissions, EUserPermissionsLevel } from "@plane/constants";

export const MilestonesListView = observer(function MilestonesListView() {
  // states
  const [createModal, setCreateModal] = useState(false);
  // router
  const { workspaceSlug, projectId } = useParams();
  // store hooks
  const { getProjectMilestoneIds, loader } = useMilestone();
  const { allowPermissions } = useUserPermissions();
  const { t } = useTranslation();

  const milestoneIds = getProjectMilestoneIds(projectId?.toString() ?? "");

  const canCreateMilestone = allowPermissions(
    [EUserPermissions.ADMIN, EUserPermissions.MEMBER],
    EUserPermissionsLevel.PROJECT,
    workspaceSlug?.toString(),
    projectId?.toString()
  );

  return (
    <>
      <CreateUpdateMilestoneModal
        isOpen={createModal}
        onClose={() => setCreateModal(false)}
        workspaceSlug={workspaceSlug?.toString() ?? ""}
        projectId={projectId?.toString() ?? ""}
      />

      <div className="flex h-full flex-col">
        {/* Header */}
        <div className="border-custom-border-200 flex items-center justify-between border-b px-6 py-4">
          <h2 className="text-lg text-custom-text-100 font-semibold">{t("milestone.page_title")}</h2>
          {canCreateMilestone && (
            <Button
              variant="primary"
              size="sm"
              prependIcon={<Plus className="h-4 w-4" />}
              onClick={() => setCreateModal(true)}
            >
              {t("milestone.add_milestone")}
            </Button>
          )}
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          {loader ? (
            <Loader className="flex flex-col gap-y-3">
              <Loader.Item height="60px" />
              <Loader.Item height="60px" />
              <Loader.Item height="60px" />
            </Loader>
          ) : !milestoneIds || milestoneIds.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center gap-y-3 py-20">
              <p className="text-sm text-custom-text-400 text-center">{t("milestone.empty_state.title")}</p>
              <p className="text-xs text-custom-text-400 text-center">{t("milestone.empty_state.description")}</p>
              {canCreateMilestone && (
                <Button
                  variant="neutral-primary"
                  size="sm"
                  prependIcon={<Plus className="h-4 w-4" />}
                  onClick={() => setCreateModal(true)}
                >
                  {t("milestone.add_milestone")}
                </Button>
              )}
            </div>
          ) : (
            <div className="flex flex-col gap-y-2">
              {milestoneIds.map((milestoneId) => (
                <MilestoneListItem key={milestoneId} milestoneId={milestoneId} />
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  );
});
