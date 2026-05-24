/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useState } from "react";
import { observer } from "mobx-react";
import { runInAction } from "mobx";
// plane imports
import { useTranslation } from "@plane/i18n";
import { ToggleSwitch } from "@plane/ui";
import { setToast, TOAST_TYPE } from "@plane/propel/toast";
import { PROJECT_STATE_GROUPS } from "@plane/types";
// services
import { workspaceProjectStateService } from "@/services/workspace-project-state.service";
// hooks
import { useWorkspaceProjectState } from "@/hooks/store/use-workspace-project-state";
import { useWorkspace } from "@/hooks/store/use-workspace";
// components
import { ProjectStateGroupSection } from "./state-group-section";

type Props = {
  workspaceSlug: string;
};

export const ProjectStatesRoot = observer(function ProjectStatesRoot({ workspaceSlug }: Props) {
  const { t } = useTranslation();
  const { currentWorkspace, getWorkspaceBySlug } = useWorkspace();
  const { fetchStates, getStatesByGroup } = useWorkspaceProjectState();

  const [isToggling, setIsToggling] = useState(false);

  const isEnabled = !!currentWorkspace?.project_states_enabled;

  const handleToggle = async (enabled: boolean) => {
    if (isToggling) return;
    setIsToggling(true);
    try {
      await workspaceProjectStateService.toggleFeature(workspaceSlug, enabled);
      // Update the workspace observable locally so the toggle reflects immediately
      const workspace = getWorkspaceBySlug(workspaceSlug);
      if (workspace) {
        runInAction(() => {
          workspace.project_states_enabled = enabled;
        });
      }
      if (enabled) {
        // Fetch default states that may have been seeded
        await fetchStates(workspaceSlug);
      }
      setToast({
        type: TOAST_TYPE.SUCCESS,
        title: enabled
          ? t("workspace_settings.settings.project_states.toast.enabled")
          : t("workspace_settings.settings.project_states.toast.disabled"),
      });
    } catch {
      setToast({
        type: TOAST_TYPE.ERROR,
        title: t("workspace_settings.settings.project_states.toast.toggle_error"),
      });
    } finally {
      setIsToggling(false);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      {/* Feature toggle */}
      <div className="border-custom-border-200 bg-custom-background-100 flex items-start justify-between gap-4 rounded-lg border p-4">
        <div className="flex flex-col gap-1">
          <h3 className="text-sm text-custom-text-100 font-medium">
            {t("workspace_settings.settings.project_states.toggle_title")}
          </h3>
          <p className="text-xs text-custom-text-300">
            {t("workspace_settings.settings.project_states.toggle_description")}
          </p>
        </div>
        <ToggleSwitch
          value={isEnabled}
          onChange={() => void handleToggle(!isEnabled)}
          disabled={isToggling}
          size="sm"
        />
      </div>

      {/* States list — only shown when feature is enabled */}
      {isEnabled && (
        <div className="flex flex-col gap-6">
          {PROJECT_STATE_GROUPS.map((groupMeta) => {
            const states = getStatesByGroup(workspaceSlug, groupMeta.key);
            return (
              <ProjectStateGroupSection
                key={groupMeta.key}
                workspaceSlug={workspaceSlug}
                group={groupMeta.key}
                states={states}
              />
            );
          })}
        </div>
      )}
    </div>
  );
});
