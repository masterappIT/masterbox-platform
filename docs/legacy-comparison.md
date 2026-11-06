# 舊版 MasterBox 與 masterbox-platform 對比報告

## 0. 範圍與判讀方式

**全部是靜態閱讀。** 舊版與新版的程式都沒有執行過，也沒有用真實的 Meta 帳號測試。文中「有實作」只表示讀到了程式碼，不代表實際可用；標「推論」的是由程式碼推斷的執行結果。

路徑前綴：

- `L/`：舊版 `main`，即 `masterbox-legacy` 倉庫的本機副本
- `v1.24:`：舊分支 `legacy/MasterBox_Webhook/v1.24` 內的 `MasterBox_Webhook/` 路徑
- 沒有前綴：現行 `masterbox-platform`

狀態定義：

| 狀態 | 意思 |
|---|---|
| 已有 | 新版有同樣的功能，且前後端有接上 |
| 改動 | 新版有對應功能，但做法或範圍不同 |
| 缺少 | 新版沒有 |
| 停用 | 新版留有程式碼或型別，但呼叫會失敗或沒有接通 |

**比對基準要分兩條看：**

- `L/MasterBox_Webhook` 的 `main` 實質上停在 2022-09-14（之後只有 2026 年的維護提交）。真正的功能都在之後的分支上，最後一條是 2023-01-09 的 `v1.24`。
- 新版 `backend/` 是從 `main` 分出來的：`controller/meta_facebook.js`、`controller/meta_whatsapp.js`、`route/meta.js`、`middleware/jwt.js` 與舊版 `main` 完全相同，`controller/meta.js` 只少一行註解。
- 舊版 App（`L/MasterBox`、`L/Master-Box-ReactNative`）呼叫的是 v1.2x 才有的 API，例如 `getUserSubscribedChannels`、`filesUpload`。所以「舊版功能」要以 v1.2x 為準，只看 `main` 會低估差距。

---

## 1. 舊版有、新版缺少或停用的功能（依重要性）

