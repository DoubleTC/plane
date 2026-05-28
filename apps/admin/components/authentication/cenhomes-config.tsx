/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import Link from "next/link";
// icons
import { Settings2 } from "lucide-react";
// plane internal packages
import { getButtonStyling } from "@plane/propel/button";
import type { TInstanceAuthenticationMethodKeys } from "@plane/types";
import { cn } from "@plane/utils";

type Props = {
  disabled: boolean;
  updateConfig: (key: TInstanceAuthenticationMethodKeys, value: string) => void;
};

/**
 * Unlike the other providers, Cenhomes ID always shows a single "Configure"
 * entry point (no inline Edit + enable toggle). Enabling/disabling and editing
 * credentials both happen inside the dedicated configuration page.
 */
export const CenhomesConfiguration = function CenhomesConfiguration(_props: Props) {
  return (
    <Link href="/authentication/cenhomes" className={cn(getButtonStyling("secondary", "base"), "text-tertiary")}>
      <Settings2 className="h-4 w-4 p-0.5 text-tertiary" />
      Configure
    </Link>
  );
};
