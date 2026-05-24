/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useState } from "react";
import { observer } from "mobx-react";
import { useParams } from "next/navigation";
import { CalendarDays, X } from "lucide-react";
// plane imports
import { useTranslation } from "@plane/i18n";
import type { DateRange } from "@plane/propel/calendar";
import { Calendar } from "@plane/propel/calendar";
import { Popover } from "@plane/propel/popover";
import type { IProject } from "@plane/types";
import { cn, renderFormattedDate } from "@plane/utils";
// hooks
import { useProject } from "@/hooks/store/use-project";
import { useUserProfile } from "@/hooks/store/user";

type Props = {
  project: IProject;
  className?: string;
};

/**
 * Compact date-range picker for the project card.
 * Opens a Popover containing a react-day-picker Calendar in range mode.
 * Selecting both start and end dates immediately saves them to the project.
 * The X button clears both dates.
 *
 * Must be rendered inside a propagation-stopping context (data-prevent-progress
 * + outer onClick) because ProjectCard is a <Link>.
 */
export const ProjectDatePicker = observer(function ProjectDatePicker({ project, className }: Props) {
  const { t } = useTranslation();
  const { workspaceSlug } = useParams();

  const [open, setOpen] = useState(false);
  // undefined = nothing selected yet; object = at least one end chosen.
  // Do NOT initialise with { from: undefined, to: undefined } — react-day-picker v9
  // treats that object as "a range is already in progress", which causes the first
  // click to immediately complete the range with the same date for both ends.
  const [range, setRange] = useState<DateRange | undefined>(undefined);

  const { updateProject } = useProject();
  const { data: userProfile } = useUserProfile();
  const weekStartsOn = userProfile?.start_of_the_week as 0 | 1 | 2 | 3 | 4 | 5 | 6 | undefined;

  // ── Derived values ────────────────────────────────────────────────────────────

  const startDate = project.start_date ? new Date(project.start_date) : undefined;
  const endDate = project.end_date ? new Date(project.end_date) : undefined;
  const hasRange = !!(project.start_date || project.end_date);

  // ── Handlers ─────────────────────────────────────────────────────────────────

  const handleOpenChange = (isOpen: boolean) => {
    setOpen(isOpen);
    if (isOpen) {
      // Pre-populate from saved dates (or undefined when there are none)
      setRange(startDate || endDate ? { from: startDate, to: endDate } : undefined);
    }
  };

  const handleRangeSelect = async (selected: DateRange | undefined) => {
    if (!workspaceSlug || !project.id) return;
    setRange(selected);

    // Auto-save only when a genuine range (two DIFFERENT days) is complete.
    // Guard against react-day-picker v9 emitting { from: d, to: d } on the
    // first click when it treats an existing range-in-progress as already started.
    const { from, to } = selected ?? {};
    if (from && to && from.getTime() !== to.getTime()) {
      setOpen(false);
      try {
        await updateProject(workspaceSlug.toString(), project.id, {
          start_date: from.toISOString().split("T")[0],
          end_date: to.toISOString().split("T")[0],
        });
      } catch {
        // updateProject surfaces its own error toast
      }
    }
  };

  const handleClearDates = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!workspaceSlug || !project.id) return;
    try {
      await updateProject(workspaceSlug.toString(), project.id, { start_date: null, end_date: null });
    } catch {
      // updateProject surfaces its own error toast
    }
  };

  // ── Render ────────────────────────────────────────────────────────────────────

  return (
    // eslint-disable-next-line jsx-a11y/no-static-element-interactions
    <div
      role="presentation"
      data-prevent-progress
      className="contents"
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
      }}
    >
      <Popover open={open} onOpenChange={handleOpenChange}>
        {/* ── Trigger ── */}
        <Popover.Button
          render={
            <button
              type="button"
              className={cn(
                "flex h-full w-full items-center justify-start gap-1.5 rounded-sm border-[0.5px] border-strong bg-layer-transparent px-1.5 text-caption-md-medium whitespace-nowrap text-secondary transition-colors hover:bg-layer-transparent-hover focus:bg-layer-transparent-active focus-visible:outline-none active:bg-layer-transparent-active disabled:pointer-events-none disabled:cursor-not-allowed disabled:bg-layer-transparent disabled:text-disabled",
                className
              )}
            />
          }
        >
          <CalendarDays className="h-3 w-3 flex-shrink-0" aria-hidden />
          {hasRange ? (
            <>
              <span className="truncate">
                {project.start_date ? renderFormattedDate(project.start_date) : "—"}
                {" - "}
                {project.end_date ? renderFormattedDate(project.end_date) : "—"}
              </span>
              {/* Clear button — separate from the Popover trigger */}
              {/* eslint-disable-next-line jsx-a11y/no-static-element-interactions */}
              <span role="presentation" onClick={handleClearDates} className="flex-shrink-0">
                <X className="h-2.5 w-2.5 text-tertiary hover:text-secondary" />
              </span>
            </>
          ) : (
            <span className="text-placeholder">{t("workspace_projects.dates.set_dates")}</span>
          )}
        </Popover.Button>

        {/* ── Panel ── */}
        <Popover.Panel
          side="bottom"
          align="start"
          sideOffset={6}
          className="shadow-lg z-20 overflow-hidden rounded-md border border-subtle bg-layer-2"
        >
          <Calendar
            mode="range"
            selected={range}
            onSelect={handleRangeSelect}
            weekStartsOn={weekStartsOn}
            captionLayout="dropdown"
            showOutsideDays
            fixedWeeks
            className="rounded-md p-3 text-12"
          />
          {/* Footer: hint text */}
          <div className="border-t border-subtle px-3 py-2 text-11 text-placeholder">
            {range?.from && (!range?.to || range.from.getTime() === range.to.getTime())
              ? t("workspace_projects.dates.select_end")
              : t("workspace_projects.dates.select_start")}
          </div>
        </Popover.Panel>
      </Popover>
    </div>
  );
});
