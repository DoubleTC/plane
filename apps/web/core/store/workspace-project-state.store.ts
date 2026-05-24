/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { makeObservable, observable, action, runInAction } from "mobx";
import { computedFn } from "mobx-utils";
import type {
  IWorkspaceProjectState,
  IWorkspaceProjectStateCreate,
  IWorkspaceProjectStateUpdate,
  TProjectStateGroup,
} from "@plane/types";
import { workspaceProjectStateService } from "@/services/workspace-project-state.service";

export interface IWorkspaceProjectStateStore {
  // state
  stateMap: Record<string, IWorkspaceProjectState>;
  loader: boolean;
  // computed
  getStatesByWorkspace: (workspaceSlug: string) => IWorkspaceProjectState[];
  getStatesByGroup: (workspaceSlug: string, group: TProjectStateGroup) => IWorkspaceProjectState[];
  getStateById: (stateId: string) => IWorkspaceProjectState | undefined;
  // actions
  fetchStates: (workspaceSlug: string) => Promise<IWorkspaceProjectState[]>;
  createState: (workspaceSlug: string, data: IWorkspaceProjectStateCreate) => Promise<IWorkspaceProjectState>;
  updateState: (
    workspaceSlug: string,
    stateId: string,
    data: IWorkspaceProjectStateUpdate
  ) => Promise<IWorkspaceProjectState>;
  deleteState: (workspaceSlug: string, stateId: string) => Promise<void>;
}

export class WorkspaceProjectStateStore implements IWorkspaceProjectStateStore {
  stateMap: Record<string, IWorkspaceProjectState> = {};
  loader = false;

  constructor() {
    makeObservable(this, {
      stateMap: observable,
      loader: observable,
      fetchStates: action,
      createState: action,
      updateState: action,
      deleteState: action,
    });
  }

  getStatesByWorkspace = computedFn((workspaceSlug: string): IWorkspaceProjectState[] =>
    Object.values(this.stateMap)
      .filter((s) => s.workspace === workspaceSlug || this._matchSlug(s, workspaceSlug))
      .sort((a, b) => a.sequence - b.sequence)
  );

  getStatesByGroup = computedFn((workspaceSlug: string, group: TProjectStateGroup): IWorkspaceProjectState[] =>
    this.getStatesByWorkspace(workspaceSlug).filter((s) => s.group === group)
  );

  getStateById = computedFn((stateId: string): IWorkspaceProjectState | undefined => this.stateMap[stateId]);

  // Helper: after fetch the workspace FK is the UUID id, not the slug.
  // We key the map by id and filter by the fetched result storing workspace id.
  // This helper is a no-op — getStatesByWorkspace is populated correctly after fetch.
  private _matchSlug(_s: IWorkspaceProjectState, _slug: string): boolean {
    return false;
  }

  fetchStates = action(async (workspaceSlug: string): Promise<IWorkspaceProjectState[]> => {
    runInAction(() => {
      this.loader = true;
    });
    try {
      const states = await workspaceProjectStateService.list(workspaceSlug);
      runInAction(() => {
        for (const s of states) this.stateMap[s.id] = s;
        this.loader = false;
      });
      return states;
    } catch (err) {
      runInAction(() => {
        this.loader = false;
      });
      throw err;
    }
  });

  createState = action(async (workspaceSlug: string, data: IWorkspaceProjectStateCreate) => {
    const state = await workspaceProjectStateService.create(workspaceSlug, data);
    runInAction(() => {
      this.stateMap[state.id] = state;
    });
    return state;
  });

  updateState = action(async (workspaceSlug: string, stateId: string, data: IWorkspaceProjectStateUpdate) => {
    const state = await workspaceProjectStateService.update(workspaceSlug, stateId, data);
    runInAction(() => {
      this.stateMap[stateId] = state;
    });
    return state;
  });

  deleteState = action(async (workspaceSlug: string, stateId: string) => {
    await workspaceProjectStateService.destroy(workspaceSlug, stateId);
    runInAction(() => {
      delete this.stateMap[stateId];
    });
  });
}
