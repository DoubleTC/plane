/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useState } from "react";
import { observer } from "mobx-react";
// plane imports
import { useTranslation } from "@plane/i18n";
import type { ICustomRole } from "@plane/types";
// propel
import { Button } from "@plane/propel/button";
import { TOAST_TYPE, setToast } from "@plane/propel/toast";
// plane ui
import { EModalWidth, ModalCore } from "@plane/ui";
// hooks
import { useRoles } from "@/hooks/store/use-roles";

interface Props {
  workspaceSlug: string;
  role: ICustomRole;
  isOpen: boolean;
  onClose: () => void;
  onDeleted?: () => void;
}

export const RoleDeleteModal = observer(function RoleDeleteModal({
  workspaceSlug,
  role,
  isOpen,
  onClose,
  onDeleted,
}: Props) {
  const { t } = useTranslation();
  const { customRoles, deleteRole } = useRoles();

  const [replacementRoleId, setReplacementRoleId] = useState<string>("");
  const [isDeleting, setIsDeleting] = useState(false);

  const memberCount = role.member_count ?? 0;
  const hasMembers = memberCount > 0;

  // Roles that can be used as replacements (same scope, different ID, not being deleted)
  const replacementOptions = Object.values(customRoles).filter((r) => r.id !== role.id && r.scope === role.scope);

  const canSubmit = !hasMembers || replacementRoleId !== "";

  const handleDelete = async () => {
    if (!canSubmit) return;
    setIsDeleting(true);
    try {
      await deleteRole(workspaceSlug, role.id, hasMembers ? replacementRoleId : undefined);
      setToast({ type: TOAST_TYPE.SUCCESS, title: t("workspace_settings.settings.roles.role.delete.success") });
      onDeleted?.();
      onClose();
    } catch {
      setToast({ type: TOAST_TYPE.ERROR, title: t("workspace_settings.settings.roles.role.delete.error") });
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <ModalCore isOpen={isOpen} handleClose={onClose} width={EModalWidth.MD}>
      <div className="p-6">
        <h3 className="text-lg text-custom-text-100 font-semibold">
          {t("workspace_settings.settings.roles.role.delete.title")}
        </h3>

        <p className="text-sm text-custom-text-300 mt-2">
          {hasMembers
            ? t("workspace_settings.settings.roles.role.delete.description", { count: memberCount })
            : `Are you sure you want to delete the role "${role.name}"? This action cannot be undone.`}
        </p>

        {/* Replacement role picker — only shown when the role has members */}
        {hasMembers && (
          <div className="mt-4">
            <label className="text-sm text-custom-text-200 mb-1 block font-medium">
              {t("workspace_settings.settings.roles.role.delete.replacement_label")}
              <span className="text-red-500 ml-1">*</span>
            </label>
            <select
              value={replacementRoleId}
              onChange={(e) => setReplacementRoleId(e.target.value)}
              className="border-custom-border-200 bg-custom-background-100 text-sm text-custom-text-100 focus:ring-custom-primary-100 w-full rounded-md border px-3 py-2 focus:ring-2 focus:outline-none"
            >
              <option value="">Select a replacement role…</option>
              {replacementOptions.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
            </select>
          </div>
        )}

        <div className="mt-6 flex items-center justify-end gap-3">
          <Button type="button" variant="secondary" onClick={onClose} disabled={isDeleting}>
            {t("common.cancel")}
          </Button>
          <Button type="button" variant="error-fill" onClick={handleDelete} loading={isDeleting} disabled={!canSubmit}>
            {t("workspace_settings.settings.roles.role.delete.confirm")}
          </Button>
        </div>
      </div>
    </ModalCore>
  );
});
