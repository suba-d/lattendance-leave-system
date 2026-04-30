# lattendance — 出勤與請假系統

公司內部請假與打卡系統。10 人規模、辦公室統一打卡。

完全雲端開發 + 部署：
- **DB**：寄生在 nshop 的 Supabase Pro project（獨立 `lattendance` schema）
- **Hosting**：AWS Amplify（與 nshop 同一個帳號）
- **CI**：GitHub Actions（每個 PR 自動跑 typecheck + build）

## 功能

- **LINE 登入**為主，員工不用記密碼（Email/密碼藏在 `?mode=email` 作為救援用）
- **LIFF**：員工從 LINE Rich Menu 直接打開系統，免跳出 LINE
- **Rich Menu**：聊天框下方常駐 6 顆按鈕（打卡 / 請假 / 餘額 / 紀錄 / 說明）
- 上下班打卡，限制辦公室 IP（手機需連辦公室 WiFi）
- 線上申請請假，**送出即生效**（無需審核）、可取消
- 自動同步請假到 **Google Calendar**
- 自動推播請假到 **LINE 群組**：`david 5/2 全天 病假` 格式（含假別、不揭露事由）
- 特休依勞基法 §38 按到職日自動計算
- 管理者後台：員工 CRUD、LINE 綁定連結、請假紀錄總表、每日打卡彙整

## 技術棧

- Next.js 15 (App Router) + React 19 + TypeScript + Tailwind v4
- PostgreSQL (Supabase) + Prisma
- Auth.js v5 (Credentials provider)
- googleapis + LINE Messaging API

## 一次性 Setup（onboard 新環境用）

整個系統不需要本機環境。新環境只需要做這三件事：

### 1. 在 Supabase 建立 schema

到 nshop 的 Supabase project → SQL Editor，執行：

```sql
CREATE SCHEMA IF NOT EXISTS lattendance;
```

（往後 Prisma migration 會自己在這個 schema 內建表，不會碰到 `public`。）

### 2. 在 Amplify 建立新 App

1. Amplify Console → **Create new app** → **Host web app**
2. 連結 GitHub repo `suba-d/lattendance-leave-system`，選 `main` branch
3. Amplify 會自動偵測到 `amplify.yml`，**不要改 build settings**
4. 設定環境變數（見下節）
5. Deploy

### 3. 設定環境變數

到 Amplify Console → 你的 app → **Hosting → Environment variables**（**不是** Secrets panel — Secrets 走 SSM 在這裡會壞）：

| 變數 | 值 / 來源 | 必填 |
|---|---|---|
| `DATABASE_URL` | Supabase → Connect popup → **Session pooler** URI，結尾加 `?schema=lattendance` | ✅ |
| `DIRECT_URL` | 同上 | ✅ |
| `AUTH_SECRET` | 本機跑 `openssl rand -base64 32` 拿到的**輸出字串**（不是這條指令本身） | ✅ |
| `OFFICE_IP_ALLOWLIST` | 辦公室固定對外 IP，例：`203.0.113.10` | ✅ 正式上線必填 |
| `APP_URL` | 部署後的對外網址，例：`https://attendance.example.com` | ✅ 啟用 LINE 後必填 |
| `SEED_ADMIN_EMAIL` | 第一個管理員 Email（救援登入用） | ✅ |
| `SEED_ADMIN_PASSWORD` | 第一個管理員密碼 | ✅ |
| `LINE_CHANNEL_ACCESS_TOKEN` | Messaging API token | ✅ 啟用 LINE 必填 |
| `LINE_CHANNEL_SECRET` | Messaging API secret（webhook 驗章用） | ✅ 啟用 LINE 必填 |
| `LINE_LOGIN_CHANNEL_ID` | LINE Login Channel ID | ✅ 啟用 LINE 必填 |
| `LINE_LOGIN_CHANNEL_SECRET` | LINE Login Channel secret | ✅ 啟用 LINE 必填 |
| `NEXT_PUBLIC_LIFF_ID` | LIFF App ID（曝光到瀏覽器） | ✅ 啟用 LIFF 必填 |
| `GOOGLE_*` | 見下方「Google Calendar 同步」 | optional |

