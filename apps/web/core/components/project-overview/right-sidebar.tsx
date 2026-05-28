/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { observer } from "mobx-react";
import { useParams } from "next/navigation";
import { Activity, CalendarCheck, Clock, Crosshair, Info, SignalHigh, User, Users } from "lucide-react";
import { Tab } from "@headlessui/react";
import { useTranslation } from "@plane/i18n";
import type { IProject, TIssuePriorities } from "@plane/types";
import { cn } from "@plane/utils";
import { DateDropdown } from "@/components/dropdowns/date";
import { PriorityDropdown } from "@/components/dropdowns/priority";
import { ProjectLeadPicker } from "@/components/project/views/lead-picker";
import { ProjectStatePicker } from "@/components/project/views/state-picker";
import { useProject } from "@/hooks/store/use-project";
import { useWorkspace } from "@/hooks/store/use-workspace";
import { RightSidebarActivity } from "./right-sidebar-activity";

type Props = {
  project: IProject;
};

/**
 * Right-hand sidebar of the Project Overview page. Two tabs:
 * - Properties (default) — state, priority, lead, members, start/due dates.
 * - Activity — recent project activity feed.
 *
 * Each Properties row is wired to `updateProject` (via the underlying
 * pickers' managed mode, or a local handler for priority/dates).
 */
export const ProjectOverviewRightSidebar = observer(function ProjectOverviewRightSidebar({ project }: Props) {
  const { t } = useTranslation();
  const { workspaceSlug } = useParams();
  const { updateProject } = useProject();
  const { currentWorkspace } = useWorkspace();

  const projectStatesEnabled = !!currentWorkspace?.project_states_enabled;
  const memberCount = (project.members?.length ?? 0) || 1;

  const handlePriorityChange = (priority: TIssuePriorities) => {
    if (!workspaceSlug || !project.id) return;
    updateProject(workspaceSlug.toString(), project.id, { priority }).catch(() => undefined);
  };

  const handleStartDateChange = (date: Date | null) => {
    if (!workspaceSlug || !project.id) return;
    updateProject(workspaceSlug.toString(), project.id, {
      start_date: date ? date.toISOString().split("T")[0] : null,
    }).catch(() => undefined);
  };

  const handleEndDateChange = (date: Date | null) => {
    if (!workspaceSlug || !project.id) return;
    updateProject(workspaceSlug.toString(), project.id, {
      end_date: date ? date.toISOString().split("T")[0] : null,
    }).catch(() => undefined);
  };

  return (
    <aside className="absolute right-0 flex h-full w-full min-w-90 flex-col gap-4 border-l border-subtle bg-surface-1 p-6 transition-[width] ease-linear sm:relative sm:w-1/2 md:w-1/3 lg:min-w-80 xl:min-w-96">
      <Tab.Group as="div" className="flex h-full w-full flex-col">
        <Tab.List className="relative flex w-full items-center justify-between gap-1.5 overflow-auto rounded-lg bg-layer-3 p-0.5 text-13">
          <SidebarTab icon={Info} />
          <SidebarTab icon={Activity} />
        </Tab.List>

        <Tab.Panels className="flex-1 overflow-y-auto pt-4">
          <Tab.Panel className="relative h-full outline-none">
            <div className="flex h-full w-full flex-col gap-3 overflow-y-auto">
              <div className="flex items-center justify-between gap-2">
                <h5 className="text-16 font-semibold text-secondary">{t("common.properties")}</h5>
              </div>

              <div className="mb-2 space-y-2.5">
                {/* State */}
                {projectStatesEnabled && (
                  <PropertyRow icon={Crosshair} label={t("common.state")}>
                    <ProjectStatePicker project={project} className="h-7 w-auto" />
                  </PropertyRow>
                )}

                {/* Priority */}
                <PropertyRow icon={SignalHigh} label={t("common.priority")}>
                  <PriorityDropdown
                    value={project.priority ?? "none"}
                    onChange={handlePriorityChange}
                    buttonVariant="border-with-text"
                    buttonClassName="h-7"
                    buttonContainerClassName="h-7"
                  />
                </PropertyRow>

                {/* Lead */}
                <PropertyRow icon={User} label={t("lead")}>
                  <ProjectLeadPicker project={project} className="h-7" />
                </PropertyRow>

                {/* Members — read-only count */}
                <PropertyRow icon={Users} label={t("common.members")}>
                  <button
                    type="button"
                    disabled
                    className="flex h-7 cursor-not-allowed items-center rounded-sm px-2 text-left text-13 text-secondary outline-none"
                  >
                    {t("overview.member_count", { count: memberCount })}
                  </button>
                </PropertyRow>

                {/* Start date */}
                <PropertyRow icon={Clock} label={t("start_date")}>
                  <DateDropdown
                    value={project.start_date ?? null}
                    onChange={handleStartDateChange}
                    buttonVariant="transparent-with-text"
                    buttonClassName="h-7 px-1.5"
                    buttonContainerClassName="h-7"
                    hideIcon
                    placeholder={t("common.none")}
                    formatToken="MMM dd, yyyy"
                  />
                </PropertyRow>

                {/* Due date */}
                <PropertyRow icon={CalendarCheck} label={t("due_date")}>
                  <DateDropdown
                    value={project.end_date ?? null}
                    onChange={handleEndDateChange}
                    buttonVariant="transparent-with-text"
                    buttonClassName="h-7 px-1.5"
                    buttonContainerClassName="h-7"
                    hideIcon
                    placeholder={t("common.none")}
                    minDate={project.start_date ? new Date(project.start_date) : undefined}
                    formatToken="MMM dd, yyyy"
                  />
                </PropertyRow>
              </div>
            </div>
          </Tab.Panel>

          <Tab.Panel className="relative h-full outline-none">
            {workspaceSlug && <RightSidebarActivity workspaceSlug={workspaceSlug.toString()} projectId={project.id} />}
          </Tab.Panel>
        </Tab.Panels>
      </Tab.Group>
    </aside>
  );
});

type SidebarTabProps = {
  icon: React.ElementType;
};

/** Single tab trigger — only renders an icon (matches Pro mockup). */
const SidebarTab = ({ icon: Icon }: SidebarTabProps) => (
  <Tab
    className={({ selected }) =>
      cn(
        "flex w-full min-w-fit cursor-pointer items-center justify-center rounded-md border border-transparent p-1 text-13 font-medium transition-all duration-200 ease-in-out outline-none focus:outline-none disabled:cursor-not-allowed",
        selected
          ? "shadow-sm raised-200 border-subtle-1 bg-layer-2 text-primary"
          : "text-placeholder hover:bg-layer-transparent-hover hover:text-tertiary"
      )
    }
  >
    <Icon className="size-4" aria-hidden />
  </Tab>
);

type PropertyRowProps = {
  icon: React.ElementType;
  label: string;
  children: React.ReactNode;
};

/** Two-column row used by the Properties tab: icon+label on the left, control on the right. */
const PropertyRow = ({ icon: Icon, label, children }: PropertyRowProps) => (
  <div className="flex h-8 items-center gap-2">
    <div className="my-auto flex w-2/5 shrink-0 items-center gap-1 text-13 text-tertiary">
      <Icon className="h-4 w-4 shrink-0" aria-hidden />
      <span>{label}</span>
    </div>
    <div className="flex-1">{children}</div>
  </div>
);
