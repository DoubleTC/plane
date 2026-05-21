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
import { Checkbox } from "@plane/ui";
// hooks
import { useRoles } from "@/hooks/store/use-roles";

interface Props {
  workspaceSlug: string;
  role: ICustomRole;
  onClose: () => void;
}

export const SchemeAttachPanel = observer(function SchemeAttachPanel({ workspaceSlug, role, onClose }: Props) {
  const { t } = useTranslation();
  const { permissionSchemes, attachScheme, detachScheme } = useRoles();

  const [isSubmitting, setIsSubmitting] = useState(false);

  // Schemes of the same scope that are not yet attached
  const attachedIds = new Set(role.schemes.map((s) => s.id));
  const availableSchemes = Object.values(permissionSchemes).filter(
    (s) => s.scope === role.scope && !attachedIds.has(s.id)
  );

  const [selectedToAttach, setSelectedToAttach] = useState<Set<string>>(new Set());

  const toggleScheme = (id: string) => {
    setSelectedToAttach((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // Live preview of effective permissions once selected schemes are "virtually" attached
  const previewPermissions = (() => {
    const all = new Set<string>();
    // Existing schemes
    role.schemes.forEach((s) => s.permissions.forEach((p) => all.add(p)));
    // Would-be added schemes
    selectedToAttach.forEach((id) => {
      const scheme = permissionSchemes[id];
      if (scheme) scheme.permissions.forEach((p) => all.add(p));
    });
    return [...all].sort();
  })();

  const handleAttach = async () => {
    setIsSubmitting(true);
    try {
      await Promise.all([...selectedToAttach].map((schemeId) => attachScheme(workspaceSlug, role.id, schemeId)));
      setToast({ type: TOAST_TYPE.SUCCESS, title: t("workspace_settings.settings.roles.scheme.attach.success") });
      onClose();
    } catch {
      setToast({ type: TOAST_TYPE.ERROR, title: t("workspace_settings.settings.roles.scheme.attach.error") });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDetach = async (schemeId: string) => {
    try {
      await detachScheme(workspaceSlug, role.id, schemeId);
      setToast({ type: TOAST_TYPE.SUCCESS, title: t("workspace_settings.settings.roles.scheme.detach_success") });
    } catch {
      setToast({ type: TOAST_TYPE.ERROR, title: t("workspace_settings.settings.roles.scheme.detach_error") });
    }
  };

  return (
    <div className="flex h-full flex-col">
      <div className="border-custom-border-200 flex items-center justify-between border-b px-6 py-4">
        <div>
          <h3 className="text-lg text-custom-text-100 font-semibold">
            {t("workspace_settings.settings.roles.scheme.attach.title")}
          </h3>
          <p className="text-sm text-custom-text-300 mt-0.5">{role.name}</p>
        </div>
        <button type="button" onClick={onClose} className="text-custom-text-300 hover:text-custom-text-100">
          ✕
        </button>
      </div>

      <div className="flex flex-1 gap-6 overflow-hidden p-6">
        {/* Left: scheme selector */}
        <div className="flex flex-1 flex-col gap-4 overflow-y-auto">
          {/* Currently attached */}
          {role.schemes.length > 0 && (
            <div>
              <p className="text-xs text-custom-text-300 mb-2 font-semibold tracking-wide uppercase">
                Currently attached
              </p>
              <div className="space-y-2">
                {role.schemes.map((scheme) => (
                  <div
                    key={scheme.id}
                    className="border-custom-border-200 flex items-center justify-between rounded-md border px-3 py-2"
                  >
                    <div>
                      <p className="text-sm text-custom-text-100 font-medium">{scheme.name}</p>
                      <p className="text-xs text-custom-text-300">{scheme.permissions.length} permissions</p>
                    </div>
                    {!scheme.is_system && (
                      <button
                        type="button"
                        onClick={() => handleDetach(scheme.id)}
                        className="text-xs text-red-500 hover:underline"
                      >
                        {t("workspace_settings.settings.roles.scheme.detach")}
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Available schemes to attach */}
          <div>
            <p className="text-xs text-custom-text-300 mb-2 font-semibold tracking-wide uppercase">Available schemes</p>
            {availableSchemes.length === 0 ? (
              <p className="text-sm text-custom-text-400">
                {t("workspace_settings.settings.roles.no_schemes.description")}
              </p>
            ) : (
              <div className="space-y-2">
                {availableSchemes.map((scheme) => (
                  <label
                    key={scheme.id}
                    className="border-custom-border-200 hover:bg-custom-background-90 flex cursor-pointer items-start gap-3 rounded-md border px-3 py-2"
                  >
                    <Checkbox
                      id={`attach-${scheme.id}`}
                      checked={selectedToAttach.has(scheme.id)}
                      onChange={() => toggleScheme(scheme.id)}
                      className="mt-0.5 shrink-0"
                    />
                    <div>
                      <p className="text-sm text-custom-text-100 font-medium">{scheme.name}</p>
                      {scheme.description && <p className="text-xs text-custom-text-300">{scheme.description}</p>}
                      <p className="text-xs text-custom-text-400">{scheme.permissions.length} permissions</p>
                    </div>
                  </label>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right: effective permissions preview */}
        <div className="w-64 shrink-0">
          <p className="text-xs text-custom-text-300 mb-2 font-semibold tracking-wide uppercase">
            {t("workspace_settings.settings.roles.scheme.attach.preview_heading")}
          </p>
          <div className="border-custom-border-200 h-full overflow-y-auto rounded-md border p-3">
            {previewPermissions.length === 0 ? (
              <p className="text-xs text-custom-text-400">No permissions selected yet.</p>
            ) : (
              <ul className="space-y-1">
                {previewPermissions.map((p) => (
                  <li key={p} className="text-xs text-custom-text-200">
                    {p}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="border-custom-border-200 flex items-center justify-end gap-3 border-t px-6 py-4">
        <Button type="button" variant="secondary" onClick={onClose} disabled={isSubmitting}>
          {t("common.cancel")}
        </Button>
        <Button
          type="button"
          variant="primary"
          onClick={handleAttach}
          loading={isSubmitting}
          disabled={selectedToAttach.size === 0}
        >
          {t("workspace_settings.settings.roles.scheme.attach.attach_btn")}
        </Button>
      </div>
    </div>
  );
});
