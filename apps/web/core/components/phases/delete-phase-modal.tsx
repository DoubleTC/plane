// Copyright (c) 2023-present Plane Software, Inc. and contributors
// SPDX-License-Identifier: AGPL-3.0-only

import { useState } from "react";
import { observer } from "mobx-react";
import { useParams } from "next/navigation";
// plane imports
import { useTranslation } from "@plane/i18n";
import { TOAST_TYPE, setToast } from "@plane/propel/toast";
import type { IPhase } from "@plane/types";
import { AlertModalCore } from "@plane/ui";
// hooks
import { usePhase } from "@/hooks/store/use-phase";

type Props = {
  data: IPhase;
  isOpen: boolean;
  onClose: () => void;
};

export const DeletePhaseModal = observer(function DeletePhaseModal(props: Props) {
  const { data, isOpen, onClose } = props;
  const [isDeleting, setIsDeleting] = useState(false);
  const { workspaceSlug, projectId } = useParams();
  const { deletePhase } = usePhase();
  const { t } = useTranslation();

  const handleDelete = async () => {
    if (!workspaceSlug || !projectId) return;
    setIsDeleting(true);
    try {
      await deletePhase(workspaceSlug.toString(), projectId.toString(), data.id);
      setToast({
        type: TOAST_TYPE.SUCCESS,
        title: t("phase.toast.deleted_title"),
        message: t("phase.toast.deleted_message", { name: data.name }),
      });
      onClose();
    } catch {
      setToast({ type: TOAST_TYPE.ERROR, title: t("phase.toast.delete_error") });
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <AlertModalCore
      handleClose={onClose}
      handleSubmit={handleDelete}
      isSubmitting={isDeleting}
      isOpen={isOpen}
      title={t("phase.delete.title")}
      content={t("phase.delete.content", { name: data.name })}
    />
  );
});
