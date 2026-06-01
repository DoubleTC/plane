/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useTranslation } from "@plane/i18n";
import { Badge } from "@plane/propel/badge";
import type { TBadgeVariant } from "@plane/propel/badge";
import type { TScheduleBuckets } from "@/services/project/project-analytics.service";

/**
 * Performance rating derived from a scope's completion-timeliness buckets.
 * Drives the status of a project / phase / cycle / module as well as an
 * individual member's "Hiệu suất". `none` means there are no dated completed
 * items to judge by.
 */
export type TScheduleRating = "excellent" | "good" | "attention" | "delayed" | "none";

/**
 * Classify timeliness buckets into a four-tier rating (agreed thresholds):
 * - excellent: >=50% finished early AND <=10% late
 * - good: <=10% late
 * - attention: <=30% late
 * - delayed: otherwise
 * - none: nothing completed-with-dates to rate
 */
export const rateSchedule = (schedule: TScheduleBuckets | undefined | null): TScheduleRating => {
  if (!schedule) return "none";
  const total = schedule.early + schedule.on_time + schedule.delayed;
  if (total <= 0) return "none";
  const lateRatio = schedule.delayed / total;
  const earlyRatio = schedule.early / total;
  if (earlyRatio >= 0.5 && lateRatio <= 0.1) return "excellent";
  if (lateRatio <= 0.1) return "good";
  if (lateRatio <= 0.3) return "attention";
  return "delayed";
};

/** Sum a list of buckets — used to roll cycle buckets up into a phase rating. */
export const sumSchedules = (buckets: (TScheduleBuckets | undefined | null)[]): TScheduleBuckets =>
  buckets.reduce<TScheduleBuckets>(
    (acc, b) => ({
      early: acc.early + (b?.early ?? 0),
      on_time: acc.on_time + (b?.on_time ?? 0),
      delayed: acc.delayed + (b?.delayed ?? 0),
    }),
    { early: 0, on_time: 0, delayed: 0 }
  );

const RATING_VARIANT: Record<TScheduleRating, TBadgeVariant> = {
  excellent: "brand",
  good: "success",
  attention: "warning",
  delayed: "danger",
  none: "neutral",
};

const RATING_I18N_KEY: Record<TScheduleRating, string> = {
  excellent: "analytics_project.rating.excellent",
  good: "analytics_project.rating.good",
  attention: "analytics_project.rating.attention",
  delayed: "analytics_project.rating.delayed",
  none: "analytics_project.rating.none",
};

type RatingBadgeProps = {
  /** Provide either a precomputed rating or the buckets to derive one from. */
  rating?: TScheduleRating;
  schedule?: TScheduleBuckets | null;
  size?: "sm" | "base";
};

/** Coloured badge with the localized rating label. */
export const RatingBadge = ({ rating, schedule, size = "sm" }: RatingBadgeProps) => {
  const { t } = useTranslation();
  const resolved = rating ?? rateSchedule(schedule);
  return (
    <Badge variant={RATING_VARIANT[resolved]} size={size}>
      {t(RATING_I18N_KEY[resolved])}
    </Badge>
  );
};
