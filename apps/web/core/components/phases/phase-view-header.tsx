// Copyright (c) 2023-present Plane Software, Inc. and contributors
// SPDX-License-Identifier: AGPL-3.0-only

import React, { useEffect, useRef, useState } from "react";
import { observer } from "mobx-react";
import { useParams } from "next/navigation";
// plane helpers
import { MODULE_VIEW_LAYOUTS } from "@plane/constants";
import { useOutsideClickDetector } from "@plane/hooks";
// types
import { useTranslation } from "@plane/i18n";
import { SearchIcon, CloseIcon } from "@plane/propel/icons";
import { Tooltip } from "@plane/propel/tooltip";
// utils
import { cn } from "@plane/utils";
// components
import { ModuleLayoutIcon } from "@/components/modules/module-layout-icon";
import { IconButton } from "@plane/propel/icon-button";
// hooks
import { usePhaseFilter } from "@/hooks/store/use-phase-filter";
import { usePlatformOS } from "@/hooks/use-platform-os";

export const PhaseViewHeader = observer(function PhaseViewHeader() {
  // refs
  const inputRef = useRef<HTMLInputElement>(null);
  // router
  const { projectId } = useParams();
  // hooks
  const { isMobile } = usePlatformOS();
  // store hooks
  const {
    currentProjectDisplayFilters: displayFilters,
    searchQuery,
    updateDisplayFilters,
    updateSearchQuery,
  } = usePhaseFilter();
  const { t } = useTranslation();

  // states
  const [isSearchOpen, setIsSearchOpen] = useState(searchQuery !== "");

  const handleInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Escape") {
      if (searchQuery && searchQuery.trim() !== "") updateSearchQuery("");
      else {
        setIsSearchOpen(false);
        inputRef.current?.blur();
      }
    }
  };

  // outside click detector hook
  useOutsideClickDetector(inputRef, () => {
    if (isSearchOpen && searchQuery.trim() === "") setIsSearchOpen(false);
  });

  useEffect(() => {
    if (searchQuery.trim() !== "") setIsSearchOpen(true);
  }, [searchQuery]);

  return (
    <div className="hidden h-full items-center gap-2 self-end sm:flex">
      <div className="flex items-center">
        {!isSearchOpen && (
          <IconButton
            variant="ghost"
            size="lg"
            className="p- -mr-1"
            onClick={() => {
              setIsSearchOpen(true);
              inputRef.current?.focus();
            }}
            icon={SearchIcon}
          />
        )}
        <div
          className={cn(
            "ml-auto flex w-0 items-center justify-start gap-1 overflow-hidden rounded-md border border-transparent bg-surface-1 text-placeholder opacity-0 transition-[width] ease-linear",
            {
              "w-64 border-subtle px-2.5 py-1.5 opacity-100": isSearchOpen,
            }
          )}
        >
          <SearchIcon className="h-3.5 w-3.5" />
          <input
            ref={inputRef}
            className="w-full max-w-[234px] border-none bg-transparent text-13 text-primary placeholder:text-placeholder focus:outline-none"
            placeholder="Search"
            value={searchQuery}
            onChange={(e) => updateSearchQuery(e.target.value)}
            onKeyDown={handleInputKeyDown}
          />
          {isSearchOpen && (
            <button
              type="button"
              className="grid place-items-center"
              onClick={() => {
                setIsSearchOpen(false);
              }}
            >
              <CloseIcon className="h-3 w-3" />
            </button>
          )}
        </div>
      </div>
      <div className="hidden items-center gap-1 rounded-sm bg-layer-3 p-1 md:flex">
        {MODULE_VIEW_LAYOUTS.map((layout) => (
          <Tooltip key={layout.key} tooltipContent={t(layout.i18n_title)} isMobile={isMobile}>
            <button
              type="button"
              className={cn(
                "group grid h-5.5 w-7 place-items-center overflow-hidden rounded-sm transition-all hover:bg-layer-transparent-hover",
                {
                  "bg-layer-transparent-active hover:bg-layer-transparent-active":
                    displayFilters?.layout === layout.key,
                }
              )}
              onClick={() => {
                if (!projectId) return;
                updateDisplayFilters(projectId.toString(), { layout: layout.key });
              }}
            >
              <ModuleLayoutIcon layoutType={layout.key} />
            </button>
          </Tooltip>
        ))}
      </div>
    </div>
  );
});
