"use client";

import { useState, useTransition } from "react";
import { clockAction } from "@/server/actions/clock";

export function ClockCard({
  lastIn,
  lastOut,
}: {
  lastIn: string | null;
  lastOut: string | null;
}) {
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState<{ type: "ok" | "err"; text: string } | null>(null);

  const punch = (kind: "IN" | "OUT") => {
    setMessage(null);
    startTransition(async () => {
      const res = await clockAction(kind);
      if (res.ok) {
        setMessage({ type: "ok", text: kind === "IN" ? "已上班打卡" : "已下班打卡" });
      } else {
        setMessage({ type: "err", text: res.error });
      }
    });
  };

  return (
    <div className="card">
      <h2 className="font-semibold mb-1">打卡</h2>
      <p className="text-sm muted mb-4">今日紀錄</p>
      <div className="grid grid-cols-2 gap-3 mb-4 text-sm">
        <div>
          <div className="muted">上班</div>
          <div className="font-medium">{lastIn ?? "—"}</div>
        </div>
        <div>
          <div className="muted">下班</div>
          <div className="font-medium">{lastOut ?? "—"}</div>
        </div>
      </div>
      <div className="flex gap-2">
        <button
          className="btn btn-primary flex-1"
          onClick={() => punch("IN")}
          disabled={isPending}
        >
          上班打卡
        </button>
        <button className="btn flex-1" onClick={() => punch("OUT")} disabled={isPending}>
          下班打卡
        </button>
      </div>
      {message ? (
        <p className={`mt-3 text-sm ${message.type === "ok" ? "text-green-600" : "text-red-600"}`}>
          {message.text}
        </p>
      ) : null}
    </div>
  );
}