| # | 功能 | 新版現況 | 舊版實作位置 | 新版位置 |
|---|---|---|---|---|
| 1 | 連接 Meta 頻道並存檔 | 停用。`sortChannelSchema` 一呼叫就拋錯，除了 seed 腳本之外沒有任何寫入頻道的程式；`registerChannel` 只有型別、沒有 resolver | `v1.24:utils/metaUtils.js:373`（`1.23` 有同名函式，見 §2.2） | `backend/utils/utils.js:42`、`backend/controller/meta_facebook.js:285`、`backend/graphQL/typeDefs/companyTypeDefs.js:147` |
| 2 | 收到的訊息入庫、建聊天室、推給頻道訂閱者 | 停用。webhook 訊息一律被拒，外部用戶也無處可存 | `v1.24:utils/messageUtils.js:19,103`；`v1.24:utils/metaUtils.js:518,525` | `backend/utils/utils.js:20-40`、`backend/graphQL/resolvers/messageResolvers.js:91-98`、`backend/prisma/schema.prisma`（`Message`） |
| 3 | 客服回覆送回 Meta | 停用（**沒接通，不是沒實作**）。見下方說明 | `v1.24:graphQL/resolvers/messageResolvers.js:21-82` | `backend/route/meta.js:43-44`、`backend/controller/meta.js:693,762`、`backend/graphQL/resolvers/messageResolvers.js:46-79` |
| 4 | 客服介面與後端對齊 | 停用。admin 的舊訊息頁與 Flutter 的部分呼叫，後端沒有對應 operation（見 §3.4、§3.5） | `v1.24:graphQL/typeDefs/channelTypeDefs.js`、`messageTypeDefs.js` | `admin/pages/index.js`、`admin/pages/messenger.js`、`admin/src/graphQL/{channel,messages}.js`、`flutter/lib/services/graphql_service.dart:153` |
| 5 | 附件與媒體收發 | 缺少。沒有上傳 API 或檔案儲存，Flutter 只把附件資訊寫進訊息 JSON | `v1.24:graphQL/resolvers/fileResolvers.js`、`utils/fileUtils.js`、`models/File.js`、`route/mb.js:9`、`route/meta.js:24` | `flutter/lib/services/graphql_service.dart:124-135` |
| 6 | 手機推播（FCM） | 缺少。Flutter 的通知開關沒有接到任何推播服務；App 以輪詢更新（聊天列表 15 秒、對話 10 秒） | `v1.24:utils/messageUtils.js:55-88`、`models/FirebaseToken.js`、`legacy/MasterBox/move-pages:MasterBox/src/utils/notifaction.tsx` | `flutter/lib/main.dart:806,1204`、`flutter/pubspec.yaml` |
| 7 | 頻道管理：列表、啟用／停用、每個帳號可看的頻道 | 缺少。`insertSubscribeChannelsToAccount` 只能替自己訂閱 | `v1.24:graphQL/typeDefs/channelTypeDefs.js`、`legacy/master_box_backend/v1.14:master_box_backend/pages/user-management/[action].js` | `admin/pages/channels-management.js`、`admin/src/components/UserForm.js`、`backend/graphQL/resolvers/accountsResolvers.js:141` |
| 8 | 改密碼、Email／簡訊驗證 | 缺少。admin 與 Flutter 的「忘記密碼」都沒有後端 | `v1.24:graphQL/typeDefs/accountTypeDefs.js`、`route/gmail.js`、`axios/twilio_sms.js` | `admin/pages/auth.js`、`flutter/lib/main.dart:278,486` |
| 9 | 訂閱、計費（Stripe、方案、發票） | 缺少。公司只有 `subscriptionName` 與起訖日；`/plans` 只是取現有公司的方案名稱 | `v1.24:route/stripe.js`、`utils/stripeUtils.js`、`utils/invoiceUtils.js`、`models/{SubscriptionPlan,CompanySubscriptions,Invoice,Discount,AddOneService}.js` | `backend/route/platformAdmin.js:108-109`、`super-admin/pages/subscriptions/index.js` |
| 10 | 其他渠道：WeChat、WhatsApp 360dialog、LINE | 缺少。只留下平台名稱（`channelPlatforms`、`ChannelPlatform`） | `v1.24:route/weChat.js`、`utils/wechatUtils.js`、`axios/whatsappApi.js`；`legacy/MasterBox_Webhook/dev-line:MasterBox_Webhook/controller/line.js` | `backend/utils/utils.js:17`、`backend/prisma/schema.prisma:9` |
| 11 | 刪除訊息、IG 限動與已刪訊息處理、訊息去重 | 缺少 | `v1.24:graphQL/resolvers/messageResolvers.js:84`、`utils/messageUtils.js:130-193` | 無 |
| 12 | 隱私權政策、服務條款、註冊同意、自訂 404／500 | 缺少 | `legacy/master_box_backend/company-info:master_box_backend/pages/{private,service}.js`、`legacy/master_box_backend/v1.12:master_box_backend/pages/{404,500}.js` | 無 |
| 13 | App 多語系 | 停用。Flutter 有語言選單，但沒有設定 locale，選了不會改變介面 | `L/MasterBox/i18n.tsx`、`L/MasterBox/src/locales/{en,zh-TW}.json` | `flutter/lib/main.dart`（`SettingsPage`） |

**第 3 項說明：** 新版有 `/meta/sendMessage`（呼叫 `whatsappSendMessage`）和 `/meta/messenger`（呼叫 `metaSendMessage`）。但在 `admin/src`、`admin/pages`、`flutter/lib`、`chat-embed/src`、`embed` 都搜尋不到呼叫這兩條路由的地方，`appSendMessage` 也沒有接到它們，只寫資料庫。

另外，GraphQL 的 `sendMessage` 在新後端只有 Subscription，沒有 Mutation（`backend/graphQL/typeDefs/messageTypeDefs.js:48`）。admin 呼叫的是 Mutation（`admin/src/graphQL/messages.js:9-10`），所以會失敗。

---

## 2. 兩個已知問題：舊版原本怎麼運作

### 2.1 webhook 訊息存不進資料庫

**新版的狀況**

`backend/controller/meta.js:202` 的 `appendMessage` 呼叫 `receivedMessageFromWebhook`，再以 `accountId = null` 呼叫 `handleSendMessage`（`messageResolvers.js:96`），接著在 `utils.js:21` 被拒絕。

**只放寬 accountId 檢查修不好，** 因為：

- `Message.createdBy` 是必填，且外鍵指向 `Account`，外部用戶沒有地方存（`schema.prisma`，`model Message`）。
- `handleSendMessage` 用帳號的公司找聊天室，沒有帳號就不知道公司；它也只接收前 3 個參數，webhook 傳來的 `platform`、`info_Content`、`channel_id` 都被忽略。
- 聊天室不存在時會報錯，不會自動建立。
- `ChatRoom.channelId` 外鍵指向 `CompanyChannel.id`，webhook 傳的卻是 Meta 的頻道 ID，需要先轉換。
- 推播只發給寄件帳號本人（`utils.js:38`），不會發給頻道訂閱者。

**舊版 `main` 也是壞的**

