import { LINE_CHANNEL_ACCESS_TOKEN, LINE_TARGET_ID, lineEnabled } from "./env";

// Pushes a plain-text message to the configured LINE target (group/room/user).
// Uses the LINE Messaging API. LINE Notify is sunset (Mar 2025), so we use
// the Messaging API push endpoint instead.
//
// Setup steps (record these in the README):
//   1. Create a Messaging API channel in LINE Developers Console.
//   2. Issue a long-lived Channel access token; set LINE_CHANNEL_ACCESS_TOKEN.
//   3. Invite the bot to your group/room.
//   4. Capture the source.groupId/roomId/userId from a webhook event;
//      set LINE_TARGET_ID.
export async function pushLineText(text: string): Promise<boolean> {
  if (!lineEnabled) return false;
  const res = await fetch("https://api.line.me/v2/bot/message/push", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${LINE_CHANNEL_ACCESS_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      to: LINE_TARGET_ID,
      messages: [{ type: "text", text: text.slice(0, 4900) }],
    }),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    console.error("LINE push failed", res.status, body);
    return false;
  }
  return true;
}
