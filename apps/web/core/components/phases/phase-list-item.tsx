// Copyright (c) 2023-present Plane Software, Inc. and contributors
// SPDX-License-Identifier: AGPL-3.0-only

import { useRef } from "react";
import { observer } from "mobx-react";
import { useParams } from "next/navigation";
// plane imports
import { CheckIcon } from "@plane/propel/icons";
import { CircularProgressIndicator } from "@plane/ui";
// components
import { ListItem } from "@/components/core/list";
import { PhaseListItemAction } from "@/components/phases/phase-list-item-action";
import { PhaseQuickActions } from "@/components/phases/phase-quick-actions";
// hooks
import { usePhase } from "@/hooks/store/use-phase";
import { usePlatformOS } from "@/hooks/use-platform-os";

type Props = { phaseId: string };

export const PhaseListItem = observer(function PhaseListItem(props: Props) {
  const { phaseId } = props;
  const parentRef = useRef<HTMLDivElement>(null);
  const { workspaceSlug, projectId } = useParams();
  const { getPhaseById } = usePhase();
  const { isMobile } = usePlatformOS();

  const phase = getPhaseById(phaseId);
  if (!phase) return null;

  const progress = phase.total_cycles > 0 ? Math.floor((phase.completed_cycles / phase.total_cycles) * 100) : 0;

  return (
    <ListItem
      title={phase.name}
      itemLink={`/${workspaceSlug}/projects/${projectId}/phases/${phaseId}`}
      prependTitleElement={
        <CircularProgressIndicator size={30} percentage={progress} strokeWidth={3}>
          {progress === 100 ? (
            <CheckIcon className="h-3 w-3 stroke-[2] text-accent-primary" />
          ) : (
            <span className="text-9 text-tertiary">{progress}%</span>
          )}
        </CircularProgressIndicator>
      }
      actionableItems={<PhaseListItemAction phaseId={phaseId} phase={phase} parentRef={parentRef} />}
      quickActionElement={
        workspaceSlug && projectId ? (
          <div className="block md:hidden">
            <PhaseQuickActions
              parentRef={parentRef}
              phaseId={phaseId}
              projectId={projectId.toString()}
              workspaceSlug={workspaceSlug.toString()}
            />
          </div>
        ) : undefined
      }
      isMobile={isMobile}
      parentRef={parentRef}
    />
  );
});
