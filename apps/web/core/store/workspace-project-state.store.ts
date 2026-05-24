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

  /**
   * Slug-keyed index: workspaceSlug → Set of state IDs belonging to that workspace.
   *
   * The Django API returns `workspace` as a UUID FK, not the slug used in URL params.
   * Filtering `stateMap` by `s.workspace === workspaceSlug` would never match.
   * We therefore maintain this separate index, populated on every mutating action,
   * so `getStatesByWorkspace` can look states up without the UUID/slug mismatch.
   */
  private slugToIds: Record<string, Set<string>> = {};

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

  // ── Computed helpers ────────────────────────────────────────────────────────

  getStatesByWorkspace = computedFn((workspaceSlug: string): IWorkspaceProjectState[] => {
    const ids = this.slugToIds[workspaceSlug];
    if (!ids) return [];
    const items = Array.from(ids)
      .map((id) => this.stateMap[id])
      .filter((s): s is IWorkspaceProjectState => !!s);
    // eslint-disable-next-line unicorn/no-array-sort
    return [...items].sort((a, b) => a.sequence - b.sequence);
  });

  getStatesByGroup = computedFn((workspaceSlug: string, group: TProjectStateGroup): IWorkspaceProjectState[] =>
    this.getStatesByWorkspace(workspaceSlug).filter((s) => s.group === group)
  );

  getStateById = computedFn((stateId: string): IWorkspaceProjectState | undefined => this.stateMap[stateId]);

  // ── Private helpers ─────────────────────────────────────────────────────────

  private _ensureSlugSet(workspaceSlug: string): void {
    if (!this.slugToIds[workspaceSlug]) {
      this.slugToIds[workspaceSlug] = new Set();
    }
  }

  // ── Actions ─────────────────────────────────────────────────────────────────

  fetchStates = action(async (workspaceSlug: string): Promise<IWorkspaceProjectState[]> => {
    runInAction(() => {
      this.loader = true;
    });
    try {
      const states = await workspaceProjectStateService.list(workspaceSlug);
      runInAction(() => {
        this._ensureSlugSet(workspaceSlug);
        for (const s of states) {
          this.stateMap[s.id] = s;
          this.slugToIds[workspaceSlug].add(s.id);
        }
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
      this._ensureSlugSet(workspaceSlug);
      this.slugToIds[workspaceSlug].add(state.id);
    });
    return state;
  });

  updateState = action(async (workspaceSlug: string, stateId: string, data: IWorkspaceProjectStateUpdate) => {
    const state = await workspaceProjectStateService.update(workspaceSlug, stateId, data);
    runInAction(() => {
      // If this update marks a state as default, clear is_default on all others in the workspace
      if (data.is_default) {
        const ids = this.slugToIds[workspaceSlug];
        if (ids) {
          for (const id of ids) {
            if (id !== stateId && this.stateMap[id]?.is_default) {
              this.stateMap[id] = { ...this.stateMap[id], is_default: false };
            }
          }
        }
      }
      this.stateMap[stateId] = state;
    });
    return state;
  });

  deleteState = action(async (workspaceSlug: string, stateId: string) => {
    await workspaceProjectStateService.destroy(workspaceSlug, stateId);
    runInAction(() => {
      delete this.stateMap[stateId];
      this.slugToIds[workspaceSlug]?.delete(stateId);
    });
  });
}
