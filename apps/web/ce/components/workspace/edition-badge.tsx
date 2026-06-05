/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useState } from "react";
import { observer } from "mobx-react";
import { Coffee, Sparkles } from "lucide-react";
// ui
import { Tooltip } from "@plane/propel/tooltip";
// hooks
import { usePlatformOS } from "@/hooks/use-platform-os";
import packageJson from "package.json";
// local components
import { PaidPlanUpgradeModal } from "../license";

// Scoped keyframes for the attention-grabbing "buy a coffee" button: a drifting
// gradient, a pulsing halo, a sweeping shine and a wiggling coffee cup.
const EFFECT_STYLES = `
@keyframes ct-gradient { 0% { background-position: 0% 50%; } 50% { background-position: 100% 50%; } 100% { background-position: 0% 50%; } }
@keyframes ct-shine { 0% { background-position: 220% 0; } 100% { background-position: -120% 0; } }
@keyframes ct-glow { 0%, 100% { opacity: .4; transform: scale(.95); } 50% { opacity: .85; transform: scale(1.08); } }
@keyframes ct-wiggle { 0%, 100% { transform: rotate(0deg); } 25% { transform: rotate(-14deg); } 75% { transform: rotate(14deg); } }
`;

const WARM_GRADIENT = "linear-gradient(110deg,#f59e0b,#ef4444,#ec4899,#8b5cf6,#f59e0b)";

export const WorkspaceEditionBadge = observer(function WorkspaceEditionBadge() {
  // states
  const [isPaidPlanPurchaseModalOpen, setIsPaidPlanPurchaseModalOpen] = useState(false);
  // platform
  const { isMobile } = usePlatformOS();

  return (
    <>
      <style>{EFFECT_STYLES}</style>
      <PaidPlanUpgradeModal
        isOpen={isPaidPlanPurchaseModalOpen}
        handleClose={() => setIsPaidPlanPurchaseModalOpen(false)}
      />
      <Tooltip tooltipContent={`Version: v${packageJson.version}`} isMobile={isMobile}>
        <div className="relative inline-flex">
          {/* Pulsing colored halo behind the button */}
          <span
            aria-hidden
            className="pointer-events-none absolute -inset-1 rounded-full blur-md"
            style={{ backgroundImage: WARM_GRADIENT, animation: "ct-glow 2.2s ease-in-out infinite" }}
          />
          <button
            type="button"
            onClick={() => setIsPaidPlanPurchaseModalOpen(true)}
            aria-haspopup="dialog"
            aria-label="Mua cà phê cho Công Thành"
            className="group relative inline-flex h-7 items-center gap-1.5 overflow-hidden rounded-full px-3 text-12 font-semibold whitespace-nowrap text-white shadow-raised-200 transition-transform duration-200 hover:scale-105 active:scale-95"
            style={{
              backgroundImage: WARM_GRADIENT,
              backgroundSize: "220% 100%",
              animation: "ct-gradient 3.5s ease infinite",
            }}
          >
            {/* Sweeping shine highlight */}
            <span
              aria-hidden
              className="pointer-events-none absolute inset-0"
              style={{
                backgroundImage: "linear-gradient(110deg,transparent 35%,rgba(255,255,255,.65) 50%,transparent 65%)",
                backgroundSize: "220% 100%",
                animation: "ct-shine 2.6s ease-in-out infinite",
              }}
            />
            <Coffee className="relative size-3.5 shrink-0" style={{ animation: "ct-wiggle 2s ease-in-out infinite" }} />
            <span className="relative">Mua cà phê cho Công Thành</span>
            <Sparkles className="relative size-3.5 shrink-0 animate-pulse" />
          </button>
        </div>
      </Tooltip>
    </>
  );
});
