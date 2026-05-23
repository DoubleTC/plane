// Copyright (c) 2023-present Plane Software, Inc. and contributors
// SPDX-License-Identifier: AGPL-3.0-only

import { sortBy } from "lodash-es";
import { action, computed, makeObservable, observable, runInAction } from "mobx";
import { computedFn } from "mobx-utils";
import type { IPhase, IPhaseCreate, IPhaseCycle, IPhaseUpdate } from "@plane/types";
import { PhaseService } from "@/services/phase.service";
import type { CoreRootStore } from "./root.store";

export interface IPhaseStore {
  // State
  loader: boolean;
  fetchedMap: Record<string, boolean>;
  phaseMap: Record<string, IPhase>;
  phaseCyclesMap: Record<string, IPhaseCycle[]>;
  createPhaseModalOpen: boolean;
  // Computed
  currentProjectPhaseIds: string[] | null;
  // Computed fns
  getPhaseFetchStatusByProjectId: (projectId: string) => boolean;
  getPhaseById: (phaseId: string) => IPhase | null;
  getProjectPhaseIds: (projectId: string) => string[] | null;
  getPhaseCyclesByPhaseId: (phaseId: string) => IPhaseCycle[] | null;
  // Toggle
  toggleCreatePhaseModal: (value?: boolean) => void;
  // Fetch
  fetchPhases: (workspaceSlug: string, projectId: string) => Promise<IPhase[]>;
  fetchPhaseDetails: (workspaceSlug: string, projectId: string, phaseId: string) => Promise<IPhase>;
  fetchPhaseCycles: (workspaceSlug: string, projectId: string, phaseId: string) => Promise<IPhaseCycle[]>;
  // CRUD
  createPhase: (workspaceSlug: string, projectId: string, data: IPhaseCreate) => Promise<IPhase>;
  updatePhase: (workspaceSlug: string, projectId: string, phaseId: string, data: IPhaseUpdate) => Promise<IPhase>;
  deletePhase: (workspaceSlug: string, projectId: string, phaseId: string) => Promise<void>;
  // Archive
  archivePhase: (workspaceSlug: string, projectId: string, phaseId: string) => Promise<void>;
  unarchivePhase: (workspaceSlug: string, projectId: string, phaseId: string) => Promise<void>;
  // Cycles
  getPhaseCycles: (workspaceSlug: string, projectId: string, phaseId: string) => Promise<IPhaseCycle[]>;
  addCyclesToPhase: (
    workspaceSlug: string,
    projectId: string,
    phaseId: string,
    cycleIds: string[]
  ) => Promise<IPhaseCycle[]>;
  removeCycleFromPhase: (
    workspaceSlug: string,
    projectId: string,
    phaseId: string,
    phaseCycleId: string
  ) => Promise<void>;
}

export class PhaseStore implements IPhaseStore {
  loader: boolean = false;
  phaseMap: Record<string, IPhase> = {};
  phaseCyclesMap: Record<string, IPhaseCycle[]> = {};
  fetchedMap: Record<string, boolean> = {};
  createPhaseModalOpen: boolean = false;

  rootStore: CoreRootStore;
  phaseService: PhaseService;

  constructor(_rootStore: CoreRootStore) {
    makeObservable(this, {
      loader: observable.ref,
      phaseMap: observable,
      phaseCyclesMap: observable,
      fetchedMap: observable,
      createPhaseModalOpen: observable.ref,
      currentProjectPhaseIds: computed,
      toggleCreatePhaseModal: action,
      fetchPhases: action,
      fetchPhaseDetails: action,
      fetchPhaseCycles: action,
      createPhase: action,
      updatePhase: action,
      deletePhase: action,
      archivePhase: action,
      unarchivePhase: action,
    });
    this.rootStore = _rootStore;
    this.phaseService = new PhaseService();
  }

  // ── Modal ──────────────────────────────────────────────────────────────────

  toggleCreatePhaseModal = (value?: boolean) => {
    this.createPhaseModalOpen = value ?? !this.createPhaseModalOpen;
  };

  // ── Computed ───────────────────────────────────────────────────────────────

  get currentProjectPhaseIds(): string[] | null {
    const projectId = this.rootStore.router.projectId;
    if (!projectId) return null;
    const phases = Object.values(this.phaseMap).filter((p) => p.project === projectId && !p.archived_at);
    return sortBy(phases, "sort_order").map((p) => p.id);
  }

  getPhaseFetchStatusByProjectId = computedFn((projectId: string): boolean => !!this.fetchedMap[projectId]);

  getPhaseById = computedFn((phaseId: string): IPhase | null => this.phaseMap[phaseId] ?? null);

  getProjectPhaseIds = computedFn((projectId: string): string[] | null => {
    const phases = Object.values(this.phaseMap).filter((p) => p.project === projectId && !p.archived_at);
    if (!phases.length) return null;
    return sortBy(phases, "sort_order").map((p) => p.id);
  });

  getPhaseCyclesByPhaseId = computedFn((phaseId: string): IPhaseCycle[] | null => this.phaseCyclesMap[phaseId] ?? null);