> 完整變數說明見 `.env.example`。

> ⚠️ **不要** 設 `TZ` 環境變數。Amplify build 環境會把 `TZ=:UTC` 預設帶進來，那個冒號前綴 JS 看不懂會炸 dashboard。app 內已 hardcode default `Asia/Taipei`。

#### Supabase 連線字串為什麼用 Session pooler

我們踩過所有可能的雷。經驗整理：

| 選項 | 結果 |
|---|---|
| `db.<project>.supabase.co:5432`（Direct connection） | ❌ IPv6-only，Amplify 走 IPv4 → P1001 連不到 |
| `aws-X-<region>.pooler.supabase.com:6543`（Transaction pooler） | ❌ Prisma + pgbouncer 跨連線撞 prepared statement → 42P05 |
| `aws-X-<region>.pooler.supabase.com:5432`（**Session pooler**） | ✅ 穩定運作 |

10 人公司負載低，session pooler 完全沒副作用；勿用 transaction pooler。

### 4. 部署後檢查

1. 打開 Amplify 提供的 URL → 看到登入頁
2. 試 `https://<你的網址>/api/healthz` → 看到 `db_ping_ms` 有值、所有 `_count` 有數字、無 `_error` 欄位
3. 到 `/login?mode=email` 用 `SEED_ADMIN_*` 登入 → 進 dashboard
4. 進管理者後台 → 員工 → 新增其他同事的帳號（或產生 LINE 綁定連結）

#### 出問題的 debug 步驟

