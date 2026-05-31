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
import { MetricsProgressBar } from "./metrics-progress-bar";
import { compareByStartDateAsc, completionPercent, formatDateRange, type TStateCounts } from "./metrics-utils";

// Cycle list response only ships total/completed/cancelled — we lazy-fetch
// the full per-state breakdown via the advance-analytics endpoint when a
// phase opens and its cycles become visible.
const projectOverviewService = new ProjectOverviewService();

type Props = {
  workspaceSlug: string;
  projectId: string;
};

/**
 * Phases section of Project Overview. Each phase is shown as its own card
 * with an aggregate state-distribution progress bar (summed from the cycles
 * it contains). Expanding a phase reveals one progress bar per cycle inside
 * it, using that cycle's individual state counts.
 *
 * Cycle membership comes from the per-phase fetch (`fetchPhaseCycles`) — we
 * kick that off for any phase that hasn't been hydrated yet so the user
 * sees real numbers without manually opening each phase first.
 */
export const MetricsPhases = observer(function MetricsPhases({ workspaceSlug, projectId }: Props) {
  const { t } = useTranslation();
  const { getProjectPhaseIds, getPhaseById, getPhaseCyclesByPhaseId, fetchPhaseCycles } = usePhase();
  const { getCycleById } = useCycle();

  const rawPhaseIds = getProjectPhaseIds(projectId) ?? [];
  // Sort phases by start_date ascending so the timeline reads top-to-bottom.
  // Phases without a start_date sink to the bottom.
  const phaseIds = rawPhaseIds
    .map((id) => ({ id, phase: getPhaseById(id) }))
    .filter((entry): entry is { id: string; phase: NonNullable<ReturnType<typeof getPhaseById>> } => !!entry.phase)
    .slice()
    // eslint-disable-next-line no-array-sort-mutation -- target is ES2022, no toSorted yet
    .sort((a, b) => compareByStartDateAsc(a.phase, b.phase))
    .map((entry) => entry.id);
  const phaseIdsKey = phaseIds.join(",");

  // Hydrate phase-cycle membership for any phase whose mapping is missing.
  useEffect(() => {
    for (const phaseId of phaseIds) {
      if (getPhaseCyclesByPhaseId(phaseId) === null) {
        fetchPhaseCycles(workspaceSlug, projectId, phaseId).catch(() => {
          // membership fetch failure is non-fatal — the phase card will show 0 cycles
        });
      }
    }
    // phaseIds intentionally tracked via stringified key to avoid identity churn
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phaseIdsKey, workspaceSlug, projectId, fetchPhaseCycles, getPhaseCyclesByPhaseId]);

  if (phaseIds.length === 0) {
    return (
      <div className="flex w-full flex-col gap-4 border-b border-subtle py-6 first:pt-0 last:border-0">
        <div className="flex items-center gap-3">
          <h3 className="text-14 font-medium text-tertiary">{t("common.phases")}</h3>
        </div>
        <p className="text-13 text-placeholder">{t("overview.no_phases")}</p>
      </div>
    );
  }

  return (
    <div className="flex w-full flex-col gap-4 border-b border-subtle py-6 first:pt-0 last:border-0">
      <div className="flex items-center gap-3">
        <h3 className="text-14 font-medium text-tertiary">{t("common.phases")}</h3>
      </div>
      <div className="space-y-3">
        {phaseIds.map((phaseId) => (
          <PhaseCard
            key={phaseId}
            workspaceSlug={workspaceSlug}
            projectId={projectId}
            phaseId={phaseId}
            getCycleById={getCycleById}
            getPhaseById={getPhaseById}
            getPhaseCyclesByPhaseId={getPhaseCyclesByPhaseId}
          />
        ))}
      </div>
    </div>
  );
});

type PhaseCardProps = {
  workspaceSlug: string;
  projectId: string;
  phaseId: string;
  getPhaseById: ReturnType<typeof usePhase>["getPhaseById"];
  getPhaseCyclesByPhaseId: ReturnType<typeof usePhase>["getPhaseCyclesByPhaseId"];
  getCycleById: ReturnType<typeof useCycle>["getCycleById"];
};

