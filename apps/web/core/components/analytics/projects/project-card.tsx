/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useEffect, type ReactNode } from "react";
import { observer } from "mobx-react";
import useSWR from "swr";
import { ChevronDown } from "lucide-react";
import { Disclosure, Transition } from "@headlessui/react";
import { useTranslation } from "@plane/i18n";
import { Loader } from "@plane/ui";
import { cn } from "@plane/utils";
import { useCycle } from "@/hooks/store/use-cycle";
import { useModule } from "@/hooks/store/use-module";
import { usePhase } from "@/hooks/store/use-phase";
import { useProject } from "@/hooks/store/use-project";
import { useWorkspaceProjectState } from "@/hooks/store/use-workspace-project-state";
import { ProjectAnalyticsService } from "@/services/project/project-analytics.service";
import { formatDateRange } from "../../project-overview/metrics-utils";
import { MembersTable } from "./members-table";
import { ModulesProgress } from "./modules-progress";
import { PhasesProgress } from "./phases-progress";
import { ScheduleDonut } from "./schedule-donut";
import { StateBreakdown } from "./state-breakdown";
import { SummaryStats } from "./summary-stats";
import { deriveStateCounts } from "./utils";

const projectAnalyticsService = new ProjectAnalyticsService();

type Props = {
  workspaceSlug: string;
  projectId: string;
};

type ProjectCardProps = Props & {
  /** Expand on mount — used to auto-open projects currently in progress. */
  defaultOpen?: boolean;
};

/**
 * A single collapsible project row in the Analytics → Projects tab. The
 * collapsed header stays cheap (name + date range, both already in the project
 * store); the heavy aggregate fetch + store hydration happen only once the card
 * is expanded (the Disclosure panel unmounts when closed).
 */
export const ProjectCard = observer(function ProjectCard({
  workspaceSlug,
  projectId,
  defaultOpen = false,
}: ProjectCardProps) {
  const { getProjectById } = useProject();
  const { getStateById } = useWorkspaceProjectState();
  const project = getProjectById(projectId);

  if (!project) return null;

  const dateRange = formatDateRange(project.start_date, project.end_date);
  const projectState = project.project_status ? getStateById(project.project_status) : undefined;

  return (
    <Disclosure defaultOpen={defaultOpen}>
      {({ open }) => (
        <div className="rounded-lg border-[0.5px] border-subtle bg-surface-1 transition-shadow hover:shadow-raised-200">
          <Disclosure.Button className="flex w-full items-center justify-between gap-3 p-4 outline-none">
            <div className="flex min-w-0 flex-1 items-center gap-3">
              <ChevronDown
                className={cn("size-4 shrink-0 text-tertiary transition-transform", open ? "" : "-rotate-90")}
                aria-hidden
              />
              <div className="flex min-w-0 flex-col text-left">
                <div className="flex min-w-0 items-center gap-2">
                  <span className="truncate text-14 font-semibold text-primary">{project.name}</span>
                  {projectState && (
                    <span
                      className="flex shrink-0 items-center gap-1 rounded-sm border-[0.5px] border-subtle px-1.5 py-0.5 text-11 font-medium text-secondary"
                      style={{ borderColor: `${projectState.color}66` }}
                    >
                      <span className="size-2 shrink-0 rounded-full" style={{ backgroundColor: projectState.color }} />
                      {projectState.name}
                    </span>
                  )}
                </div>
                {dateRange && <span className="truncate text-12 text-tertiary">{dateRange}</span>}
              </div>
            </div>
          </Disclosure.Button>

          <Transition
            show={open}
            enter="transition-opacity duration-200 ease-out"
            enterFrom="opacity-0"
            enterTo="opacity-100"
            leave="transition-opacity duration-100 ease-in"
            leaveFrom="opacity-100"
            leaveTo="opacity-0"
          >
            <Disclosure.Panel className="border-t border-subtle px-4 pt-4 pb-5">
              <ProjectCardBody workspaceSlug={workspaceSlug} projectId={projectId} />
            </Disclosure.Panel>
          </Transition>
        </div>
      )}
    </Disclosure>
  );
});

const Section = ({ title, children, className }: { title: string; children: ReactNode; className?: string }) => (
  <section className={cn("flex flex-col gap-3", className)}>
    <h3 className="text-14 font-semibold text-tertiary">{title}</h3>
    {children}
  </section>
);

const ProjectCardBody = observer(function ProjectCardBody({ workspaceSlug, projectId }: Props) {
  const { t } = useTranslation();
  const { fetchAllCycles, getProjectCycleIds } = useCycle();
  const { fetchModules, getProjectModuleIds } = useModule();
  const { fetchPhases, getProjectPhaseIds, getPhaseFetchStatusByProjectId } = usePhase();

  const phasesFetched = getPhaseFetchStatusByProjectId(projectId);

  // Hydrate the stores that feed the phase / module / cycle sections, scoped to
  // this project. Mirrors the Project Overview root bootstrap.
  useEffect(() => {
    if (!workspaceSlug || !projectId) return;
    fetchAllCycles(workspaceSlug, projectId).catch(() => undefined);
    fetchModules(workspaceSlug, projectId).catch(() => undefined);
    if (!phasesFetched) {
      fetchPhases(workspaceSlug, projectId).catch(() => undefined);
    }
  }, [workspaceSlug, projectId, phasesFetched, fetchAllCycles, fetchModules, fetchPhases]);

  const { data, isLoading } = useSWR(
    workspaceSlug && projectId ? ["projectAnalyticsOverview", workspaceSlug, projectId] : null,
    () => projectAnalyticsService.getProjectAnalyticsOverview(workspaceSlug, projectId)
  );

  if (isLoading || !data) {
    return (
      <Loader className="flex flex-col gap-4">
        <Loader.Item height="90px" />
        <Loader.Item height="160px" />
        <Loader.Item height="160px" />
      </Loader>
    );
  }

  const counts = deriveStateCounts(data.state_breakdown);
  const memberCount = data.members.length;
  const moduleCount = (getProjectModuleIds(projectId) ?? []).length;
  const phaseCount = (getProjectPhaseIds(projectId) ?? []).length;
  const cycleCount = (getProjectCycleIds(projectId) ?? []).length;

  return (
    <div className="flex flex-col gap-8">
      <SummaryStats
        counts={counts}
        schedule={data.schedule}
        memberCount={memberCount}
        moduleCount={moduleCount}
        phaseCount={phaseCount}
        cycleCount={cycleCount}
      />

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-5">
        <Section title={t("analytics_project.section.status")} className="lg:col-span-2">
          <ScheduleDonut schedule={data.schedule} />
        </Section>
        <Section title={t("analytics_project.section.work_items")} className="lg:col-span-3">
          <StateBreakdown counts={counts} breakdown={data.state_breakdown} />
        </Section>
      </div>

      <Section title={t("analytics_project.section.phases")}>
        <PhasesProgress workspaceSlug={workspaceSlug} projectId={projectId} cycleSchedule={data.cycle_schedule} />
      </Section>

      <Section title={t("analytics_project.section.modules")}>
        <ModulesProgress projectId={projectId} moduleSchedule={data.module_schedule} />
      </Section>

      <Section title={t("analytics_project.section.members")}>
        <MembersTable members={data.members} />
      </Section>
    </div>
  );
});
