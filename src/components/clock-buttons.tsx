"use client";

import { useState, useTransition } from "react";
import { clockAction } from "@/server/actions/clock";

// Big-tap-target version of the clock-in/out buttons for the standalone
// /clock page (used inside LINE Rich Menu / LIFF). Renders feedback inline.
export default function ClockButtons() {
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState<{ type: "ok" | "err"; text: string } | null>(null);

  const punch = (kind: "IN" | "OUT") => {
    setMessage(null);
    startTransition(async () => {
      const res = await clockAction(kind);
      if (res.ok) {
        setMessage({
          type: "ok",
          text: kind === "IN" ? "✓ 已上班打卡" : "✓ 已下班打卡",
        });
      } else {
        setMessage({ type: "err", text: res.error });
      }
    });
  };

  return (
    <div className="space-y-3">
      <button
        onClick={() => punch("IN")}
        disabled={isPending}
        className="w-full py-6 rounded-xl text-lg font-semibold text-white shadow-sm disabled:opacity-50"
        style={{ background: "#16a34a" }}
      >
        🟢 上班打卡
      </button>
      <button
        onClick={() => punch("OUT")}
        disabled={isPending}
        className="w-full py-6 rounded-xl text-lg font-semibold text-white shadow-sm disabled:opacity-50"
        style={{ background: "#dc2626" }}
      >
        🔴 下班打卡
      </button>
      {message ? (
        <pre
          className={`p-3 rounded text-sm whitespace-pre-wrap font-sans ${
            message.type === "ok"
              ? "bg-green-50 border border-green-200 text-green-700"
              : "bg-red-50 border border-red-200 text-red-700"
          }`}
        >
          {message.text}
        </pre>
      ) : null}
    </div>
  );
}
