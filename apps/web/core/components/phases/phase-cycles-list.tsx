// Copyright (c) 2023-present Plane Software, Inc. and contributors
// SPDX-License-Identifier: AGPL-3.0-only

import { observer } from "mobx-react";
// plane imports
import { useTranslation } from "@plane/i18n";
import { ContentWrapper, ERowVariant } from "@plane/ui";
// components
import { ListLayout } from "@/components/core/list";
import { CyclePeekOverview } from "@/components/cycles/cycle-peek-overview";
import { CyclesListMap } from "@/components/cycles/list/cycles-list-map";
// hooks
import { usePhase } from "@/hooks/store/use-phase";

type Props = {
  workspaceSlug: string;
  projectId: string;
  phaseId: string;
};

export const PhaseCyclesList = observer(function PhaseCyclesList(props: Props) {
  const { workspaceSlug, projectId, phaseId } = props;
  const { t } = useTranslation();
  const { getPhaseCyclesByPhaseId } = usePhase();

  const phaseCycles = getPhaseCyclesByPhaseId(phaseId) ?? [];
  const cycleIds = phaseCycles.map((pc) => pc.cycle);

  if (cycleIds.length === 0) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-14 text-tertiary">{t("phase.detail.no_cycles")}</p>
      </div>
    );
  }

  return (
    <ContentWrapper variant={ERowVariant.HUGGING} className="flex-row">
      <ListLayout>
        <CyclesListMap cycleIds={cycleIds} projectId={projectId} workspaceSlug={workspaceSlug} />
      </ListLayout>
      <CyclePeekOverview projectId={projectId} workspaceSlug={workspaceSlug} />
    </ContentWrapper>
  );
});
