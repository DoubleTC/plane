/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useEffect } from "react";
import { observer } from "mobx-react";
import { Controller, useForm } from "react-hook-form";
// plane imports
import { useTranslation } from "@plane/i18n";
import { TOAST_TYPE, setToast } from "@plane/propel/toast";
import type { IMilestone, IMilestoneCreate } from "@plane/types";
import { Button, EModalPosition, EModalWidth, Input, ModalCore, TextArea } from "@plane/ui";
// hooks
import { useMilestone } from "@/hooks/store/use-milestone";

type TFormValues = IMilestoneCreate;

const defaultValues: TFormValues = {
  name: "",
  description: "",
  target_date: null,
  color: null,
};

type Props = {
  isOpen: boolean;
  onClose: () => void;
  data?: IMilestone | null;
  workspaceSlug: string;
  projectId: string;
};

export const CreateUpdateMilestoneModal = observer(function CreateUpdateMilestoneModal(props: Props) {
  const { isOpen, onClose, data, workspaceSlug, projectId } = props;
  // i18n
  const { t } = useTranslation();
  // store hooks
  const { createMilestone, updateMilestone } = useMilestone();

  const isEditing = !!data;

  const {
    control,
    formState: { errors, isSubmitting },
    handleSubmit,
    reset,
  } = useForm<TFormValues>({ defaultValues });

  useEffect(() => {
    if (data) {
      reset({
        name: data.name,
        description: data.description ?? "",
        target_date: data.target_date,
        color: data.color,
      });
    } else {
      reset(defaultValues);
    }
  }, [data, reset]);

  const handleClose = () => {
    reset(defaultValues);
    onClose();
  };

  const onSubmit = async (formData: TFormValues) => {
    try {
      if (isEditing && data) {
        await updateMilestone(workspaceSlug, projectId, data.id, formData);
        setToast({
          type: TOAST_TYPE.SUCCESS,
          title: t("milestone.toast.updated_title"),
          message: t("milestone.toast.updated_message"),
        });
      } else {
        await createMilestone(workspaceSlug, projectId, formData);
        setToast({
          type: TOAST_TYPE.SUCCESS,
          title: t("milestone.toast.created_title"),
          message: t("milestone.toast.created_message"),
        });
      }
      handleClose();
    } catch {
      setToast({
        type: TOAST_TYPE.ERROR,
        title: t("common.error"),
        message: t("milestone.toast.save_error"),
      });
    }
  };

  return (
    <ModalCore isOpen={isOpen} handleClose={handleClose} position={EModalPosition.CENTER} width={EModalWidth.XL}>
      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-y-4 p-5">
        <h3 className="text-xl font-medium text-custom-text-200">
          {isEditing ? t("milestone.edit_milestone") : t("milestone.create_milestone")}
        </h3>

        {/* Name */}
        <div className="flex flex-col gap-y-1">
          <label className="text-sm text-custom-text-300">{t("milestone.fields.name")} *</label>
          <Controller
            name="name"
            control={control}
            rules={{ required: t("milestone.validation.name_required") }}
            render={({ field }) => (
              <Input
                {...field}
                value={field.value ?? ""}
                placeholder={t("milestone.fields.name_placeholder")}
                className="w-full"
                hasError={!!errors.name}
              />
            )}
          />
          {errors.name && <span className="text-xs text-red-500">{errors.name.message}</span>}
        </div>

        {/* Description */}
        <div className="flex flex-col gap-y-1">
          <label className="text-sm text-custom-text-300">{t("milestone.fields.description")}</label>
          <Controller
            name="description"
            control={control}
            render={({ field }) => (
              <TextArea
                {...field}
                value={field.value ?? ""}
                placeholder={t("milestone.fields.description_placeholder")}
                className="min-h-[80px] w-full resize-none text-sm"
              />
            )}
          />
        </div>

        {/* Target Date */}
        <div className="flex flex-col gap-y-1">
          <label className="text-sm text-custom-text-300">{t("milestone.fields.target_date")}</label>
          <Controller
            name="target_date"
            control={control}
            render={({ field }) => (
              <input
                {...field}
                type="date"
                value={field.value ?? ""}
                onChange={(e) => field.onChange(e.target.value || null)}
                className="w-full rounded border border-custom-border-200 bg-custom-background-100 px-3 py-2 text-sm text-custom-text-200 outline-none focus:border-custom-primary"
              />
            )}
          />
        </div>

        {/* Actions */}
        <div className="flex items-center justify-end gap-x-3 pt-2">
          <Button variant="neutral-primary" size="sm" onClick={handleClose} type="button">
            {t("common.cancel")}
          </Button>
          <Button variant="primary" size="sm" type="submit" loading={isSubmitting}>
            {isEditing ? t("common.update") : t("common.create")}
          </Button>
        </div>
      </form>
    </ModalCore>
  );
});
