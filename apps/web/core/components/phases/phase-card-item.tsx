// Copyright (c) 2023-present Plane Software, Inc. and contributors
// SPDX-License-Identifier: AGPL-3.0-only

import React, { useRef } from "react";
import { observer } from "mobx-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { SquareUser } from "lucide-react";
// plane package imports
import { MODULE_STATUS, EUserPermissions, EUserPermissionsLevel, IS_FAVORITE_MENU_OPEN } from "@plane/constants";
import { useLocalStorage } from "@plane/hooks";
import { useTranslation } from "@plane/i18n";
import { ModuleStatusIcon } from "@plane/propel/icons";
import { setPromiseToast } from "@plane/propel/toast";
import { Tooltip } from "@plane/propel/tooltip";
import { Card, CircularProgressIndicator, FavoriteStar } from "@plane/ui";
import { getDate, renderFormattedPayloadDate } from "@plane/utils";
// components
import { DateRangeDropdown } from "@/components/dropdowns/date-range";
import { ButtonAvatars } from "@/components/dropdowns/member/avatar";
import { PhaseQuickActions } from "@/components/phases/phase-quick-actions";
// hooks
import { useMember } from "@/hooks/store/use-member";
import { usePhase } from "@/hooks/store/use-phase";
import { useUserPermissions } from "@/hooks/store/user";
import { usePlatformOS } from "@/hooks/use-platform-os";

type Props = {
  phaseId: string;
};

const handleEventPropagation = (e: React.SyntheticEvent<HTMLElement>) => {
  e.stopPropagation();
  e.preventDefault();
};

