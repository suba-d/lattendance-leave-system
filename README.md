# lattendance — 出勤與請假系統

公司內部使用的請假與打卡系統。10 人規模、辦公室統一打卡。

## 功能

- 員工登入（Email + 密碼）
- 上下班打卡，限制辦公室 IP
- 線上申請請假（無需簽核，送出即生效）
- 自動同步請假到 Google Calendar
- 自動推播請假到 LINE 群組
- 特休依勞基法 §38 按到職日自動計算
- 管理者後台：員工管理、請假紀錄、每日打卡彙整

## 技術棧

- **Next.js 15** (App Router) + React 19
- **TypeScript**, **Tailwind CSS v4**
- **PostgreSQL** + **Prisma**
- **Auth.js v5** (Credentials provider)
- **googleapis** for Google Calendar
- LINE Messaging API (push)

## 本機開發

需要 Node 20+ / pnpm 10+。Postgres 可用內建 docker-compose 起，或自備一個。

```bash
# 1. 起 Postgres
docker compose up -d

# 2. 安裝依賴
pnpm install

# 3. 複製環境變數
cp .env.example .env
# 編輯 .env，至少填好 DATABASE_URL、AUTH_SECRET、SEED_ADMIN_*

# 4. 建表 + 種子
pnpm db:migrate
pnpm db:seed

# 5. 啟動
pnpm dev
```

啟動後開 http://localhost:3000，用 `SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD` 登入。

## 環境變數

見 `.env.example`，分四群：

| 群組 | 必填 | 說明 |
|---|---|---|
| `DATABASE_URL`, `AUTH_SECRET` | ✅ | 基本必填 |
| `OFFICE_IP_ALLOWLIST` | ⚠️ 正式環境必填 | 留空則不限制 IP，僅供開發 |
| `GOOGLE_*` | optional | 設定後自動同步請假到 Google Calendar |
| `LINE_*` | optional | 設定後自動推播請假到 LINE 群組 |

### 設定 Google Calendar 同步

1. 到 Google Cloud Console 建立 Service Account，下載 JSON key
2. 啟用 Google Calendar API
3. 在 Google Calendar 建立一個共用日曆（例：「公司請假」），把 Service Account email 加為「可變更活動」共用對象
4. 把日曆 ID、Service Account email、private key 寫進 `.env`

### 設定 LINE 群組通知

LINE Notify 已於 2025 年中止服務，本系統使用 LINE Messaging API。

1. 到 LINE Developers 建立 Messaging API Channel
2. 取得 Channel access token，填入 `LINE_CHANNEL_ACCESS_TOKEN`
3. 把 Bot 邀請進公司 LINE 群組
4. 從 webhook 事件擷取 `source.groupId`，填入 `LINE_TARGET_ID`
   （簡單做法：暫時把 webhook 指向 webhook.site，自己在群組發一句話，看 payload）

## 部署

任何能跑 Node + Postgres 的平台都可以。建議：

- **Zeabur**（台灣機房，最省心）
- **Render**（Singapore region，國際大廠穩定）

部署時設定環境變數、執行 `pnpm db:deploy` 即可。

## Roadmap

- [ ] 舊系統 DB 匯入（待提供 dump）
- [ ] 補休累積邏輯
- [ ] 月份/年度報表 export
- [ ] Google Workspace SSO（取代密碼登入）
- [ ] Cron job：年初重設特休、請假提醒
- [ ] 國定假日匯入（影響 leave 計時）

## 結構

```
src/
  app/
    (app)/             # 登入後頁面
      dashboard/       # 首頁：打卡 + 特休餘額
      leave/           # 我的請假 / 申請
      attendance/      # 我的打卡紀錄
      admin/           # 管理者後台
    login/             # 登入頁
    api/auth/          # NextAuth handlers
  components/          # React 元件
  lib/                 # auth / db / IP allowlist / Google Calendar / LINE / 勞基法計算
  server/actions/      # Server Actions: clock / leave / users
  middleware.ts        # 全站登入閘道
prisma/
  schema.prisma        # DB schema
  seed.ts              # 假別 + admin 種子
```
