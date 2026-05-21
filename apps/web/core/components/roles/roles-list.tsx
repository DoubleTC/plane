/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useState } from "react";
import { observer } from "mobx-react";
import { Plus } from "lucide-react";
// plane imports
import { useTranslation } from "@plane/i18n";
import type { ICustomRoleCreate } from "@plane/types";
// propel
import { Button } from "@plane/propel/button";
import { TOAST_TYPE, setToast } from "@plane/propel/toast";
// plane ui
import { EModalWidth, Input, ModalCore } from "@plane/ui";
// hooks
import { useRoles } from "@/hooks/store/use-roles";
// components
import { RoleCard } from "./role-card";

interface Props {
  workspaceSlug: string;
  scope: "workspace" | "project";
}

export const RolesList = observer(function RolesList({ workspaceSlug, scope }: Props) {
  const { t } = useTranslation();
  const { customRoles, isLoadingRoles, createRole } = useRoles();

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const roles = Object.values(customRoles).filter((r) => r.scope === scope);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setIsSubmitting(true);
    try {
      const data: ICustomRoleCreate = {
        name: name.trim(),
        description: description.trim(),
        scope,
      };
      await createRole(workspaceSlug, data);
      setToast({
        type: TOAST_TYPE.SUCCESS,
        title: t("workspace_settings.settings.roles.role.create.success"),
      });
      setName("");
      setDescription("");
      setIsCreateOpen(false);
    } catch {
      setToast({
        type: TOAST_TYPE.ERROR,
        title: t("workspace_settings.settings.roles.role.create.error"),
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoadingRoles) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map((n) => (
          <div key={n} className="bg-custom-background-80 h-20 animate-pulse rounded-lg" />
        ))}
      </div>
    );
  }

  return (
    <div>
      <div className="mb-4 flex items-center justify-end">
        <Button
          variant="primary"
          size="sm"
          prependIcon={<Plus className="size-4" />}
          onClick={() => setIsCreateOpen(true)}
        >
          {t("workspace_settings.settings.roles.add_role")}
        </Button>
      </div>

      {roles.length === 0 ? (
        <div className="border-custom-border-200 flex flex-col items-center justify-center rounded-lg border border-dashed py-16 text-center">
          <p className="text-sm text-custom-text-200 font-medium">
            {t("workspace_settings.settings.roles.no_roles.title")}
          </p>
          <p className="text-xs text-custom-text-300 mt-1">
            {t("workspace_settings.settings.roles.no_roles.description")}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {roles.map((role) => (
            <RoleCard key={role.id} workspaceSlug={workspaceSlug} role={role} />
          ))}
        </div>
      )}

      {/* Create role modal */}
      <ModalCore isOpen={isCreateOpen} handleClose={() => setIsCreateOpen(false)} width={EModalWidth.MD}>
        <form onSubmit={handleCreate} className="p-6">
          <h3 className="text-lg text-custom-text-100 mb-4 font-semibold">
            {t("workspace_settings.settings.roles.role.create.title")}
          </h3>
          <div className="space-y-4">
            <div>
              <label className="text-sm text-custom-text-200 mb-1 block font-medium">
                {t("workspace_settings.settings.roles.role.name")}
                <span className="text-red-500 ml-1">*</span>
              </label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Issue Manager"
                required
                className="w-full"
              />
            </div>
            <div>
              <label className="text-sm text-custom-text-200 mb-1 block font-medium">
                {t("workspace_settings.settings.roles.role.description")}
              </label>
              <Input
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Brief description of this role"
                className="w-full"
              />
            </div>
          </div>
          <div className="mt-6 flex items-center justify-end gap-3">
            <Button type="button" variant="secondary" onClick={() => setIsCreateOpen(false)} disabled={isSubmitting}>
              {t("common.cancel")}
            </Button>
            <Button type="submit" variant="primary" loading={isSubmitting} disabled={!name.trim()}>
              {t("common.create")}
            </Button>
          </div>
        </form>
      </ModalCore>
    </div>
  );
});
