/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useState } from "react";
import { observer } from "mobx-react";
import { Pencil, Trash2, Shield } from "lucide-react";
// plane imports
import { useTranslation } from "@plane/i18n";
import type { IPermissionScheme } from "@plane/types";
// propel
import { Button } from "@plane/propel/button";
import { TOAST_TYPE, setToast } from "@plane/propel/toast";
// plane ui
import { EModalWidth, ModalCore } from "@plane/ui";
// hooks
import { useRoles } from "@/hooks/store/use-roles";
// components
import { SchemeCreateForm } from "./scheme-create-form";

interface Props {
  workspaceSlug: string;
  scheme: IPermissionScheme;
}

export const SchemeCard = observer(function SchemeCard({ workspaceSlug, scheme }: Props) {
  const { t } = useTranslation();
  const { deleteScheme } = useRoles();

  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      await deleteScheme(workspaceSlug, scheme.id);
      setToast({
        type: TOAST_TYPE.SUCCESS,
        title: t("workspace_settings.settings.roles.scheme.delete.success"),
      });
      setIsDeleteOpen(false);
    } catch {
      setToast({
        type: TOAST_TYPE.ERROR,
        title: t("workspace_settings.settings.roles.scheme.delete.error"),
      });
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <>
      <div className="border-custom-border-200 bg-custom-background-100 hover:bg-custom-background-90 flex items-start justify-between rounded-lg border p-4 transition-colors">
        <div className="flex items-start gap-3">
          <div className="bg-custom-primary-100/10 mt-0.5 flex size-8 items-center justify-center rounded-md">
            <Shield className="text-custom-primary-100 size-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <p className="text-sm text-custom-text-100 font-medium">{scheme.name}</p>
              {scheme.is_system && (
                <span className="bg-custom-background-80 text-custom-text-300 rounded px-1.5 py-0.5 text-[10px] font-medium">
                  {t("workspace_settings.settings.roles.scheme.system_scheme")}
                </span>
              )}
            </div>
            {scheme.description && <p className="text-xs text-custom-text-300 mt-0.5">{scheme.description}</p>}
            <p className="text-xs text-custom-text-400 mt-1">{scheme.permissions.length} permissions</p>
          </div>
        </div>

        {!scheme.is_system && (
          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              size="sm"
              prependIcon={<Pencil className="size-3" />}
              onClick={() => setIsEditOpen(true)}
            >
              {t("common.edit")}
            </Button>
            <Button
              variant="secondary"
              size="sm"
              prependIcon={<Trash2 className="size-3" />}
              onClick={() => setIsDeleteOpen(true)}
            >
              {t("common.delete")}
            </Button>
          </div>
        )}
      </div>

      {/* Edit modal */}
      <ModalCore isOpen={isEditOpen} handleClose={() => setIsEditOpen(false)} width={EModalWidth.XL}>
        <div className="p-6">
          <h3 className="text-lg text-custom-text-100 mb-4 font-semibold">
            {t("workspace_settings.settings.roles.scheme.edit_scheme")}
          </h3>
          <SchemeCreateForm
            workspaceSlug={workspaceSlug}
            scope={scheme.scope}
            schemeId={scheme.id}
            initialData={{
              name: scheme.name,
              description: scheme.description,
              permissions: scheme.permissions,
            }}
            onSuccess={() => setIsEditOpen(false)}
            onCancel={() => setIsEditOpen(false)}
          />
        </div>
      </ModalCore>

      {/* Delete confirm modal */}
      <ModalCore isOpen={isDeleteOpen} handleClose={() => setIsDeleteOpen(false)} width={EModalWidth.MD}>
        <div className="p-6">
          <h3 className="text-lg text-custom-text-100 font-semibold">
            {t("workspace_settings.settings.roles.scheme.delete.title")}
          </h3>
          <p className="text-sm text-custom-text-300 mt-2">
            {t("workspace_settings.settings.roles.scheme.delete.description")}
          </p>
          <div className="mt-6 flex items-center justify-end gap-3">
            <Button type="button" variant="secondary" onClick={() => setIsDeleteOpen(false)} disabled={isDeleting}>
              {t("common.cancel")}
            </Button>
            <Button type="button" variant="error-fill" onClick={handleDelete} loading={isDeleting}>
              {t("workspace_settings.settings.roles.scheme.delete.confirm")}
            </Button>
          </div>
        </div>
      </ModalCore>
    </>
  );
});
