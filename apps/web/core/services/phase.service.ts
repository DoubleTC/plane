// Copyright (c) 2023-present Plane Software, Inc. and contributors
// SPDX-License-Identifier: AGPL-3.0-only

import { API_BASE_URL } from "@plane/constants";
import type { IPhase, IPhaseCreate, IPhaseUpdate, IPhaseCycle } from "@plane/types";
import { APIService } from "@/services/api.service";

export class PhaseService extends APIService {
  constructor() {
    super(API_BASE_URL);
  }

  private base(workspaceSlug: string, projectId: string) {
    return `/workspaces/${workspaceSlug}/projects/${projectId}/phases`;
  }

  getPhases(workspaceSlug: string, projectId: string): Promise<IPhase[]> {
    return this.get(`${this.base(workspaceSlug, projectId)}/`).then((r) => r.data as IPhase[]);
  }

  getPhaseDetails(workspaceSlug: string, projectId: string, phaseId: string): Promise<IPhase> {
    return this.get(`${this.base(workspaceSlug, projectId)}/${phaseId}/`).then((r) => r.data as IPhase);
  }

  createPhase(workspaceSlug: string, projectId: string, data: IPhaseCreate): Promise<IPhase> {
    return this.post(`${this.base(workspaceSlug, projectId)}/`, data).then((r) => r.data as IPhase);
  }

  updatePhase(workspaceSlug: string, projectId: string, phaseId: string, data: IPhaseUpdate): Promise<IPhase> {
    return this.patch(`${this.base(workspaceSlug, projectId)}/${phaseId}/`, data).then((r) => r.data as IPhase);
  }

  deletePhase(workspaceSlug: string, projectId: string, phaseId: string): Promise<void> {
    return this.delete(`${this.base(workspaceSlug, projectId)}/${phaseId}/`).then(() => undefined);
  }

  archivePhase(workspaceSlug: string, projectId: string, phaseId: string): Promise<{ archived_at: string }> {
    return this.post(`${this.base(workspaceSlug, projectId)}/${phaseId}/archive/`).then(
      (r) => r.data as { archived_at: string }
    );
  }

  unarchivePhase(workspaceSlug: string, projectId: string, phaseId: string): Promise<void> {
    return this.delete(`${this.base(workspaceSlug, projectId)}/${phaseId}/archive/`).then(() => undefined);
  }

  // Cycles
  getPhaseCycles(workspaceSlug: string, projectId: string, phaseId: string): Promise<IPhaseCycle[]> {
    return this.get(`${this.base(workspaceSlug, projectId)}/${phaseId}/cycles/`).then((r) => r.data as IPhaseCycle[]);
  }

  addCyclesToPhase(
    workspaceSlug: string,
    projectId: string,
    phaseId: string,
    cycleIds: string[]
  ): Promise<IPhaseCycle[]> {
    return this.post(`${this.base(workspaceSlug, projectId)}/${phaseId}/cycles/`, {
      cycles: cycleIds,
    }).then((r) => r.data as IPhaseCycle[]);
  }

  removeCycleFromPhase(workspaceSlug: string, projectId: string, phaseId: string, phaseCycleId: string): Promise<void> {
    return this.delete(`${this.base(workspaceSlug, projectId)}/${phaseId}/cycles/${phaseCycleId}/`).then(
      () => undefined
    );
  }
}