`L/MasterBox_Webhook/graphQL/resolvers/messageResolvers.js:56` 呼叫 `sendMessage(null, …)`，但檔案只 import 了 `handleSendMessage`。推論執行時會出現 `ReferenceError`，訊息存不進去。這個舊名稱是合併提交 `feb56d3a` 解衝突時留下的。

不過 `L/MasterBox_Webhook/utils/utils.js:64-151` 的設計意圖是清楚的：

1. 沒有 `account_id` 時，從 `info_Content` 取外部用戶 ID 當寄件者。
2. 用 `access_info.id` 找到公司與頻道。
3. 聊天室不存在就建立。
4. 存訊息，寄件者直接存字串。
5. 推給該頻道的所有訂閱帳號。

**有實作的版本在之後的分支**

`dev-apis` 起改用 `saveAndPublishMessage`。`v1.24` 的流程：

- `v1.24:utils/metaUtils.js:518,525` 呼叫 `receivedMessageFromWebhook`（`utils/messageUtils.js:19`）。
- 需要時建立聊天室，再進入 `saveAndPublishMessage`（`:103`）。
- 訊息用 `sender` 字串欄位存外部用戶；`created_by` 只有從 App 發送時才填（`:119-126`）。
- 依平台訊息 ID 去重（`:157`），同時推 WebSocket 與 FCM（`:55-88`）。

這是最值得參考的版本，但未經執行驗證。

### 2.2 `sortChannelSchema` 一呼叫就報錯，頻道不會存

**新版的狀況**

`backend/utils/utils.js:42-44` 直接拋出 `WEBHOOK_DISABLED`。呼叫端 `backend/controller/meta_facebook.js:285` 沒有 `await` 也沒有 `catch`，後端也沒有 `process.on('unhandledRejection')`。

**推論：** Dockerfile 用 Node 20，未處理的 rejection 預設會結束程序，所以一次 Meta 登入可能讓後端重啟。這點需要實測確認，比「頻道沒存」更嚴重。

**舊版 `main`**

`L/MasterBox_Webhook/utils/utils.js:274-299` 依平台分流 FB、IG、WhatsApp，略過已存在的頻道，再把新頻道寫入 `Company.channels`。但 `:278` 把公司 ID **寫死**成單一公司，只能算原型。

**之後的分支**

改成 `updateMetaChannels(authorizedChannels, company_id, user_id, user_access_token)`，公司 ID 來自 OAuth 的 `state`（`v1.24:controller/meta/meta.js:373-381`、`utils/metaUtils.js:869`）。這個版本多做了：

- 擋下已被其他公司綁定的 Meta 帳號（`:390`）
- 把取消授權的頻道標為停用（`:404-411`）
- 恢復重新授權的頻道（`:413-430`）

**移植時要注意：** `v1.24:utils/metaUtils.js:435` 引用了沒有宣告的 `sameAccount`。推論它會在建立新頻道（`:455`）之前拋錯。比較安全的參考是 `1.23`（沒有這段）或 `dev-filter_company_subscription`（有宣告），兩者同樣沒有執行驗證。

**環境變數：** `backend/.env.example` 沒有 Meta 流程會用到的 `BASE_URL`、`VERIFY_TOKEN`、`FB_APP_ID`、`FB_APP_SECRET`。我沒有檢查正式環境的設定，上線前要確認。

---

## 3. 功能對照表

### 3.1 REST 路由

舊版 `main` 的路徑都在 `L/MasterBox_Webhook/route/meta.js`，對應 `backend/route/meta.js`；兩個檔案內容相同。

| 路由 | 狀態 | 備註 |
|---|---|---|
| `GET /meta/webhook` | 已有 | 需要 `VERIFY_TOKEN` |
| `POST /meta/webhook` | 停用 | 收得到，存不進去（§2.1） |
| `GET /meta/login` | 已有 | |
| `GET /meta/getToken` | 停用 | 走到 `sortChannelSchema` 拋錯（§2.2） |
| `GET /meta/getDebugToken`、`POST /meta/getWhatsappInfo`、`GET /meta/getlongliveToken`、`GET /meta/getPageToken`、`GET /meta/getPageFollowers`、`POST /meta/getInstagramAccount`、`POST /meta/subscriptFBpage`、`POST /meta/unsubscribeFBpage`、`GET /meta/whatsappNumbers` | 已有 | 程式相同，未驗證目前的 Meta API 是否仍相容 |
| `POST /meta/createTemplate`、`GET /meta/getTemplate`、`POST /meta/editTemplate`、`POST /meta/deleteTemplate` | 已有 | 另有 GraphQL 範本 CRUD，只存本地，沒有同步到 Meta |
| `GET /meta/getConversations`、`GET /meta/messagesList`、`GET /meta/message` | 已有 | `getConversations` 是 webhook 查聊天室 ID 的內部依賴 |
| `POST /meta/sendMessage`、`POST /meta/messenger` | 停用 | 有實作，沒有任何前端或 resolver 呼叫（§1 第 3 項） |

