/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useRef, useState } from "react";
import { observer } from "mobx-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import {
  addDays,
  addMonths,
  addWeeks,
  differenceInDays,
  endOfMonth,
  endOfQuarter,
  format,
  isToday,
  startOfDay,
  startOfMonth,
  startOfQuarter,
  startOfWeek,
} from "date-fns";
import { Maximize2 } from "lucide-react";
// plane imports
import { useTranslation } from "@plane/i18n";
import { Logo } from "@plane/propel/emoji-icon-picker";
import type { IProject } from "@plane/types";
import { cn } from "@plane/utils";
// local imports
import { useWorkspace } from "@/hooks/store/use-workspace";
import { useWorkspaceProjectState } from "@/hooks/store/use-workspace-project-state";
import { ProjectStatePicker } from "./state-picker";

// ── Constants ─────────────────────────────────────────────────────────────────
const SIDEBAR_WIDTH = 360; // px
const HEADER_HEIGHT = 48; // px — two-row (month + week/day)
const ROW_HEIGHT = 56; // px per project row
const BAR_HEIGHT = 28; // px for the Gantt bar
const BAR_V_OFFSET = (ROW_HEIGHT - BAR_HEIGHT) / 2; // center bar vertically in row

type TZoomLevel = "week" | "month" | "quarter";

const DAY_WIDTH: Record<TZoomLevel, number> = {
  week: 60,
  month: 32,
  quarter: 16,
};

// ── Date utilities ─────────────────────────────────────────────────────────────

function buildDayColumns(rangeStart: Date, rangeEnd: Date): Date[] {
  const cols: Date[] = [];
  let cur = startOfDay(rangeStart);
  while (cur <= rangeEnd) {
    cols.push(cur);
    cur = addDays(cur, 1);
  }
  return cols;
}

function computeRange(projects: IProject[], zoom: TZoomLevel): { rangeStart: Date; rangeEnd: Date } {
  const today = startOfDay(new Date());
  const datesWithData = projects
    .flatMap((p) => [
      p.start_date ? startOfDay(new Date(p.start_date)) : null,
      p.end_date ? startOfDay(new Date(p.end_date)) : null,
    ])
    .filter((d): d is Date => !!d);

  let rangeStart: Date;
  let rangeEnd: Date;

  if (datesWithData.length > 0) {
    const min = datesWithData.reduce((a, b) => (a < b ? a : b));
    const max = datesWithData.reduce((a, b) => (a > b ? a : b));
    // Pad by ±1 zoom unit around min/max
    if (zoom === "week") {
      rangeStart = startOfWeek(addWeeks(min, -1), { weekStartsOn: 1 });
      rangeEnd = addWeeks(max, 2);
    } else if (zoom === "month") {
      rangeStart = startOfMonth(addMonths(min, -1));
      rangeEnd = endOfMonth(addMonths(max, 1));
    } else {
      rangeStart = startOfQuarter(addMonths(min, -3));
      rangeEnd = endOfQuarter(addMonths(max, 3));
    }
  } else {
    // No projects with dates: show a 3-month window centred on today
    rangeStart = startOfMonth(addMonths(today, -1));
    rangeEnd = endOfMonth(addMonths(today, 2));
  }

  return { rangeStart, rangeEnd };
}

// ── Month header helper — for the top row of the calendar header ──────────────

type MonthBlock = { label: string; startCol: number; span: number };

function buildMonthBlocks(days: Date[]): MonthBlock[] {
  const blocks: MonthBlock[] = [];
  let currentMonth = "";
  let blockStart = 0;

  days.forEach((day, i) => {
    const m = format(day, "MMM yyyy");
    if (m !== currentMonth) {
      if (currentMonth !== "") {
        blocks.push({ label: currentMonth, startCol: blockStart, span: i - blockStart });
      }
      currentMonth = m;
      blockStart = i;
    }
  });
  if (currentMonth) {
    blocks.push({ label: currentMonth, startCol: blockStart, span: days.length - blockStart });
  }
  return blocks;
}

// ── Subcomponents ─────────────────────────────────────────────────────────────

type SidebarRowProps = {
  project: IProject;
  projectStatesEnabled: boolean;
};

