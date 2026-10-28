/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useState, type ReactNode } from "react";
import { observer } from "mobx-react";
import { Check, Copy } from "lucide-react";
// plane imports
import { cn } from "@plane/utils";
// hooks
import { useUser } from "@/hooks/store/user";

// "Buy Công Thành a coffee" donation details. The amount + note are pre-filled
// in the VietQR code, so a quick scan is all it takes.
const QR_BASE_URL = "https://api.vietqr.io/image/970443-1009173623-yARuxyy.jpg";
const QR_ACCOUNT_NAME = "HOANG CONG THANH";
const QR_AMOUNT = "22222";
const BANK_NAME = "SHB";
const ACCOUNT_NAME = "HOÀNG CÔNG THÀNH";
const ACCOUNT_NUMBER = "1009173623";
const AMOUNT_LABEL = "22.222đ ☕";
const TRANSFER_NOTE = "GUI TANG 1 COFFEE";

// Bank transfer content must be plain ASCII (no Vietnamese diacritics) and free
// of special characters, otherwise many banks reject it. Normalize accordingly.
const toBankText = (value: string): string =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // strip combining diacritics
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .replace(/[^a-zA-Z0-9\s]/g, "") // drop remaining non-alphanumerics
    .replace(/\s+/g, " ")
    .trim()
    .toUpperCase();

// Build the pre-filled VietQR image URL for a given transfer note.
const buildQrImageUrl = (note: string): string =>
  `${QR_BASE_URL}?accountName=${encodeURIComponent(QR_ACCOUNT_NAME)}&amount=${QR_AMOUNT}&addInfo=${encodeURIComponent(note)}`;

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

export type CoffeeDonateProps = {
  /** Extra classes for the outer wrapper. */
  className?: string;
  /** Optional action slot rendered between the transfer details and the footer note. */
  actions?: ReactNode;
};

/**
 * Shared "buy Công Thành a coffee" donation block. Used both by the paid-plan
 * upgrade modal and the workspace billing settings page so the QR / transfer
 * note / user-name personalization logic lives in one place.
 */
export const CoffeeDonate = observer(function CoffeeDonate(props: CoffeeDonateProps) {
  const { className, actions } = props;
  // store hooks
  const { data: currentUser } = useUser();

  // Prefix the transfer note with the logged-in user's name (ASCII, no diacritics)
  // so it reads e.g. "XXX GUI TANG 1 COFFEE". Falls back to the plain note
  // when there is no user or the name is empty.
  const userName = currentUser
    ? toBankText(
        `${currentUser.last_name ?? ""} ${currentUser.first_name ?? ""}`.trim() || currentUser.display_name || ""
      )
    : "";
  const transferNote = userName ? `${userName} ${TRANSFER_NOTE}` : TRANSFER_NOTE;
  const qrImageUrl = buildQrImageUrl(transferNote);

  return (
    <div className={cn("text-center", className)}>
      <h3 className="text-24 leading-8 font-bold text-primary">Mời Công Thành một ly cà phê nha! 🥺👉👈</h3>

      <p className="mx-auto mt-3 max-w-md text-13 leading-6 text-secondary">
        Tính năng xịn xò bạn vừa bấm là thành quả của những đêm{" "}
        <span className="font-semibold text-primary">Công Thành</span> thức trắng ôm bàn phím 🧑‍💻💤. Ở đây{" "}
        <span className="font-semibold text-primary">không bán</span> Pro / Business / Enterprise gì đâu — chỉ cần{" "}
        <span className="font-semibold text-primary">22.222đ</span> để nạp caffeine cho não chạy mượt là đủ rồi! 😴 ➡️
        🤩
      </p>

      <p className="mx-auto mt-2 max-w-md text-12 text-tertiary italic">
        “Một ly cà phê hôm nay = Mười tính năng mới ngày mai.” — Công Thành (chắc vậy 😎)
      </p>

      {/* QR code */}
      <div className="mx-auto mt-5 w-fit rounded-2xl border border-subtle bg-surface-1 p-3 shadow-raised-200">
        <img
          src={qrImageUrl}
          alt="Mã QR chuyển khoản tặng cà phê cho Công Thành"
          className="size-60 rounded-lg object-contain"
        />
        <p className="mt-1 text-11 font-medium text-tertiary">Quét là xong, tiền & nội dung điền sẵn hết rồi 😇</p>
      </div>

      {/* Transfer details */}
      <div className="mx-auto mt-4 flex max-w-md flex-col gap-2 rounded-xl bg-layer-1 p-4 text-left">
        <InfoRow label="Ngân hàng" value={BANK_NAME} />
        <InfoRow label="Chủ tài khoản" value={ACCOUNT_NAME} />
        <InfoRow label="Số tài khoản" value={ACCOUNT_NUMBER} copyValue={ACCOUNT_NUMBER} />
        <InfoRow label="Số tiền" value={AMOUNT_LABEL} />
        <InfoRow label="Nội dung" value={transferNote} copyValue={transferNote} />
      </div>

      {actions}

      <p className="mt-4 text-11 text-placeholder">
        Donate hay không cũng được, nhưng nếu có thì Công Thành thương bạn lắm luôn á 💖
      </p>
    </div>
  );
});
