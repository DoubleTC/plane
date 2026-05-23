// Copyright (c) 2023-present Plane Software, Inc. and contributors
// SPDX-License-Identifier: AGPL-3.0-only

import { useState } from "react";
import { observer } from "mobx-react";
import Link from "next/link";
import { CalendarDays, X } from "lucide-react";
// plane imports
import { EUserPermissions, EUserPermissionsLevel } from "@plane/constants";
import { useTranslation } from "@plane/i18n";
import { CheckIcon } from "@plane/propel/icons";
import { TOAST_TYPE, setToast } from "@plane/propel/toast";
import { Tooltip } from "@plane/propel/tooltip";
import { CircularProgressIndicator } from "@plane/ui";
import { renderFormattedDate } from "@plane/utils";
// hooks
import { useCycle } from "@/hooks/store/use-cycle";
import { usePhase } from "@/hooks/store/use-phase";
import { useUserPermissions } from "@/hooks/store/user";
import { usePlatformOS } from "@/hooks/use-platform-os";

type Props = {
  workspaceSlug: string;
  projectId: string;
  phaseId: string;
};

export const PhaseCyclesList = observer(function PhaseCyclesList(props: Props) {
  const { workspaceSlug, projectId, phaseId } = props;
  // store hooks
  const { t } = useTranslation();
  const { getPhaseCyclesByPhaseId, removeCycleFromPhase } = usePhase();
  const { getCycleById } = useCycle();
  const { allowPermissions } = useUserPermissions();
  const { isMobile } = usePlatformOS();
  // local state for removing
  const [removingId, setRemovingId] = useState<string | null>(null);

  const phaseCycles = getPhaseCyclesByPhaseId(phaseId) ?? [];
  const isEditingAllowed = allowPermissions(
    [EUserPermissions.ADMIN, EUserPermissions.MEMBER],
    EUserPermissionsLevel.PROJECT
  );

  const handleRemove = async (phaseCycleId: string) => {
    setRemovingId(phaseCycleId);
    try {
      await removeCycleFromPhase(workspaceSlug, projectId, phaseId, phaseCycleId);
      setToast({ type: TOAST_TYPE.SUCCESS, title: t("phase.toast.cycle_removed") });
    } catch {
      setToast({ type: TOAST_TYPE.ERROR, title: t("phase.toast.cycle_remove_error") });
    } finally {
      setRemovingId(null);
    }
  };

  if (phaseCycles.length === 0)
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-20 text-center">
        <p className="text-14 text-tertiary">{t("phase.detail.no_cycles")}</p>
      </div>
    );

  return (
    <div className="space-y-2">
      {phaseCycles.map((pc) => {
        const cycle = getCycleById(pc.cycle);
        if (!cycle) return null;

        const totalIssues = cycle.total_issues ?? 0;
        const completedIssues = cycle.completed_issues ?? 0;
        const progress = totalIssues > 0 ? Math.floor((completedIssues / totalIssues) * 100) : 0;
        const isOverdue = cycle.end_date != null && new Date(cycle.end_date) < new Date() && progress < 100;

        return (
          <div
            key={pc.id}
            className="group flex items-center gap-3 rounded-md border border-subtle bg-surface-1 px-4 py-3 hover:bg-surface-2"
          >
            {/* Progress ring */}
            <CircularProgressIndicator size={32} percentage={progress} strokeWidth={3}>
              {progress === 100 ? (
                <CheckIcon className="h-3 w-3 stroke-[2] text-accent-primary" />
              ) : (
                <span className="text-[9px] text-tertiary">{progress}%</span>
              )}
            </CircularProgressIndicator>

            {/* Cycle name (link to cycle detail) */}
            <Link
              href={`/${workspaceSlug}/projects/${projectId}/cycles/${cycle.id}`}
              className="flex-1 truncate text-14 font-medium text-primary hover:underline"
            >
              {cycle.name}
            </Link>

            {/* Work items count */}
            <span className="hidden text-12 whitespace-nowrap text-tertiary sm:block">
              {completedIssues}/{totalIssues} {t("issues")}
            </span>

            {/* Date range */}
            {(cycle.start_date || cycle.end_date) && (
              <div
                className={`hidden items-center gap-1 text-12 whitespace-nowrap lg:flex ${
                  isOverdue ? "text-red-500" : "text-tertiary"
                }`}
              >
                <CalendarDays className="h-3.5 w-3.5 flex-shrink-0" />
                <span>
                  {cycle.start_date ? renderFormattedDate(cycle.start_date) : "—"}
                  {" → "}
                  {cycle.end_date ? renderFormattedDate(cycle.end_date) : "—"}
                </span>
              </div>
            )}

            {/* Remove button */}
            {isEditingAllowed && (
              <Tooltip isMobile={isMobile} tooltipContent={t("phase.detail.remove_cycle")} position="left">
                <button
                  type="button"
                  disabled={removingId === pc.id}
                  onClick={() => handleRemove(pc.id)}
                  className="hover:bg-red-500/10 hover:text-red-500 flex h-6 w-6 flex-shrink-0 items-center justify-center rounded opacity-0 transition-opacity group-hover:opacity-100 disabled:cursor-wait"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </Tooltip>
            )}
          </div>
        );
      })}
    </div>
  );
});
