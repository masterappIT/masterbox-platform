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

Run the admin console with `cd admin && npm install && npm run dev`. Run Flutter H5 with `cd flutter && flutter pub get && flutter run -d chrome`.

Copy the relevant `.env.example` files to untracked `.env` files. Never commit credentials, API keys, JWT secrets, signing keys or generated build directories.

## 正式環境部署說明

推送至 `main` 就會自動部署，由 [`.github/workflows/deploy-hostkvm.yml`](.github/workflows/deploy-hostkvm.yml) 負責。也可以在 GitHub Actions 手動執行 **Deploy HostKVM**。

### 部署流程

1. 安裝 backend、admin 與 super-admin 依賴，執行 Prisma schema validation 與前端 production build。
2. 建立以 commit SHA 命名的 container images，推送至 `ghcr.io/masterappit/masterbox`。
3. 以 SSH 通知正式伺服器部署。伺服器會先備份資料庫，再更新容器；健康檢查失敗會自動退回上一版。
4. 透過正式網域執行 smoke tests。

正式環境的密碼只存在伺服器上，不在 GitHub。部署只需要 `production` environment 的 secret `HOSTKVM_DEPLOY_SSH_KEY`。

舊的 `deploy-production.yml`（GCP Cloud Run）已停用，相關 GCP 資源已刪除，請勿重新啟用。

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
- [Flutter](flutter/README.md)
- [Chat embed](chat-embed/README.md)
