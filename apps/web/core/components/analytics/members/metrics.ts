/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import type { TMemberPillars } from "@/services/analytics/member-analytics.service";

/** Pillar display metadata (order = how the radar/mini-bars are laid out). */
export const PILLAR_META: { key: keyof TMemberPillars; i18nKey: string; color: string }[] = [
  { key: "delivery", i18nKey: "members_analytics.pillar.delivery", color: "rgb(59, 130, 246)" },
  { key: "quality", i18nKey: "members_analytics.pillar.quality", color: "rgb(34, 197, 94)" },
  { key: "predictability", i18nKey: "members_analytics.pillar.predictability", color: "rgb(168, 85, 247)" },
  { key: "flow", i18nKey: "members_analytics.pillar.flow", color: "rgb(245, 158, 11)" },
  { key: "collaboration", i18nKey: "members_analytics.pillar.collaboration", color: "rgb(236, 72, 153)" },
];

export type TIndexTier = "top" | "strong" | "mid" | "low";

/** Coarse band for the composite index, used to colour the score. */
export const indexTier = (value: number): TIndexTier =>
  value >= 75 ? "top" : value >= 50 ? "strong" : value >= 25 ? "mid" : "low";

export const INDEX_TIER_TEXT_CLASS: Record<TIndexTier, string> = {
  top: "text-success-primary",
  strong: "text-accent-primary",
  mid: "text-warning-primary",
  low: "text-danger-primary",
};

export const INDEX_TIER_BG_CLASS: Record<TIndexTier, string> = {
  top: "bg-success-subtle-1",
  strong: "bg-accent-subtle",
  mid: "bg-warning-subtle",
  low: "bg-danger-subtle",
};

/** Round to at most one decimal, dropping a trailing ".0". */
export const compactNumber = (value: number): string => {
  const rounded = Math.round(value * 10) / 10;
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
};

export type TDelta = { dir: "up" | "down" | "flat"; label: string; positive: boolean };

/**
 * Period-over-period delta. `goodWhenUp` flips the colour semantics for
 * metrics where a decrease is the good outcome (not used yet, but kept for
 * lead/cycle-time deltas).
 */
export const computeDelta = (current: number, previous: number, goodWhenUp = true): TDelta => {
  const diff = Math.round((current - previous) * 10) / 10;
  if (diff === 0) return { dir: "flat", label: "0", positive: true };
  const dir = diff > 0 ? "up" : "down";
  const positive = goodWhenUp ? diff > 0 : diff < 0;
  return { dir, label: `${diff > 0 ? "+" : ""}${compactNumber(diff)}`, positive };
};
