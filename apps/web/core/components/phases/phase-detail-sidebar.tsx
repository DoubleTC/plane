// Copyright (c) 2023-present Plane Software, Inc. and contributors
// SPDX-License-Identifier: AGPL-3.0-only

import { useEffect } from "react";
import { observer } from "mobx-react";
import { useParams } from "next/navigation";
import { Controller, useForm } from "react-hook-form";
import { SquareUser } from "lucide-react";
// plane imports
import { MODULE_STATUS, EUserPermissions, EUserPermissionsLevel } from "@plane/constants";
import { useTranslation } from "@plane/i18n";
import {
  MembersPropertyIcon,
  ModuleStatusIcon,
  StartDatePropertyIcon,
  ChevronRightIcon,
  CheckIcon,
} from "@plane/propel/icons";
import { Tooltip } from "@plane/propel/tooltip";
import type { TPhaseStatus } from "@plane/types";
import { Avatar, AvatarGroup, CustomSelect, Loader, TextArea } from "@plane/ui";
import { CircularProgressIndicator } from "@plane/ui";
import { getDate, getFileURL, renderFormattedPayloadDate } from "@plane/utils";
// components
import { DateRangeDropdown } from "@/components/dropdowns/date-range";
import { MemberDropdown } from "@/components/dropdowns/member/dropdown";
// hooks
import { usePhase } from "@/hooks/store/use-phase";
import { useMember } from "@/hooks/store/use-member";
import { useUserPermissions } from "@/hooks/store/user";
import { usePlatformOS } from "@/hooks/use-platform-os";

type FormValues = {
  status: TPhaseStatus;
  start_date: string | null;
  end_date: string | null;
  lead_id: string | null;
};

type Props = {
  phaseId: string;
  handleClose: () => void;
};

