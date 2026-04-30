import { NextRequest, NextResponse } from "next/server";
import { createHmac, timingSafeEqual } from "node:crypto";
import { LINE_CHANNEL_SECRET } from "@/lib/env";
import { setLineTargetId, replyLineText } from "@/lib/line";

// Strict types only for the fields we actually inspect.
type LineEvent = {
  type: string;
  replyToken?: string;
  source?: { type: "user" | "group" | "room"; userId?: string; groupId?: string; roomId?: string };
  message?: { type: string; text?: string };
};

function verifySignature(rawBody: string, signature: string | null): boolean {
  if (!signature || !LINE_CHANNEL_SECRET) return false;
  const expected = createHmac("sha256", LINE_CHANNEL_SECRET).update(rawBody).digest("base64");
  const a = Buffer.from(expected);
  const b = Buffer.from(signature);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export async function POST(req: NextRequest) {
  const rawBody = await req.text();
  const sig = req.headers.get("x-line-signature");
  if (!verifySignature(rawBody, sig)) {
    return NextResponse.json({ error: "invalid signature" }, { status: 401 });
  }

  const body = JSON.parse(rawBody) as { events?: LineEvent[] };
  const events = body.events ?? [];

  for (const ev of events) {
    try {
      await handleEvent(ev);
    } catch (err) {
      console.error("LINE webhook handler error", err);
    }
  }

  return NextResponse.json({ ok: true });
}

async function handleEvent(ev: LineEvent) {
  if (ev.type !== "message") return;
  if (ev.message?.type !== "text") return;
  const text = (ev.message.text || "").trim();

  // Group/room operators can wire up the notification target with one command.
  if (text === "/bind" || text === "/綁定") {
    const src = ev.source;
    if (!src) return;

    let targetId: string | null = null;
    let kind = "";
    if (src.type === "group" && src.groupId) {
      targetId = src.groupId;
      kind = "group";
    } else if (src.type === "room" && src.roomId) {
      targetId = src.roomId;
      kind = "room";
    } else if (src.type === "user" && src.userId) {
      targetId = src.userId;
      kind = "user";
    }
    if (!targetId) return;

    await setLineTargetId(targetId);

    if (ev.replyToken) {
      await replyLineText(
        ev.replyToken,
        `✅ 已連結到此${kind === "group" ? "群組" : kind === "room" ? "聊天室" : "對話"}，之後請假通知會發送到這裡。`,
      );
    }
  }
}
