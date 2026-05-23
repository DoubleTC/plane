// Copyright (c) 2023-present Plane Software, Inc. and contributors
// SPDX-License-Identifier: AGPL-3.0-only

import { useEffect } from "react";
import { observer } from "mobx-react";
import { Controller, useForm } from "react-hook-form";
// plane imports
import { useTranslation } from "@plane/i18n";
import { Button } from "@plane/propel/button";
import { TOAST_TYPE, setToast } from "@plane/propel/toast";
import type { IPhase, IPhaseCreate } from "@plane/types";
import { EModalPosition, EModalWidth, Input, ModalCore, TextArea } from "@plane/ui";
import { renderFormattedPayloadDate } from "@plane/utils";
// components
import { DateDropdown } from "@/components/dropdowns/date";
// hooks
import { usePhase } from "@/hooks/store/use-phase";

type FormValues = {
  name: string;
  description: string;
  start_date: string | null;
  end_date: string | null;
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
    register,
    handleSubmit,
    control,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    defaultValues: {
      name: "",
      description: "",
      start_date: null,
      end_date: null,
    },
  });

  useEffect(() => {
    if (data) {
      reset({
        name: data.name,
        description: data.description ?? "",
        start_date: data.start_date ?? null,
        end_date: data.end_date ?? null,
      });
    } else {
      reset({ name: "", description: "", start_date: null, end_date: null });
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
      start_date: values.start_date || null,
      end_date: values.end_date || null,
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
    <ModalCore isOpen={isOpen} handleClose={handleClose} position={EModalPosition.CENTER} width={EModalWidth.XXL}>
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 p-5">
        <h3 className="text-base text-custom-text-100 font-semibold">
          {data ? t("phase.edit_phase") : t("phase.create_phase")}
        </h3>

        {/* Name */}
        <div>
          <Input
            id="name"
            type="text"
            placeholder={t("phase.fields.name_placeholder")}
            {...register("name", { required: t("phase.validation.name_required") })}
            className={`w-full ${errors.name ? "border-red-500" : ""}`}
          />
          {errors.name && <p className="text-xs text-red-500 mt-1">{errors.name.message}</p>}
        </div>

        {/* Description */}
        <TextArea
          id="description"
          placeholder={t("phase.fields.description_placeholder")}
          {...register("description")}
          className="min-h-[80px] w-full resize-none"
        />

        {/* Date range */}
        <div className="flex items-center gap-3">
          <div className="flex-1">
            <label className="text-xs text-custom-text-300 mb-1 block">{t("phase.fields.start_date")}</label>
            <Controller
              name="start_date"
              control={control}
              render={({ field }) => (
                <DateDropdown
                  value={field.value ?? null}
                  onChange={(date) => field.onChange(date ? renderFormattedPayloadDate(date) : null)}
                  placeholder={t("phase.fields.start_date")}
                  buttonVariant="border-with-text"
                  className="w-full"
                  clearIconClassName="h-3 w-3"
                />
              )}
            />
          </div>
          <div className="flex-1">
            <label className="text-xs text-custom-text-300 mb-1 block">{t("phase.fields.end_date")}</label>
            <Controller
              name="end_date"
              control={control}
              render={({ field }) => (
                <DateDropdown
                  value={field.value ?? null}
                  onChange={(date) => field.onChange(date ? renderFormattedPayloadDate(date) : null)}
                  placeholder={t("phase.fields.end_date")}
                  buttonVariant="border-with-text"
                  className="w-full"
                  clearIconClassName="h-3 w-3"
                />
              )}
            />
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-end gap-2 pt-2">
          <Button type="button" variant="secondary" size="lg" onClick={handleClose}>
            {t("common.cancel")}
          </Button>
          <Button type="submit" variant="primary" size="lg" loading={isSubmitting} disabled={isSubmitting}>
            {data ? t("common.save") : t("phase.create_phase")}
          </Button>
        </div>
      </form>
    </ModalCore>
  );
});
