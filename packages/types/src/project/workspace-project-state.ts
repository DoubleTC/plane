/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

export type TProjectStateGroup = "draft" | "planning" | "execution" | "monitoring" | "completed" | "cancelled";

export interface IWorkspaceProjectState {
  readonly id: string;
  workspace: string;
  name: string;
  description?: string | null;
  group: TProjectStateGroup;
  color: string;
  sequence: number;
  // Audit
  readonly created_at: string;
  readonly updated_at: string;
  readonly created_by?: string;
  readonly updated_by?: string;
}

export interface IWorkspaceProjectStateCreate {
  name: string;
  description?: string;
  group: TProjectStateGroup;
  color?: string;
}

export type IWorkspaceProjectStateUpdate = Partial<IWorkspaceProjectStateCreate> & {
  sequence?: number;
};

export const PROJECT_STATE_GROUPS: { key: TProjectStateGroup; label: string; color: string }[] = [
  { key: "draft", label: "Draft", color: "#94A3B8" },
  { key: "planning", label: "Planning", color: "#60A5FA" },
  { key: "execution", label: "Execution", color: "#F59E0B" },
  { key: "monitoring", label: "Monitoring", color: "#A78BFA" },
  { key: "completed", label: "Completed", color: "#34D399" },
  { key: "cancelled", label: "Cancelled", color: "#9AA4BC" },
];