| 症狀 | 看哪 |
|---|---|
| 登入點下去出現 `MissingSecret` | `AUTH_SECRET` 沒設 / 值不對 / 在錯的 env panel（要用 Environment variables 不要用 Secrets） |
| Dashboard 500 | 訪問 `/api/healthz` 看 JSON output；裡面會列 DB 連線 + 所有 query 的成功/錯誤 |
| `Application error: client-side exception` | 通常是 server-side error 隱藏訊息，先看 `/api/healthz` |
| Build 卡 `prisma migrate` | 99% 是 connection string 格式錯。詳見 [Supabase 連線字串為什麼用 Session pooler](#supabase-連線字串為什麼用-session-pooler) 那節 |
| Env var 在 console 設了但 runtime 拿不到 | 已知 Amplify SSR bug；本專案 build 階段把 env 寫進 `.env.production` 解這個。如果新加 env var，記得到 `amplify.yml` 的 grep 白名單把它加進去 |

## 日常開發流程

完全自動化、無人工介入：

```
AI 寫 code → push branch → 開 PR → GitHub Actions CI 跑 typecheck + build
                                ↓
                            review + merge to main
                                ↓
                       Amplify 自動 build + 部署
                       (跑 prisma migrate deploy → seed → next build)
```

不需要本機跑任何指令。

## LINE 整合（一次設定）

整合 4 個元件：**Messaging API**（推播 + webhook）、**LINE Login**（OAuth）、**LIFF**（in-app webview）、**Rich Menu**（聊天選單）。

### 1. 建 Provider + Channel

LINE Developers Console → 建一個 Provider → 在底下建一個 **Messaging API Channel**。

在 Channel 設定頁同時啟用：
- ✅ Messaging API（必）
- ✅ **LINE Login**（必）— 同一個 Channel 啟用兩個 product，userId 一致

### 2. 蒐集 keys 填到 Amplify env vars

| Channel 設定頁位置 | 環境變數 |
|---|---|
| Basic settings → Channel ID | `LINE_LOGIN_CHANNEL_ID` |
| Basic settings → Channel secret | `LINE_LOGIN_CHANNEL_SECRET` 與 `LINE_CHANNEL_SECRET` |
| Messaging API → Channel access token (long-lived) | `LINE_CHANNEL_ACCESS_TOKEN` |

### 3. Callback URL 設定

在 LINE Login 設定頁的 Callback URL 加入：
```
https://<你的 amplify 網域>/api/auth/callback/line
https://<你的 amplify 網域>/api/line/bind/callback
```

### 4. Webhook URL（推播 + 群組綁定）

Messaging API → Webhook URL 設成：
```
https://<你的 amplify 網域>/api/line/webhook
```
按「Verify」應該回 200 OK，再打開「Use webhook」開關。

### 5. 群組通知綁定

1. 把 bot 加進公司 LINE 群組
2. 任何人在群組打 `/bind`
3. Bot 會回「✅ 已連結到此群組」並把 groupId 寫入 DB
4. 之後請假申請會自動推到此群組

> 也可以直接把 `LINE_TARGET_ID` 環境變數寫死，繞過動態綁定。

### 6. LIFF App

LINE Developers → 你的 Channel → LIFF tab → Add：
- Size: **Tall**
- Endpoint URL: `https://<你的 amplify 網域>/liff`
- Scopes: `openid` `profile`
- 開啟「Bot link feature」可選

把產生的 LIFF ID 填進 Amplify env var：`NEXT_PUBLIC_LIFF_ID`。

### 7. Rich Menu（員工聊天框下方常駐選單）

部署完成後，本機跑一次：

```bash
LINE_CHANNEL_ACCESS_TOKEN=xxx APP_URL=https://... NEXT_PUBLIC_LIFF_ID=xxx \
  pnpm tsx scripts/setup-line.ts
```

腳本會：自動產生選單圖（綠底 6 格）→ 上傳到 LINE → 設為所有員工的預設選單。

> 想客製化圖：放 `2500x843` PNG 到 `.cache/rich-menu.png`，腳本會優先用它。

### 8. 員工綁定 LINE

1. 管理者登入 → 管理 → 員工 → 該員工列「產生綁定連結」
2. 把連結私訊給員工（連結 24 小時內、一次性）
3. 員工點連結 → 用 LINE 授權 → 自動登入並綁定

之後該員工：
- 在電腦：到登入頁點「用 LINE 登入」
- 在手機：直接從 LINE Rich Menu 點任一按鈕進系統

## Google Calendar 同步（optional）

1. 到 Google Cloud Console 建 Service Account，下載 JSON key
2. 啟用 Google Calendar API
3. 建一個共用日曆（例：「公司請假」），把 Service Account email 加為「可變更活動」共用對象
4. 把日曆 ID、Service Account email、private key 寫進 Amplify env vars

## 結構

```
src/
  app/
    (app)/           # 登入後頁面
      dashboard/     # 首頁：打卡 + 特休餘額
      leave/         # 我的請假 / 申請
      attendance/    # 我的打卡紀錄
      admin/         # 管理者後台
    login/
    api/auth/        # Auth.js handlers
    api/healthz/     # 部署診斷 (env+DB+queries 自查)
    api/line/        # LINE webhook + bind callback
  components/
  lib/               # auth / db / IP allowlist / Google Calendar / LINE / 勞基法
  server/actions/    # Server Actions
  middleware.ts      # 全站登入閘道
prisma/
  schema.prisma      # multi-database via DATABASE_URL + DIRECT_URL
  migrations/        # 由 AI 在開發時用 `prisma migrate dev` 產出，提交進 repo
  seed.ts            # 假別 + admin
scripts/
  setup-line.ts      # Rich Menu 一次性註冊（手動跑）
  import-legacy.ts   # 舊系統 dump 匯入（idempotent，amplify build 會跑）
amplify.yml          # Amplify build + migrate + seed + import + .env.production
.github/workflows/   # CI
```

## Roadmap

- [ ] 舊系統 DB 匯入（待提供 dump）
- [ ] 補休累積邏輯
- [ ] 月份 / 年度報表 export
- [ ] Cron jobs：年初重設特休
- [ ] 國定假日匯入
