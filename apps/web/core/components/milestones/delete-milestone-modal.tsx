/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useState } from "react";
import { observer } from "mobx-react";
import { useParams } from "next/navigation";
// plane imports
import { useTranslation } from "@plane/i18n";
import { TOAST_TYPE, setToast } from "@plane/propel/toast";
import type { IMilestone } from "@plane/types";
import { AlertModalCore } from "@plane/ui";
// hooks
import { useMilestone } from "@/hooks/store/use-milestone";
import { useAppRouter } from "@/hooks/use-app-router";

type Props = {
  data: IMilestone;
  isOpen: boolean;
  onClose: () => void;
};

export const DeleteMilestoneModal = observer(function DeleteMilestoneModal(props: Props) {
  const { data, isOpen, onClose } = props;
  // states
  const [isDeleteLoading, setIsDeleteLoading] = useState(false);
  // router
  const router = useAppRouter();
  const { workspaceSlug, projectId } = useParams();
  // store hooks
  const { deleteMilestone } = useMilestone();
  const { t } = useTranslation();

  const handleClose = () => {
    onClose();
    setIsDeleteLoading(false);
  };

  const handleDeletion = async () => {
    if (!workspaceSlug || !projectId) return;
    setIsDeleteLoading(true);
    try {
      await deleteMilestone(workspaceSlug.toString(), projectId.toString(), data.id);
      setToast({
        type: TOAST_TYPE.SUCCESS,
        title: t("milestone.toast.deleted_title"),
        message: t("milestone.toast.deleted_message", { name: data.name }),
      });
      // Navigate away if on milestone detail
      router.push(`/${workspaceSlug}/projects/${projectId}/milestones/`);
      handleClose();
    } catch {
      setToast({
        type: TOAST_TYPE.ERROR,
        title: t("common.error"),
        message: t("milestone.toast.delete_error"),
      });
      setIsDeleteLoading(false);
    }
  };

  return (
    <AlertModalCore
      handleClose={handleClose}
      handleSubmit={handleDeletion}
      isSubmitting={isDeleteLoading}
      isOpen={isOpen}
      title={t("milestone.delete.title")}
      content={<p className="text-sm text-custom-text-200">{t("milestone.delete.content", { name: data.name })}</p>}
    />
  );
});
