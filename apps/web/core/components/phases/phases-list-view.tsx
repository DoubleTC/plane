// Copyright (c) 2023-present Plane Software, Inc. and contributors
// SPDX-License-Identifier: AGPL-3.0-only

import { observer } from "mobx-react";
import { useParams } from "next/navigation";
// plane imports
import { EUserPermissions, EUserPermissionsLevel } from "@plane/constants";
import { useTranslation } from "@plane/i18n";
import { EmptyStateDetailed } from "@plane/propel/empty-state";
import { ContentWrapper, ERowVariant } from "@plane/ui";
// components
import { ListLayout } from "@/components/core/list";
import { PhaseListItem } from "@/components/phases/phase-list-item";
import { CycleModuleListLayoutLoader } from "@/components/ui/loader/cycle-module-list-loader";
// hooks
import { usePhase } from "@/hooks/store/use-phase";
import { useUserPermissions } from "@/hooks/store/user";

export const PhasesListView = observer(function PhasesListView() {
  const { projectId } = useParams();
  const { getProjectPhaseIds, loader, toggleCreatePhaseModal } = usePhase();
  const { allowPermissions } = useUserPermissions();
  const { t } = useTranslation();

  const phaseIds = getProjectPhaseIds(projectId?.toString() ?? "");
  const canCreate = allowPermissions([EUserPermissions.ADMIN, EUserPermissions.MEMBER], EUserPermissionsLevel.PROJECT);

  if (loader) return <CycleModuleListLayoutLoader />;

  if (!phaseIds || phaseIds.length === 0)
    return (
      <EmptyStateDetailed
        assetKey="module"
        title={t("phase.empty_state.title")}
        description={t("phase.empty_state.description")}
        actions={[
          {
            label: t("phase.add_phase"),
            onClick: () => toggleCreatePhaseModal(true),
            disabled: !canCreate,
            variant: "primary",
          },
        ]}
      />
    );

  return (
    <ContentWrapper variant={ERowVariant.HUGGING}>
      <div className="flex size-full justify-between">
        <ListLayout>
          {phaseIds.map((id) => (
            <PhaseListItem key={id} phaseId={id} />
          ))}
        </ListLayout>
      </div>
    </ContentWrapper>
  );
});