只在舊分支有的路由，新版都**缺少**（路徑在 `v1.24:route/`）：

| 路由 | 用途 | 檔案 |
|---|---|---|
| `POST /meta/webhook/whatsapp/:phoneNumber`、`GET /meta/connectWhatsappChannels` | WhatsApp 360dialog | `route/meta.js:12,18` |
| `POST /meta/unauthorized`、`GET /meta/deleteInfo` | 從名稱看是 Meta 取消授權與資料刪除回呼（未細讀） | `route/meta.js:20,22` |
| `POST /meta/messengerWithAttachment` | 傳送附件 | `route/meta.js:24` |
| `GET /mb/file/:uploadType/:channelId/:token/:filename` | 下載檔案 | `route/mb.js:9` |
| `GET /email/auth`、`GET /email/verify/:code` | Email 驗證 | `route/gmail.js:16,29` |
| `POST /payment/webhook_event`、`POST /payment/setWebhookEndPoint`、`POST /payment/test` | Stripe | `route/stripe.js:27,245,263` |
| `/wechat/*`（`/`、`/gh/:appId`、`/webhookEvent`、`/wxAuthEvent`、`/wxAuth`、`/sendGroupMessage`、`/uploadImage`） | WeChat | `route/weChat.js:12-29` |

新版新增、舊版沒有：`/api/integrations/*`、`/api/embed/*`、`/api/realtime/*`（LiveKit 通話）、`/api/platform-admin/*`。

### 3.2 GraphQL：舊版 `main` 對新版

舊版路徑在 `L/MasterBox_Webhook/graphQL/`，新版在 `backend/graphQL/`，檔名相同。

| Operation | 狀態 | 備註 |
|---|---|---|
| `loginAccount`、`registerAccount` | 改動 | 改用 Prisma；`registerAccount` 需要管理員權限 |
| `insertSubscribeChannelsToAccount` | 改動 | 只能替呼叫者本人訂閱 |
| `findAccountByEmail` | 已有 | |
| `findAccountByCompanyId` | 停用 | 有型別，新版 `accountsResolvers.js` 沒有 resolver；由 `listAccounts` 取代 |
| `registerCompany`、`updateCompanyInfo`、`findCompanyById`、`findCompanyByEmail` | 改動 | 改用 Prisma |
| `registerChannel` | 停用 | 兩邊都只有型別，沒有 resolver |
| `appSendMessage` | 改動 | 新增加密與閱後即焚欄位；只寫資料庫，不發送到 Meta |
| `receivedMessageFromWebhook` | 停用 | §2.1 |
| Subscription `sendMessage(accountId)` | 改動 | 舊版推給頻道訂閱者，新版只推給寄件帳號本人 |
| `Message`（Query） | 停用 | 舊版回傳測試資料，新版回傳 null，都不是實際功能 |
| `numberIncremented`、`currentNumber` | 已有 | 舊版留下的測試項目，可清除 |

新版新增：`refreshToken`、`createAccount`、`updateAccount`、`deleteAccount`、`listAccounts`、`markMessageRead`、`chatRooms`、`messages`、範本 CRUD（`backend/graphQL/typeDefs/messageTemplateTypeDefs.js`）。

### 3.3 GraphQL：`v1.24` 才有的 operation

路徑都在 `v1.24:graphQL/typeDefs/`。