const SidebarRow = observer(function SidebarRow({ project, projectStatesEnabled }: SidebarRowProps) {
  const { workspaceSlug } = useParams();
  const isMemberOfProject = !!project.member_role;

  return (
    <div className="flex items-center gap-2 border-b border-subtle px-4" style={{ height: ROW_HEIGHT }}>
      {/* Logo */}
      <div className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-sm bg-layer-1">
        <Logo logo={project.logo_props} size={12} />
      </div>

      {/* Name */}
      <Link
        href={isMemberOfProject ? `/${workspaceSlug}/projects/${project.id}/issues` : "#"}
        onClick={(e) => {
          if (!isMemberOfProject) {
            e.preventDefault();
            e.stopPropagation();
          }
        }}
        className="flex-1 truncate text-13 font-medium text-primary hover:underline"
      >
        {project.name}
      </Link>

      {/* State picker */}
      {projectStatesEnabled && <ProjectStatePicker project={project} />}
    </div>
  );
});

// ── Main component ─────────────────────────────────────────────────────────────

type Props = {
  projectIds: string[];
  getProjectById: (id: string) => IProject | undefined;
};

/**
 * Timeline (Gantt) view — sidebar + horizontally scrollable calendar grid.
 * Zoom levels: Week (60px/day), Month (32px/day), Quarter (16px/day).
 * Projects without both start + end dates are shown in the sidebar but have no bar.
 */
