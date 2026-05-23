// Copyright (c) 2023-present Plane Software, Inc. and contributors
// SPDX-License-Identifier: AGPL-3.0-only

export interface IPhase {
  id: string;
  name: string;
  description?: string | null;
  start_date?: string | null;
  end_date?: string | null;
  sort_order: number;
  archived_at?: string | null;
  project: string;
  workspace: string;
  created_at: string;
  updated_at: string;
  created_by?: string;
  updated_by?: string;
  // Annotated counts from the backend
  total_cycles: number;
  completed_cycles: number;
}

export interface IPhaseCreate {
  name: string;
  description?: string;
  start_date?: string | null;
  end_date?: string | null;
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
