/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { sortBy } from "lodash-es";
import { action, computed, makeObservable, observable, runInAction } from "mobx";
import { computedFn } from "mobx-utils";
// types
import type { IMilestone, IMilestoneCreate, IMilestoneIssue, IMilestoneUpdate } from "@plane/types";
// services
import { MilestoneService } from "@/services/milestone.service";
// store
import type { CoreRootStore } from "./root.store";

export interface IMilestoneStore {
  // Loaders
  loader: boolean;
  fetchedMap: Record<string, boolean>;
  // Observables
  milestoneMap: Record<string, IMilestone>;
  // Computed
  currentProjectMilestoneIds: string[] | null;
  // Computed actions
  getMilestoneFetchStatusByProjectId: (projectId: string) => boolean;
  getMilestoneById: (milestoneId: string) => IMilestone | null;
  getProjectMilestoneIds: (projectId: string) => string[] | null;
  // Fetch
  fetchMilestones: (workspaceSlug: string, projectId: string) => Promise<IMilestone[]>;
  fetchMilestoneDetails: (workspaceSlug: string, projectId: string, milestoneId: string) => Promise<IMilestone>;
  // CRUD
  createMilestone: (workspaceSlug: string, projectId: string, data: IMilestoneCreate) => Promise<IMilestone>;
  updateMilestone: (
    workspaceSlug: string,
    projectId: string,
    milestoneId: string,
    data: IMilestoneUpdate
  ) => Promise<IMilestone>;
  deleteMilestone: (workspaceSlug: string, projectId: string, milestoneId: string) => Promise<void>;
  // Archive
  archiveMilestone: (workspaceSlug: string, projectId: string, milestoneId: string) => Promise<void>;
  unarchiveMilestone: (workspaceSlug: string, projectId: string, milestoneId: string) => Promise<void>;
  // Issues
  getMilestoneIssues: (workspaceSlug: string, projectId: string, milestoneId: string) => Promise<IMilestoneIssue[]>;
  addIssuesToMilestone: (
    workspaceSlug: string,
    projectId: string,
    milestoneId: string,
    issueIds: string[]
  ) => Promise<IMilestoneIssue[]>;
  removeIssueFromMilestone: (
    workspaceSlug: string,
    projectId: string,
    milestoneId: string,
    milestoneIssueId: string
  ) => Promise<void>;
}

export class MilestoneStore implements IMilestoneStore {
  // Observables
  loader: boolean = false;
  milestoneMap: Record<string, IMilestone> = {};
  fetchedMap: Record<string, boolean> = {};
  // Root store
  rootStore: CoreRootStore;
  // Services
  milestoneService: MilestoneService;

  constructor(_rootStore: CoreRootStore) {
    makeObservable(this, {
      // Observables
      loader: observable.ref,
      milestoneMap: observable,
      fetchedMap: observable,
      // Computed
      currentProjectMilestoneIds: computed,
      // Actions
      fetchMilestones: action,
      fetchMilestoneDetails: action,
      createMilestone: action,
      updateMilestone: action,
      deleteMilestone: action,
      archiveMilestone: action,
      unarchiveMilestone: action,
    });
    this.rootStore = _rootStore;
    this.milestoneService = new MilestoneService();
  }

  // -------------------------------------------------------------------------
  // Computed
  // -------------------------------------------------------------------------

  get currentProjectMilestoneIds(): string[] | null {
    const projectId = this.rootStore.router.projectId;
    if (!projectId) return null;
    const milestones = Object.values(this.milestoneMap).filter(
      (m) => m.project === projectId && !m.archived_at
    );
    return sortBy(milestones, "sort_order").map((m) => m.id);
  }

  getMilestoneFetchStatusByProjectId = computedFn((projectId: string): boolean => {
    return !!this.fetchedMap[projectId];
  });

  getMilestoneById = computedFn((milestoneId: string): IMilestone | null => {
    return this.milestoneMap[milestoneId] ?? null;
  });

  getProjectMilestoneIds = computedFn((projectId: string): string[] | null => {
    const milestones = Object.values(this.milestoneMap).filter(
      (m) => m.project === projectId && !m.archived_at
    );
    if (!milestones.length) return null;
    return sortBy(milestones, "sort_order").map((m) => m.id);
  });

  // -------------------------------------------------------------------------
  // Fetch
  // -------------------------------------------------------------------------

  fetchMilestones = async (workspaceSlug: string, projectId: string): Promise<IMilestone[]> => {
    try {
      this.loader = true;
      const milestones = await this.milestoneService.getMilestones(workspaceSlug, projectId);
      runInAction(() => {
        for (const milestone of milestones) {
          this.milestoneMap[milestone.id] = milestone;
        }
        this.fetchedMap[projectId] = true;
        this.loader = false;
      });
      return milestones;
    } catch (error) {
      runInAction(() => {
        this.loader = false;
      });
      throw error;
    }
  };

