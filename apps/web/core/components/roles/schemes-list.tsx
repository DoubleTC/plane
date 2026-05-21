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
// propel
import { Button } from "@plane/propel/button";
// plane ui
import { EModalWidth, ModalCore } from "@plane/ui";
// hooks
import { useRoles } from "@/hooks/store/use-roles";
// components
import { SchemeCard } from "./scheme-card";
import { SchemeCreateForm } from "./scheme-create-form";

interface Props {
  workspaceSlug: string;
  scope: "workspace" | "project";
}

export const SchemesList = observer(function SchemesList({ workspaceSlug, scope }: Props) {
  const { t } = useTranslation();
  const { permissionSchemes, isLoadingSchemes } = useRoles();
  const [isCreateOpen, setIsCreateOpen] = useState(false);

  const schemes = Object.values(permissionSchemes).filter((s) => s.scope === scope);

  if (isLoadingSchemes) {
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
          {t("workspace_settings.settings.roles.add_scheme")}
        </Button>
      </div>

      {schemes.length === 0 ? (
        <div className="border-custom-border-200 flex flex-col items-center justify-center rounded-lg border border-dashed py-16 text-center">
          <p className="text-sm text-custom-text-200 font-medium">
            {t("workspace_settings.settings.roles.no_schemes.title")}
          </p>
          <p className="text-xs text-custom-text-300 mt-1">
            {t("workspace_settings.settings.roles.no_schemes.description")}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {schemes.map((scheme) => (
            <SchemeCard key={scheme.id} workspaceSlug={workspaceSlug} scheme={scheme} />
          ))}
        </div>
      )}

      {/* Create scheme modal */}
      <ModalCore isOpen={isCreateOpen} handleClose={() => setIsCreateOpen(false)} width={EModalWidth.XL}>
        <div className="p-6">
          <h3 className="text-lg text-custom-text-100 mb-4 font-semibold">
            {t("workspace_settings.settings.roles.scheme.create.title")}
          </h3>
          <SchemeCreateForm
            workspaceSlug={workspaceSlug}
            scope={scope}
            onSuccess={() => setIsCreateOpen(false)}
            onCancel={() => setIsCreateOpen(false)}
          />
        </div>
      </ModalCore>
    </div>
  );
});
