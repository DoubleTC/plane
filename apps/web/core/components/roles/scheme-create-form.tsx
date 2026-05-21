/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useState, useCallback } from "react";
import { observer } from "mobx-react";
import useSWR from "swr";
// plane imports
import { useTranslation } from "@plane/i18n";
import type { IPermissionSchemeCreate } from "@plane/types";
// propel
import { Button } from "@plane/propel/button";
import { TOAST_TYPE, setToast } from "@plane/propel/toast";
// plane ui
import { Input } from "@plane/ui";
// hooks
import { useRoles } from "@/hooks/store/use-roles";
// components
import { PermissionGroupToggle } from "./permission-group-toggle";

interface Props {
  workspaceSlug: string;
  scope: "workspace" | "project";
  initialData?: { name: string; description: string; permissions: string[] };
  schemeId?: string; // if set: edit mode
  onSuccess?: () => void;
  onCancel?: () => void;
}

export const SchemeCreateForm = observer(function SchemeCreateForm({
  workspaceSlug,
  scope,
  initialData,
  schemeId,
  onSuccess,
  onCancel,
}: Props) {
  const { t } = useTranslation();
  const { createScheme, updateScheme, fetchPermissionGroups, permissionGroups } = useRoles();

  const [name, setName] = useState(initialData?.name ?? "");
  const [description, setDescription] = useState(initialData?.description ?? "");
  const [selectedPerms, setSelectedPerms] = useState<Set<string>>(new Set(initialData?.permissions ?? []));
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Fetch permission groups for the given scope
  useSWR(`PERMISSION_GROUPS_${workspaceSlug}_${scope}`, () => fetchPermissionGroups(workspaceSlug, scope));

  const groups = permissionGroups[scope] ?? [];

  const handlePermChange = useCallback((changes: string[]) => {
    setSelectedPerms((prev) => {
      const next = new Set(prev);
      changes.forEach((c) => {
        if (c.startsWith("-")) {
          next.delete(c.slice(1));
        } else {
          next.add(c);
        }
      });
      return next;
    });
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    setIsSubmitting(true);
    try {
      const data: IPermissionSchemeCreate = {
        name: name.trim(),
        description: description.trim(),
        scope,
        permissions: [...selectedPerms],
      };

      if (schemeId) {
        await updateScheme(workspaceSlug, schemeId, data);
        setToast({ type: TOAST_TYPE.SUCCESS, title: t("workspace_settings.settings.roles.scheme.update.success") });
      } else {
        await createScheme(workspaceSlug, data);
        setToast({ type: TOAST_TYPE.SUCCESS, title: t("workspace_settings.settings.roles.scheme.create.success") });
      }
      onSuccess?.();
    } catch {
      setToast({
        type: TOAST_TYPE.ERROR,
        title: schemeId
          ? t("workspace_settings.settings.roles.scheme.update.error")
          : t("workspace_settings.settings.roles.scheme.create.error"),
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Name */}
      <div>
        <label className="text-sm text-custom-text-200 mb-1 block font-medium">
          {t("workspace_settings.settings.roles.scheme.name")}
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

      {/* Description */}
      <div>
        <label className="text-sm text-custom-text-200 mb-1 block font-medium">
          {t("workspace_settings.settings.roles.scheme.description")}
        </label>
        <Input
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Brief description of this permission scheme"
          className="w-full"
        />
      </div>

      {/* Permission groups */}
      <div>
        <p className="text-sm text-custom-text-200 mb-3 font-medium">
          {t("workspace_settings.settings.roles.scheme.permissions")}
        </p>
        <div className="space-y-4">
          {groups.map((group) => (
            <PermissionGroupToggle
              key={group.group_name}
              group={group}
              selected={selectedPerms}
              onChange={handlePermChange}
            />
          ))}
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center justify-end gap-3">
        {onCancel && (
          <Button type="button" variant="secondary" onClick={onCancel} disabled={isSubmitting}>
            {t("common.cancel")}
          </Button>
        )}
        <Button type="submit" variant="primary" loading={isSubmitting} disabled={!name.trim()}>
          {schemeId ? t("common.update") : t("common.create")}
        </Button>
      </div>
    </form>
  );
});
