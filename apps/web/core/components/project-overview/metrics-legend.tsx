/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useTranslation } from "@plane/i18n";
import { STATE_SEGMENTS, type TStateCounts } from "./metrics-utils";

type Props = {
  counts: TStateCounts;
};

/**
 * Grid of per-state cards rendered below the overall progress bar.
 * Each card shows a colour swatch matching the corresponding bar segment,
 * the state label, the count, and that state's share of the total
 * (or 0% when the project has no work items yet).
 */
export const MetricsLegend = ({ counts }: Props) => {
  const { t } = useTranslation();
  const total = counts.total_issues;

  return (
    <div className="flex w-full flex-wrap justify-stretch gap-4">
      {STATE_SEGMENTS.map((seg) => {
        const value = counts[seg.key];
        const percent = total > 0 ? Math.round((value / total) * 100) : 0;
        return (
          <div key={seg.key} className="flex min-w-24 flex-1 flex-col gap-1 px-3 py-2">
            <div className="flex items-center gap-2">
              <span className="size-2.5 shrink-0 rounded-sm" style={{ backgroundColor: seg.color }} aria-hidden />
              <span className="text-6 leading-4 font-medium text-tertiary">{t(seg.i18nKey)}</span>
            </div>
            <div className="flex gap-3">
              <span className="text-13 font-medium text-tertiary">{value}</span>
              <span className="my-auto text-13 font-medium text-tertiary">{percent}%</span>
            </div>
          </div>
        );
      })}
    </div>
  );
};
