// Copyright (c) 2023-present Plane Software, Inc. and contributors
// SPDX-License-Identifier: AGPL-3.0-only

import { useContext } from "react";
import { StoreContext } from "@/lib/store-context";
import type { IPhaseStore } from "@/store/phase.store";

export const usePhase = (): IPhaseStore => {
  const context = useContext(StoreContext);
  if (context === undefined) throw new Error("usePhase must be used within StoreProvider");
  return context.phase;
};
