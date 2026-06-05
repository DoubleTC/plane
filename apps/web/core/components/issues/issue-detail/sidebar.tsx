/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useState, type ReactNode } from "react";
import { observer } from "mobx-react";
import { ChevronDown } from "lucide-react";
// i18n
import { useTranslation } from "@plane/i18n";
// ui
import {
  CycleIcon,
  ModuleIcon,
  LabelPropertyIcon,
  UserCirclePropertyIcon,
  EstimatePropertyIcon,
  ParentPropertyIcon,
} from "@plane/propel/icons";
import { cn } from "@plane/utils";
// components
import { EstimateDropdown } from "@/components/dropdowns/estimate";
import { ButtonAvatars } from "@/components/dropdowns/member/avatar";
// hooks
import { useProjectEstimates } from "@/hooks/store/estimates";
import { useIssueDetail } from "@/hooks/store/use-issue-detail";
import { useMember } from "@/hooks/store/use-member";
import { useProject } from "@/hooks/store/use-project";
// plane web components
// components
import { WorkItemAdditionalSidebarProperties } from "@/plane-web/components/issues/issue-details/additional-properties";
import { IssueParentSelectRoot } from "@/plane-web/components/issues/issue-details/parent-select-root";
import { TransferHopInfo } from "@/plane-web/components/issues/issue-details/sidebar/transfer-hop-info";
import { IssueWorklogProperty } from "@/plane-web/components/issues/worklog/property";
import { SidebarPropertyListItem } from "@/components/common/layout/sidebar/property-list-item";
import { IssueCycleSelect } from "./cycle-select";
import { IssueLabel } from "./label";
import { IssueModuleSelect } from "./module-select";
import type { TIssueOperations } from "./root";

type Props = {
  workspaceSlug: string;
  projectId: string;
  issueId: string;
  issueOperations: TIssueOperations;
  isEditable: boolean;
};

/** A collapsible group of properties (e.g. "Details" / "Project structure"). */
const CollapsibleSection = ({ title, children }: { title: string; children: ReactNode }) => {
  const [open, setOpen] = useState(true);
  return (
    <div className="flex flex-col gap-2 py-1">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="flex w-full items-center gap-1 py-1 text-caption-md-semibold text-primary"
        aria-expanded={open}
      >
        <span className="text-caption-md-semibold">{title}</span>
        <ChevronDown
          className={cn("size-4 shrink-0 text-tertiary transition-transform", open ? "" : "-rotate-90")}
          aria-hidden
        />
      </button>
      {open && <div className="flex flex-col gap-2.5">{children}</div>}
    </div>
  );
};

export const IssueDetailsSidebar = observer(function IssueDetailsSidebar(props: Props) {
  const { t } = useTranslation();
  const { workspaceSlug, projectId, issueId, issueOperations, isEditable } = props;
  // store hooks
  const { getProjectById } = useProject();
  const { areEstimateEnabledByProjectId } = useProjectEstimates();
  const {
    issue: { getIssueById },
  } = useIssueDetail();
  const { getUserDetails } = useMember();
  const issue = getIssueById(issueId);
  if (!issue) return <></>;

  const createdByDetails = getUserDetails(issue.created_by);

  // derived values
  const projectDetails = getProjectById(issue.project_id);

  return (
    <>
      <div className="flex h-full w-full flex-col items-center divide-y-2 divide-subtle-1 overflow-hidden">
        <div className="h-full w-full overflow-y-auto px-6">
          <h5 className="mt-5 text-body-sm-semibold text-primary">{t("common.properties")}</h5>
          <div className={`mt-4 mb-2 truncate ${!isEditable ? "opacity-60" : ""}`}>
            <CollapsibleSection title={t("common.details")}>
              {createdByDetails && (
                <SidebarPropertyListItem icon={UserCirclePropertyIcon} label={t("common.created_by")}>
                  <div className="flex gap-2 px-2">
                    <ButtonAvatars showTooltip userIds={createdByDetails.id} />
                    <span className="grow truncate text-body-xs-regular leading-5">
                      {createdByDetails?.display_name}
                    </span>
                  </div>
                </SidebarPropertyListItem>
              )}

              {projectId && areEstimateEnabledByProjectId(projectId) && (
                <SidebarPropertyListItem icon={EstimatePropertyIcon} label={t("common.estimate")}>
                  <EstimateDropdown
                    value={issue?.estimate_point ?? undefined}
                    onChange={(val: string | undefined) =>
                      issueOperations.update(workspaceSlug, projectId, issueId, { estimate_point: val })
                    }
                    projectId={projectId}
                    disabled={!isEditable}
                    buttonVariant="transparent-with-text"
                    className="group w-full grow"
                    buttonContainerClassName="w-full text-left h-7.5"
                    buttonClassName={`text-body-xs-regular ${issue?.estimate_point !== null ? "" : "text-placeholder"}`}
                    placeholder={t("common.none")}
                    hideIcon
                    dropdownArrow
                    dropdownArrowClassName="h-3.5 w-3.5 hidden group-hover:inline"
                  />
                </SidebarPropertyListItem>
              )}

              <SidebarPropertyListItem icon={ParentPropertyIcon} label={t("common.parent")}>
                <IssueParentSelectRoot
                  className="h-7.5 w-full grow"
                  workspaceSlug={workspaceSlug}
                  projectId={projectId}
                  issueId={issueId}
                  issueOperations={issueOperations}
                  disabled={!isEditable}
                />
              </SidebarPropertyListItem>

              <SidebarPropertyListItem icon={LabelPropertyIcon} label={t("common.labels")}>
                <IssueLabel
                  workspaceSlug={workspaceSlug}
                  projectId={projectId}
                  issueId={issueId}
                  disabled={!isEditable}
                />
              </SidebarPropertyListItem>

              <IssueWorklogProperty
                workspaceSlug={workspaceSlug}
                projectId={projectId}
                issueId={issueId}
                disabled={!isEditable}
              />

              <WorkItemAdditionalSidebarProperties
                workItemId={issue.id}
                workItemTypeId={issue.type_id}
                projectId={projectId}
                workspaceSlug={workspaceSlug}
                isEditable={isEditable}
              />
            </CollapsibleSection>

            {(projectDetails?.module_view || projectDetails?.cycle_view) && (
              <>
                <div className="w-full border-t border-subtle" />
                <CollapsibleSection title={t("common.project_structure")}>
                  {projectDetails?.cycle_view && (
                    <SidebarPropertyListItem
                      icon={CycleIcon}
                      label={t("common.cycle")}
                      appendElement={<TransferHopInfo workItem={issue} />}
                    >
                      <IssueCycleSelect
                        className="h-7.5 w-full grow"
                        workspaceSlug={workspaceSlug}
                        projectId={projectId}
                        issueId={issueId}
                        issueOperations={issueOperations}
                        disabled={!isEditable}
                      />
                    </SidebarPropertyListItem>
                  )}

                  {projectDetails?.module_view && (
                    <SidebarPropertyListItem icon={ModuleIcon} label={t("common.modules")}>
                      <IssueModuleSelect
                        className="w-full grow"
                        workspaceSlug={workspaceSlug}
                        projectId={projectId}
                        issueId={issueId}
                        issueOperations={issueOperations}
                        disabled={!isEditable}
                      />
                    </SidebarPropertyListItem>
                  )}
                </CollapsibleSection>
              </>
            )}
          </div>
        </div>
      </div>
    </>
  );
});