| 類別（檔案） | Operation | 新版狀態 |
|---|---|---|
| 帳號（`accountTypeDefs.js`） | `addAndEditAccount`、`deleteAccountById`、`findAccountsByCompanyId` | 改動：`createAccount`、`updateAccount`、`deleteAccount`、`listAccounts` |
| 帳號 | `refreshToken` | 改動：參數結構不同 |
| 帳號 | `updatePassword`、`sendEmailVerificationCode`、`sendSMSVerificationCode`、`verifyCodeFromSMS`、`findAccountInfoByfield` | 缺少 |
| 頻道（`channelTypeDefs.js`） | `getUserSubscribedChannels`、`getCompanyChannels`、`getChannelByfield`、`updateCompanyChannelActiveStatus` | 缺少 |
| 聊天室（`chatroomTypeDefs.js`） | `chatRooms`（分頁、篩選） | 改動：新版沒有參數 |
| 聊天室 | `markMessageAsRead` | 改動：`markMessageRead`，以單一訊息為單位 |
| 聊天室 | `findChatRoomsByUser` | 缺少 |
| 訊息（`messageTypeDefs.js`） | `sendMessage`（Mutation）、`deleteMessage`、`findMessages` | 缺少 |
| 訊息 | `getChatRoomsMessages` | 改動：`messages`，沒有分頁，也不向 Meta 補抓歷史訊息 |
| 檔案（`fileTypeDefs.js`） | `filesUpload`、`deleteFiles`、`getFilesInfo`、`getWeChatMedia`、`getLongtermMediaByType`、`deleteLongtermMedia` | 缺少 |
| 推播（`firebaseTypeDefs.js`） | `subscribeChannelsMessages`、`unsubscribeChannelsMessages` | 缺少 |
| 計費（`stripeTypeDef.js`、`companySubscriptionTypeDefs.js`、`subscriptionPlanTypeDefs.js`、`addOneServiceTypeDefs.js`、`discountTypeDefs.js`、`invoiceTypeDefs.js`） | Stripe、訂閱、方案、加購、折扣、發票的全部 operation | 缺少 |

### 3.4 管理後台頁面

路徑：`L/master_box_backend/pages/` 對應 `admin/pages/`。`admin/` 是從 `master_box_backend` 的 `main` 分出來的，沒有 v1.1～v1.14 的成果。

| 舊版頁面 | 新版頁面 | 狀態 | 差異 |
|---|---|---|---|
| `_app.js` | `_app.js` | 改動 | 增加角色限制、可收合側欄 |
| `auth.js` | `auth.js` | 改動 | 登入、註冊保留；忘記密碼顯示「尚未由後端提供」 |
| `auth copy.js` | 無 | 停用 | 舊副本，不需要 |
| `index.js`（訊息） | `index.js`、`messenger.js` | 停用 | `messenger.js` 與舊版 `index.js` 完全相同；兩者都呼叫後端沒有的 `getUserSubscribedChannels`、`getChatRoomsMessages`、`sendMessage`，`chatRooms` 帶的參數也不符；`index.js` 另有示範資料備援 |
| `channels-management.js` | 同名 | 停用 | 導向 `/meta/login`，但頻道存不進去（§2.2） |
| `company-information.js` | 同名 | 改動 | 流程保留，增加防呆 |
| `user-management.js` | 同名 | 改動 | 舊版是假資料；新版用 `listAccounts`、`deleteAccount`，有 localStorage 備援 |
| `user-management/edit/[id].js` | 同名、`src/components/UserForm.js` | 改動 | 舊版有頻道選擇器但沒存檔；新版只有 Email、密碼、角色 |
| `user-management/add/[id].js` | 同名 | 改動 | 舊版是空檔；新版可用 |
| `customers-management.js` | 同名 | 改動 | 舊版是空殼；新版管理的是**員工帳號**，不是客戶 |
| `messaging-template.js` | 同名 | 改動 | 舊版是空殼；新版接本地範本 CRUD |
| `bot-messaging.js` | 同名、`api/bots.js` | 改動 | 舊版是空殼；新版是記憶體內的模擬 API |
| `data-analysis.js`、`group-notifications.js`、`setting.js` | 同名 | 改動 | 舊版是空殼；新版仍是靜態或測試模式 |
| `text.js`、`api/hello.js` | 同名 | 已有 | 開發殘留，可清除 |

`L/MasterBox_Backend/pages/` 是 Notus 版型的展示頁（`admin/{dashboard,maps,settings,tables}.js`、`auth/{login,register}.js`、`index.js`、`landing.js`、`profile.js`、`404.js`、`_error.js`），沒有呼叫 API。新版都不保留，狀態為停用，不需要補回；唯一可參考的是自訂錯誤頁。

新版新增：

- `admin/pages/chat-management.js`：用新 API，是目前唯一對得上後端的訊息頁
- `admin/pages/home.js`、`platform-admin.js`：模擬資料
- `admin/pages/chatroom-flow.js`：靜態導覽
- `super-admin/`、`chat-embed/`、`embed/`（目前沒有受版控的檔案）、`landing-page/`

### 3.5 App 畫面

路徑：`L/MasterBox/src/`（`L/Master-Box-ReactNative/src/` 是結構幾乎相同的 Expo 版，有 29 個檔案不同）對應 `flutter/lib/`。

