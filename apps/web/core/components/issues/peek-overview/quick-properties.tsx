/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { observer } from "mobx-react";
import { useTranslation } from "@plane/i18n";
import { cn, getDate, renderFormattedPayloadDate } from "@plane/utils";
import { DateDropdown } from "@/components/dropdowns/date";
import { MemberDropdown } from "@/components/dropdowns/member/dropdown";
import { PriorityDropdown } from "@/components/dropdowns/priority";
import { StateDropdown } from "@/components/dropdowns/state/dropdown";
import { useIssueDetail } from "@/hooks/store/use-issue-detail";
import type { TIssueOperations } from "../issue-detail";

type Props = {
  workspaceSlug: string;
  projectId: string;
  issueId: string;
  issueOperations: TIssueOperations;
  disabled: boolean;
};

const Cell = ({ children }: { children: React.ReactNode }) => <div className="h-7 w-full px-1">{children}</div>;
const Divider = () => <div data-divider className="h-7 shrink-0 border-l border-subtle" />;

/**
 * Compact horizontal property bar shown directly under the title in the peek
 * overview: state / priority / assignees / start date / due date, each cell
 * stretching equally with a divider between them.
 */
export const PeekOverviewQuickProperties = observer(function PeekOverviewQuickProperties(props: Props) {
  const { workspaceSlug, projectId, issueId, issueOperations, disabled } = props;
  const { t } = useTranslation();
  const {
    issue: { getIssueById },
  } = useIssueDetail();

  const issue = getIssueById(issueId);
  if (!issue) return null;

  const minDate = getDate(issue.start_date);
  minDate?.setDate(minDate.getDate());
  const maxDate = getDate(issue.target_date);
  maxDate?.setDate(maxDate.getDate());

  return (
    <div
      className={cn(
        "-ml-3 flex w-full flex-wrap items-center gap-y-2 rounded-lg py-0.5",
        "[&>*:not([data-divider])]:min-w-24 [&>*:not([data-divider])]:flex-1",
        disabled ? "opacity-60" : ""
      )}
    >
      <Cell>
        <StateDropdown
          value={issue.state_id}
          onChange={(val) => issueOperations.update(workspaceSlug, projectId, issueId, { state_id: val })}
          projectId={projectId}
          disabled={disabled}
          buttonVariant="transparent-with-text"
          className="h-7 w-full"
          buttonContainerClassName="w-full text-left h-7"
          buttonClassName={`text-body-xs-medium justify-between ${issue.state_id ? "" : "text-placeholder"}`}
        />
      </Cell>

      <Divider />

      <Cell>
        <PriorityDropdown
          value={issue.priority}
          onChange={(val) => issueOperations.update(workspaceSlug, projectId, issueId, { priority: val })}
          disabled={disabled}
          buttonVariant="transparent-with-text"
          className="h-7 w-full rounded-sm"
          buttonContainerClassName="w-full text-left h-7"
          buttonClassName={`text-body-xs-medium whitespace-nowrap [&_svg]:size-3.5 ${!issue.priority || issue.priority === "none" ? "text-placeholder" : ""}`}
        />
      </Cell>

      <Divider />

      <Cell>
        <MemberDropdown
          value={issue.assignee_ids ?? undefined}
          onChange={(val) => issueOperations.update(workspaceSlug, projectId, issueId, { assignee_ids: val })}
          disabled={disabled}
          projectId={projectId}
          placeholder={t("issue.add.assignee")}
          multiple
          buttonVariant={issue.assignee_ids?.length > 1 ? "transparent-without-text" : "transparent-with-text"}
          className="h-7 w-full"
          buttonContainerClassName="w-full text-left h-7"
          buttonClassName={`text-body-xs-medium justify-between ${issue.assignee_ids?.length > 0 ? "" : "text-placeholder"}`}
          hideIcon={issue.assignee_ids?.length === 0}
        />
      </Cell>

      <Divider />

      <Cell>
        <DateDropdown
          value={issue.start_date}
          onChange={(val) =>
            issueOperations.update(workspaceSlug, projectId, issueId, {
              start_date: val ? renderFormattedPayloadDate(val) : null,
            })
          }
          placeholder={t("issue.add.start_date")}
          buttonVariant="transparent-with-text"
          maxDate={maxDate ?? undefined}
          disabled={disabled}
          className="h-7 w-full"
          buttonContainerClassName="w-full text-left h-7"
          buttonClassName={`text-body-xs-medium justify-between ${issue.start_date ? "" : "text-placeholder"}`}
        />
      </Cell>

      <Divider />

      <Cell>
        <DateDropdown
          value={issue.target_date}
          onChange={(val) =>
            issueOperations.update(workspaceSlug, projectId, issueId, {
              target_date: val ? renderFormattedPayloadDate(val) : null,
            })
          }
          placeholder={t("issue.add.due_date")}
          buttonVariant="transparent-with-text"
          minDate={minDate ?? undefined}
          disabled={disabled}
          className="h-7 w-full"
          buttonContainerClassName="w-full text-left h-7"
          buttonClassName={`text-body-xs-medium justify-between ${issue.target_date ? "" : "text-placeholder"}`}
        />
      </Cell>
    </div>
  );
});
