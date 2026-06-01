/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useTranslation } from "@plane/i18n";
import { PieChart } from "@plane/propel/charts/pie-chart";
import type { TScheduleBuckets } from "@/services/project/project-analytics.service";
import { RatingBadge } from "./rating";
import { formatPercent } from "./utils";

type ScheduleKey = "early" | "on_time" | "delayed";

const SCHEDULE_SEGMENTS: { key: ScheduleKey; i18nKey: string; color: string }[] = [
  { key: "early", i18nKey: "analytics_project.timeliness.early", color: "rgb(59, 130, 246)" },
  { key: "on_time", i18nKey: "analytics_project.timeliness.on_time", color: "rgb(34, 197, 94)" },
  { key: "delayed", i18nKey: "analytics_project.timeliness.delayed", color: "rgb(239, 68, 68)" },
];

type Props = {
  schedule: TScheduleBuckets;
  /** Optional heading. When omitted, only the status badge is shown (the caller
   * — e.g. a Section — already provides the label). */
  title?: string;
};

/**
 * Donut chart of completion timeliness (Trước / Đúng / Chậm) with the on-time
 * rate in the center and the derived status badge. Doubles as the "Tình trạng"
 * indicator for whatever scope feeds it.
 */
export const ScheduleDonut = ({ schedule, title }: Props) => {
  const { t } = useTranslation();
  const total = schedule.early + schedule.on_time + schedule.delayed;
  const onTimeRate = total > 0 ? ((schedule.early + schedule.on_time) / total) * 100 : 0;

  const data = SCHEDULE_SEGMENTS.map((seg) => ({
    id: seg.key,
    key: seg.key,
    name: t(seg.i18nKey),
    value: schedule[seg.key],
    color: seg.color,
  }));

  return (
    <div className="flex flex-1 flex-col gap-3 rounded-lg border-[0.5px] border-subtle bg-surface-1 p-4">
      <div className="flex items-center justify-between gap-2">
        {title ? <h4 className="text-14 font-medium text-secondary">{title}</h4> : <span />}
        <RatingBadge schedule={schedule} />
      </div>
      {total > 0 ? (
        <div className="my-auto grid grid-cols-2 items-center gap-2">
          <div className="h-[140px] w-full">
            <PieChart
              className="size-full"
              dataKey="value"
              data={data}
              cells={SCHEDULE_SEGMENTS.map((seg) => ({ key: seg.key, fill: seg.color }))}
              margin={{ top: 0, right: 0, bottom: 0, left: 0 }}
              innerRadius="62%"
              paddingAngle={3}
              cornerRadius={3}
              showTooltip
              showLabel={false}
              centerLabel={{
                text: formatPercent(onTimeRate),
                fill: "currentColor",
                className: "text-16 font-semibold text-primary",
              }}
            />
          </div>
          <div className="flex flex-col gap-2">
            {SCHEDULE_SEGMENTS.map((seg) => (
              <div key={seg.key} className="flex items-center justify-between gap-2 text-12">
                <div className="flex items-center gap-1.5">
                  <span className="size-2.5 rounded-xs" style={{ backgroundColor: seg.color }} />
                  <span className="text-secondary">{t(seg.i18nKey)}</span>
                </div>
                <span className="font-medium text-primary">{schedule[seg.key]}</span>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <p className="my-auto py-6 text-center text-12 text-placeholder">{t("analytics_project.no_dated_items")}</p>
      )}
    </div>
  );
};
