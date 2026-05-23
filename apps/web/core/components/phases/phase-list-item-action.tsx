// Copyright (c) 2023-present Plane Software, Inc. and contributors
// SPDX-License-Identifier: AGPL-3.0-only

import React from "react";
import { observer } from "mobx-react";
import { useParams } from "next/navigation";
import { SquareUser } from "lucide-react";
// plane imports
import { MODULE_STATUS, EUserPermissions, EUserPermissionsLevel, IS_FAVORITE_MENU_OPEN } from "@plane/constants";
import { useLocalStorage } from "@plane/hooks";
import { useTranslation } from "@plane/i18n";
import type { IPhase, IPhaseUpdate, TPhaseStatus } from "@plane/types";
import { ModuleStatusIcon } from "@plane/propel/icons";
import { TOAST_TYPE, setPromiseToast, setToast } from "@plane/propel/toast";
import { Tooltip } from "@plane/propel/tooltip";
import { Avatar, AvatarGroup, CustomSelect, FavoriteStar } from "@plane/ui";
import { getDate, getFileURL, renderFormattedPayloadDate } from "@plane/utils";
// components
import { DateRangeDropdown } from "@/components/dropdowns/date-range";
import { ButtonAvatars } from "@/components/dropdowns/member/avatar";
import { PhaseQuickActions } from "@/components/phases/phase-quick-actions";
// hooks
import { usePhase } from "@/hooks/store/use-phase";
import { useMember } from "@/hooks/store/use-member";
import { useUserPermissions } from "@/hooks/store/user";
import { usePlatformOS } from "@/hooks/use-platform-os";

type Props = {
  phaseId: string;
  phase: IPhase;
  parentRef: React.RefObject<HTMLDivElement>;
};