  fetchMilestoneDetails = async (
    workspaceSlug: string,
    projectId: string,
    milestoneId: string
  ): Promise<IMilestone> => {
    const milestone = await this.milestoneService.getMilestoneDetails(workspaceSlug, projectId, milestoneId);
    runInAction(() => {
      this.milestoneMap[milestone.id] = milestone;
    });
    return milestone;
  };

  // -------------------------------------------------------------------------
  // CRUD
  // -------------------------------------------------------------------------

  createMilestone = async (
    workspaceSlug: string,
    projectId: string,
    data: IMilestoneCreate
  ): Promise<IMilestone> => {
    const milestone = await this.milestoneService.createMilestone(workspaceSlug, projectId, data);
    runInAction(() => {
      this.milestoneMap[milestone.id] = milestone;
    });
    return milestone;
  };

  updateMilestone = async (
    workspaceSlug: string,
    projectId: string,
    milestoneId: string,
    data: IMilestoneUpdate
  ): Promise<IMilestone> => {
    // Optimistic update
    const existing = this.milestoneMap[milestoneId];
    if (existing) {
      runInAction(() => {
        this.milestoneMap[milestoneId] = { ...existing, ...data } as IMilestone;
      });
    }
    try {
      const updated = await this.milestoneService.updateMilestone(workspaceSlug, projectId, milestoneId, data);
      runInAction(() => {
        this.milestoneMap[milestoneId] = updated;
      });
      return updated;
    } catch (error) {
      // Rollback
      if (existing) {
        runInAction(() => {
          this.milestoneMap[milestoneId] = existing;
        });
      }
      throw error;
    }
  };

  deleteMilestone = async (workspaceSlug: string, projectId: string, milestoneId: string): Promise<void> => {
    const existing = this.milestoneMap[milestoneId];
    runInAction(() => {
      delete this.milestoneMap[milestoneId];
    });
    try {
      await this.milestoneService.deleteMilestone(workspaceSlug, projectId, milestoneId);
    } catch (error) {
      // Rollback
      if (existing) {
        runInAction(() => {
          this.milestoneMap[milestoneId] = existing;
        });
      }
      throw error;
    }
  };

  // -------------------------------------------------------------------------
  // Archive
  // -------------------------------------------------------------------------

  archiveMilestone = async (workspaceSlug: string, projectId: string, milestoneId: string): Promise<void> => {
    const result = await this.milestoneService.archiveMilestone(workspaceSlug, projectId, milestoneId);
    runInAction(() => {
      if (this.milestoneMap[milestoneId]) {
        this.milestoneMap[milestoneId] = {
          ...this.milestoneMap[milestoneId],
          archived_at: result.archived_at,
        };
      }
    });
  };

  unarchiveMilestone = async (workspaceSlug: string, projectId: string, milestoneId: string): Promise<void> => {
    await this.milestoneService.unarchiveMilestone(workspaceSlug, projectId, milestoneId);
    runInAction(() => {
      if (this.milestoneMap[milestoneId]) {
        this.milestoneMap[milestoneId] = {
          ...this.milestoneMap[milestoneId],
          archived_at: null,
        };
      }
    });
  };

  // -------------------------------------------------------------------------
  // Issues
  // -------------------------------------------------------------------------

  getMilestoneIssues = async (
    workspaceSlug: string,
    projectId: string,
    milestoneId: string
  ): Promise<IMilestoneIssue[]> => {
    return this.milestoneService.getMilestoneIssues(workspaceSlug, projectId, milestoneId);
  };

  addIssuesToMilestone = async (
    workspaceSlug: string,
    projectId: string,
    milestoneId: string,
    issueIds: string[]
  ): Promise<IMilestoneIssue[]> => {
    const result = await this.milestoneService.addIssuesToMilestone(workspaceSlug, projectId, milestoneId, issueIds);
    // Refresh milestone to get updated counts
    await this.fetchMilestoneDetails(workspaceSlug, projectId, milestoneId);
    return result;
  };

  removeIssueFromMilestone = async (
    workspaceSlug: string,
    projectId: string,
    milestoneId: string,
    milestoneIssueId: string
  ): Promise<void> => {
    await this.milestoneService.removeIssueFromMilestone(workspaceSlug, projectId, milestoneId, milestoneIssueId);
    // Refresh milestone to get updated counts
    await this.fetchMilestoneDetails(workspaceSlug, projectId, milestoneId);
  };
}
