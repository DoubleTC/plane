/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { autorun } from "mobx";
// Store
import type { RootStore } from "@/plane-web/store/root.store";
import { BaseTimeLineStore } from "@/plane-web/store/timeline/base-timeline.store";
import type { IBaseTimelineStore } from "@/plane-web/store/timeline/base-timeline.store";

export interface IPhasesTimeLineStore extends IBaseTimelineStore {}

export class PhasesTimeLineStore extends BaseTimeLineStore implements IPhasesTimeLineStore {
  constructor(_rootStore: RootStore) {
    super(_rootStore);

    autorun(() => {
      const getPhaseById = this.rootStore.phase.getPhaseById;
      this.updateBlocks((id) => {
        const phase = getPhaseById(id);
        if (!phase) return null;
        return {
          id: phase.id,
          name: phase.name,
          sort_order: phase.sort_order,
          start_date: phase.start_date ?? undefined,
          target_date: phase.end_date ?? undefined, // map end_date → target_date
          project_id: phase.project, // map project → project_id
        };
      });
    });
  }
}
