/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useContext } from "react";
// store
import { StoreContext } from "@/lib/store-context";
import type { IWorkspaceProjectStateStore } from "@/store/workspace-project-state.store";

export const useWorkspaceProjectState = (): IWorkspaceProjectStateStore => {
  const context = useContext(StoreContext);
  if (!context) throw new Error("useWorkspaceProjectState must be used within a StoreProvider");
  return context.workspaceProjectState;
};
