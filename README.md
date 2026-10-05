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

正式環境部署由 [`.github/workflows/deploy-production.yml`](.github/workflows/deploy-production.yml) 管理，並固定部署至既有的 `masterbox-507211` GCP 專案與 `asia-east2` 區域。任何推送至 `main` 的變更都會自動觸發部署；也可透過 GitHub Actions 的 `workflow_dispatch` 手動重新部署。

### 部署流程

1. 安裝 backend、admin 與 super-admin 依賴。
2. 執行 Prisma schema validation 與前端 production build。
3. 建立以 commit SHA 命名的 immutable container images，並推送至 Artifact Registry。
4. 建立 Cloud SQL `masterbox-db` 部署前備份。
5. 更新既有的 `masterbox-api`、`masterbox-admin`、`masterbox-super-admin`、`masterbox-customer` 與 `masterbox-landing` Cloud Run services。
6. 透過固定正式網域執行 smoke tests。

Prisma validation 使用僅供 schema 檢查的本機格式 placeholder `DATABASE_URL`，不會連線資料庫，也不會暴露正式資料庫密碼。正式 API 使用 Secret Manager 中的 `DATABASE_URL`、JWT、token、Redis 與 CORS secrets。

### 固定正式網域

- `https://masterbox.masterappinc.com/`：Landing page
- `https://api.masterbox.masterappinc.com/graphql`：GraphQL API
- `https://admin.masterbox.masterappinc.com/`：Admin
- `https://superadmin.masterappinc.com/`：Super Admin
- `https://masterboxapp.masterappinc.com/`：Customer app

### GitHub Actions 權限

GitHub Actions 透過 Workload Identity Federation 登入 GCP，不使用 JSON service-account key。Production environment 必須保留以下 variables：

- `GCP_WORKLOAD_IDENTITY_PROVIDER`
- `GCP_DEPLOY_SERVICE_ACCOUNT`

請勿將 production credentials、database URL 或 Secret Manager 的內容提交至 Git。`backend/docker-compose.yml` 僅供本機開發，不能用於正式環境。


- [Architecture](docs/architecture.md)
- [Legacy inventory and integration policy](docs/legacy-inventory.md)
- [Product prototype references](docs/product-prototypes.md)
- [Historical development notes](docs/historical-changelog.md)
- [Backend](backend/README.md)
- [Admin](admin/README.md)
- [Flutter](flutter/README.md)
- [Chat embed](chat-embed/README.md)
