// Copyright (c) 2023-present Plane Software, Inc. and contributors
// SPDX-License-Identifier: AGPL-3.0-only

export type TPhaseStatus = "backlog" | "planned" | "in-progress" | "paused" | "completed" | "cancelled";

export interface IPhase {
  id: string;
  name: string;
  description?: string | null;
  status: TPhaseStatus;
  start_date?: string | null;
  end_date?: string | null;
  lead_id?: string | null;
  member_ids: string[];
  sort_order: number;
  archived_at?: string | null;
  project: string;
  workspace: string;
  created_at: string;
  updated_at: string;
  created_by?: string;
  updated_by?: string;
  // Annotated counts and flags from the backend
  total_cycles: number;
  completed_cycles: number;
  is_favorite: boolean;
}

export interface IPhaseCreate {
  name: string;
  description?: string;
  status?: TPhaseStatus;
  start_date?: string | null;
  end_date?: string | null;
  lead_id?: string | null;
  member_ids?: string[];
}

export interface IPhaseUpdate extends Partial<IPhaseCreate> {
  sort_order?: number;
  archived_at?: string | null;
}

export interface IPhaseCycle {
  id: string;
  phase: string;
  cycle: string;
  project: string;
  workspace: string;
}