export const PhaseDetailSidebar = observer(function PhaseDetailSidebar(props: Props) {
  const { phaseId, handleClose } = props;
  // router
  const { workspaceSlug, projectId } = useParams();
  // store hooks
  const { t } = useTranslation();
  const { getPhaseById, updatePhase } = usePhase();
  const { getUserDetails } = useMember();
  const { allowPermissions } = useUserPermissions();
  const { isMobile } = usePlatformOS();

  const phase = getPhaseById(phaseId);

  const { control, reset } = useForm<FormValues>({
    defaultValues: {
      status: "planned",
      start_date: null,
      end_date: null,
      lead_id: null,
    },
  });

  useEffect(() => {
    if (phase) {
      reset({
        status: phase.status ?? "planned",
        start_date: phase.start_date ?? null,
        end_date: phase.end_date ?? null,
        lead_id: phase.lead_id ?? null,
      });
    }
  }, [phase, reset]);

  const isEditingAllowed = allowPermissions(
    [EUserPermissions.ADMIN, EUserPermissions.MEMBER],
    EUserPermissionsLevel.PROJECT
  );

  const submitChanges = async (data: Partial<FormValues>) => {
    if (!workspaceSlug || !projectId) return;
    await updatePhase(workspaceSlug.toString(), projectId.toString(), phaseId, data);
  };

  if (!phase)
    return (
      <Loader>
        <div className="space-y-2">
          <Loader.Item height="15px" width="50%" />
          <Loader.Item height="15px" width="30%" />
        </div>
        <div className="mt-8 space-y-3">
          <Loader.Item height="30px" />
          <Loader.Item height="30px" />
          <Loader.Item height="30px" />
        </div>
      </Loader>
    );

  const progress = phase.total_cycles > 0 ? Math.floor((phase.completed_cycles / phase.total_cycles) * 100) : 0;
  const moduleStatus = MODULE_STATUS.find((s) => s.value === phase.status);

  return (
    <div className="relative">
      {/* Header */}
      <div className="sticky top-0 z-10 flex items-center justify-between bg-surface-1 pt-5 pb-5">
        <button className="flex h-5 w-5 items-center justify-center rounded-full bg-layer-3" onClick={handleClose}>
          <ChevronRightIcon className="h-3 w-3 stroke-2 text-on-color" />
        </button>
      </div>

      {/* Status + Name */}
      <div className="flex flex-col gap-3">
        <div className="flex items-center gap-5 pt-2">
          <Controller
            control={control}
            name="status"
            render={({ field: { value } }) => (
              <CustomSelect
                customButton={
                  <span
                    className={`flex h-6 w-20 items-center justify-center rounded-xs text-center text-11 ${
                      isEditingAllowed ? "cursor-pointer" : "cursor-not-allowed"
                    }`}
                    style={{
                      color: moduleStatus ? moduleStatus.color : "#a3a3a2",
                      backgroundColor: moduleStatus ? `${moduleStatus.color}20` : "#a3a3a220",
                    }}
                  >
                    {(moduleStatus && t(moduleStatus.i18n_label)) ?? t("project_modules.status.backlog")}
                  </span>
                }
                value={value}
                onChange={(val: TPhaseStatus) => {
                  submitChanges({ status: val });
                }}
                disabled={!isEditingAllowed}
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
          />
        </div>
        <h4 className="w-full text-18 font-semibold break-words text-primary">{phase.name}</h4>
      </div>

      {/* Description */}
      {phase.description && (
        <TextArea
          className="ring-none !m-0 mt-2 max-h-max w-full resize-none !border-0 bg-transparent !p-0 text-13 leading-5 text-secondary outline-none"
          value={phase.description}
          disabled
        />
      )}

      {/* Meta fields */}
      <div className="flex flex-col gap-5 pt-4 pb-6">
        {/* Date range */}
        <div className="flex items-center justify-start gap-1">
          <div className="flex w-2/5 items-center justify-start gap-2 text-tertiary">
            <StartDatePropertyIcon className="h-4 w-4" />
            <span className="text-14">{t("date_range")}</span>
          </div>
          <div className="h-7">
            <Controller
              control={control}
              name="start_date"
              render={({ field: { value: startVal, onChange: onChangeStart } }) => (
                <Controller
                  control={control}
                  name="end_date"
                  render={({ field: { value: endVal, onChange: onChangeEnd } }) => (
                    <DateRangeDropdown
                      buttonContainerClassName="w-full"
                      buttonVariant="background-with-text"
                      value={{
                        from: getDate(startVal),
                        to: getDate(endVal),
                      }}
                      onSelect={(val) => {
                        const newStart = val?.from ? renderFormattedPayloadDate(val.from) : null;
                        const newEnd = val?.to ? renderFormattedPayloadDate(val.to) : null;
                        onChangeStart(newStart);
                        onChangeEnd(newEnd);
                        submitChanges({ start_date: newStart, end_date: newEnd });
                      }}
                      placeholder={{
                        from: t("start_date"),
                        to: t("end_date"),
                      }}
                      disabled={!isEditingAllowed}
                    />
                  )}
                />
              )}
            />
          </div>
        </div>

        {/* Lead */}
        <div className="flex items-center justify-start gap-1">
          <div className="flex w-2/5 items-center justify-start gap-2 text-tertiary">
            <SquareUser className="h-4 w-4" />
            <span className="text-14">{t("lead")}</span>
          </div>
          <Controller
            control={control}
            name="lead_id"
            render={({ field: { value } }) => (
              <div className="h-7 w-3/5">
                <MemberDropdown
                  value={value ?? null}
                  onChange={(val) => {
                    submitChanges({ lead_id: val });
                  }}
                  projectId={projectId?.toString() ?? ""}
                  multiple={false}
                  buttonVariant="background-with-text"
                  placeholder={t("lead")}
                  disabled={!isEditingAllowed}
                  icon={SquareUser}
                />
              </div>
            )}
          />
        </div>

        {/* Members — computed read-only: union of all assignees across all phase cycles */}
        <div className="flex items-center justify-start gap-1">
          <div className="flex w-2/5 items-center justify-start gap-2 text-tertiary">
            <MembersPropertyIcon className="h-4 w-4" />
            <span className="text-14">{t("members")}</span>
          </div>
          <div className="flex h-7 w-3/5 items-center">
            {phase.member_ids && phase.member_ids.length > 0 ? (
              <Tooltip isMobile={isMobile} tooltipContent={`${phase.member_ids.length} ${t("members")}`} position="top">
                <AvatarGroup showTooltip={false}>
                  {phase.member_ids.map((memberId) => {
                    const member = getUserDetails(memberId);
                    return (
                      <Avatar key={memberId} name={member?.display_name} src={getFileURL(member?.avatar_url ?? "")} />
                    );
                  })}
                </AvatarGroup>
              </Tooltip>
            ) : (
              <span className="text-13 text-tertiary italic">—</span>
            )}
          </div>
        </div>

        {/* Progress */}
        <div className="flex items-center justify-start gap-1">
          <div className="flex w-2/5 items-center justify-start gap-2 text-tertiary">
            <span className="text-14">{t("phase.detail.progress")}</span>
          </div>
          <div className="flex h-7 w-3/5 items-center gap-2">
            <CircularProgressIndicator size={20} percentage={progress} strokeWidth={3}>
              {progress === 100 ? <CheckIcon className="h-2 w-2 stroke-[2] text-accent-primary" /> : null}
            </CircularProgressIndicator>
            <span className="text-13 text-tertiary">
              {phase.completed_cycles}/{phase.total_cycles} {t("phase.cycles_label")}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
});
