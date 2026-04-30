# lattendance — 出勤與請假系統

公司內部請假與打卡系統。10 人規模、辦公室統一打卡。

完全雲端開發 + 部署：
- **DB**：寄生在 nshop 的 Supabase Pro project（獨立 `lattendance` schema）
- **Hosting**：AWS Amplify（與 nshop 同一個帳號）
- **CI**：GitHub Actions（每個 PR 自動跑 typecheck + build）

## 功能

- 員工 Email + 密碼登入
- 上下班打卡，限制辦公室 IP（CIDR / IPv4-mapped IPv6）
- 線上申請請假，**送出即生效**（無需審核）、可取消
- 自動同步請假到 **Google Calendar**
- 自動推播請假到 **LINE 群組**
- 特休依勞基法 §38 按到職日自動計算
- 管理者後台：員工 CRUD、請假紀錄總表、每日打卡彙整

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

在 Amplify → App settings → Environment variables 填入：

| 變數 | 值 / 來源 | 必填 |
|---|---|---|
| `DATABASE_URL` | Supabase → Settings → Database → **Connection pooling URI**，後面接 `&schema=lattendance` | ✅ |
| `DIRECT_URL` | 同上頁的 **Direct connection URI**，後面接 `&schema=lattendance` | ✅ |
| `AUTH_SECRET` | `openssl rand -base64 32` | ✅ |
| `OFFICE_IP_ALLOWLIST` | 辦公室固定對外 IP，例：`203.0.113.10` | ✅ 正式上線必填 |
| `TZ` | `Asia/Taipei` | 建議 |
| `SEED_ADMIN_EMAIL` | 第一個管理員 Email | ✅ |
| `SEED_ADMIN_PASSWORD` | 第一個管理員密碼（首次登入後請員工自己改） | ✅ |
| `GOOGLE_*` | 見下方「Google Calendar 同步」 | optional |
| `LINE_*` | 見下方「LINE 群組通知」 | optional |

> 完整變數說明見 `.env.example`。

### 4. 部署後檢查

打開 Amplify 提供的 URL → 應看到登入頁。用 `SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD` 登入。

進管理者後台 → 員工 → 新增其他同事的帳號。

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

## Google Calendar 同步（optional）

LINE Notify 已停用，本系統用 LINE Messaging API。設定步驟：

1. 到 Google Cloud Console 建 Service Account，下載 JSON key
2. 啟用 Google Calendar API
3. 建一個共用日曆（例：「公司請假」），把 Service Account email 加為「可變更活動」共用對象
4. 把日曆 ID、Service Account email、private key 寫進 Amplify env vars

## LINE 群組通知（optional）

1. LINE Developers Console → 建立 Messaging API Channel
2. 取得 Channel access token → `LINE_CHANNEL_ACCESS_TOKEN`
3. 把 Bot 邀請進公司群組
4. 從 webhook event 抓 `source.groupId` → `LINE_TARGET_ID`

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
  components/
  lib/               # auth / db / IP allowlist / Google Calendar / LINE / 勞基法
  server/actions/    # Server Actions
  middleware.ts      # 全站登入閘道
prisma/
  schema.prisma      # multi-database via DATABASE_URL + DIRECT_URL
  migrations/        # 由 AI 在開發時用 `prisma migrate dev` 產出，提交進 repo
  seed.ts            # 假別 + admin
amplify.yml          # Amplify build + migrate + seed
.github/workflows/   # CI
```

## Roadmap

- [ ] 舊系統 DB 匯入（待提供 dump）
- [ ] 補休累積邏輯
- [ ] 月份 / 年度報表 export
- [ ] Google Workspace SSO
- [ ] Cron jobs：年初重設特休、未打卡提醒
- [ ] 國定假日匯入