| 舊版 | 新版 | 狀態 | 差異 |
|---|---|---|---|
| `screen/AuthScreen.tsx` | `main.dart`（`LoginPage`） | 改動 | 登入保留；舊版可選語言；重設密碼在新舊版都未見後端支援；新版在 debug 版有開發模式 |
| `screen/ClientScreen.tsx` | `main.dart`（`ClientPage`） | 改動 | 舊版列出訂閱頻道與各頻道的聊天室；新版列 `listAccounts` 的員工帳號（需管理員權限），頻道是固定文字「尚未指派社群」 |
| `screen/ChatScreen.tsx` | `main.dart`（`ChatPage`） | 改動 | 舊版是推播與選圖的測試頁；新版是正式聊天列表，每 15 秒輪詢，失敗時顯示示範聊天室；`lastMessage` 後端沒有回傳 |
| `screen/Conversation.tsx`、`components/Conversation/*` | `main.dart`（`ConversationPage`） | 改動 | 舊版有訂閱即時更新、分頁、已讀、圖片影片語音顯示、Facebook 24 小時限制提示；新版每 10 秒輪詢、沒有分頁；`isMine` 後端固定為 undefined |
| `components/Conversation/MessageInput.tsx`、`utils/files.tsx` | `main.dart`（`_showAttachmentOptions`） | 停用 | 新版可選檔，但沒有上傳 API，只把附件資訊放進訊息 JSON |
| `screen/SettingScreen.tsx`、`SettingScreenDetail.tsx` | `main.dart`（`SettingsPage`） | 改動 | 新增深色模式；語言選單不生效；通知開關沒有推播；登出保留 |
| `i18n.tsx`、`locales/{en,zh-TW}.json` | 無 | 缺少 | 新版介面文字寫死 |
| `utils/pushNotifaction.tsx` | 無 | 缺少 | Flutter 沒有推播套件 |
| `redux/slices/messagesSlices.tsx`（`handleMessagesSubscription`） | `services/graphql_service.dart` | 缺少 | Flutter 沒有 WebSocket 訂閱，只有輪詢 |

新版新增：

- `call_page.dart`：LiveKit 語音與視訊通話
- 端對端加密與閱後即焚介面。其中 `updateChatRoomSettings`（`graphql_service.dart:154`）在後端**沒有定義**，設定會失敗，因此這項目前是**停用**
- `services/dynamic_island_service.dart`

---

## 4. 資料結構對照

新版在 `backend/prisma/schema.prisma`。舊版要分兩個時間點看：`L/MasterBox_Webhook/models/`（`main`）和 `v1.24:models/`。

### 4.1 `main` 的 model

| 舊版 model | 新版 | 差異 |
|---|---|---|
| `Account` | `Account`、`AccountChannel` | `user_info` 改 Json；`channels_subscribed_ids` 改關聯表。欄位沒有遺失 |
| `Company` | `Company`、`CompanyChannel`、`CompanyLabel` | `subscription` 攤平成 3 個欄位；內嵌的 `channels`、`labels` 改成獨立表。欄位沒有遺失 |
| `ChatRoom` | `ChatRoom` | `platform` 改 enum；`channel_id` 從字串變成外鍵 |
| `Message` | `Message`、`MessageRecipient` | **語意改變：** `created_by` 從可存外部用戶 ID 的字串，變成必須對應 `Account` 的外鍵 |
| `MessageTemplate` | `MessageTemplate` | 相同 |
| `User` | `User` | 相同 |

### 4.2 新版沒有搬過來的欄位（`v1.24`）

| Model | 缺少的欄位 | 影響 |
|---|---|---|
| `Message` | `sender`、平台訊息 `id`、`channel_id`、`to_chat_room_id`、`delete_by` | 無法存外部寄件者、無法去重、無法記錄刪除 |
| `Channels` | `active`、`authorized` | 無法停用頻道或標記取消授權 |
| `ChatRoom` | `last_message_read`（`users` 由 ID 陣列改 Json） | 沒有聊天室層級的已讀位置 |
| `Account` | `verify`、`access_info`（付款方式、卡號末四碼）、細部 `permissions` 陣列（新版是單一字串）、訂閱頻道的 `platform` | 沒有驗證狀態與細部權限 |
| `Company` | `verify`、`business_registration`、`stripe_customer_id`、`subscription` 參照 | 沒有公司驗證與 Stripe 客戶關聯 |

舊版把訊息、聊天室、頻道依平台分開存（`Messages(platform)`、`ChatRoom(platform)`、`Channels(platform)`），新版統一放進同一組表。

`ChannelPlatform` 也少了 `whatsapp_360dialog`（`v1.24:utils/chatRoomUtils.js:10`）。

### 4.3 新版沒有的集合（`v1.24`）

`ThirdPartyUser`、`FirebaseToken`、`File`（GridFS）、`SubscriptionPlan`、`CompanySubscriptions`、`AddOneService`、`Discount`、`Invoice`、`Stripe`（`StripeMetadataSchema`，內嵌於方案與加購）。

