/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import type { AnalyticsTab } from "@plane/types";
import { MembersAnalytics } from "@/components/analytics/members";
import { Overview } from "@/components/analytics/overview";
import { ProjectsAnalytics } from "@/components/analytics/projects";
import { WorkItems } from "@/components/analytics/work-items";

export const getAnalyticsTabs = (t: (key: string, params?: Record<string, any>) => string): AnalyticsTab[] => [
  { key: "overview", label: t("common.overview"), content: Overview, isDisabled: false },
  { key: "projects", label: t("analytics_project.tab"), content: ProjectsAnalytics, isDisabled: false },
  { key: "members", label: t("members_analytics.tab"), content: MembersAnalytics, isDisabled: false },
  { key: "work-items", label: t("sidebar.work_items"), content: WorkItems, isDisabled: false },
];
