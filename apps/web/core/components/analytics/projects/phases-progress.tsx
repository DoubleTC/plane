/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useEffect } from "react";
import { observer } from "mobx-react";
import useSWR from "swr";
import { ChevronDown } from "lucide-react";
import { Disclosure, Transition } from "@headlessui/react";
import { useTranslation } from "@plane/i18n";
import { cn } from "@plane/utils";
import { useCycle } from "@/hooks/store/use-cycle";
import { usePhase } from "@/hooks/store/use-phase";
import { ProjectOverviewService } from "@/services/project/project-overview.service";
import type { TScheduleBuckets } from "@/services/project/project-analytics.service";
import { MetricsProgressBar } from "../../project-overview/metrics-progress-bar";
import {
  compareByStartDateAsc,
  completionPercent,
  formatDateRange,
  type TStateCounts,
} from "../../project-overview/metrics-utils";
import { RatingBadge, sumSchedules } from "./rating";
import { isTodayWithin } from "./utils";

const projectOverviewService = new ProjectOverviewService();

type Props = {
  workspaceSlug: string;
  projectId: string;
  cycleSchedule: Record<string, TScheduleBuckets>;
};

/**
 * Item 11 — phase → cycle progress, mirroring the Project Overview phases
 * section but adding a timeliness rating badge per phase/cycle and a "current"
 * highlight on whichever phase/cycle contains today's date.
 */
