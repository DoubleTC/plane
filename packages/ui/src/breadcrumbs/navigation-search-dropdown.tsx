/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import * as React from "react";
import { useState } from "react";
import { Tooltip } from "@plane/propel/tooltip";
import type { ICustomSearchSelectOption } from "@plane/types";
import { CustomSearchSelect } from "../dropdowns";
import { cn } from "../utils";
import { Breadcrumbs } from "./breadcrumbs";

type TBreadcrumbNavigationSearchDropdownProps = {
  icon?: React.ReactNode;
  title?: string;
  selectedItem: string;
  navigationItems: ICustomSearchSelectOption[];
  onChange?: (value: string) => void;
  navigationDisabled?: boolean;
  isLast?: boolean;
  handleOnClick?: () => void;
  disableRootHover?: boolean;
  shouldTruncate?: boolean;
};

export function BreadcrumbNavigationSearchDropdown(props: TBreadcrumbNavigationSearchDropdownProps) {
  const {
    icon,
    title,
    selectedItem,
    navigationItems,
    onChange,
    navigationDisabled = false,
    isLast = false,
    handleOnClick,
    shouldTruncate = false,
  } = props;
  // state
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);

  // For non-last breadcrumb items, clicking the label navigates instead of toggling the dropdown.
  const handleNavigate = (e: React.SyntheticEvent) => {
    if (isLast) return;
    e.preventDefault();
    e.stopPropagation();
    handleOnClick?.();
  };

  // The label is rendered as a <span> (not a <button>): CustomSearchSelect already wraps this
  // customButton in its own <button>, and nesting <button> in <button> is invalid DOM. For non-last
  // items the span behaves as a navigation control, so it carries the button role + a keyboard
  // handler. The last (current) item is a plain, non-interactive label.
  const interactiveLabelProps: React.HTMLAttributes<HTMLSpanElement> & { tabIndex?: number } = isLast
    ? {}
    : {
        role: "button",
        tabIndex: 0,
        onClick: handleNavigate,
        onKeyDown: (e) => {
          if (e.key === "Enter" || e.key === " ") handleNavigate(e);
        },
      };

  const breadcrumbLabelClassName = cn(
    "group flex h-full cursor-pointer items-center gap-2 rounded-sm rounded-r-none px-1.5 py-1 text-13 font-medium text-tertiary",
    {
      "hover:bg-layer-1 hover:text-primary": !isLast,
    }
  );

  const breadcrumbLabelContent = (
    <>
      {shouldTruncate && <div className="flex text-tertiary @4xl:hidden">...</div>}
      <div
        className={cn("flex gap-2", {
          "hidden items-center gap-2 @4xl:flex": shouldTruncate,
        })}
      >
        {icon && <Breadcrumbs.Icon>{icon}</Breadcrumbs.Icon>}
        <Breadcrumbs.Label>{title}</Breadcrumbs.Label>
      </div>
    </>
  );

  return (
    <CustomSearchSelect
      onOpen={() => {
        setIsDropdownOpen(true);
      }}
      onClose={() => {
        setIsDropdownOpen(false);
      }}
      options={navigationItems}
      value={selectedItem}
      onChange={(value: string) => {
        if (value !== selectedItem) {
          onChange?.(value);
        }
      }}
      customButton={
        <>
          <Tooltip tooltipContent={title} position="bottom">
            <span className={breadcrumbLabelClassName} {...interactiveLabelProps}>
              {breadcrumbLabelContent}
            </span>
          </Tooltip>
          <Breadcrumbs.Separator
            className={cn("rounded-r-sm", {
              "bg-layer-1": isDropdownOpen && !isLast,
              "hover:bg-layer-1": !isLast,
            })}
            containerClassName="p-0"
            iconClassName={cn("group-hover:rotate-90 hover:text-primary", {
              "text-primary": isDropdownOpen,
              "rotate-90": isDropdownOpen || isLast,
            })}
            showDivider={!isLast}
          />
        </>
      }
      disabled={navigationDisabled}
      className="h-full rounded-sm"
      customButtonClassName={cn(
        "group flex h-full cursor-pointer items-center gap-0.5 rounded-sm outline-none hover:bg-surface-2",
        {
          "bg-surface-2": isDropdownOpen,
        }
      )}
    />
  );
}
