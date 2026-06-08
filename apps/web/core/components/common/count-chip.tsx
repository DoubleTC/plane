/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { forwardRef } from "react";
import type { ComponentPropsWithoutRef } from "react";
import { cn } from "@plane/utils";

type TCountChip = {
  count: string | number;
  className?: string;
} & Omit<ComponentPropsWithoutRef<"div">, "className">;

// forwardRef + prop spreading so the chip can act as a Tooltip trigger: Base UI clones the trigger
// child and injects a ref plus event/aria props, which a plain function component cannot receive
// (causing the "Function components cannot be given refs" warning and a non-working tooltip).
export const CountChip = forwardRef<HTMLDivElement, TCountChip>(function CountChip(props, ref) {
  const { count, className = "", ...rest } = props;

  return (
    <div
      ref={ref}
      className={cn(
        "relative flex flex-shrink-0 items-center justify-center rounded-xl bg-accent-primary/20 px-2.5 py-0.5 text-caption-sm-semibold text-accent-primary",
        className
      )}
      {...rest}
    >
      {count}
    </div>
  );
});