  // ── Fetch ──────────────────────────────────────────────────────────────────

  fetchPhases = async (workspaceSlug: string, projectId: string): Promise<IPhase[]> => {
    try {
      runInAction(() => {
        this.loader = true;
      });
      const phases = await this.phaseService.getPhases(workspaceSlug, projectId);
      runInAction(() => {
        for (const p of phases) this.phaseMap[p.id] = p;
        this.fetchedMap[projectId] = true;
        this.loader = false;
      });
      return phases;
    } catch (error) {
      runInAction(() => {
        this.loader = false;
      });
      throw error;
    }
  };

  fetchPhaseDetails = async (workspaceSlug: string, projectId: string, phaseId: string): Promise<IPhase> => {
    const phase = await this.phaseService.getPhaseDetails(workspaceSlug, projectId, phaseId);
    runInAction(() => {
      this.phaseMap[phase.id] = phase;
    });
    return phase;
  };

  // ── CRUD ───────────────────────────────────────────────────────────────────

  createPhase = async (workspaceSlug: string, projectId: string, data: IPhaseCreate): Promise<IPhase> => {
    const phase = await this.phaseService.createPhase(workspaceSlug, projectId, data);
    runInAction(() => {
      this.phaseMap[phase.id] = phase;
    });
    return phase;
  };

  updatePhase = async (
    workspaceSlug: string,
    projectId: string,
    phaseId: string,
    data: IPhaseUpdate
  ): Promise<IPhase> => {
    const existing = this.phaseMap[phaseId];
    if (existing)
      runInAction(() => {
        this.phaseMap[phaseId] = { ...existing, ...data } as IPhase;
      });
    try {
      const updated = await this.phaseService.updatePhase(workspaceSlug, projectId, phaseId, data);
      runInAction(() => {
        this.phaseMap[phaseId] = updated;
      });
      return updated;
    } catch (error) {
      if (existing)
        runInAction(() => {
          this.phaseMap[phaseId] = existing;
        });
      throw error;
    }
  };

  deletePhase = async (workspaceSlug: string, projectId: string, phaseId: string): Promise<void> => {
    const existing = this.phaseMap[phaseId];
    runInAction(() => {
      delete this.phaseMap[phaseId];
    });
    try {
      await this.phaseService.deletePhase(workspaceSlug, projectId, phaseId);
    } catch (error) {
      if (existing)
        runInAction(() => {
          this.phaseMap[phaseId] = existing;
        });
      throw error;
    }
  };

  // ── Archive ────────────────────────────────────────────────────────────────

  archivePhase = async (workspaceSlug: string, projectId: string, phaseId: string): Promise<void> => {
    const result = await this.phaseService.archivePhase(workspaceSlug, projectId, phaseId);
    runInAction(() => {
      if (this.phaseMap[phaseId])
        this.phaseMap[phaseId] = { ...this.phaseMap[phaseId], archived_at: result.archived_at };
    });
  };

  unarchivePhase = async (workspaceSlug: string, projectId: string, phaseId: string): Promise<void> => {
    await this.phaseService.unarchivePhase(workspaceSlug, projectId, phaseId);
    runInAction(() => {
      if (this.phaseMap[phaseId]) this.phaseMap[phaseId] = { ...this.phaseMap[phaseId], archived_at: null };
    });
  };

  // ── Cycles ─────────────────────────────────────────────────────────────────

  fetchPhaseCycles = async (workspaceSlug: string, projectId: string, phaseId: string): Promise<IPhaseCycle[]> => {
    const cycles = await this.phaseService.getPhaseCycles(workspaceSlug, projectId, phaseId);
    runInAction(() => {
      this.phaseCyclesMap[phaseId] = cycles;
    });
    return cycles;
  };

  getPhaseCycles = async (workspaceSlug: string, projectId: string, phaseId: string): Promise<IPhaseCycle[]> =>
    this.phaseService.getPhaseCycles(workspaceSlug, projectId, phaseId);

  addCyclesToPhase = async (
    workspaceSlug: string,
    projectId: string,
    phaseId: string,
    cycleIds: string[]
  ): Promise<IPhaseCycle[]> => {
    const result = await this.phaseService.addCyclesToPhase(workspaceSlug, projectId, phaseId, cycleIds);
    await Promise.all([
      this.fetchPhaseDetails(workspaceSlug, projectId, phaseId),
      this.fetchPhaseCycles(workspaceSlug, projectId, phaseId),
    ]);
    return result;
  };

  removeCycleFromPhase = async (
    workspaceSlug: string,
    projectId: string,
    phaseId: string,
    phaseCycleId: string
  ): Promise<void> => {
    // Optimistic update
    runInAction(() => {
      if (this.phaseCyclesMap[phaseId]) {
        this.phaseCyclesMap[phaseId] = this.phaseCyclesMap[phaseId].filter((pc) => pc.id !== phaseCycleId);
      }
    });
    await this.phaseService.removeCycleFromPhase(workspaceSlug, projectId, phaseId, phaseCycleId);
    await this.fetchPhaseDetails(workspaceSlug, projectId, phaseId);
  };
}
