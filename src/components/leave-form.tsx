"use client";

import { useState } from "react";
import { submitLeaveAction } from "@/server/actions/leave";
import { RECEIPT_MAX_BYTES, RECEIPT_ALLOWED_MIME } from "@/lib/receipt";

type LeaveTypeOption = { id: string; name: string; key: string };

export default function LeaveForm({
  types,
  errorFromUrl,
}: {
  types: LeaveTypeOption[];
  errorFromUrl?: string;
}) {
  const [selectedTypeId, setSelectedTypeId] = useState(types[0]?.id ?? "");
  const [filePreview, setFilePreview] = useState<string | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);

  const selectedType = types.find((t) => t.id === selectedTypeId);
  const isSick = selectedType?.key === "SICK";

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    setFileError(null);
    setFilePreview(null);
    const f = e.target.files?.[0];
    if (!f) return;
    if (f.size > RECEIPT_MAX_BYTES) {
      setFileError(`檔案 ${(f.size / 1024 / 1024).toFixed(2)} MB 超過 3MB 上限`);
      e.target.value = "";
      return;
    }
    if (!RECEIPT_ALLOWED_MIME.has(f.type.toLowerCase())) {
      setFileError("只接受 JPG / PNG / WebP 圖片");
      e.target.value = "";
      return;
    }
    const url = URL.createObjectURL(f);
    setFilePreview(url);
  }

  return (
    <form
      action={submitLeaveAction}
      encType="multipart/form-data"
      className="card space-y-4"
    >
      <div>
        <label className="label" htmlFor="leaveTypeId">假別</label>
        <select
          id="leaveTypeId"
          name="leaveTypeId"
          required
          className="input"
          value={selectedTypeId}
          onChange={(e) => setSelectedTypeId(e.target.value)}
        >
          {types.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="label" htmlFor="unit">時間單位</label>
        <select id="unit" name="unit" className="input" defaultValue="DAY">
          <option value="DAY">整天 (一天 8 小時)</option>
          <option value="HALF_DAY">半天 (4 小時)</option>
          <option value="HOUR">指定起訖時間</option>
        </select>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="label" htmlFor="startAt">開始</label>
          <input
            id="startAt"
            name="startAt"
            type="datetime-local"
            required
            className="input"
          />
        </div>
        <div>
          <label className="label" htmlFor="endAt">結束</label>
          <input
            id="endAt"
            name="endAt"
            type="datetime-local"
            required
            className="input"
          />
        </div>
      </div>

      <div>
        <label className="label" htmlFor="reason">事由 (選填)</label>
        <textarea id="reason" name="reason" rows={3} className="input" />
      </div>

      {/* Receipt upload — required for SICK, optional for others. */}
      <div>
        <label className="label" htmlFor="receipt">
          收據照片
          {isSick ? (
            <span className="text-red-600 ml-1">*</span>
          ) : (
            <span className="muted ml-1">(選填)</span>
          )}
        </label>
        <input
          id="receipt"
          name="receipt"
          type="file"
          accept="image/jpeg,image/png,image/webp"
          required={isSick}
          onChange={handleFileChange}
          className="input"
        />
        <p className="muted text-xs mt-1">
          {isSick
            ? "病假必須附上收據照片才能送出。JPG / PNG / WebP，3MB 以下。"
            : "可附 JPG / PNG / WebP 圖片，3MB 以下。"}
        </p>
        {fileError ? (
          <p className="text-sm text-red-600 mt-1">{fileError}</p>
        ) : null}
        {filePreview ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={filePreview}
            alt="預覽"
            className="mt-2 max-h-48 rounded border border-[var(--color-border)]"
          />
        ) : null}
      </div>

      {errorFromUrl ? (
        <p className="text-sm text-red-600">{errorFromUrl}</p>
      ) : null}

      <div className="flex gap-2">
        <button type="submit" className="btn btn-primary">
          送出申請
        </button>
      </div>
    </form>
  );
}
