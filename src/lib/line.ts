import {
  LINE_CHANNEL_ACCESS_TOKEN,
  LINE_TARGET_ID_ENV,
  lineMessagingEnabled,
} from "./env";
import { prisma } from "./db";

const SETTING_KEY_TARGET_ID = "line.targetId";

// Resolves the LINE push target. ENV wins; otherwise reads from AppSetting,
// which is auto-populated when the bot receives `/bind` in a group/room.
export async function resolveLineTargetId(): Promise<string | null> {
  if (LINE_TARGET_ID_ENV) return LINE_TARGET_ID_ENV;
  const row = await prisma.appSetting.findUnique({
    where: { key: SETTING_KEY_TARGET_ID },
  });
  return row?.value || null;
}

export async function setLineTargetId(targetId: string): Promise<void> {
  await prisma.appSetting.upsert({
    where: { key: SETTING_KEY_TARGET_ID },
    update: { value: targetId },
    create: { key: SETTING_KEY_TARGET_ID, value: targetId },
  });
}

// Push plain text. Resolves target lazily so newly bound groups work without
// a server restart.
export async function pushLineText(text: string): Promise<boolean> {
  if (!lineMessagingEnabled) return false;
  const target = await resolveLineTargetId();
  if (!target) return false;

  return pushLineRaw(target, [{ type: "text", text: text.slice(0, 4900) }]);
}

// Push to an arbitrary target (used for replies to user-initiated DMs).
export async function pushLineRaw(
  to: string,
  messages: Array<{ type: string; [k: string]: unknown }>,
): Promise<boolean> {
  if (!lineMessagingEnabled) return false;
  const res = await fetch("https://api.line.me/v2/bot/message/push", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${LINE_CHANNEL_ACCESS_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ to, messages }),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    console.error("LINE push failed", res.status, body);
    return false;
  }
  return true;
}

// Reply to a webhook event using its replyToken (does not consume push quota).
export async function replyLineText(
  replyToken: string,
  text: string,
): Promise<boolean> {
  if (!lineMessagingEnabled) return false;
  const res = await fetch("https://api.line.me/v2/bot/message/reply", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${LINE_CHANNEL_ACCESS_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      replyToken,
      messages: [{ type: "text", text: text.slice(0, 4900) }],
    }),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    console.error("LINE reply failed", res.status, body);
    return false;
  }
  return true;
}