export const PhaseListItemAction = observer(function PhaseListItemAction(props: Props) {
  const { phaseId, phase, parentRef } = props;
  // router
  const { workspaceSlug, projectId } = useParams();
  // store hooks
  const { t } = useTranslation();
  const { allowPermissions } = useUserPermissions();
  const { updatePhase, addPhaseToFavorites, removePhaseFromFavorites } = usePhase();
  const { getUserDetails } = useMember();
  const { isMobile } = usePlatformOS();

  // local storage — open favorites sidebar when favoriting
  const { setValue: toggleFavoriteMenu, storedValue: favoriteMenuOpen } = useLocalStorage<boolean>(
    IS_FAVORITE_MENU_OPEN,
    false
  );

  // derived values
  const isEditingAllowed = allowPermissions(
    [EUserPermissions.ADMIN, EUserPermissions.MEMBER],
    EUserPermissionsLevel.PROJECT
  );
  const isDisabled = !isEditingAllowed || !!phase.archived_at;
  const showDateIcon = Boolean(phase.start_date) || Boolean(phase.end_date);
  const currentStatus = MODULE_STATUS.find((s) => s.value === phase.status);

  // handlers
  const handlePhaseChange = async (payload: IPhaseUpdate) => {
    if (!workspaceSlug || !projectId) return;
    await updatePhase(workspaceSlug.toString(), projectId.toString(), phaseId, payload).catch(() => {
      setToast({ type: TOAST_TYPE.ERROR, title: t("common.error") });
    });
  };

  const handleAddToFavorites = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.stopPropagation();
    e.preventDefault();
    if (!workspaceSlug || !projectId) return;

    const promise = addPhaseToFavorites(workspaceSlug.toString(), projectId.toString(), phaseId).then(() => {
      if (!favoriteMenuOpen) toggleFavoriteMenu(true);
      return undefined;
    });

    setPromiseToast(promise, {
      loading: t("phase.toast.favoriting"),
      success: { title: t("common.success"), message: () => t("phase.toast.favorited") },
      error: { title: t("common.error"), message: () => t("phase.toast.favorite_error") },
    });
  };

  const handleRemoveFromFavorites = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.stopPropagation();
    e.preventDefault();
    if (!workspaceSlug || !projectId) return;

    const promise = removePhaseFromFavorites(workspaceSlug.toString(), projectId.toString(), phaseId);
    setPromiseToast(promise, {
      loading: t("phase.toast.unfavoriting"),
      success: { title: t("common.success"), message: () => t("phase.toast.unfavorited") },
      error: { title: t("common.error"), message: () => t("phase.toast.favorite_error") },
    });
  };

  return (
    <>
      {/* Date range — merged start → end */}
      <DateRangeDropdown
        buttonContainerClassName={`h-6 w-full flex ${isDisabled ? "cursor-not-allowed" : "cursor-pointer"} items-center gap-1.5 text-tertiary border-[0.5px] border-strong rounded-sm text-11`}
        buttonVariant="transparent-with-text"
        className="h-7"
        value={{
          from: getDate(phase.start_date),
          to: getDate(phase.end_date),
        }}
        onSelect={(val) => {
          handlePhaseChange({
            start_date: val?.from ? renderFormattedPayloadDate(val.from) : null,
            end_date: val?.to ? renderFormattedPayloadDate(val.to) : null,
          });
        }}
        mergeDates
        placeholder={{ from: t("start_date"), to: t("end_date") }}
        disabled={isDisabled}
        hideIcon={{ from: showDateIcon ?? true, to: showDateIcon }}
      />

      {/* Status */}
      {currentStatus && (
        <CustomSelect
          customButton={
            <span
              className={`flex h-6 w-20 items-center justify-center rounded-sm text-center text-11 ${
                isDisabled ? "cursor-not-allowed" : "cursor-pointer"
              }`}
              style={{
                color: currentStatus.color,
                backgroundColor: `${currentStatus.color}20`,
              }}
            >
              {t(currentStatus.i18n_label)}
            </span>
          }
          value={phase.status}
          onChange={(val: TPhaseStatus) => handlePhaseChange({ status: val })}
          disabled={isDisabled}
        >
          {MODULE_STATUS.map((s) => (
            <CustomSelect.Option key={s.value} value={s.value}>
              <div className="flex items-center gap-2">
                <ModuleStatusIcon status={s.value as TPhaseStatus} />
                {t(s.i18n_label)}
              </div>
            </CustomSelect.Option>
          ))}
        </CustomSelect>
      )}

      {/* Lead avatar */}
      {phase.lead_id ? (
        <span className="cursor-default">
          <ButtonAvatars showTooltip={false} userIds={phase.lead_id} />
        </span>
      ) : (
        <Tooltip isMobile={isMobile} tooltipContent={t("phase.no_lead")}>
          <SquareUser className="h-4 w-4 text-tertiary" />
        </Tooltip>
      )}

      {/* Member avatars — computed from all assignees across phase cycles */}
      {phase.member_ids && phase.member_ids.length > 0 ? (
        <Tooltip isMobile={isMobile} tooltipContent={`${phase.member_ids.length} ${t("members")}`} position="bottom">
          <div className="flex cursor-default items-center justify-center">
            <AvatarGroup showTooltip={false}>
              {phase.member_ids.map((memberId) => {
                const member = getUserDetails(memberId);
                return <Avatar key={memberId} name={member?.display_name} src={getFileURL(member?.avatar_url ?? "")} />;
              })}
            </AvatarGroup>
          </div>
        </Tooltip>
      ) : null}

      {/* Favorite star */}
      {isEditingAllowed && !phase.archived_at && (
        <FavoriteStar
          onClick={(e) => {
            if (phase.is_favorite) handleRemoveFromFavorites(e);
            else handleAddToFavorites(e);
          }}
          selected={phase.is_favorite}
        />
      )}

      {/* Quick actions (desktop) */}
      {workspaceSlug && projectId && (
        <div className="hidden md:block">
          <PhaseQuickActions
            parentRef={parentRef}
            phaseId={phaseId}
            projectId={projectId.toString()}
            workspaceSlug={workspaceSlug.toString()}
          />
        </div>
      )}
    </>
  );
});
