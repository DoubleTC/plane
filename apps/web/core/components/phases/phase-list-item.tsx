// Copyright (c) 2023-present Plane Software, Inc. and contributors
// SPDX-License-Identifier: AGPL-3.0-only

import { useRef } from "react";
import { observer } from "mobx-react";
import { useParams } from "next/navigation";
// icons
import { CalendarDays } from "lucide-react";
// plane imports
import { useTranslation } from "@plane/i18n";
import { CheckIcon } from "@plane/propel/icons";
import { CircularProgressIndicator } from "@plane/ui";
import { renderFormattedDate } from "@plane/utils";
// components
import { ListItem } from "@/components/core/list";
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
  const { t } = useTranslation();

  const phase = getPhaseById(phaseId);
  if (!phase) return null;

  const progress = phase.total_cycles > 0 ? Math.floor((phase.completed_cycles / phase.total_cycles) * 100) : 0;

  const isOverdue = phase.end_date != null && new Date(phase.end_date) < new Date() && progress < 100;

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
      actionableItems={
        <>
          {phase.archived_at && (
            <span className="bg-custom-background-80 text-xs text-custom-text-300 rounded px-1.5 py-0.5 whitespace-nowrap">
              {t("common.archived")}
            </span>
          )}

          {/* Cycle count */}
          <div className="text-xs text-custom-text-300 flex items-center gap-x-1 whitespace-nowrap">
            <span>
              {phase.completed_cycles}/{phase.total_cycles}
            </span>
            <span>{t("phase.cycles_label")}</span>
          </div>

          {/* Date range */}
          {(phase.start_date || phase.end_date) && (
            <div
              className={`text-xs flex items-center gap-x-1 whitespace-nowrap ${isOverdue ? "text-red-500" : "text-custom-text-300"}`}
            >
              <CalendarDays className="h-3.5 w-3.5 flex-shrink-0" />
              <span>
                {phase.start_date ? renderFormattedDate(phase.start_date) : "—"}
                {" → "}
                {phase.end_date ? renderFormattedDate(phase.end_date) : "—"}
              </span>
            </div>
          )}

          {/* Quick actions — desktop */}
          {workspaceSlug && projectId && (
            <div className="hidden md:block">
              <PhaseQuickActions
                parentRef={parentRef}
                phaseId={phaseId}
                projectId={projectId.toString()}
                workspaceSlug={workspaceSlug.toString()}
              />
            </div>
          )}
        </>
      }
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
