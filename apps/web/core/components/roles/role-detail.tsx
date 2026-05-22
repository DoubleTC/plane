/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useState } from "react";
import { observer } from "mobx-react";
import { Pencil, Users } from "lucide-react";
// plane imports
import { useTranslation } from "@plane/i18n";
import type { ICustomRole } from "@plane/types";
// propel
import { Button } from "@plane/propel/button";
import { TOAST_TYPE, setToast } from "@plane/propel/toast";
// plane ui
import { Input } from "@plane/ui";
// hooks
import { useRoles } from "@/hooks/store/use-roles";

interface Props {
  workspaceSlug: string;
  role: ICustomRole;
}

export const RoleDetail = observer(function RoleDetail({ workspaceSlug, role }: Props) {
  const { t } = useTranslation();
  const { updateRole } = useRoles();

  const [isEditing, setIsEditing] = useState(false);
  const [name, setName] = useState(role.name);
  const [description, setDescription] = useState(role.description);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleCancel = () => {
    setName(role.name);
    setDescription(role.description);
    setIsEditing(false);
  };

  const handleSave = async () => {
    if (!name.trim()) return;
    setIsSubmitting(true);
    try {
      await updateRole(workspaceSlug, role.id, {
        name: name.trim(),
        description: description.trim(),
      });
      setToast({
        type: TOAST_TYPE.SUCCESS,
        title: t("workspace_settings.settings.roles.role.update.success"),
      });
      setIsEditing(false);
    } catch {
      setToast({
        type: TOAST_TYPE.ERROR,
        title: t("workspace_settings.settings.roles.role.update.error"),
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="border-custom-border-200 bg-custom-background-100 rounded-lg border p-6">
      {isEditing ? (
        <div className="space-y-4">
          <div>
            <label className="text-sm text-custom-text-200 mb-1 block font-medium">
              {t("workspace_settings.settings.roles.role.name")}
              <span className="text-red-500 ml-1">*</span>
            </label>
            <Input value={name} onChange={(e) => setName(e.target.value)} required className="w-full" />
          </div>
          <div>
            <label className="text-sm text-custom-text-200 mb-1 block font-medium">
              {t("workspace_settings.settings.roles.role.description")}
            </label>
            <Input value={description} onChange={(e) => setDescription(e.target.value)} className="w-full" />
          </div>
          <div className="flex items-center justify-end gap-3">
            <Button type="button" variant="secondary" onClick={handleCancel} disabled={isSubmitting}>
              {t("common.cancel")}
            </Button>
            <Button type="button" variant="primary" onClick={handleSave} loading={isSubmitting} disabled={!name.trim()}>
              {t("common.update")}
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-3">
              <h2 className="text-xl text-custom-text-100 font-semibold">{role.name}</h2>
              {role.is_system && (
                <span className="bg-custom-background-80 text-xs text-custom-text-300 rounded px-2 py-0.5 font-medium">
                  {t("workspace_settings.settings.roles.role.system_role")}
                </span>
              )}
            </div>
            {role.description && <p className="text-sm text-custom-text-300 mt-1">{role.description}</p>}
            <div className="text-xs text-custom-text-400 mt-3 flex items-center gap-4">
              <span>
                Scope: <span className="text-custom-text-200 font-medium capitalize">{role.scope}</span>
              </span>
              <span className="flex items-center gap-1">
                <Users className="size-3" />
                {t("workspace_settings.settings.roles.role.member_count", { count: role.member_count ?? 0 })}
              </span>
            </div>
          </div>
          {!role.is_system && (
            <Button
              variant="secondary"
              size="sm"
              prependIcon={<Pencil className="size-3" />}
              onClick={() => setIsEditing(true)}
            >
              {t("common.edit")}
            </Button>
          )}
        </div>
      )}
    </div>
  );
});