其中 `ThirdPartyUser`（外部用戶的姓名、頭像）與修復訊息入庫最相關。

新版新增、舊版沒有：`ThirdPartyIntegration`、`IntegrationConversation`、`IntegrationMessage`、`DeepLinkSession`、`CallSession`、`CallParticipant`、`CallSignalEvent`、`EmbedToken`、`PlatformAdminProfile`、`PlatformAdminRefreshSession`、`AuditLog`。

---

## 5. 舊分支

**這一節只讀了提交紀錄與程式碼，沒有任何分支實際執行過。** 提交多標示 `[WIP]`，「有實作」不等於可用。

### 5.1 `MasterBox_Webhook`（相對於 `main`）

| 分支 | 最後提交 | 多做的功能 | 新版 |
|---|---|---|---|
| `dev-line` | 2022-07-15 | LINE 登入、webhook、使用者資料路由（`controller/line.js`、`route/line.js`），仍是 WIP，只有 3 個提交 | 缺少 |
| `fb` | 2022-08-30 | Messenger／IG／WhatsApp 收發、附件、範本訊息；另有粉專貼文查詢 | 收發大多併入 `main`（§1 第 3 項沒接通）；貼文查詢缺少 |
| `dev-mongodb-models` | 2022-08-29 | 沒有 `main` 以外的提交 | 不適用 |
| `dev-apis` | 2022-09-22 | `saveAndPublishMessage`、聊天室與頻道 resolver、分頁 | 缺少（chatRooms、messages 是簡化版） |
| `dev-graphql` | 2022-09-29 | 同上，加 IGSID 查詢與修正 | 缺少 |
| `https` | 2022-09-23 | HTTPS 憑證設定、WebSocket 路徑調整 | 改動：改由部署環境處理（未驗證） |
| `dev-weChat` | 2022-09-28 | WeChat 第三方平台授權、加解密、收發訊息、客服 API（`controller/weChat.js`、`helper/weChat_*.js`）；含模擬登入公眾號的實驗 | 缺少 |
| `v1`、`v1.01` | 2022-09-26、09-29 | 帳號更新、WebSocket 路徑、auth 與 jwt 修正 | 改動：認證已重寫 |
| `v1.1` | 2022-10-05 | 檔案上傳、權限細項、頻道啟用切換 | 缺少 |
| `v1.11` | 2022-10-21 | 檔案下載與類型過濾、`generalResponse`、`updateMetaChannels` | 缺少 |
| `v.1.12` | 2022-10-26 | IG 限動、`markMessageAsRead`、頻道分頁、`ThirdPartyUser` | 已讀有簡化版，其餘缺少 |
| `v1.2` | 2022-10-24 | 併入 WeChat（授權流程、用戶分組、QR 規則） | 缺少 |
| `v1.21` | 2022-11-11 | WeChat 媒體下載修正 | 缺少 |
| `v1.22` | 2022-11-07 | WhatsApp 媒體下載、聊天室與訊息存取、權限更新 | 缺少 |
| `dev-wxGh_login` | 2022-11-08 | 模擬登入公眾號後台並保存 token 與 cookie | 缺少；**不建議補**，依賴模擬登入，可能違反平台規範 |
| `dev-gmail` | 2022-11-14 | Google API 寄信、Email 驗證（5 分鐘過期） | 缺少 |
| `dev-mongodb_controller` | 2022-11-16 | 清除 MongoDB 集合內容的工具 | 不需要 |
| `dev-sms` | 2022-11-17 | Twilio 簡訊驗證、WeChat 媒體 | 缺少 |
| `dev-ws_device_id` | 2022-11-23 | 以 user-agent 當裝置 ID，綁定 refresh token | 缺少 |
| `1.23` | 2022-12-23 | FCM 推播、360dialog token 流程、refresh token 調整 | 缺少（refresh token 已另外實作） |
| `dev-filter_company_subscription` | 2022-12-29 | Stripe 訂閱排程、發票、失敗重試計時器 | 缺少 |
| `v1.24` | 2023-01-09 | 建立付款資訊、更新與取消訂閱、預設付款方式 | 缺少 |
| `security/remove-exposed-credentials` | 2026-11-04 | 只刪除 `data/dummyData.js` | 新版已刪除同名檔案 |

### 5.2 `master_box_backend`（相對於 `init`／`main`）

`init` 與 `main` 內容相同。

