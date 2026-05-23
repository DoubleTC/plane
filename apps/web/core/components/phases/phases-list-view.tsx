// Copyright (c) 2023-present Plane Software, Inc. and contributors
// SPDX-License-Identifier: AGPL-3.0-only

import { observer } from "mobx-react";
import { useParams } from "next/navigation";
// plane imports
import { EUserPermissions, EUserPermissionsLevel } from "@plane/constants";
import { useTranslation } from "@plane/i18n";
import { EmptyStateDetailed } from "@plane/propel/empty-state";
import { ContentWrapper, Row, ERowVariant } from "@plane/ui";
// components
import { ListLayout } from "@/components/core/list";
import { PhaseCardItem } from "@/components/phases/phase-card-item";
import { PhaseListItem } from "@/components/phases/phase-list-item";
import { PhasesListGanttChartView } from "@/components/phases/gantt-chart/phases-list-layout";
import { CycleModuleBoardLayoutLoader } from "@/components/ui/loader/cycle-module-board-loader";
import { CycleModuleListLayoutLoader } from "@/components/ui/loader/cycle-module-list-loader";
import { GanttLayoutLoader } from "@/components/ui/loader/layouts/gantt-layout-loader";
// hooks
import { usePhase } from "@/hooks/store/use-phase";
import { usePhaseFilter } from "@/hooks/store/use-phase-filter";
import { useUserPermissions } from "@/hooks/store/user";

export const PhasesListView = observer(function PhasesListView() {
  const { projectId } = useParams();
  const { getProjectPhaseIds, loader, toggleCreatePhaseModal } = usePhase();
  const { currentProjectDisplayFilters: displayFilters } = usePhaseFilter();
  const { allowPermissions } = useUserPermissions();
  const { t } = useTranslation();

  const phaseIds = getProjectPhaseIds(projectId?.toString() ?? "");
  const canCreate = allowPermissions([EUserPermissions.ADMIN, EUserPermissions.MEMBER], EUserPermissionsLevel.PROJECT);

  if (loader)
    return (
      <>
        {displayFilters?.layout === "list" && <CycleModuleListLayoutLoader />}
        {displayFilters?.layout === "board" && <CycleModuleBoardLayoutLoader />}
        {displayFilters?.layout === "gantt" && <GanttLayoutLoader />}
        {!displayFilters?.layout && <CycleModuleListLayoutLoader />}
      </>
    );

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
        {displayFilters?.layout === "board" ? (
          <Row className="3xl:grid-cols-4 vertical-scrollbar grid scrollbar-lg size-full auto-rows-max grid-cols-1 gap-6 overflow-y-auto py-page-y transition-all lg:grid-cols-2 xl:grid-cols-3">
            {phaseIds.map((id) => (
              <PhaseCardItem key={id} phaseId={id} />
            ))}
          </Row>
        ) : displayFilters?.layout === "gantt" ? (
          <div className="size-full overflow-hidden">
            <PhasesListGanttChartView />
          </div>
        ) : (
          <ListLayout>
            {phaseIds.map((id) => (
              <PhaseListItem key={id} phaseId={id} />
            ))}
          </ListLayout>
        )}
      </div>
    </ContentWrapper>
  );
});
