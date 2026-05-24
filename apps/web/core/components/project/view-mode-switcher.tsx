/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { LayoutGrid, Columns3, List, GanttChartSquare } from "lucide-react";
// plane imports
import { useLocalStorage } from "@plane/hooks";
import { useTranslation } from "@plane/i18n";
import { Tooltip } from "@plane/propel/tooltip";
import { cn } from "@plane/utils";
// local imports
import { PROJECT_VIEW_MODE_KEY, type TProjectViewMode } from "./views/types";

const VIEW_MODES: {
  mode: TProjectViewMode;
  icon: React.ComponentType<{ className?: string }>;
  i18nKey: string;
}[] = [
  { mode: "gallery", icon: LayoutGrid, i18nKey: "workspace_projects.view_modes.gallery" },
  { mode: "board", icon: Columns3, i18nKey: "workspace_projects.view_modes.board" },
  { mode: "list", icon: List, i18nKey: "workspace_projects.view_modes.list" },
  { mode: "timeline", icon: GanttChartSquare, i18nKey: "workspace_projects.view_modes.timeline" },
];

/**
 * Four icon buttons for switching between project view modes.
 * Persists the selection in localStorage so the choice survives navigation.
 * Placed in the page header right item alongside the filters / create button.
 */
export function ProjectViewModeSwitcher() {
  const { t } = useTranslation();
  const { storedValue: viewMode, setValue: setViewMode } = useLocalStorage<TProjectViewMode>(
    PROJECT_VIEW_MODE_KEY,
    "gallery"
  );

  const active = viewMode ?? "gallery";

  return (
    <div className="flex items-center gap-0.5 rounded-md border border-subtle bg-layer-2 p-0.5">
      {VIEW_MODES.map(({ mode, icon: Icon, i18nKey }) => (
        <Tooltip key={mode} tooltipContent={t(i18nKey)} position="bottom">
          <button
            type="button"
            onClick={() => setViewMode(mode)}
            className={cn(
              "flex h-7 w-7 items-center justify-center rounded transition-colors",
              active === mode ? "bg-accent-primary text-white" : "text-secondary hover:bg-layer-1 hover:text-primary"
            )}
          >
            <Icon className="h-3.5 w-3.5" />
          </button>
        </Tooltip>
      ))}
    </div>
  );
}
