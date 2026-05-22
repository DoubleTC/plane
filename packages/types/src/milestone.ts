/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import type { TLogoProps } from "./common";

export interface IMilestone {
  id: string;
  name: string;
  description: string;
  target_date: string | null;
  color: string | null;
  sort_order: number;
  logo_props: TLogoProps;
  archived_at: string | null;
  // computed issue counts (annotated by API)
  total_issues: number;
  completed_issues: number;
  cancelled_issues: number;
  started_issues: number;
  unstarted_issues: number;
  backlog_issues: number;
  // Relations
  project: string;
  workspace: string;
  // Timestamps / actors
  created_at: string;
  updated_at: string;
  created_by: string | null;
  updated_by: string | null;
}

export interface IMilestoneCreate {
  name: string;
  description?: string;
  target_date?: string | null;
  color?: string | null;
  logo_props?: TLogoProps;
}

export interface IMilestoneUpdate extends Partial<IMilestoneCreate> {
  sort_order?: number;
}

export interface IMilestoneIssue {
  id: string;
  issue: string;
  milestone: string;
  project: string;
  workspace: string;
  created_at: string;
  updated_at: string;
  created_by: string | null;
  updated_by: string | null;
}
