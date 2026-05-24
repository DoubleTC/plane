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
// components
import { SettingsHeading } from "@/components/settings/heading";
// services
import { workspaceProjectStateService } from "@/services/workspace-project-state.service";
// hooks
import { useWorkspace } from "@/hooks/store/use-workspace";
import { useWorkspaceProjectState } from "@/hooks/store/use-workspace-project-state";
// local
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

  const handleToggle = async () => {
    if (isToggling) return;
    const newValue = !isEnabled;
    setIsToggling(true);
    try {
      await workspaceProjectStateService.toggleFeature(workspaceSlug, newValue);
      // Patch the workspace observable locally without a second PATCH request
      const workspace = getWorkspaceBySlug(workspaceSlug);
      if (workspace) {
        runInAction(() => {
          workspace.project_states_enabled = newValue;
        });
      }
      if (newValue) {
        // Fetch default states that were seeded on first enable
        await fetchStates(workspaceSlug);
      }
      setToast({
        type: TOAST_TYPE.SUCCESS,
        title: newValue
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
      {/* Heading + description + feature toggle aligned to top-right */}
      <SettingsHeading
        title={t("workspace_settings.settings.project_states.heading")}
        description={t("workspace_settings.settings.project_states.description")}
        control={
          <ToggleSwitch value={isEnabled} onChange={() => void handleToggle()} disabled={isToggling} size="sm" />
        }
      />

      {/* Group accordion list — rendered only when the feature is enabled */}
      {isEnabled && (
        <div className="flex flex-col gap-3">
          {PROJECT_STATE_GROUPS.map((groupMeta) => (
            <ProjectStateGroupSection
              key={groupMeta.key}
              workspaceSlug={workspaceSlug}
              group={groupMeta.key}
              states={getStatesByGroup(workspaceSlug, groupMeta.key)}
            />
          ))}
        </div>
      )}
    </div>
  );
});
