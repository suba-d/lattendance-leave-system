/* eslint-disable no-console */
// One-shot script: registers a Rich Menu on the LINE Official Account and
// sets it as the default menu for all friends.
//
// Run with:
//   pnpm tsx scripts/setup-line.ts
//
// Required env:
//   LINE_CHANNEL_ACCESS_TOKEN  (Messaging API access token)
//   APP_URL                    (e.g. https://attendance.example.com)
//   NEXT_PUBLIC_LIFF_ID        (LIFF app ID, format like 1234567890-AbCdEfGh)

import { writeFileSync, readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

const TOKEN = process.env.LINE_CHANNEL_ACCESS_TOKEN || "";
const APP_URL = (process.env.APP_URL || "").replace(/\/$/, "");
const LIFF_ID = process.env.NEXT_PUBLIC_LIFF_ID || process.env.LIFF_ID || "";

if (!TOKEN || !APP_URL || !LIFF_ID) {
  console.error("Missing env: LINE_CHANNEL_ACCESS_TOKEN / APP_URL / NEXT_PUBLIC_LIFF_ID");
  process.exit(1);
}

// Rich Menu image must be exactly 2500x1686 (default) or 2500x843 (compact).
// We use the compact size so the menu doesn't overwhelm the chat area.
const WIDTH = 2500;
const HEIGHT = 843;

// 6 columns × 1 row.
const COL_W = WIDTH / 3;
const ROW_H = HEIGHT / 2;

type Action =
  | { type: "uri"; uri: string }
  | { type: "postback"; data: string; displayText?: string };

type AreaSpec = { x: number; y: number; w: number; h: number; label: string; action: Action };

const liffUrl = (path: string) =>
  `https://liff.line.me/${LIFF_ID}?to=${encodeURIComponent(path)}`;

const areas: AreaSpec[] = [
  { x: 0,         y: 0,     w: COL_W, h: ROW_H, label: "打卡",     action: { type: "uri", uri: liffUrl("/dashboard") } },
  { x: COL_W,     y: 0,     w: COL_W, h: ROW_H, label: "我要請假", action: { type: "uri", uri: liffUrl("/leave/new") } },
  { x: 2 * COL_W, y: 0,     w: COL_W, h: ROW_H, label: "特休餘額", action: { type: "uri", uri: liffUrl("/dashboard") } },
  { x: 0,         y: ROW_H, w: COL_W, h: ROW_H, label: "我的請假", action: { type: "uri", uri: liffUrl("/leave") } },
  { x: COL_W,     y: ROW_H, w: COL_W, h: ROW_H, label: "我的打卡", action: { type: "uri", uri: liffUrl("/attendance") } },
  { x: 2 * COL_W, y: ROW_H, w: COL_W, h: ROW_H, label: "說明",     action: { type: "postback", data: "help", displayText: "Help" } },
];

const richMenu = {
  size: { width: WIDTH, height: HEIGHT },
  selected: true,
  name: "Lattendance Main",
  chatBarText: "選單",
  areas: areas.map((a) => ({
    bounds: { x: a.x, y: a.y, width: a.w, height: a.h },
    action: a.action,
  })),
};

async function api<T>(path: string, init: RequestInit & { binary?: boolean } = {}): Promise<T> {
  const res = await fetch(`https://api.line.me${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${TOKEN}`,
      ...(init.headers || {}),
    },
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`LINE API ${path} → ${res.status}: ${body}`);
  }
  return (await res.json()) as T;
}

async function uploadImage(richMenuId: string, image: Buffer): Promise<void> {
  const res = await fetch(
    `https://api-data.line.me/v2/bot/richmenu/${richMenuId}/content`,
    {
      method: "POST",
      headers: { Authorization: `Bearer ${TOKEN}`, "Content-Type": "image/png" },
      body: new Uint8Array(image),
    },
  );
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Image upload failed ${res.status}: ${body}`);
  }
}

function buildSvg(): string {
  const cellLabels = areas.map(
    (a) => `
      <g>
        <rect x="${a.x}" y="${a.y}" width="${a.w}" height="${a.h}"
          fill="${(a.x / COL_W + a.y / ROW_H) % 2 === 0 ? "#06C755" : "#04A045"}"
          stroke="#ffffff" stroke-width="6" />
        <text x="${a.x + a.w / 2}" y="${a.y + a.h / 2}"
          font-family="sans-serif" font-size="120" font-weight="700"
          fill="#ffffff" text-anchor="middle" dominant-baseline="middle">
          ${a.label}
        </text>
      </g>`,
  );
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${WIDTH} ${HEIGHT}">
  <rect width="${WIDTH}" height="${HEIGHT}" fill="#06C755" />
  ${cellLabels.join("")}
</svg>`;
}

async function ensurePngFromSvg(): Promise<Buffer> {
  const cacheDir = join(process.cwd(), ".cache");
  const svgPath = join(cacheDir, "rich-menu.svg");
  const pngPath = join(cacheDir, "rich-menu.png");

  // Reuse existing PNG if a designer has placed one there.
  if (existsSync(pngPath)) {
    return readFileSync(pngPath);
  }

  // Otherwise emit an SVG and rely on the user (or `sharp`) to convert it.
  // To avoid bundling sharp, we attempt dynamic import and fall back with a
  // helpful error.
  try {
    const fs = await import("node:fs/promises");
    await fs.mkdir(cacheDir, { recursive: true });
    writeFileSync(svgPath, buildSvg(), "utf8");
    const sharp = (
      (await import("sharp" as string)) as { default: (input: Buffer) => { png: () => { toBuffer: () => Promise<Buffer> } } }
    ).default;
    const buf = await sharp(Buffer.from(buildSvg())).png().toBuffer();
    writeFileSync(pngPath, buf);
    return buf;
  } catch {
    throw new Error(
      [
        "找不到 sharp 套件，無法把 SVG 轉成 PNG。請選一個方案：",
        " 1) `pnpm add -D sharp` 後再跑這個 script",
        ` 2) 自行準備一張 ${WIDTH}x${HEIGHT} 的 PNG，放到 .cache/rich-menu.png`,
      ].join("\n"),
    );
  }
}

async function main() {
  console.log("→ Generating rich menu image…");
  const png = await ensurePngFromSvg();

  console.log("→ Creating rich menu definition…");
  const created = await api<{ richMenuId: string }>("/v2/bot/richmenu", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(richMenu),
  });
  console.log(`   richMenuId = ${created.richMenuId}`);

  console.log("→ Uploading image…");
  await uploadImage(created.richMenuId, png);

  console.log("→ Setting as default menu…");
  await api(`/v2/bot/user/all/richmenu/${created.richMenuId}`, { method: "POST" });

  console.log("✓ Done. Re-add the bot or refresh LINE to see the menu.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
