/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { observer } from "mobx-react";
import { Coffee } from "lucide-react";
// plane imports
import { Button } from "@plane/propel/button";
import { EModalWidth, ModalCore } from "@plane/ui";
// local imports
import { CoffeeDonate } from "../coffee-donate";

export type PaidPlanUpgradeModalProps = {
  isOpen: boolean;
  handleClose: () => void;
};

/**
 * Instead of nudging users toward a paid plan, this fork's "upgrade" modal
 * cheerfully asks them to buy the maintainer (Công Thành) a coffee via a
 * pre-filled VietQR transfer. Same export name + props so all callers keep
 * working — they just trigger a much friendlier ask.
 */
export const PaidPlanUpgradeModal = observer(function PaidPlanUpgradeModal(props: PaidPlanUpgradeModalProps) {
  const { isOpen, handleClose } = props;

  return (
    <ModalCore isOpen={isOpen} handleClose={handleClose} width={EModalWidth.LG} className="rounded-2xl">
      <div className="max-h-[90vh] overflow-auto p-8">
        <CoffeeDonate
          actions={
            <div className="mt-6 flex items-center justify-center gap-3">
              <Button variant="secondary" onClick={handleClose}>
                Để bữa khác 🥲
              </Button>
              <Button variant="primary" prependIcon={<Coffee className="size-4" />} onClick={handleClose}>
                Đã chuyển rồi nha! 💸
              </Button>
            </div>
          }
        />
      </div>
    </ModalCore>
  );
});