export const PhasesProgress = observer(function PhasesProgress({ workspaceSlug, projectId, cycleSchedule }: Props) {
  const { t } = useTranslation();
  const { getProjectPhaseIds, getPhaseById, getPhaseCyclesByPhaseId, fetchPhaseCycles } = usePhase();
  const { getCycleById } = useCycle();

  const phaseIds = (getProjectPhaseIds(projectId) ?? [])
    .map((id) => ({ id, phase: getPhaseById(id) }))
    .filter((entry): entry is { id: string; phase: NonNullable<ReturnType<typeof getPhaseById>> } => !!entry.phase)
    .slice()
    // eslint-disable-next-line no-array-sort-mutation -- target is ES2022, no toSorted yet
    .sort((a, b) => compareByStartDateAsc(a.phase, b.phase))
    .map((entry) => entry.id);
  const phaseIdsKey = phaseIds.join(",");

  // Ensure each phase's cycle membership is hydrated so ratings/highlights work.
  useEffect(() => {
    for (const phaseId of phaseIds) {
      if (getPhaseCyclesByPhaseId(phaseId) === null) {
        fetchPhaseCycles(workspaceSlug, projectId, phaseId).catch(() => undefined);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phaseIdsKey, workspaceSlug, projectId, fetchPhaseCycles, getPhaseCyclesByPhaseId]);

  if (phaseIds.length === 0) {
    return <p className="text-12 text-placeholder">{t("overview.no_phases")}</p>;
  }

  return (
    <div className="space-y-3">
      {phaseIds.map((phaseId) => (
        <PhaseCard
          key={phaseId}
          workspaceSlug={workspaceSlug}
          projectId={projectId}
          phaseId={phaseId}
          cycleSchedule={cycleSchedule}
          getCycleById={getCycleById}
          getPhaseById={getPhaseById}
          getPhaseCyclesByPhaseId={getPhaseCyclesByPhaseId}
        />
      ))}
    </div>
  );
});

type PhaseCardProps = {
  workspaceSlug: string;
  projectId: string;
  phaseId: string;
  cycleSchedule: Record<string, TScheduleBuckets>;
  getPhaseById: ReturnType<typeof usePhase>["getPhaseById"];
  getPhaseCyclesByPhaseId: ReturnType<typeof usePhase>["getPhaseCyclesByPhaseId"];
  getCycleById: ReturnType<typeof useCycle>["getCycleById"];
};

const PhaseCard = observer(function PhaseCard({
  workspaceSlug,
  projectId,
  phaseId,
  cycleSchedule,
  getPhaseById,
  getPhaseCyclesByPhaseId,
  getCycleById,
}: PhaseCardProps) {
  const { t } = useTranslation();
  const phase = getPhaseById(phaseId);
  const phaseCycles = getPhaseCyclesByPhaseId(phaseId) ?? [];
  const cycles = phaseCycles
    .map((pc) => getCycleById(pc.cycle))
    .filter((c): c is NonNullable<ReturnType<typeof getCycleById>> => !!c)
    .slice()
    // eslint-disable-next-line no-array-sort-mutation -- target is ES2022, no toSorted yet
    .sort(compareByStartDateAsc);

  if (!phase) return null;

  const phaseDateRange = formatDateRange(phase.start_date, phase.end_date);
  // Phase rating rolls up the timeliness of all its cycles.
  const phaseSchedule = sumSchedules(cycles.map((c) => cycleSchedule[c.id]));
  const isCurrent = isTodayWithin(phase.start_date, phase.end_date);

  const totalCycles = phase.total_cycles ?? cycles.length;
  const completedCycles = phase.completed_cycles ?? 0;
  const remainingCycles = Math.max(totalCycles - completedCycles, 0);
  const phaseCycleCounts: TStateCounts = {
    backlog_issues: remainingCycles,
    unstarted_issues: 0,
    started_issues: 0,
    completed_issues: completedCycles,
    cancelled_issues: 0,
    total_issues: totalCycles,
  };

  return (
    <Disclosure defaultOpen={isCurrent}>
      {({ open }) => (
        <div
          className={cn(
            "rounded-lg border-[0.5px] border-subtle bg-surface-1 p-4 transition-shadow hover:shadow-raised-200",
            isCurrent && "border-accent-strong ring-1 ring-accent-subtle"
          )}
        >
          <Disclosure.Button className="flex w-full items-center justify-between gap-3 outline-none">
            <div className="flex min-w-0 flex-1 items-center gap-3">
              <ChevronDown
                className={cn("size-3.5 shrink-0 text-tertiary transition-transform", open ? "" : "-rotate-90")}
                aria-hidden
              />
              <div className="flex min-w-0 flex-col text-left">
                <div className="flex items-center gap-2">
                  <span className="truncate text-13 font-medium text-primary">{phase.name}</span>
                  {isCurrent && (
                    <span className="shrink-0 rounded-sm bg-accent-subtle px-1 text-11 text-accent-primary">
                      {t("analytics_project.current")}
                    </span>
                  )}
                </div>
                {phaseDateRange && <span className="truncate text-11 text-tertiary">{phaseDateRange}</span>}
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <RatingBadge schedule={phaseSchedule} />
              <span className="text-12 text-tertiary">
                {t("overview.cycle_completion_summary", {
                  completed: completedCycles,
                  total: totalCycles,
                  percent: totalCycles > 0 ? Math.round((completedCycles / totalCycles) * 100) : 0,
                })}
              </span>
            </div>
          </Disclosure.Button>

          <div className="mt-3">
            <MetricsProgressBar counts={phaseCycleCounts} />
          </div>

          <Transition
            show={open}
            enter="transition-opacity duration-200 ease-out"
            enterFrom="opacity-0"
            enterTo="opacity-100"
            leave="transition-opacity duration-100 ease-in"
            leaveFrom="opacity-100"
            leaveTo="opacity-0"
          >
            <Disclosure.Panel className="mt-4 border-t border-subtle-1 pt-3">
              {cycles.length === 0 ? (
                <p className="text-12 text-placeholder">{t("phase.detail.no_cycles")}</p>
              ) : (
                <div className="space-y-3">
                  {cycles.map((cycle) => (
                    <CycleRow
                      key={cycle.id}
                      workspaceSlug={workspaceSlug}
                      projectId={projectId}
                      cycleId={cycle.id}
                      cycleName={cycle.name}
                      cycleStartDate={cycle.start_date}
                      cycleEndDate={cycle.end_date}
                      schedule={cycleSchedule[cycle.id]}
                    />
                  ))}
                </div>
              )}
            </Disclosure.Panel>
          </Transition>
        </div>
      )}
    </Disclosure>
  );
});

type CycleRowProps = {
  workspaceSlug: string;
  projectId: string;
  cycleId: string;
  cycleName: string;
  cycleStartDate?: string | null;
  cycleEndDate?: string | null;
  schedule?: TScheduleBuckets;
};

const CycleRow = ({
  workspaceSlug,
  projectId,
  cycleId,
  cycleName,
  cycleStartDate,
  cycleEndDate,
  schedule,
}: CycleRowProps) => {
  const { t } = useTranslation();
  const { data } = useSWR(["cycleStateDistribution", workspaceSlug, projectId, cycleId], () =>
    projectOverviewService.getCycleStateDistribution(workspaceSlug, projectId, cycleId)
  );
  const cycleDateRange = formatDateRange(cycleStartDate, cycleEndDate);
  const isCurrent = isTodayWithin(cycleStartDate, cycleEndDate);

  const counts: TStateCounts = {
    backlog_issues: data?.backlog ?? 0,
    unstarted_issues: data?.unstarted ?? 0,
    started_issues: data?.started ?? 0,
    completed_issues: data?.completed ?? 0,
    cancelled_issues: data?.cancelled ?? 0,
    total_issues: data?.total ?? 0,
  };
  const pct = completionPercent(counts);

  return (
    <div
      className={cn(
        // Keep identical box metrics whether or not the row is highlighted so
        // the labels/progress bars stay aligned across rows; the highlight only
        // adds a background tint.
        "mb-2 flex flex-col gap-1.5 rounded-md border-b border-subtle-1 px-2 pt-1.5 pb-3",
        isCurrent && "bg-accent-subtle/40"
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex min-w-0 flex-col">
          <div className="flex items-center gap-2">
            <span className="truncate text-12 text-secondary">{cycleName}</span>
            {isCurrent && (
              <span className="shrink-0 rounded-sm bg-accent-subtle px-1 text-11 text-accent-primary">
                {t("analytics_project.current")}
              </span>
            )}
          </div>
          {cycleDateRange && <span className="truncate text-11 text-placeholder">{cycleDateRange}</span>}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <RatingBadge schedule={schedule} />
          <span className="text-12 text-tertiary">
            {t("overview.completion_summary", {
              completed: counts.completed_issues,
              total: counts.total_issues,
              percent: pct,
            })}
          </span>
        </div>
      </div>
      <MetricsProgressBar counts={counts} heightClassName="h-2" />
    </div>
  );
};
