/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { CircleDashed, Scan, SquareDashed, Square, SquareCheck, SquareX } from "lucide-react";
// plane imports
import type { TProjectStateGroup } from "@plane/types";

type Props = {
  group: TProjectStateGroup;
  color?: string;
  size?: number;
  className?: string;
};

export function GroupIcon({ group, color, size = 16, className }: Props) {
  const props = {
    size,
    className,
    style: color ? { color } : undefined,
  };

  switch (group) {
    case "draft":
      return <CircleDashed {...props} />;
    case "planning":
      return <Scan {...props} />;
    case "execution":
      return <SquareDashed {...props} />;
    case "monitoring":
      return <Square {...props} />;
    case "completed":
      return <SquareCheck {...props} />;
    case "cancelled":
      return <SquareX {...props} />;
    default:
      return <Square {...props} />;
  }
}
