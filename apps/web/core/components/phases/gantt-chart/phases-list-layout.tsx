/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { observer } from "mobx-react";
import { useParams } from "next/navigation";
// Plane
import { GANTT_TIMELINE_TYPE } from "@plane/types";
import type { IBlockUpdateData, IBlockUpdateDependencyData } from "@plane/types";
// components
import { GanttChartRoot } from "@/components/gantt-chart";
import { TimeLineTypeContext } from "@/components/gantt-chart/contexts";
import { PhaseGanttBlock } from "@/components/phases/gantt-chart/blocks";
import { PhaseGanttSidebar } from "@/components/gantt-chart/sidebar/phases/sidebar";
// hooks
import { usePhase } from "@/hooks/store/use-phase";
import { useProject } from "@/hooks/store/use-project";

export const PhasesListGanttChartView = observer(function PhasesListGanttChartView() {
  // router
  const { workspaceSlug, projectId } = useParams();
  // store
  const { currentProjectDetails } = useProject();
  const { getProjectPhaseIds, updatePhase } = usePhase();

  // derived values
  const phaseIds = projectId ? getProjectPhaseIds(projectId.toString()) : undefined;

  const handlePhaseUpdate = async (phase: any, data: IBlockUpdateData) => {
    if (!workspaceSlug || !phase) return;

    const payload: any = {};
    if (data.sort_order) payload.sort_order = data.sort_order.newSortOrder;
    if (data.start_date) payload.start_date = data.start_date;
    // gantt returns target_date; IPhase uses end_date
    if (data.target_date) payload.end_date = data.target_date;

    // block.data has project_id (mapped from IPhase.project in PhasesTimeLineStore)
    await updatePhase(workspaceSlug.toString(), phase.project_id, phase.id, payload);
  };

  const updateBlockDates = async (blockUpdates: IBlockUpdateDependencyData[]) => {
    const blockUpdate = blockUpdates[0];
    if (!blockUpdate || !projectId) return;

    const payload: Record<string, string> = {};
    if (blockUpdate.start_date) payload.start_date = blockUpdate.start_date;
    // gantt returns target_date; IPhase uses end_date
    if (blockUpdate.target_date) payload.end_date = blockUpdate.target_date;

    await updatePhase(workspaceSlug.toString(), projectId.toString(), blockUpdate.id, payload);
  };

  const isAllowed = currentProjectDetails?.member_role === 20 || currentProjectDetails?.member_role === 15;

  if (!phaseIds) return null;

  return (
    <TimeLineTypeContext.Provider value={GANTT_TIMELINE_TYPE.PHASE}>
      <GanttChartRoot
        title="Phases"
        loaderTitle="Phases"
        blockIds={phaseIds}
        sidebarToRender={(props) => <PhaseGanttSidebar {...props} />}
        blockUpdateHandler={(block, payload) => handlePhaseUpdate(block, payload)}
        blockToRender={(data: any) => <PhaseGanttBlock phaseId={data.id} />}
        enableBlockLeftResize={isAllowed}
        enableBlockRightResize={isAllowed}
        enableBlockMove={isAllowed}
        enableReorder={isAllowed}
        enableAddBlock={isAllowed}
        updateBlockDates={updateBlockDates}
        showAllBlocks
      />
    </TimeLineTypeContext.Provider>
  );
});
