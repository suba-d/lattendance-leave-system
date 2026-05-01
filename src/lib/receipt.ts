// Server-only helpers for working with leave receipt images stored as
// bytea on LeaveRequest. Kept thin: the actual upload + serve flows live
// in their respective server actions / route handlers.

export const RECEIPT_MAX_BYTES = 3 * 1024 * 1024; // 3 MB
export const RECEIPT_ALLOWED_MIME = new Set([
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
]);
export const RECEIPT_RETENTION_MONTHS = 3;

export type ReceiptValidationError =
  | "missing"
  | "too_large"
  | "wrong_type";

export function validateReceiptFile(
  file: File | null | undefined,
): { ok: true; mimeType: string } | { ok: false; reason: ReceiptValidationError } {
  if (!file || file.size === 0) return { ok: false, reason: "missing" };
  if (file.size > RECEIPT_MAX_BYTES) return { ok: false, reason: "too_large" };
  const mime = file.type?.toLowerCase() || "";
  if (!RECEIPT_ALLOWED_MIME.has(mime)) {
    return { ok: false, reason: "wrong_type" };
  }
  return { ok: true, mimeType: mime };
}

export function receiptErrorMessage(err: ReceiptValidationError): string {
  switch (err) {
    case "missing":
      return "病假必須附上收據照片";
    case "too_large":
      return "收據檔案超過 3 MB，請壓縮後再上傳";
    case "wrong_type":
      return "只接受 JPG / PNG / WebP 格式的圖片";
  }
}
