/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { set } from "lodash-es";
import { action, computed, observable, makeObservable, runInAction, reaction } from "mobx";
import { computedFn } from "mobx-utils";
// types
import type { TPhaseDisplayFilters } from "@plane/types";
// helpers
import { storage } from "@/lib/local-storage";
// store
import type { CoreRootStore } from "./root.store";

// localStorage key
const PHASE_DISPLAY_FILTERS_KEY = "phase_display_filters";

export interface IPhaseFilterStore {
  // observables
  displayFilters: Record<string, TPhaseDisplayFilters>;
  searchQuery: string;
  // computed
  currentProjectDisplayFilters: TPhaseDisplayFilters | undefined;
  // computed functions
  getDisplayFiltersByProjectId: (projectId: string) => TPhaseDisplayFilters | undefined;
  // actions
  updateDisplayFilters: (projectId: string, displayFilters: TPhaseDisplayFilters) => void;
  updateSearchQuery: (query: string) => void;
}

export class PhaseFilterStore implements IPhaseFilterStore {
  // observables
  displayFilters: Record<string, TPhaseDisplayFilters> = {};
  searchQuery: string = "";
  // root store
  rootStore: CoreRootStore;

  constructor(_rootStore: CoreRootStore) {
    makeObservable(this, {
      // observables
      displayFilters: observable,
      searchQuery: observable.ref,
      // computed
      currentProjectDisplayFilters: computed,
      // actions
      updateDisplayFilters: action,
      updateSearchQuery: action,
    });
    // root store
    this.rootStore = _rootStore;

    // initialize display filters of the current project
    reaction(
      () => this.rootStore.router.projectId,
      (projectId) => {
        if (!projectId) return;
        this.initProjectPhaseFilters(projectId);
        this.searchQuery = "";
      }
    );

    // Load initial data from localStorage after reactions are set up
    this.loadFromLocalStorage();
  }

  /**
   * @description Load filters from localStorage
   */
  loadFromLocalStorage = () => {
    try {
      const displayFiltersData = storage.get(PHASE_DISPLAY_FILTERS_KEY);
      runInAction(() => {
        if (displayFiltersData) {
          const parsed = JSON.parse(displayFiltersData);
          if (typeof parsed === "object" && parsed !== null) {
            this.displayFilters = parsed;
          }
        }
      });
    } catch (error) {
      console.error("Failed to load phase filters from localStorage:", error);
      runInAction(() => {
        this.displayFilters = {};
      });
    }
  };

  /**
   * @description Save display filters to localStorage
   */
  saveDisplayFiltersToLocalStorage = () => {
    storage.set(PHASE_DISPLAY_FILTERS_KEY, this.displayFilters);
  };

  /**
   * @description get display filters of the current project
   */
  get currentProjectDisplayFilters() {
    const projectId = this.rootStore.router.projectId;
    if (!projectId) return;
    return this.displayFilters[projectId];
  }

  /**
   * @description get display filters of a project by projectId
   * @param {string} projectId
   */
  getDisplayFiltersByProjectId = computedFn((projectId: string) => this.displayFilters[projectId]);

  /**
   * @description initialize display filters of a project
   * @param {string} projectId
   */
  initProjectPhaseFilters = (projectId: string) => {
    const displayFilters = this.getDisplayFiltersByProjectId(projectId);
    runInAction(() => {
      this.displayFilters[projectId] = {
        layout: displayFilters?.layout || "list",
      };
    });
    this.saveDisplayFiltersToLocalStorage();
  };

  /**
   * @description update display filters of a project
   * @param {string} projectId
   * @param {TPhaseDisplayFilters} displayFilters
   */
  updateDisplayFilters = (projectId: string, displayFilters: TPhaseDisplayFilters) => {
    runInAction(() => {
      Object.keys(displayFilters).forEach((key) => {
        set(this.displayFilters, [projectId, key], displayFilters[key as keyof TPhaseDisplayFilters]);
      });
    });
    this.saveDisplayFiltersToLocalStorage();
  };

  /**
   * @description update search query
   * @param {string} query
   */
  updateSearchQuery = (query: string) => {
    this.searchQuery = query;
  };
}
