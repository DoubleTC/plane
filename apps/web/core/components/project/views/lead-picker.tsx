/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useEffect, useRef, useState } from "react";
import { observer } from "mobx-react";
import { useParams } from "next/navigation";
import { Ban, Check, Search, Users } from "lucide-react";
// plane imports
import { useTranslation } from "@plane/i18n";
import { Popover } from "@plane/propel/popover";
import type { IProject } from "@plane/types";
import { Avatar } from "@plane/ui";
import { cn, getFileURL } from "@plane/utils";
// hooks
import { useMember } from "@/hooks/store/use-member";
import { useProject } from "@/hooks/store/use-project";

type Props = {
  project: IProject;
  className?: string;
};

/**
 * Compact lead-picker button for the project card.
 * Opens a Popover listing all project members (minus guests) so the user
 * can set or clear the project lead without leaving the listing page.
 *
 * Must be rendered inside a propagation-stopping context (data-prevent-progress
 * + outer onClick) because ProjectCard is a <Link>.
 */
export const ProjectLeadPicker = observer(function ProjectLeadPicker({ project, className }: Props) {
  const { t } = useTranslation();
  const { workspaceSlug } = useParams();

  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const { updateProject } = useProject();
  const { getUserDetails } = useMember();

  // Resolve the current lead to a display object
  const projectLead =
    typeof project.project_lead === "string"
      ? getUserDetails(project.project_lead)
      : (project.project_lead ?? undefined);

  // Build the selectable member list from project.members (array of user IDs)
  const memberIds = project.members ?? [];
  const memberOptions = memberIds
    .map((id) => getUserDetails(id))
    .filter((u): u is NonNullable<ReturnType<typeof getUserDetails>> => !!u);

  const filteredMembers = search.trim()
    ? memberOptions.filter((u) => u.display_name.toLowerCase().includes(search.toLowerCase()))
    : memberOptions;

  // ── Popover lifecycle ─────────────────────────────────────────────────────────

  const handleOpenChange = (isOpen: boolean) => {
    setOpen(isOpen);
    if (!isOpen) setSearch("");
  };

  // Auto-focus the search input when the popover opens
  useEffect(() => {
    if (open) {
      const id = setTimeout(() => inputRef.current?.focus(), 0);
      return () => clearTimeout(id);
    }
  }, [open]);

  // ── Selection handler ─────────────────────────────────────────────────────────

  const handleSelectLead = async (userId: string | null) => {
    if (!workspaceSlug || !project.id) return;
    setOpen(false);
    setSearch("");
    try {
      await updateProject(workspaceSlug.toString(), project.id, { project_lead: userId });
    } catch {
      // updateProject shows its own error toast on failure
    }
  };

  const currentLeadId = typeof project.project_lead === "string" ? project.project_lead : project.project_lead?.id;

  return (
    // eslint-disable-next-line jsx-a11y/no-static-element-interactions
    <div
      role="presentation"
      data-prevent-progress
      className="contents"
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
      }}
    >
      <Popover open={open} onOpenChange={handleOpenChange}>
        {/* ── Trigger button ── */}
        <Popover.Button
          render={
            <button
              type="button"
              className={cn(
                "flex h-full items-center gap-2 rounded border-[0.5px] border-subtle-1 px-2 text-11 text-secondary hover:bg-layer-1",
                className
              )}
            />
          }
        >
          {projectLead ? (
            <>
              <Avatar
                name={projectLead.display_name}
                src={getFileURL(projectLead.avatar_url)}
                size={14}
                className="flex-shrink-0"
              />
              <span className="max-w-[80px] truncate">{projectLead.display_name}</span>
            </>
          ) : (
            <>
              <Users className="h-3 w-3 flex-shrink-0" />
              <span>{t("lead")}</span>
            </>
          )}
        </Popover.Button>

        {/* ── Panel ── */}
        <Popover.Panel
          side="bottom"
          align="start"
          sideOffset={6}
          className="shadow-lg z-20 min-w-48 overflow-hidden rounded-md border border-subtle bg-layer-2 py-2.5 whitespace-nowrap"
        >
          {/* Search bar */}
          <div className="mx-2 mb-2 flex items-center gap-1.5 rounded-sm border border-subtle px-2">
            <Search className="h-3.5 w-3.5 flex-shrink-0 text-placeholder" />
            <input
              ref={inputRef}
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t("search")}
              className="w-full bg-transparent py-1 text-11 text-secondary placeholder:text-placeholder focus:outline-none"
            />
          </div>

          {/* Member list */}
          <div className="vertical-scrollbar scrollbar-xs max-h-48 space-y-1 overflow-y-scroll px-2">
            {/* "No lead" option — always visible when no search or matches "none" */}
            {!search.trim() && (
              <button
                type="button"
                onClick={() => void handleSelectLead(null)}
                className="flex w-full cursor-pointer items-center justify-between gap-2 truncate rounded-sm px-1 py-1.5 text-13 text-secondary select-none hover:bg-layer-1"
              >
                <span className="flex items-center gap-2 truncate">
                  <Ban className="h-3 w-3 flex-shrink-0 rotate-90 text-placeholder" />
                  <span className="truncate text-placeholder">{t("common.none")}</span>
                </span>
                {!currentLeadId && <Check className="size-3.5 shrink-0" />}
              </button>
            )}

            {filteredMembers.map((member) => (
              <button
                key={member.id}
                type="button"
                onClick={() => void handleSelectLead(member.id)}
                className="flex w-full cursor-pointer items-center justify-between gap-2 truncate rounded-sm px-1 py-1.5 text-13 text-secondary select-none hover:bg-layer-1"
              >
                <span className="flex items-center gap-2 truncate">
                  <Avatar
                    name={member.display_name}
                    src={getFileURL(member.avatar_url)}
                    size={14}
                    className="flex-shrink-0"
                  />
                  <span className="max-w-[100px] truncate">{member.display_name}</span>
                </span>
                {currentLeadId === member.id && <Check className="size-3.5 shrink-0" />}
              </button>
            ))}

            {filteredMembers.length === 0 && search.trim() && (
              <p className="px-1 py-2 text-center text-11 text-placeholder">{t("no_matching_members")}</p>
            )}
          </div>
        </Popover.Panel>
      </Popover>
    </div>
  );
});
