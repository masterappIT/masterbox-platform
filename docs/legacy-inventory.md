# MasterBox Legacy Inventory

`masterbox-platform` is the canonical MasterBox monorepo. Legacy folders and repositories are reference material only and must not be merged by overwriting current files.

## Canonical components

| Component | Location | Role |
|---|---|---|
| Backend | `backend/` | Express, GraphQL, Prisma/PostgreSQL, Redis, Meta integrations, realtime and platform APIs |
| Admin | `admin/` | Next.js operational administration UI |
| Super admin | `super-admin/` | Next.js platform administration UI |
| Flutter client | `flutter/` | Mobile and Flutter Web/H5 client |
| Embed client | `chat-embed/` | Dependency-free browser chat client |

## Local legacy sources reviewed

- `MasterBox_Webhook-main`: earlier backend copy. Its data layer and runtime must be compared semantically; do not overwrite `backend/`.
- `legacy-archive-20260901-0038/masterbox_flutter`: earlier Flutter copy. Compare feature behavior and API contracts before porting anything.
- `legacy-archive-20260901-0038/master_box_backend-init`: earlier admin UI prototype. Use it as a page and workflow reference only.
- `new_master-master/flutter_app`: EC Travel passenger/driver prototype. It is a separate product flow and is not merged into the chat platform without an approved product boundary.
- `MasterBox-main` and `Master-Box-ReactNative-main`: legacy React Native clients. Use for feature parity review; Flutter is the current client direction.
- `super-admin`: local duplicate of the canonical `super-admin/` component; no separate integration is required.

## Excluded from integration

Never copy real `.env` files, signing keys, `node_modules`, `.next`, `.dart_tool`, `build`, `ios/Pods`, `.expo`, or broken Git worktrees into this repository. Rotate any credentials found in legacy `.env` files if they were ever shared or committed.

## GitHub repositories

- [`masterappIT/masterbox-platform`](https://github.com/masterappIT/masterbox-platform) is the canonical repository.
- `masterappIT/MasterBox_Webhook` is a legacy webhook repository; preserve it for history until API and data migration review is complete.
- `masterappIT/master_box_backend` is a legacy admin frontend; migrate missing workflows into `admin/`, then archive it.
- `masterappIT/Master-Box-ReactNative` is a legacy mobile client; use it for parity review, then archive it after Flutter acceptance.
