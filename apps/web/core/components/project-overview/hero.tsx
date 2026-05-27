/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { observer } from "mobx-react";
import { Logo } from "@plane/propel/emoji-icon-picker";
import type { IProject } from "@plane/types";
import { CoverImage } from "@/components/common/cover-image";

type Props = {
  project: IProject;
};

/**
 * Top section of the Project Overview page: cover image, project logo/emoji
 * floating over the cover, the project name, and (when present) the project
 * description rendered as plain text. The Tiptap editor used in Plane Pro is
 * intentionally omitted here — descriptions are read-only at MVP.
 */
export const ProjectOverviewHero = observer(function ProjectOverviewHero({ project }: Props) {
  return (
    <div>
      <div className="relative h-[118px] w-full">
        <CoverImage
          src={project.cover_image_url}
          alt={project.name}
          className="absolute top-0 left-0 h-full w-full object-cover"
          draggable={false}
        />
      </div>
      <div className="relative mt-2 px-10 pt-page-y">
        <div className="absolute -top-[27px] grid h-10 w-10 shrink-0 place-items-center rounded-sm bg-layer-1">
          <Logo logo={project.logo_props} size={28} />
        </div>
        <h1 className="truncate pt-5 text-18 font-bold">{project.name}</h1>
        {project.description ? (
          <p className="mt-3 text-13 leading-5 break-words whitespace-pre-line text-secondary">{project.description}</p>
        ) : null}
      </div>
    </div>
  );
});
