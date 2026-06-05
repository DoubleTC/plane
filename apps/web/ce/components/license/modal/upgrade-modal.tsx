/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useState } from "react";
import { observer } from "mobx-react";
import { Check, Coffee, Copy } from "lucide-react";
// plane imports
import { Button } from "@plane/propel/button";
import { EModalWidth, ModalCore } from "@plane/ui";
import { cn } from "@plane/utils";

// "Buy Công Thành a coffee" donation details. The amount + note are pre-filled
// in the VietQR code, so a quick scan is all it takes.
const QR_IMAGE_URL =
  "https://api.vietqr.io/image/970443-1009173623-yARuxyy.jpg?accountName=HOANG%20CONG%20THANH&amount=22222&addInfo=TANG%20CONG%20THANH%201%20COFFEE";
const BANK_NAME = "SHB";
const ACCOUNT_NAME = "HOÀNG CÔNG THÀNH";
const ACCOUNT_NUMBER = "1009173623";
const AMOUNT_LABEL = "22.222đ ☕";
const TRANSFER_NOTE = "TANG CONG THANH 1 COFFEE";

export type PaidPlanUpgradeModalProps = {
  isOpen: boolean;
  handleClose: () => void;
};

const InfoRow = ({ label, value, copyValue }: { label: string; value: string; copyValue?: string }) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    if (!copyValue || typeof navigator === "undefined" || !navigator.clipboard) return;
    try {
      await navigator.clipboard.writeText(copyValue);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // clipboard not available — silently ignore
    }
  };

  return (
    <div className="flex items-center justify-between gap-3">
      <span className="shrink-0 text-12 text-tertiary">{label}</span>
      <div className="flex min-w-0 items-center gap-1.5">
        <span className="truncate text-12 font-medium text-primary">{value}</span>
        {copyValue && (
          <button
            type="button"
            onClick={handleCopy}
            className="shrink-0 rounded-sm p-0.5 text-tertiary hover:bg-layer-1 hover:text-secondary"
            aria-label="Sao chép"
          >
            {copied ? <Check className="size-3.5 text-success-primary" /> : <Copy className="size-3.5" />}
          </button>
        )}
      </div>
    </div>
  );
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
      <div className="max-h-[90vh] overflow-auto p-8 text-center">
        <h3 className="text-24 leading-8 font-bold text-primary">Mời Công Thành một ly cà phê nha! 🥺👉👈</h3>

        <p className="mx-auto mt-3 max-w-md text-13 leading-6 text-secondary">
          Tính năng xịn xò bạn vừa bấm là thành quả của những đêm{" "}
          <span className="font-semibold text-primary">Công Thành</span> thức trắng ôm bàn phím 🧑‍💻💤. Ở đây{" "}
          <span className="font-semibold text-primary">không bán</span> Pro / Business / Enterprise gì đâu — chỉ cần{" "}
          <span className="font-semibold text-primary">22.222đ</span> để nạp caffeine cho não chạy mượt là đủ rồi! 😴 ➡️ 🤩
        </p>

        <p className="mx-auto mt-2 max-w-md text-12 text-tertiary italic">
          “Một ly cà phê hôm nay = mười tính năng mới ngày mai.” — Công Thành (chắc vậy 😎)
        </p>

        {/* QR code */}
        <div className="mx-auto mt-5 w-fit rounded-2xl border border-subtle bg-surface-1 p-3 shadow-raised-200">
          <img
            src={QR_IMAGE_URL}
            alt="Mã QR chuyển khoản tặng cà phê cho Công Thành"
            className="size-60 rounded-lg object-contain"
          />
          <p className="mt-1 text-11 font-medium text-tertiary">Quét là xong, tiền & nội dung điền sẵn hết rồi 😇</p>
        </div>

        {/* Transfer details */}
        <div className="mx-auto mt-4 flex max-w-xs flex-col gap-2 rounded-xl bg-layer-1 p-4 text-left">
          <InfoRow label="Ngân hàng" value={BANK_NAME} />
          <InfoRow label="Chủ tài khoản" value={ACCOUNT_NAME} />
          <InfoRow label="Số tài khoản" value={ACCOUNT_NUMBER} copyValue={ACCOUNT_NUMBER} />
          <InfoRow label="Số tiền" value={AMOUNT_LABEL} />
          <InfoRow label="Nội dung" value={TRANSFER_NOTE} copyValue={TRANSFER_NOTE} />
        </div>

        <div className={cn("mt-6 flex items-center justify-center gap-3")}>
          <Button variant="secondary" onClick={handleClose}>
            Để bữa khác 🥲
          </Button>
          <Button variant="primary" prependIcon={<Coffee className="size-4" />} onClick={handleClose}>
            Đã chuyển rồi nha! 💸
          </Button>
        </div>

        <p className="mt-4 text-11 text-placeholder">
          Donate hay không cũng được, nhưng nếu có thì Công Thành thương bạn lắm luôn á 💖
        </p>
      </div>
    </ModalCore>
  );
});
