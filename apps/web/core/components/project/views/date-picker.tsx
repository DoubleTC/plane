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

const toDate = (v: string | Date | null | undefined): Date | undefined =>
  v ? (v instanceof Date ? v : new Date(v)) : undefined;

type Props = {
  /** Managed mode: provide a project. Selecting a range patches start/end on the project. */
  project?: IProject;
  /** Controlled mode: current start date (YYYY-MM-DD string or Date or null). */
  startDate?: string | Date | null;
  /** Controlled mode: current end date. */
  endDate?: string | Date | null;
  /** Controlled mode: called when both ends of a valid range are picked. */
  onChange?: (start: string | null, end: string | null) => void;
  className?: string;
};

/**
 * Compact date-range picker for the project card and create form.
 * Opens a Popover containing a react-day-picker Calendar in range mode.
 *
 * - Managed mode (pass `project`): selecting a complete range patches the project.
 * - Controlled mode (pass `startDate`+`endDate`+`onChange`): selecting emits the
 *   ISO-date strings (YYYY-MM-DD) to the parent. Used by the project-create form.
 *
 * The X button clears both dates in either mode.
 */
export const ProjectDatePicker = observer(function ProjectDatePicker({
  project,
  startDate: startDateProp,
  endDate: endDateProp,
  onChange,
  className,
}: Props) {
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

  const rawStart = project ? project.start_date : startDateProp;
  const rawEnd = project ? project.end_date : endDateProp;
  const startDate = toDate(rawStart);
  const endDate = toDate(rawEnd);
  const hasRange = !!(rawStart || rawEnd);

  // Format for trigger label: prefer ISO string-formatting helper, but accept Date too
  const formatForLabel = (v: string | Date | null | undefined): string => (v ? (renderFormattedDate(v) ?? "—") : "—");

  // ── Handlers ─────────────────────────────────────────────────────────────────

  const handleOpenChange = (isOpen: boolean) => {
    setOpen(isOpen);
    if (isOpen) {
      // Pre-populate from saved dates (or undefined when there are none)
      setRange(startDate || endDate ? { from: startDate, to: endDate } : undefined);
    }
  };

  const handleRangeSelect = async (selected: DateRange | undefined) => {
    setRange(selected);

    // Auto-save only when a genuine range (two DIFFERENT days) is complete.
    // Guard against react-day-picker v9 emitting { from: d, to: d } on the
    // first click when it treats an existing range-in-progress as already started.
    const { from, to } = selected ?? {};
    if (from && to && from.getTime() !== to.getTime()) {
      setOpen(false);
      const startStr = from.toISOString().split("T")[0];
      const endStr = to.toISOString().split("T")[0];

      if (project) {
        if (!workspaceSlug || !project.id) return;
        try {
          await updateProject(workspaceSlug.toString(), project.id, {
            start_date: startStr,
            end_date: endStr,
          });
        } catch {
          // updateProject surfaces its own error toast
        }
        return;
      }
      onChange?.(startStr, endStr);
    }
  };

  const handleClearDates = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (project) {
      if (!workspaceSlug || !project.id) return;
      try {
        await updateProject(workspaceSlug.toString(), project.id, { start_date: null, end_date: null });
      } catch {
        // updateProject surfaces its own error toast
      }
      return;
    }
    onChange?.(null, null);
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
                {formatForLabel(rawStart)}
                {" - "}
                {formatForLabel(rawEnd)}
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
          positionerClassName="z-[99999]"
          className="shadow-lg overflow-hidden rounded-md border border-subtle bg-layer-2"
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
