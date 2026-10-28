/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { observer } from "mobx-react";
import { Controller, useFormContext } from "react-hook-form";
import { Users } from "lucide-react";
// plane imports
import { NETWORK_CHOICES, ETabIndices } from "@plane/constants";
import { useTranslation } from "@plane/i18n";
import type { IProject } from "@plane/types";
import { CustomSelect } from "@plane/ui";
import { getTabIndex } from "@plane/utils";
// components
import { ProjectDatePicker } from "@/components/project/views/date-picker";
import { ProjectLeadPicker } from "@/components/project/views/lead-picker";
import { ProjectNetworkIcon } from "@/components/project/project-network-icon";
import { ProjectStatePicker } from "@/components/project/views/state-picker";
// hooks
import { useMember } from "@/hooks/store/use-member";
import { useWorkspace } from "@/hooks/store/use-workspace";

type Props = {
  isMobile?: boolean;
};

function ProjectAttributesInner(props: Props) {
  const { isMobile = false } = props;
  const { t } = useTranslation();
  const { control } = useFormContext<IProject>();
  const { getIndex } = getTabIndex(ETabIndices.PROJECT_CREATE, isMobile);
  // store
  const { currentWorkspace } = useWorkspace();
  const {
    workspace: { workspaceMemberIds },
  } = useMember();
  // derived
  const projectStatesEnabled = !!currentWorkspace?.project_states_enabled;
  const workspaceMembers = workspaceMemberIds ?? [];
  return (
    <div className="flex flex-wrap items-center gap-2">
      {/* Network / access */}
      <Controller
        name="network"
        control={control}
        render={({ field: { onChange, value } }) => {
          const currentNetwork = NETWORK_CHOICES.find((n) => n.key === value);

          return (
            <div className="h-6 flex-shrink-0" tabIndex={getIndex("network")}>
              <CustomSelect
                value={value}
                onChange={onChange}
                label={
                  <div className="flex h-full items-center gap-1">
                    {currentNetwork ? (
                      <>
                        <ProjectNetworkIcon iconKey={currentNetwork.iconKey} />
                        {t(currentNetwork.i18n_label)}
                      </>
                    ) : (
                      <span className="text-placeholder">{t("select_network")}</span>
                    )}
                  </div>
                }
                placement="bottom-start"
                className="h-full"
                buttonClassName="h-full"
                noChevron
                tabIndex={getIndex("network")}
              >
                {NETWORK_CHOICES.map((network) => (
                  <CustomSelect.Option key={network.key} value={network.key}>
                    <div className="flex items-start gap-2">
                      <ProjectNetworkIcon iconKey={network.iconKey} className="h-3.5 w-3.5" />
                      <div className="-mt-1">
                        <p>{t(network.i18n_label)}</p>
                        <p className="text-11 text-placeholder">{t(network.description)}</p>
                      </div>
                    </div>
                  </CustomSelect.Option>
                ))}
              </CustomSelect>
            </div>
          );
        }}
      />

      {/* Project state — only when the workspace has the feature enabled */}
      {projectStatesEnabled && (
        <Controller
          name="project_status"
          control={control}
          render={({ field: { value, onChange } }) => (
            <div className="my-auto h-6" role="presentation">
              <ProjectStatePicker value={value ?? null} onChange={onChange} className="h-6" />
            </div>
          )}
        />
      )}

      {/* Lead */}
      <Controller
        name="project_lead"
        control={control}
        render={({ field: { value, onChange } }) => {
          // Controller value can be IUser, string id, or null. Normalise to id for the picker.
          const leadId = typeof value === "string" ? value : (value?.id ?? null);
          return (
            <div className="my-auto h-6">
              <ProjectLeadPicker
                value={leadId}
                onChange={(id) => onChange(id === leadId ? null : id)}
                memberIds={workspaceMembers}
              />
            </div>
          );
        }}
      />

      {/* Members count — disabled placeholder (creator is the only member at create time) */}
      <div className="my-auto h-6" role="presentation">
        <button type="button" disabled className="block h-full w-full cursor-not-allowed outline-none">
          <div className="flex h-full cursor-not-allowed items-center gap-2 rounded border-[0.5px] border-subtle-1 px-2 text-11 text-secondary hover:bg-layer-1">
            <Users className="h-3 w-3 shrink-0" />
            <span>1</span>
          </div>
        </button>
      </div>

      {/* Date range */}
      <Controller
        name="start_date"
        control={control}
        render={({ field: { value: startValue, onChange: onChangeStart } }) => (
          <Controller
            name="end_date"
            control={control}
            render={({ field: { value: endValue, onChange: onChangeEnd } }) => (
              <div className="my-auto h-6">
                <ProjectDatePicker
                  startDate={startValue ?? null}
                  endDate={endValue ?? null}
                  onChange={(start, end) => {
                    onChangeStart(start);
                    onChangeEnd(end);
                  }}
                />
              </div>
            )}
          />
        )}
      />
    </div>
  );
}

const ProjectAttributes = observer(ProjectAttributesInner);

export default ProjectAttributes;
export { ProjectAttributes };
