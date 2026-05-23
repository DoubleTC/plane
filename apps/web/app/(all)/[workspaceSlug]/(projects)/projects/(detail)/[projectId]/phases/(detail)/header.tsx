// Copyright (c) 2023-present Plane Software, Inc. and contributors
// SPDX-License-Identifier: AGPL-3.0-only

import { useRef, useState } from "react";
import { observer } from "mobx-react";
import { useParams } from "next/navigation";
import { Milestone, PanelRight } from "lucide-react";
// plane imports
import { EUserPermissions, EUserPermissionsLevel } from "@plane/constants";
import { useTranslation } from "@plane/i18n";
import { Button } from "@plane/propel/button";
import { IconButton } from "@plane/propel/icon-button";
import { Breadcrumbs, Header } from "@plane/ui";
import { cn } from "@plane/utils";
// components
import { BreadcrumbLink } from "@/components/common/breadcrumb-link";
import { AddCyclesToPhaseModal } from "@/components/phases/add-cycles-to-phase-modal";
import { PhaseQuickActions } from "@/components/phases/phase-quick-actions";
// hooks
import { usePhase } from "@/hooks/store/use-phase";
import { useProject } from "@/hooks/store/use-project";
import { useUserPermissions } from "@/hooks/store/user";
import { useAppRouter } from "@/hooks/use-app-router";
import useLocalStorage from "@/hooks/use-local-storage";
import { CommonProjectBreadcrumbs } from "@/plane-web/components/breadcrumbs/common";
export const PhaseDetailHeader = observer(function PhaseDetailHeader() {
  const parentRef = useRef<HTMLDivElement>(null);
  const router = useAppRouter();
  const { workspaceSlug, projectId, phaseId } = useParams();
  // store hooks
  const { t } = useTranslation();
  const { loader } = useProject();
  const { getPhaseById, getPhaseCycles } = usePhase();
  const { allowPermissions } = useUserPermissions();
  // sidebar state
  const { storedValue, setValue } = useLocalStorage("phase_detail_sidebar_collapsed", "false");
  const isSidebarCollapsed = storedValue === "true";
  // local state
  const [addCyclesModal, setAddCyclesModal] = useState(false);
  const [linkedCycleIds, setLinkedCycleIds] = useState<string[]>([]);

  const phase = phaseId ? getPhaseById(phaseId.toString()) : undefined;
  const canEdit = allowPermissions([EUserPermissions.ADMIN, EUserPermissions.MEMBER], EUserPermissionsLevel.PROJECT);

  const handleOpenAddCycles = async () => {
    if (!workspaceSlug || !projectId || !phaseId) return;
    try {
      const existing = await getPhaseCycles(workspaceSlug.toString(), projectId.toString(), phaseId.toString());
      setLinkedCycleIds(existing.map((pc) => pc.cycle));
    } catch {
      setLinkedCycleIds([]);
    }
    setAddCyclesModal(true);
  };

  return (
    <>
      {workspaceSlug && projectId && phaseId && (
        <AddCyclesToPhaseModal
          isOpen={addCyclesModal}
          onClose={() => setAddCyclesModal(false)}
          workspaceSlug={workspaceSlug.toString()}
          projectId={projectId.toString()}
          phaseId={phaseId.toString()}
          linkedCycleIds={linkedCycleIds}
        />
      )}
      <Header>
        <Header.LeftItem>
          <Breadcrumbs onBack={router.back} isLoading={loader === "init-loader"}>
            <CommonProjectBreadcrumbs workspaceSlug={workspaceSlug?.toString()} projectId={projectId?.toString()} />
            <Breadcrumbs.Item
              component={
                <BreadcrumbLink
                  label={t("phase.page_title")}
                  href={`/${workspaceSlug}/projects/${projectId}/phases/`}
                  icon={<Milestone className="h-4 w-4 text-tertiary" />}
                />
              }
            />
            <Breadcrumbs.Item
              component={
                <BreadcrumbLink
                  label={phase?.name ?? "..."}
                  href={`/${workspaceSlug}/projects/${projectId}/phases/${phaseId}`}
                  icon={<Milestone className="h-4 w-4 text-tertiary" />}
                  isLast
                />
              }
              isLast
            />
          </Breadcrumbs>
        </Header.LeftItem>
        <Header.RightItem className="items-center">
          {canEdit && !phase?.archived_at && (
            <Button variant="secondary" size="lg" onClick={handleOpenAddCycles}>
              {t("phase.add_cycles")}
            </Button>
          )}
          <IconButton
            variant="tertiary"
            size="lg"
            icon={PanelRight}
            onClick={() => setValue(`${!isSidebarCollapsed}`)}
            className={cn({ "bg-accent-subtle text-accent-primary": !isSidebarCollapsed })}
          />
          {workspaceSlug && projectId && phaseId && (
            <PhaseQuickActions
              parentRef={parentRef}
              phaseId={phaseId.toString()}
              projectId={projectId.toString()}
              workspaceSlug={workspaceSlug.toString()}
            />
          )}
        </Header.RightItem>
      </Header>
    </>
  );
});