export const PhaseCardItem = observer(function PhaseCardItem(props: Props) {
  const { phaseId } = props;
  // refs
  const parentRef = useRef(null);
  // router
  const { workspaceSlug, projectId } = useParams();
  // store hooks
  const { allowPermissions } = useUserPermissions();
  const { getPhaseById, updatePhase, addPhaseToFavorites, removePhaseFromFavorites } = usePhase();
  const { getUserDetails } = useMember();
  const { isMobile } = usePlatformOS();
  const { t } = useTranslation();
  // local storage
  const { setValue: toggleFavoriteMenu, storedValue } = useLocalStorage<boolean>(IS_FAVORITE_MENU_OPEN, false);
  // derived values
  const phase = getPhaseById(phaseId);
  const isEditingAllowed = allowPermissions(
    [EUserPermissions.ADMIN, EUserPermissions.MEMBER],
    EUserPermissionsLevel.PROJECT
  );
  const isDisabled = !isEditingAllowed || !!phase?.archived_at;
  const renderIcon = Boolean(phase?.start_date) || Boolean(phase?.end_date);

  if (!phase) return null;

  const progress = phase.total_cycles > 0 ? Math.floor((phase.completed_cycles / phase.total_cycles) * 100) : 0;
  const phaseStatus = MODULE_STATUS.find((s) => s.value === phase.status);
  const phaseLeadDetails = phase.lead_id ? getUserDetails(phase.lead_id) : undefined;

  const handlePhaseDetailsChange = async (payload: Record<string, string | null | undefined>) => {
    if (!workspaceSlug || !projectId) return;
    await updatePhase(workspaceSlug.toString(), projectId.toString(), phaseId, payload as any);
  };

  const handleAddToFavorites = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.stopPropagation();
    e.preventDefault();
    if (!workspaceSlug || !projectId) return;

    const addToFavoritePromise = addPhaseToFavorites(workspaceSlug.toString(), projectId.toString(), phaseId).then(
      () => {
        if (!storedValue) toggleFavoriteMenu(true);
        return undefined;
      }
    );

    setPromiseToast(addToFavoritePromise, {
      loading: t("phase.toast.favoriting"),
      success: { title: t("common.success"), message: () => t("phase.toast.favorited") },
      error: { title: t("common.error"), message: () => t("phase.toast.favorite_error") },
    });
  };

  const handleRemoveFromFavorites = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.stopPropagation();
    e.preventDefault();
    if (!workspaceSlug || !projectId) return;

    const removeFromFavoritePromise = removePhaseFromFavorites(workspaceSlug.toString(), projectId.toString(), phaseId);

    setPromiseToast(removeFromFavoritePromise, {
      loading: t("phase.toast.unfavoriting"),
      success: { title: t("common.success"), message: () => t("phase.toast.unfavorited") },
      error: { title: t("common.error"), message: () => t("phase.toast.favorite_error") },
    });
  };

  return (
    <div className="relative" data-prevent-progress>
      <Link ref={parentRef} href={`/${workspaceSlug}/projects/${phase.project}/phases/${phase.id}`}>
        <Card>
          <div>
            <div className="flex items-center justify-between gap-2">
              <Tooltip tooltipContent={phase.name} position="top" isMobile={isMobile}>
                <span className="truncate text-14 font-medium">{phase.name}</span>
              </Tooltip>
              <div
                role="presentation"
                className="flex items-center gap-2"
                onClick={handleEventPropagation}
                onKeyDown={handleEventPropagation}
              >
                {phaseStatus && (
                  <span
                    className="flex h-6 items-center justify-center rounded-sm px-2 text-11"
                    style={{
                      color: phaseStatus.color,
                      backgroundColor: `${phaseStatus.color}20`,
                    }}
                  >
                    <ModuleStatusIcon status={phase.status} height="12px" width="12px" className="mr-1" />
                    {t(phaseStatus.i18n_label)}
                  </span>
                )}
              </div>
            </div>
          </div>
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 text-secondary">
                <CircularProgressIndicator size={28} percentage={progress} strokeWidth={3}>
                  <span className="text-9 text-tertiary">{progress}%</span>
                </CircularProgressIndicator>
                <span className="text-11 text-tertiary">
                  {phase.completed_cycles}/{phase.total_cycles} cycles
                </span>
              </div>
              {phaseLeadDetails ? (
                <span className="cursor-default">
                  <ButtonAvatars showTooltip={false} userIds={phaseLeadDetails?.id} />
                </span>
              ) : (
                <Tooltip tooltipContent={t("phase.no_lead")}>
                  <SquareUser className="mx-1 h-4 w-4 text-tertiary" />
                </Tooltip>
              )}
            </div>
            <div
              role="presentation"
              className="flex items-center justify-between py-0.5"
              onClick={handleEventPropagation}
              onKeyDown={handleEventPropagation}
            >
              <DateRangeDropdown
                buttonContainerClassName={`h-6 w-full flex ${isDisabled ? "cursor-not-allowed" : "cursor-pointer"} items-center gap-1.5 text-tertiary border-[0.5px] border-strong rounded-sm text-11`}
                buttonVariant="transparent-with-text"
                className="h-7"
                value={{
                  from: getDate(phase.start_date),
                  to: getDate(phase.end_date),
                }}
                onSelect={(val) => {
                  handlePhaseDetailsChange({
                    start_date: val?.from ? (renderFormattedPayloadDate(val.from) ?? null) : null,
                    end_date: val?.to ? (renderFormattedPayloadDate(val.to) ?? null) : null,
                  });
                }}
                placeholder={{
                  from: t("start_date"),
                  to: t("end_date"),
                }}
                disabled={isDisabled}
                hideIcon={{ from: renderIcon ?? true, to: renderIcon }}
              />
            </div>
          </div>
        </Card>
      </Link>
      <div className="absolute right-4 bottom-[18px] flex items-center gap-1.5">
        {isEditingAllowed && !phase.archived_at && (
          <FavoriteStar
            onClick={(e) => {
              if (phase.is_favorite) handleRemoveFromFavorites(e);
              else handleAddToFavorites(e);
            }}
            selected={!!phase.is_favorite}
          />
        )}
        {workspaceSlug && projectId && (
          <PhaseQuickActions
            parentRef={parentRef}
            phaseId={phaseId}
            projectId={projectId.toString()}
            workspaceSlug={workspaceSlug.toString()}
          />
        )}
      </div>
    </div>
  );
});
