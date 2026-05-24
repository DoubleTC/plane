/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

export type TProjectViewMode = "gallery" | "board" | "list" | "timeline";

/** localStorage key shared between the switcher (header) and the root content component. */
export const PROJECT_VIEW_MODE_KEY = "project_list_view_mode";
