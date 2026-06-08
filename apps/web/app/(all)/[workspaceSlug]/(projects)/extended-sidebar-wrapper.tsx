/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import React, { useEffect } from "react";
import { observer } from "mobx-react";
// plane imports
import { EXTENDED_SIDEBAR_WIDTH, SIDEBAR_WIDTH } from "@plane/constants";
import { useLocalStorage } from "@plane/hooks";
import { cn } from "@plane/utils";
// hooks
import { useAppTheme } from "@/hooks/store/use-app-theme";
// hooks
import useExtendedSidebarOutsideClickDetector from "@/hooks/use-extended-sidebar-overview-outside-click";

type Props = {
  className?: string;
  children: React.ReactNode;
  extendedSidebarRef: React.RefObject<HTMLDivElement>;
  isExtendedSidebarOpened: boolean;
  handleClose: () => void;
  excludedElementId: string;
};

export const ExtendedSidebarWrapper = observer(function ExtendedSidebarWrapper(props: Props) {
  const { className, children, extendedSidebarRef, isExtendedSidebarOpened, handleClose, excludedElementId } = props;
  // store hooks
  const { sidebarCollapsed } = useAppTheme();
  // local storage
  const { storedValue } = useLocalStorage("sidebarWidth", SIDEBAR_WIDTH);

  useExtendedSidebarOutsideClickDetector(extendedSidebarRef, handleClose, excludedElementId);

  useEffect(() => {
    if (sidebarCollapsed) {
      handleClose();
    }
  }, [sidebarCollapsed, handleClose]);

  return (
    <div
      id={excludedElementId}
      ref={extendedSidebarRef}
      // The extended sidebar is rendered as a sibling of the main sidebar, so it lies outside the main
      // sidebar's outside-click detector. On mobile that detector fires on `mousedown` and collapses the
      // main sidebar, which hides this panel (display:none) before the `click` reaches the link — breaking
      // navigation. Marking the panel prevents it from being treated as an outside click.
      data-prevent-outside-click
      className={cn(
        "shadow-sm absolute z-[21] flex h-full transform flex-col border-r border-subtle bg-surface-1 p-4 py-2 transition-all duration-300 ease-in-out",
        {
          "opacity-100": isExtendedSidebarOpened,
          "hidden opacity-0": !isExtendedSidebarOpened,
        },
        className
      )}
      style={{
        left: `${storedValue ?? SIDEBAR_WIDTH}px`,
        width: `${EXTENDED_SIDEBAR_WIDTH}px`,
      }}
    >
      {children}
    </div>
  );
});