/**
 * One phase row: header (name + aggregate %) and expanded body showing one
 * progress bar per cycle in that phase.
 */
const PhaseCard = observer(function PhaseCard({
  workspaceSlug,
  projectId,
  phaseId,
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

  // Phase header shows CYCLE completion, not work-item completion. Backend
  // ships `total_cycles` and `completed_cycles` directly on the phase record.
  const totalCycles = phase.total_cycles ?? cycles.length;
  const completedCycles = phase.completed_cycles ?? 0;
  const remainingCycles = Math.max(totalCycles - completedCycles, 0);
  const phasePct = totalCycles > 0 ? Math.round((completedCycles / totalCycles) * 100) : 0;

  // Reuse MetricsProgressBar: it just renders coloured segments keyed by
  // TStateCounts fields. We map cycle counts onto the completed (green) and
  // backlog (neutral) slots so the bar shows progress vs. remaining.
  const phaseCycleCounts: TStateCounts = {
    backlog_issues: remainingCycles,
    unstarted_issues: 0,
    started_issues: 0,
    completed_issues: completedCycles,
    cancelled_issues: 0,
    total_issues: totalCycles,
  };

  return (
    <Disclosure defaultOpen={false}>
      {({ open }) => (
        <div className="rounded-lg border-[0.5px] border-subtle bg-surface-1 p-4 transition-shadow hover:shadow-raised-200">
          <Disclosure.Button className="flex w-full items-center justify-between gap-3 outline-none">
            <div className="flex min-w-0 flex-1 items-center gap-3">
              <ChevronDown
                className={cn("size-3.5 shrink-0 text-tertiary transition-transform", open ? "" : "-rotate-90")}
                aria-hidden
              />
              <div className="flex min-w-0 flex-col text-left">
                <span className="truncate text-13 font-medium text-primary">{phase.name}</span>
                {phaseDateRange && <span className="truncate text-10 text-tertiary">{phaseDateRange}</span>}
              </div>
            </div>
            <span className="shrink-0 text-11 text-tertiary">
              {t("overview.cycle_completion_summary", {
                completed: completedCycles,
                total: totalCycles,
                percent: phasePct,
              })}
            </span>
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
                <p className="text-11 text-placeholder">{t("phase.detail.no_cycles")}</p>
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
};

/**
 * Single cycle row inside a phase. Renders a label + 5-state progress bar
 * for the work items attached to this cycle. The breakdown is fetched on
 * demand via SWR (the cycle list endpoint doesn't ship the full per-state
 * counts — only total/completed/cancelled — so we hit advance-analytics
 * scoped to `cycle_id`). SWR dedupes and caches automatically.
 */
const CycleRow = ({ workspaceSlug, projectId, cycleId, cycleName, cycleStartDate, cycleEndDate }: CycleRowProps) => {
  const { t } = useTranslation();
  const { data } = useSWR(["cycleStateDistribution", workspaceSlug, projectId, cycleId], () =>
    projectOverviewService.getCycleStateDistribution(workspaceSlug, projectId, cycleId)
  );
  const cycleDateRange = formatDateRange(cycleStartDate, cycleEndDate);

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
    <div className="mb-2 flex flex-col gap-1.5 border-b border-subtle-1 pb-3">
      <div className="flex items-center justify-between gap-2">
        <div className="flex min-w-0 flex-col">
          <span className="truncate text-11 text-secondary">{cycleName}</span>
          {cycleDateRange && <span className="truncate text-10 text-placeholder">{cycleDateRange}</span>}
        </div>
        <span className="shrink-0 text-11 text-tertiary">
          {t("overview.completion_summary", {
            completed: counts.completed_issues,
            total: counts.total_issues,
            percent: pct,
          })}
        </span>
      </div>
      <MetricsProgressBar counts={counts} heightClassName="h-2" />
    </div>
  );
};
