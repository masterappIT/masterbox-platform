# MasterBox Platform

MasterBox is a real-time conversation platform monorepo. This repository is the canonical integration point for all current product surfaces.

## Components

- `backend/` — Node.js/Express API, GraphQL, Prisma/PostgreSQL, Redis, Meta integrations, realtime and LiveKit
- `admin/` — Next.js operations console
- `super-admin/` — Next.js platform administration console
- `flutter/` — Flutter mobile and Web/H5 client
- `chat-embed/` — dependency-free browser embed client
- `docs/` — architecture and legacy integration records

## Start locally

```bash
docker compose -f backend/docker-compose.yml up -d
cd backend && npm install && npm run prisma:generate && npm run dev
```

Run the admin console with `cd admin && npm install && npm run dev`, and the super-admin console with `cd super-admin && npm install && npm run dev` (port 3100). Run Flutter H5 with `cd flutter && flutter pub get && flutter run -d chrome`.

Web fonts are self-hosted through `@fontsource` packages and bundled with each Next.js build. Do not load fonts or other assets from `fonts.googleapis.com` or other Google CDNs: users in mainland China often cannot reach them.

Copy the relevant `.env.example` files to untracked `.env` files. Never commit credentials, API keys, JWT secrets, signing keys or generated build directories.

## 正式環境部署說明

推送至 `main` 就會自動部署，由 [`.github/workflows/deploy-hostkvm.yml`](.github/workflows/deploy-hostkvm.yml) 負責。也可以在 GitHub Actions 手動執行 **Deploy HostKVM**。

### 部署流程

1. 安裝 backend、admin 與 super-admin 依賴，執行 Prisma schema validation 與前端 production build。
2. 建立以 commit SHA 命名的 container images，推送至 `ghcr.io/masterappit/masterbox`。
3. 以 SSH 通知正式伺服器部署。伺服器會先備份資料庫，再更新容器；健康檢查失敗會自動退回上一版。
4. 透過正式網域執行 smoke tests。

正式環境的密碼只存在伺服器上，不在 GitHub。部署只需要 `production` environment 的 secret `HOSTKVM_DEPLOY_SSH_KEY`。

舊的 `deploy-production.yml`（GCP Cloud Run）已於 2026-10-19 刪除，只留在 Git 歷史中，相關 GCP 資源也已刪除。正式部署只有 `deploy-hostkvm.yml` 一條流程，請勿恢復舊 workflow。

### 運作須知

- **Migration**：API 容器的啟動命令是 `npx prisma migrate deploy && node app.js`，所以 migration 在新版 API 啟動時執行。migration 失敗時容器無法啟動，伺服器會自動退回上一版映像，但**已套用的 migration 不會撤銷**。每個 migration 都必須能與上一版程式共存（先加入相容結構，之後的版本才移除舊結構）。
- **部署會短暫中斷**：伺服器以新映像重建容器，每次部署網站會中斷幾秒到十幾秒。避免在繁忙時段推送。
- **映像是公開的**：本 repo 公開，`ghcr.io/masterappit/masterbox` 的映像任何人都能下載。映像和前端 bundle 內不能包含任何密碼、金鑰或內部網址。
- **伺服器端設定與回滾**：容器設定、部署腳本、回滾和日常操作記錄在私人 repo `masterappIT/MasterApp-infra` 的 `docs/masterbox-deploy.md`。

### 固定正式網域

- `https://masterbox.masterappinc.com/`：Landing page
- `https://api.masterbox.masterappinc.com/graphql`：GraphQL API
- `https://admin.masterbox.masterappinc.com/`：Admin
- `https://superadmin.masterappinc.com/`：Super Admin
- `https://masterboxapp.masterappinc.com/`：Customer app

請勿將 production credentials 或 database URL 提交至 Git。`backend/docker-compose.yml` 僅供本機開發，不能用於正式環境。

- [Architecture](docs/architecture.md)
- [Legacy inventory and integration policy](docs/legacy-inventory.md)
- [Product prototype references](docs/product-prototypes.md)
- [Historical development notes](docs/historical-changelog.md)
- [Backend](backend/README.md)
- [Admin](admin/README.md)
- [Super Admin](super-admin/README.md)
- [Flutter](flutter/README.md)
- [Chat embed](chat-embed/README.md)