| 分支 | 最後提交 | 多做的功能 | 新版 |
|---|---|---|---|
| `v1` | 2022-09-26 | 使用者編輯表單重做、清除副本 | 部分：有 `UserForm.js`，沒有頻道選擇器 |
| `v1.1`、`UserPage` | 2022-10-06、10-03 | 新增與編輯合併頁、`updatePassword`、`getCompanyChannels`、token 更新 | 帳號 CRUD 改動；改密碼與頻道列表缺少 |
| `v1.11` | 2022-10-14 | 刪除帳號、頻道啟用切換、訊息分頁 | 刪除已有；其餘缺少 |
| `v1.12` | 2022-10-21 | 404／500 頁、附件顯示與圖片彈窗 | 缺少 |
| `company-info` | 2022-10-27 | 隱私權與條款頁、註冊同意、已讀、上傳 | 缺少 |
| `upload` | 2022-12-12 | 檔案上傳、`fileUrlGenerator` | 缺少 |
| `v1.13` | 2022-12-22 | 刪除訊息、簡訊驗證彈窗、Email 邀請、已讀工具、多種訊息類型、權限介面 | 缺少 |
| `group` | 2022-12-22 | 群發通知列表與新增編輯路由 | 缺少：新版只有測試模式 |
| `payment` | 2022-12-26 | Stripe 付款頁、訂閱方案、發票（`companySubscriptionUtils.js`） | 缺少 |
| `v1.14` | 2023-01-19 | 集合 v1.13 與 payment，加語言預設、訊息頁完整功能 | 缺少；**移植後台時最值得參考** |

### 5.3 其他倉庫

| 分支 | 內容 | 新版 |
|---|---|---|
| `MasterBox_Backend/layout` | 靜態聊天畫面（`pages/admin/messenger.js`） | 概念已由 admin 取代 |
| `MasterBox/init` | 只有 1 個提交：把圖示換成文字 | 不需要 |
| `MasterBox/move-pages` | 25 個提交：FCM 與 notifee 前景背景推播、其他裝置登入時登出、圖片訊息上傳、頻道為空的畫面 | 缺少 |
| `Master-Box-ReactNative/main`、`MasterBox/main` | 與合併後的 `main` 內容相同 | 不適用 |

---

## 6. 結論：建議補上的功能（依重要性）

前 3 項是同一條主流程，要一起完成才看得到效果：頻道連得上，訊息才收得到；訊息收得到，回覆才有意義。

1. **修好 Meta 頻道連接。** 先處理 `sortChannelSchema` 未捕捉的錯誤，再參考 `updateMetaChannels` 寫入 `CompanyChannel`（公司取自 OAuth `state`），並補 `active`、`authorized`。避開 `v1.24` 的 `sameAccount` 問題。同時確認環境變數。
2. **修好收訊息。** 調整資料表：`createdBy` 改為可空，新增 `sender` 與平台訊息 ID（加唯一限制以去重）。把 Meta 頻道 ID 對應到 `CompanyChannel`，自動建立聊天室，並推給 `AccountChannel` 的訂閱者。
3. **接通客服回覆。** 讓發送訊息的 mutation 依平台呼叫既有的 `metaSendMessage`、`whatsappSendMessage`，成功才存入。
4. **統一前後端 API。** 二選一處理 admin 的 `index.js`、`messenger.js`：改用新 API，或移除並以 `chat-management.js` 為主。Flutter 要補客戶與頻道資料來源，並解決 `updateChatRoomSettings`、`isMine`、`lastMessage`。
5. **附件與媒體。** 上傳、儲存、下載，以及收到平台附件時的處理。
6. **即時更新與手機推播。** Flutter 改用訂閱，再補 FCM。
7. **帳號與頻道管理。** 改密碼、忘記密碼、Email 驗證、每個帳號的頻道指派、頻道啟用切換。
8. **合規頁面。** 隱私權政策、服務條款、註冊同意，以及 Meta 取消授權與資料刪除回呼。若要通過 Meta 應用程式審查，這項應提前。
9. **訂閱計費。** 工程量大，舊版也停在 WIP，建議先確認商業需求再重新設計，不要直接移植。
10. **其他渠道與細項。** WeChat、360dialog、LINE 依市場需求決定；刪除訊息、IG 限動、多語系排在其後；`dev-wxGh_login` 的模擬登入不要補。

**還需要實測的項目：**

- Meta 登入是否真的會讓後端程序結束（§2.2）
- 正式環境的 Meta 相關環境變數是否齊全
- 目前的 Meta Graph API 是否仍相容這批 2022 年的呼叫
- 舊分支中要參考的流程，移植後都要重新測試

**憑證：** 舊版歷史含有已外洩的憑證，本報告未列出任何值，也沒有測試它們能否使用。