export const ProjectTimelineView = observer(function ProjectTimelineView({ projectIds, getProjectById }: Props) {
  const { t } = useTranslation();
  const { currentWorkspace } = useWorkspace();
  const { getStateById } = useWorkspaceProjectState();

  const [zoom, setZoom] = useState<TZoomLevel>("month");
  const calendarRef = useRef<HTMLDivElement>(null);

  const projectStatesEnabled = !!currentWorkspace?.project_states_enabled;

  const projects = projectIds.map((id) => getProjectById(id)).filter((p): p is IProject => !!p);

  const today = startOfDay(new Date());
  const dayWidth = DAY_WIDTH[zoom];
  const { rangeStart, rangeEnd } = computeRange(projects, zoom);
  const days = buildDayColumns(rangeStart, rangeEnd);
  const monthBlocks = buildMonthBlocks(days);

  const todayOffset = differenceInDays(today, rangeStart);
  const todayX = todayOffset * dayWidth;
  const totalWidth = days.length * dayWidth;

  // Scroll today into view on mount / zoom change
  const handleScrollToday = () => {
    if (calendarRef.current) {
      const scrollX = Math.max(0, todayX - calendarRef.current.clientWidth / 2);
      calendarRef.current.scrollTo({ left: scrollX, behavior: "smooth" });
    }
  };

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden rounded-lg border border-subtle">
      {/* ── Toolbar ── */}
      <div className="flex flex-shrink-0 items-center justify-between border-b border-subtle bg-layer-1 px-4 py-2">
        <div className="flex items-center gap-1 rounded-md border border-subtle bg-layer-2 p-0.5">
          {(["week", "month", "quarter"] as TZoomLevel[]).map((z) => (
            <button
              key={z}
              type="button"
              onClick={() => setZoom(z)}
              className={cn(
                "rounded px-3 py-1 text-13 font-medium capitalize transition-colors",
                zoom === z ? "bg-accent-primary text-white" : "text-secondary hover:bg-layer-1"
              )}
            >
              {t(`workspace_projects.timeline.${z}`)}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleScrollToday}
            className="rounded-md border border-subtle px-3 py-1 text-13 text-secondary hover:bg-layer-1"
          >
            {t("workspace_projects.timeline.today")}
          </button>
          <button
            type="button"
            className="flex h-7 w-7 items-center justify-center rounded-md border border-subtle text-secondary hover:bg-layer-1"
            title={t("workspace_projects.timeline.fullscreen")}
          >
            <Maximize2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* ── Main split: sidebar + calendar ── */}
      <div className="flex min-h-0 flex-1">
        {/* ── Sidebar ── */}
        <div
          className="vertical-scrollbar flex scrollbar-sm flex-shrink-0 flex-col overflow-y-auto border-r border-subtle"
          style={{ width: SIDEBAR_WIDTH }}
        >
          {/* Sidebar header (matches calendar header height) */}
          <div
            className="sticky top-0 z-10 flex flex-shrink-0 items-end border-b border-subtle bg-layer-1 px-4 pb-2 text-13 font-medium text-secondary"
            style={{ height: HEADER_HEIGHT }}
          >
            {t("workspace_projects.label", { count: 2 })}
          </div>

          {/* Project rows */}
          {projects.map((project) => (
            <SidebarRow key={project.id} project={project} projectStatesEnabled={projectStatesEnabled} />
          ))}

          {projects.length === 0 && (
            <div className="flex h-16 items-center justify-center px-4 text-13 text-placeholder">
              {t("workspace_projects.timeline.no_projects")}
            </div>
          )}
        </div>

        {/* ── Calendar ── */}
        <div
          ref={calendarRef}
          className="horizontal-scrollbar vertical-scrollbar relative scrollbar-md scrollbar-sm flex-1 overflow-auto"
        >
          {/* Calendar header */}
          <div
            className="sticky top-0 z-10 flex-shrink-0 border-b border-subtle bg-layer-1"
            style={{ width: totalWidth, height: HEADER_HEIGHT }}
          >
            {/* Month labels (top half) */}
            <div className="absolute inset-x-0 top-0 flex" style={{ height: HEADER_HEIGHT / 2 }}>
              {monthBlocks.map((block) => (
                <div
                  key={`${block.label}-${block.startCol}`}
                  className="flex flex-shrink-0 items-center overflow-hidden border-r border-subtle px-2 text-11 font-medium text-tertiary"
                  style={{ width: block.span * dayWidth }}
                >
                  {block.label}
                </div>
              ))}
            </div>

            {/* Day labels (bottom half) */}
            <div className="absolute inset-x-0 bottom-0 flex" style={{ height: HEADER_HEIGHT / 2 }}>
              {days.map((day, dayIndex) => (
                <div
                  key={format(day, "yyyy-MM-dd")}
                  className={cn(
                    "flex flex-shrink-0 items-center justify-center border-r border-subtle text-11 text-tertiary",
                    isToday(day) && "bg-accent-primary/20 font-semibold text-accent-primary"
                  )}
                  style={{ width: dayWidth }}
                >
                  {/* Show day number on week/month; on quarter only every 7th day */}
                  {zoom === "quarter" ? (dayIndex % 7 === 0 ? format(day, "d") : null) : format(day, "d")}
                </div>
              ))}
            </div>
          </div>

          {/* Rows */}
          <div className="relative" style={{ width: totalWidth }}>
            {/* Today vertical highlight */}
            {todayOffset >= 0 && todayOffset < days.length && (
              <div
                className="pointer-events-none absolute top-0 bottom-0 z-0 bg-accent-primary/10"
                style={{ left: todayX, width: dayWidth }}
              />
            )}

            {projects.map((project) => {
              const state = project.project_status ? getStateById(project.project_status) : undefined;

              const hasBar = !!project.start_date && !!project.end_date;
              let barLeft = 0;
              let barWidth = 0;

              if (hasBar) {
                const startDay = startOfDay(new Date(project.start_date!));
                const endDay = startOfDay(new Date(project.end_date!));
                const startOffset = differenceInDays(startDay, rangeStart);
                const endOffset = differenceInDays(endDay, rangeStart) + 1; // inclusive
                barLeft = startOffset * dayWidth;
                barWidth = (endOffset - startOffset) * dayWidth;
              }

              const barColor = state?.color ?? "#64748B";

              return (
                <div
                  key={project.id}
                  className="relative flex items-center border-b border-subtle"
                  style={{ height: ROW_HEIGHT }}
                >
                  {/* Column grid lines */}
                  {days.map((day, dayColIdx) => (
                    <div
                      key={format(day, "yyyy-MM-dd")}
                      className={cn(
                        "absolute top-0 bottom-0 border-r border-subtle/50",
                        isToday(day) && "border-accent-primary/20"
                      )}
                      style={{ left: dayColIdx * dayWidth, width: dayWidth }}
                    />
                  ))}

                  {/* Gantt bar */}
                  {hasBar && (
                    <div
                      className="absolute z-10 flex items-center overflow-hidden rounded-full"
                      style={{
                        left: barLeft,
                        width: Math.max(barWidth, dayWidth),
                        top: BAR_V_OFFSET,
                        height: BAR_HEIGHT,
                        backgroundColor: `${barColor}33`, // 20% opacity
                        border: `1px solid ${barColor}80`,
                      }}
                    >
                      {/* Solid left end cap */}
                      <div className="h-full w-1.5 flex-shrink-0 rounded-full" style={{ backgroundColor: barColor }} />
                      {/* Project name */}
                      <span className="flex-1 truncate px-2 text-12 font-medium" style={{ color: barColor }}>
                        {project.name}
                      </span>
                    </div>
                  )}
                </div>
              );
            })}

            {projects.length === 0 && (
              <div
                className="flex items-center justify-center text-13 text-placeholder"
                style={{ height: ROW_HEIGHT * 2 }}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
});
