/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useTheme } from "next-themes";
import { isRouteErrorResponse } from "react-router";
// plane imports
import { Button } from "@plane/propel/button";
// assets
import maintenanceModeDarkModeImage from "@/app/assets/instance/maintenance-mode-dark.svg?url";
import maintenanceModeLightModeImage from "@/app/assets/instance/maintenance-mode-light.svg?url";
// layouts
import DefaultLayout from "@/layouts/default-layout";

const linkMap = [
  {
    key: "mail_to",
    label: "Contact Support",
    value: "mailto:gmail@doubletc.com",
  }
];

// Production Error Component
interface ProdErrorComponentProps {
  onGoHome: () => void;
  error?: unknown;
}

// TEMPORARY DEBUG: extracts a human-readable message + stack from the caught error so it can be
// shown on-screen in production builds. Remove the `error` prop and the debug block below once the
// mobile crash is diagnosed.
function getErrorDetails(error: unknown): { message: string; stack?: string } {
  if (isRouteErrorResponse(error)) {
    return { message: `${error.status} ${error.statusText}`, stack: typeof error.data === "string" ? error.data : undefined };
  }
  if (error instanceof Error) {
    return { message: error.message, stack: error.stack };
  }
  if (typeof error === "string") return { message: error };
  try {
    return { message: JSON.stringify(error) };
  } catch {
    return { message: String(error) };
  }
}

export function ProdErrorComponent({ onGoHome, error }: ProdErrorComponentProps) {
  // hooks
  const { resolvedTheme } = useTheme();

  // derived values
  const maintenanceModeImage = resolvedTheme === "dark" ? maintenanceModeDarkModeImage : maintenanceModeLightModeImage;
  const errorDetails = error !== undefined && error !== null ? getErrorDetails(error) : undefined;

  return (
    <DefaultLayout>
      <div className="relative container mx-auto flex h-full w-full max-w-xl flex-col items-center justify-center gap-2 gap-y-6 bg-surface-1 px-6 text-center">
        <div className="relative w-full">
          <img
            src={maintenanceModeImage}
            height="176"
            width="288"
            alt="ProjectSettingImg"
            className="h-full w-full object-fill object-center"
          />
        </div>
        <div className="relative mt-4 flex w-full flex-col gap-4">
          <div className="flex flex-col gap-2.5">
            <h1 className="text-left text-18 font-semibold text-primary">&#x1F6A7; Looks like something went wrong!</h1>
            <span className="text-left text-14 font-medium text-secondary">
              We track these errors automatically and working on getting things back up and running. If the problem
              persists feel free to contact us. In the meantime, try refreshing.
            </span>
          </div>

          <div className="mt-1 flex items-center justify-start gap-6">
            {linkMap.map((link) => (
              <div key={link.key}>
                <a
                  href={link.value}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-13 text-accent-primary hover:underline"
                >
                  {link.label}
                </a>
              </div>
            ))}
          </div>

          <div className="flex items-center justify-start gap-6">
            <Button variant="primary" size="lg" onClick={onGoHome}>
              Go to home
            </Button>
          </div>

          {/* TEMPORARY DEBUG: surface the actual error on-screen to diagnose the mobile crash. Remove this block afterwards. */}
          {errorDetails && (
            <div className="mt-2 flex flex-col gap-2 rounded-md border border-danger-primary/40 bg-layer-1 p-3 text-left">
              <p className="text-13 font-semibold text-danger-primary">DEBUG · {errorDetails.message}</p>
              {errorDetails.stack && (
                <pre className="max-h-72 overflow-auto font-code text-11 break-words whitespace-pre-wrap text-secondary">
                  {errorDetails.stack}
                </pre>
              )}
            </div>
          )}
        </div>
      </div>
    </DefaultLayout>
  );
}
