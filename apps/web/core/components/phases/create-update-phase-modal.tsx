// Copyright (c) 2023-present Plane Software, Inc. and contributors
// SPDX-License-Identifier: AGPL-3.0-only

import { useEffect } from "react";
import { observer } from "mobx-react";
import { Controller, useForm } from "react-hook-form";
// plane imports
import { MODULE_STATUS } from "@plane/constants";
import { useTranslation } from "@plane/i18n";
import { Button } from "@plane/propel/button";
import { ModuleStatusIcon } from "@plane/propel/icons";
import { TOAST_TYPE, setToast } from "@plane/propel/toast";
import type { IPhase, IPhaseCreate, TPhaseStatus } from "@plane/types";
import { CustomSelect, EModalPosition, EModalWidth, Input, ModalCore, TextArea } from "@plane/ui";
import { getDate, renderFormattedPayloadDate } from "@plane/utils";
// components
import { DateRangeDropdown } from "@/components/dropdowns/date-range";
import { MemberDropdown } from "@/components/dropdowns/member/dropdown";
// hooks
import { usePhase } from "@/hooks/store/use-phase";

type FormValues = {
  name: string;
  description: string;
  status: TPhaseStatus;
  start_date: string | null;
  end_date: string | null;
  lead_id: string | null;
};

type Props = {
  isOpen: boolean;
  onClose: () => void;
  workspaceSlug: string;
  projectId: string;
  data?: IPhase;
};

export const CreateUpdatePhaseModal = observer(function CreateUpdatePhaseModal(props: Props) {
  const { isOpen, onClose, workspaceSlug, projectId, data } = props;
  // store
  const { createPhase, updatePhase } = usePhase();
  const { t } = useTranslation();
  // form
  const {
    handleSubmit,
    control,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    defaultValues: {
      name: "",
      description: "",
      status: "planned",
      start_date: null,
      end_date: null,
      lead_id: null,
    },
  });

  useEffect(() => {
    if (data) {
      reset({
        name: data.name,
        description: data.description ?? "",
        status: data.status ?? "planned",
        start_date: data.start_date ?? null,
        end_date: data.end_date ?? null,
        lead_id: data.lead_id ?? null,
      });
    } else {
      reset({
        name: "",
        description: "",
        status: "planned",
        start_date: null,
        end_date: null,
        lead_id: null,
      });
    }
  }, [data, isOpen, reset]);

  const handleClose = () => {
    reset();
    onClose();
  };

  const onSubmit = async (values: FormValues) => {
    const payload: IPhaseCreate = {
      name: values.name.trim(),
      description: values.description,
      status: values.status,
      start_date: values.start_date || null,
      end_date: values.end_date || null,
      lead_id: values.lead_id || null,
    };
    try {
      if (data) {
        await updatePhase(workspaceSlug, projectId, data.id, payload);
        setToast({ type: TOAST_TYPE.SUCCESS, title: t("phase.toast.updated_title") });
      } else {
        await createPhase(workspaceSlug, projectId, payload);
        setToast({ type: TOAST_TYPE.SUCCESS, title: t("phase.toast.created_title") });
      }
      handleClose();
    } catch {
      setToast({ type: TOAST_TYPE.ERROR, title: t("phase.toast.save_error") });
    }
  };

  return (
    <ModalCore isOpen={isOpen} handleClose={handleClose} position={EModalPosition.TOP} width={EModalWidth.XXL}>
      {/*
       * Use a plain <div> instead of <form> to prevent React Router 7
       * (framework mode) from intercepting the submission as a route action.
       * The submit button calls handleSubmit(onSubmit) directly via onClick.
       */}
      <div>
        <div className="space-y-5 p-5">
          <h3 className="text-18 font-medium text-secondary">
            {data ? t("phase.edit_phase") : t("phase.create_phase")}
          </h3>

          <div className="space-y-3">
            {/* Name */}
            <div className="space-y-1">
              <Controller
                control={control}
                name="name"
                rules={{
                  required: t("phase.validation.name_required"),
                  maxLength: { value: 255, message: "Phase name must be under 255 characters." },
                }}
                render={({ field: { value, onChange } }) => (
                  <Input
                    id="name"
                    name="name"
                    type="text"
                    value={value}
                    onChange={onChange}
                    hasError={Boolean(errors?.name)}
                    placeholder={t("phase.fields.name_placeholder")}
                    className="w-full text-14"
                  />
                )}
              />
              {errors?.name && <span className="text-11 text-danger-primary">{errors.name.message}</span>}
            </div>

            {/* Description */}
            <Controller
              name="description"
              control={control}
              render={({ field: { value, onChange } }) => (
                <TextArea
                  id="description"
                  name="description"
                  value={value}
                  onChange={onChange}
                  placeholder={t("phase.fields.description_placeholder")}
                  className="min-h-24 w-full resize-none text-14"
                />
              )}
            />

            {/* Date range + Status + Lead */}
            <div className="flex flex-wrap items-center gap-2">
              {/* Combined date range picker */}
              <Controller
                control={control}
                name="start_date"
                render={({ field: { value: startVal, onChange: onChangeStart } }) => (
                  <Controller
                    control={control}
                    name="end_date"
                    render={({ field: { value: endVal, onChange: onChangeEnd } }) => (
                      <DateRangeDropdown
                        buttonVariant="border-with-text"
                        className="h-7"
                        value={{
                          from: getDate(startVal),
                          to: getDate(endVal),
                        }}
                        onSelect={(val) => {
                          onChangeStart(val?.from ? renderFormattedPayloadDate(val.from) : null);
                          onChangeEnd(val?.to ? renderFormattedPayloadDate(val.to) : null);
                        }}
                        placeholder={{
                          from: t("phase.fields.start_date"),
                          to: t("phase.fields.end_date"),
                        }}
                        hideIcon={{ to: true }}
                      />
                    )}
                  />
                )}
              />

              {/* Status */}
              <div className="h-7">
                <Controller
                  control={control}
                  name="status"
                  render={({ field: { value, onChange } }) => {
                    const selected = MODULE_STATUS.find((s) => s.value === value);
                    return (
                      <CustomSelect
                        value={value}
                        label={
                          <div className="flex items-center gap-2 py-0.5 text-11">
                            <ModuleStatusIcon status={value as TPhaseStatus} />
                            {selected ? t(selected.i18n_label) : <span className="text-secondary">Status</span>}
                          </div>
                        }
                        onChange={onChange}
                        noChevron
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
                    );
                  }}
                />
              </div>

              {/* Lead */}
              <Controller
                control={control}
                name="lead_id"
                render={({ field: { value, onChange } }) => (
                  <div className="h-7">
                    <MemberDropdown
                      value={value}
                      onChange={onChange}
                      projectId={projectId}
                      multiple={false}
                      buttonVariant="border-with-text"
                      placeholder={t("lead")}
                    />
                  </div>
                )}
              />
            </div>
          </div>
        </div>

        {/* Footer actions */}
        <div className="flex items-center justify-end gap-2 border-t-[0.5px] border-subtle px-5 py-4">
          <Button type="button" variant="secondary" size="lg" onClick={handleClose}>
            {t("common.cancel")}
          </Button>
          <Button
            type="button"
            variant="primary"
            size="lg"
            loading={isSubmitting}
            disabled={isSubmitting}
            onClick={handleSubmit(onSubmit)}
          >
            {data
              ? isSubmitting
                ? t("common.saving")
                : t("common.save")
              : isSubmitting
                ? t("common.creating")
                : t("phase.create_phase")}
          </Button>
        </div>
      </div>
    </ModalCore>
  );
});
