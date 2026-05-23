/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { observer } from "mobx-react";
import Link from "next/link";
import { useParams } from "next/navigation";
// ui
import { MODULE_STATUS } from "@plane/constants";
import { ModuleStatusIcon } from "@plane/propel/icons";
import { Tooltip } from "@plane/propel/tooltip";
// components
import { SIDEBAR_WIDTH } from "@/components/gantt-chart/constants";
import { getBlockViewDetails } from "@/components/issues/issue-layouts/utils";
// hooks
import { usePhase } from "@/hooks/store/use-phase";
import { useAppRouter } from "@/hooks/use-app-router";
import { usePlatformOS } from "@/hooks/use-platform-os";

type Props = {
  phaseId: string;
};

export const PhaseGanttBlock = observer(function PhaseGanttBlock(props: Props) {
  const { phaseId } = props;
  // router
  const router = useAppRouter();
  const { workspaceSlug } = useParams();
  // store hooks
  const { getPhaseById } = usePhase();
  // derived values
  const phaseDetails = getPhaseById(phaseId);
  // hooks
  const { isMobile } = usePlatformOS();

  // getBlockViewDetails expects target_date; IPhase uses end_date — adapt here
  const blockData = phaseDetails
    ? { start_date: phaseDetails.start_date, target_date: phaseDetails.end_date }
    : undefined;
  const { message, blockStyle } = getBlockViewDetails(
    blockData,
    MODULE_STATUS.find((s) => s.value === phaseDetails?.status)?.color ?? ""
  );

  return (
    <Tooltip
      isMobile={isMobile}
      tooltipContent={
        <div className="space-y-1">
          <h5>{phaseDetails?.name}</h5>
          <div>{message}</div>
        </div>
      }
      position="top-start"
    >
      <button
        type="button"
        className="relative flex h-full w-full cursor-pointer items-center rounded-sm"
        style={blockStyle}
        onClick={() =>
          router.push(`/${workspaceSlug?.toString()}/projects/${phaseDetails?.project}/phases/${phaseDetails?.id}`)
        }
      >
        <div className="absolute top-0 left-0 h-full w-full bg-surface-1/50" />
        <div
          className="sticky w-auto truncate overflow-hidden px-2.5 py-1 text-13 text-primary"
          style={{ left: `${SIDEBAR_WIDTH}px` }}
        >
          {phaseDetails?.name}
        </div>
      </button>
    </Tooltip>
  );
});

export const PhaseGanttSidebarBlock = observer(function PhaseGanttSidebarBlock(props: Props) {
  const { phaseId } = props;
  const { workspaceSlug } = useParams();
  // store hooks
  const { getPhaseById } = usePhase();
  // derived values
  const phaseDetails = getPhaseById(phaseId);

  return (
    <Link
      className="relative flex h-full w-full items-center gap-2"
      href={`/${workspaceSlug?.toString()}/projects/${phaseDetails?.project}/phases/${phaseDetails?.id}`}
      draggable={false}
    >
      <ModuleStatusIcon status={phaseDetails?.status ?? "backlog"} height="16px" width="16px" />
      <h6 className="flex-grow truncate text-13 font-medium">{phaseDetails?.name}</h6>
    </Link>
  );
});
