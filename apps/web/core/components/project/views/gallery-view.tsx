/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { observer } from "mobx-react";
// plane imports
import type { IProject } from "@plane/types";
// local imports
import { ProjectCard } from "../card";

type Props = {
  projectIds: string[];
  getProjectById: (id: string) => IProject | undefined;
};

/**
 * Gallery view — responsive card grid.
 * Columns: 1 → md:2 → lg:3 → 2xl:4 → 3xl:5
 */
export const ProjectGalleryView = observer(function ProjectGalleryView({ projectIds, getProjectById }: Props) {
  return (
    <div className="3xl:grid-cols-5 grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
      {projectIds.map((projectId) => {
        const project = getProjectById(projectId);
        if (!project) return null;
        return <ProjectCard key={project.id} project={project} />;
      })}
    </div>
  );
});
