/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { observer } from "mobx-react";
// plane imports
import { useTranslation } from "@plane/i18n";
import type { IPermissionGroup } from "@plane/types";
// plane ui
import { Checkbox } from "@plane/ui";

interface Props {
  group: IPermissionGroup;
  selected: Set<string>;
  onChange: (permissions: string[]) => void;
  disabled?: boolean;
}

export const PermissionGroupToggle = observer(function PermissionGroupToggle({
  group,
  selected,
  onChange,
  disabled = false,
}: Props) {
  const { t } = useTranslation();

  const groupPermIds = group.permissions.map((p) => p.id);
  const allSelected = groupPermIds.every((id) => selected.has(id));
  const someSelected = groupPermIds.some((id) => selected.has(id));

  const handleSelectAll = () => {
    if (allSelected) {
      // Deselect all in group
      onChange(groupPermIds.map((id) => `-${id}`));
    } else {
      // Select all in group
      onChange(groupPermIds);
    }
  };

  const handleToggle = (permId: string, prereqs: string[] | undefined) => {
    if (selected.has(permId)) {
      // Deselect: remove this permission
      onChange([`-${permId}`]);
    } else {
      // Select: also auto-select prerequisites
      const toAdd: string[] = [permId];
      if (prereqs) {
        prereqs.forEach((prereq) => {
          if (!selected.has(prereq)) toAdd.push(prereq);
        });
      }
      onChange(toAdd);
    }
  };

  return (
    <div className="border-custom-border-200 bg-custom-background-90 rounded-lg border p-4">
      {/* Group header with Select All */}
      <div className="mb-3 flex items-center justify-between">
        <h4 className="text-sm text-custom-text-100 font-medium">{group.group_name}</h4>
        <button
          type="button"
          onClick={handleSelectAll}
          disabled={disabled}
          className="text-xs text-custom-primary-100 hover:underline disabled:cursor-not-allowed disabled:opacity-50"
        >
          {allSelected ? t("common.deselect_all") : someSelected ? t("common.select_all") : t("common.select_all")}
        </button>
      </div>

      {/* Permission list */}
      <div className="space-y-2">
        {group.permissions.map((perm) => {
          const isChecked = selected.has(perm.id);
          const isConditional = perm.conditional === "creator";

          return (
            <div key={perm.id} className="flex items-start gap-3">
              <Checkbox
                id={`perm-${perm.id}`}
                checked={isChecked}
                onChange={() => handleToggle(perm.id, perm.prerequisites)}
                disabled={disabled}
                className="mt-0.5 shrink-0"
              />
              <label htmlFor={`perm-${perm.id}`} className="flex flex-1 cursor-pointer flex-col gap-0.5">
                <span className="text-sm text-custom-text-100 flex items-center gap-2">
                  {perm.label}
                  {isConditional && (
                    <span className="bg-custom-warning-100/20 text-custom-warning-200 rounded px-1.5 py-0.5 text-[10px] font-medium">
                      {t("workspace_settings.settings.roles.scheme.conditional_badge")}
                    </span>
                  )}
                </span>
                {perm.description && <span className="text-xs text-custom-text-300">{perm.description}</span>}
                {perm.prerequisites && perm.prerequisites.length > 0 && !isChecked && (
                  <span className="text-xs text-custom-text-400">
                    {t("common.requires")}: {perm.prerequisites.join(", ")}
                  </span>
                )}
              </label>
            </div>
          );
        })}
      </div>
    </div>
  );
});
