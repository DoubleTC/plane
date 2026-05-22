/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useState } from "react";
import { Link } from "react-router";
import { observer } from "mobx-react";
import { ChevronRight, Trash2, Users } from "lucide-react";
// plane imports
import { useTranslation } from "@plane/i18n";
import type { ICustomRole } from "@plane/types";
// propel
import { Button } from "@plane/propel/button";
// components
import { RoleDeleteModal } from "./role-delete-modal";

interface Props {
  workspaceSlug: string;
  role: ICustomRole;
}

export const RoleCard = observer(function RoleCard({ workspaceSlug, role }: Props) {
  const { t } = useTranslation();
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);

  return (
    <>
      <div className="border-custom-border-200 bg-custom-background-100 hover:bg-custom-background-90 flex items-center justify-between rounded-lg border p-4 transition-colors">
        <Link to={`/${workspaceSlug}/settings/roles/${role.id}`} className="flex flex-1 items-center gap-3">
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <p className="text-sm text-custom-text-100 font-medium">{role.name}</p>
              {role.is_system && (
                <span className="bg-custom-background-80 text-custom-text-300 rounded px-1.5 py-0.5 text-[10px] font-medium">
                  {t("workspace_settings.settings.roles.role.system_role")}
                </span>
              )}
            </div>
            {role.description && <p className="text-xs text-custom-text-300 mt-0.5">{role.description}</p>}
            {role.member_count !== undefined && (
              <span className="text-xs text-custom-text-400 mt-1 flex items-center gap-1">
                <Users className="size-3" />
                {t("workspace_settings.settings.roles.role.member_count", { count: role.member_count })}
              </span>
            )}
          </div>
          <ChevronRight className="text-custom-text-300 size-4" />
        </Link>

        {!role.is_system && (
          <Button
            variant="secondary"
            size="sm"
            prependIcon={<Trash2 className="size-3" />}
            onClick={(e) => {
              e.preventDefault();
              setIsDeleteOpen(true);
            }}
            className="ml-3 shrink-0"
          >
            {t("common.delete")}
          </Button>
        )}
      </div>

      <RoleDeleteModal
        workspaceSlug={workspaceSlug}
        role={role}
        isOpen={isDeleteOpen}
        onClose={() => setIsDeleteOpen(false)}
      />
    </>
  );
});
