/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { cn } from "@plane/utils";
import { STATE_SEGMENTS, type TStateCounts } from "./metrics-utils";

type Props = {
  counts: TStateCounts;
  className?: string;
  /** Tailwind height utility for the bar (defaults to h-[14px] per mockup). */
  heightClassName?: string;
};

/**
 * A horizontal stacked bar visualising the state distribution of a set of
 * work items. Each segment width is proportional to its share of `total_issues`;
 * the empty case shows a single neutral track so the bar always has a frame.
 */
export const MetricsProgressBar = ({ counts, className, heightClassName = "h-[14px]" }: Props) => {
  const total = counts.total_issues;
  const isEmpty = total <= 0;

  return (
    <div className={cn("flex w-full items-center justify-between gap-[1px] rounded-xs", heightClassName, className)}>
      <div className="flex h-full w-full gap-0.5 rounded-sm bg-transparent p-0">
        {isEmpty ? (
          <div
            className="rounded-sm first:rounded-sm last:rounded-sm"
            style={{ width: "100%", backgroundColor: STATE_SEGMENTS[0].color }}
          />
        ) : (
          STATE_SEGMENTS.map((seg) => {
            const value = counts[seg.key];
            if (!value) return null;
            const widthPct = (value / total) * 100;
            return (
              <div
                key={seg.key}
                className="rounded first:rounded-sm last:rounded-sm"
                style={{ width: `${widthPct}%`, backgroundColor: seg.color }}
              />
            );
          })
        )}
      </div>
    </div>
  );
};
