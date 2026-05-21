/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useState } from "react";
import { observer } from "mobx-react";
import { Layers, Plus, Shield } from "lucide-react";
// plane imports
import { useTranslation } from "@plane/i18n";
import type { ICustomRole } from "@plane/types";
// propel
import { Button } from "@plane/propel/button";
// hooks
import { useRoles } from "@/hooks/store/use-roles";
// components
import { SchemeAttachPanel } from "./scheme-attach-panel";

interface Props {
  workspaceSlug: string;
  role: ICustomRole;
}

export const RoleDetail = observer(function RoleDetail({ workspaceSlug, role }: Props) {
  const { t } = useTranslation();
  const { computeEffectivePermissions } = useRoles();

  const [isAttachPanelOpen, setIsAttachPanelOpen] = useState(false);

  const effectivePermissions = computeEffectivePermissions(role.id);

  return (
    <div className="space-y-8">
      {/* Role meta */}
      <div className="border-custom-border-200 bg-custom-background-100 rounded-lg border p-6">
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
              <span>
                Members: <span className="text-custom-text-200 font-medium">{role.member_count ?? 0}</span>
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Attached schemes */}
      <div>
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Layers className="text-custom-text-300 size-5" />
            <h3 className="text-base text-custom-text-100 font-semibold">
              {t("workspace_settings.settings.roles.role.schemes")}
            </h3>
            <span className="bg-custom-background-80 text-xs text-custom-text-300 rounded-full px-2 py-0.5">
              {role.schemes.length}
            </span>
          </div>
          {!role.is_system && (
            <Button
              variant="secondary"
              size="sm"
              prependIcon={<Plus className="size-3" />}
              onClick={() => setIsAttachPanelOpen(true)}
            >
              {t("workspace_settings.settings.roles.role.attach_scheme")}
            </Button>
          )}
        </div>

        {role.schemes.length === 0 ? (
          <div className="border-custom-border-200 flex flex-col items-center justify-center rounded-lg border border-dashed py-10 text-center">
            <Layers className="text-custom-text-400 mx-auto mb-2 size-8" />
            <p className="text-sm text-custom-text-300">No schemes attached yet.</p>
            {!role.is_system && (
              <Button variant="secondary" size="sm" className="mt-3" onClick={() => setIsAttachPanelOpen(true)}>
                {t("workspace_settings.settings.roles.role.attach_scheme")}
              </Button>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            {role.schemes.map((scheme) => (
              <div
                key={scheme.id}
                className="border-custom-border-200 bg-custom-background-100 flex items-center justify-between rounded-lg border px-4 py-3"
              >
                <div className="flex items-center gap-3">
                  <Shield className="text-custom-primary-100 size-4" />
                  <div>
                    <p className="text-sm text-custom-text-100 font-medium">{scheme.name}</p>
                    <p className="text-xs text-custom-text-400">{scheme.permissions.length} permissions</p>
                  </div>
                </div>
                {scheme.is_system && (
                  <span className="text-xs text-custom-text-400">
                    {t("workspace_settings.settings.roles.scheme.system_scheme")}
                  </span>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Effective permissions */}
      <div>
        <div className="mb-4 flex items-center gap-2">
          <Shield className="text-custom-text-300 size-5" />
          <h3 className="text-base text-custom-text-100 font-semibold">
            {t("workspace_settings.settings.roles.role.effective_permissions")}
          </h3>
          <span className="bg-custom-background-80 text-xs text-custom-text-300 rounded-full px-2 py-0.5">
            {effectivePermissions.length}
          </span>
        </div>

        {effectivePermissions.length === 0 ? (
          <p className="text-sm text-custom-text-400">
            This role has no effective permissions. Attach permission schemes to grant access.
          </p>
        ) : (
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {effectivePermissions.map((perm) => (
              <div
                key={perm}
                className="bg-custom-background-80 text-xs font-mono text-custom-text-200 rounded-md px-3 py-1.5"
              >
                {perm}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Attach panel slide-over */}
      {isAttachPanelOpen && (
        <div className="fixed inset-0 z-50 flex">
          {/* Backdrop */}
          <button
            type="button"
            className="flex-1 cursor-default bg-black/40"
            onClick={() => setIsAttachPanelOpen(false)}
            aria-label="Close panel"
          />
          {/* Panel */}
          <div className="bg-custom-background-100 shadow-xl flex h-full w-[600px] flex-col">
            <SchemeAttachPanel workspaceSlug={workspaceSlug} role={role} onClose={() => setIsAttachPanelOpen(false)} />
          </div>
        </div>
      )}
    </div>
  );
});
