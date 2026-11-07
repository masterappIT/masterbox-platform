# 第一階段：統一聊天基礎

狀態：草案，等使用者確認（2026-11-07）

## 為什麼要做

MasterBox 之後要接的來源越來越多：Meta（FB、IG、WhatsApp 官方）、WhatsApp 掃碼、LINE，以及 Chat Box 的對內和對外。每多接一種，現在的做法都要在後端、後台和 App 各改一次，功能也會越來越不一致。

第一階段要建立一套統一的基礎，讓每種來源用同一套規格接進來：

- **基礎功能**：MasterBox 自己做得到、跟平台無關。每種來源都一定有，不會被減掉。
- **加掛功能**：要看來源支不支援。由來源宣告，介面依宣告顯示。

## 現況的問題

| 問題 | 位置 |
|---|---|
| 送訊息的流程把 `fb`、`ig`、`whatsapp` 寫死，掃碼和官方的分支也夾在同一段 | `backend/utils/utils.js` 的 `replyTarget`、`prepareReply` |
| 訊息依平台存成不同格式（Meta 的格式、WhatsApp 的 `text.body`、純文字），讀的地方各自猜格式，同樣的判斷寫了三份 | 後端 `conversationText.js`、後台 `ChatBubble`／`Conversations.js`、App `app_models.dart` |
| WhatsApp 官方和掃碼都叫 `whatsapp`，只能從頻道的連線資料判斷是哪一種，而且這份資料不會送到前端 | `isWebChannel(channel)` |
| 後台聊天畫面約有 35 處直接判斷平台 | `MessageInput`、`Conversations`、`replyWindow`、`MessageFactory` |
| App 的對話頁有 1484 行，平台判斷和通話、消失訊息混在一起；通話、消失訊息、加密出現在客戶對話裡，但在那裡用不了 | `flutter/lib/pages/conversation_page.dart` |
| 後台即時訊息和 Chat Box 各寫一套聊天畫面 | `admin/src/components/Conversations`、`ChatManagement` |

## 設計

### 1. 來源

每個頻道有一個明確的來源類型，存在資料庫裡，篩選時可以直接查詢：

| 來源 | 平台（沿用） | 說明 |
|---|---|---|
| `messenger` | fb | Facebook 粉專 |
| `instagram` | ig | Instagram 商業帳號 |
| `whatsapp_cloud` | whatsapp | WhatsApp 官方（Cloud API） |
| `whatsapp_web` | whatsapp | WhatsApp 掃碼（whatsapp-gateway） |
| `line` | line | 之後接 |
| `masterbox` | — | 第二階段 Chat Box 使用 |

- `CompanyChannel` 加 `source` 欄位，migration 依現有資料補值：fb → messenger，ig → instagram，whatsapp 依 `accessInfo` 分成 cloud 或 web。
- 原本的 `platform` 欄位保留，舊版 App 和既有查詢照常可用。

### 2. 接入規格

每種來源一個檔案，放在 `backend/lib/connectors/<source>.js`，實作同一組方法：

| 方法 | 作用 |
|---|---|
| `capabilities(channel)` | 這個來源支援哪些加掛功能 |
| `replyRule(room)` | 回覆前的規則。Meta 是 24 小時期限、人工客服標籤、WhatsApp 範本；其他來源沒有 |
| `send(target, part)` | 把一則訊息送出去，回傳平台上的訊息 ID |
| `normalize(raw)` | 把平台傳來的訊息轉成統一格式 |
| `connection(channel)` | 連線狀態，搬自現在的 `channels.js` |

`prepareReply`、`replyTarget` 改成通用流程：

1. 檢查內容和附件
2. 查來源的回覆規則
3. 呼叫來源的 `send`

流程裡不再出現平台名稱。新增一種來源時，只要新增一個 connector 檔案。

### 3. 統一訊息格式

```js
{
  text: '你好',
  attachments: [{ type: 'image', url, filename, mime_type, size, caption }],
  template: { id, name },   // 只有 WhatsApp 範本訊息有
  // 第二階段起依需要增加：reply_to、reaction 等
}
```

- 新訊息一律存成這個格式。
- GraphQL 的 `Message` 新增 `body { text attachments template }`，由後端把新舊格式都轉好。後台和 App 只讀 `body`，不用再自己猜格式。
- 舊訊息不改資料，讀的時候才轉換。原本的 `contents` 繼續回傳，給舊版 App 用。

### 4. 功能清單

**基礎功能（固定都有）**
- 對話列表、未讀、搜尋、篩選、指派、標籤
- 客戶資訊、快速回覆
- 訊息泡泡、日期分隔、載入舊訊息、顯示附件、送出失敗重試
- 推播、即時更新、連線狀態
- 文字訊息

**加掛功能（由來源宣告）**

| 功能 | 第一階段的支援情況 |
|---|---|
| `send_image`、`send_video`、`send_audio`、`send_document` | 依現有的 `checkAttachment` 規則，各來源照實宣告 |
| `caption`（附件和文字一起送） | WhatsApp 官方、掃碼 |
| `reply_window`（24 小時期限） | Messenger、Instagram、WhatsApp 官方 |
| `templates`（訊息範本） | WhatsApp 官方 |
| `calls`、`disappearing`、`e2ee`、`groups` | 先列出來，第一階段沒有來源宣告支援，第二階段給 Chat Box 用 |
| `reactions`、`quote_reply`、`read_receipts`、`recall` | 先列出來，各平台是否支援要查證後再開 |

GraphQL 新增：

- `SubscribedChannel.source`、`SubscribedChannel.capabilities`
- `ChatRoom.source`、`ChatRoom.capabilities`

### 5. 共用聊天室

畫面照定稿的設計做：[聊天室樣式規劃](chat-room-design-plan.md)，以及 Figma「MasterBox」頁面的「聊天室 v1」三個區塊（共用原則、Admin Web、App）。第一階段先做跟即時訊息有關的部分：泡泡、輸入區、限制提示、來源標記、列表、空白和錯誤狀態、深色模式（App）。指派面板、內部備註、刪除、Chat Box 的畫面等功能上線時再照設計稿做。

**後台**：把 `Conversations`、`MessageInput`、`ChatBubble` 整理成一個聊天室元件。

- 輸入：對話、訊息、功能清單。
- 平台判斷全部改成檢查功能清單，例如 `capabilities.includes('templates')`，不再寫 `platform === 'whatsapp'`。
- 第一階段只有即時訊息使用，第二階段 Chat Box 改用同一個元件。

**App**：`conversation_page.dart` 拆成同樣的結構。

- 基礎部分：訊息列表、輸入框。
- 加掛部分依功能清單顯示：範本、24 小時提示、通話、消失訊息。
- 結果：客戶對話裡的通話、消失訊息和加密選項會消失，因為來源沒有宣告支援。這三項第二階段在 Chat Box 裡出現。

### 6. 預留分類需要的資料

- `ChatRoom` 加 `status` 欄位（`open`、`pending`、`closed`），預設 `open`。第一階段不做畫面。
- 來源類型（見第 1 點）。
- 標籤已經有了。

### 7. 順便完成

- 即時訊息的篩選從「平台」改成「來源」，WhatsApp 官方和掃碼可以分開篩選。
- 頻道下拉選單的副標題改成電話號碼或粉專名稱，不再顯示內部 ID。

## 不在第一階段

- Chat Box 的內部對話、chat-embed、對外 API：第二、第三階段。
- 對話狀態的畫面、標籤篩選、頻道分組：第四階段。
- LINE。
- `/chat-management` 頁面維持原樣，第二階段重做。

## 工作拆分

| 步驟 | 內容 | 依賴 |
|---|---|---|
| A. 後端 | 來源欄位和 migration、connector、統一訊息格式、功能清單和 GraphQL 欄位。畫面完全不變 | 無 |
| B. 後台 | 共用聊天室元件、改用功能清單和 `body`、來源篩選、頻道副標題 | A |
| C. App | 拆對話頁、改用功能清單和 `body`、來源篩選、頻道副標題 | A |

A 完成並推送後，B 和 C 可以分成兩個 session 同時做。

## 驗收

- 既有的後端、後台、App 測試全部通過，並補上新測試：
  - 每個 connector 的送出和格式轉換
  - 新舊訊息格式的轉換
  - 功能清單
  - migration 補值
- 舊版 App 的 GraphQL 操作照常可用（`flutterCompat.test.js`）。
- 實際操作：在後台和 App 對 Messenger、Instagram、WhatsApp 官方、WhatsApp 掃碼各收發一次文字和圖片；確認 WhatsApp 官方超過 24 小時只能用範本。

## 待決定

1. App 客戶對話裡的通話、消失訊息和加密選項，第一階段拿掉，第二階段移到 Chat Box。
2. 舊訊息讀的時候才轉換，不改資料庫裡的資料。
3. 來源在畫面上的名稱：Facebook、Instagram、WhatsApp 官方、WhatsApp 掃碼。
4. 對話狀態欄位先加，畫面第四階段才做。
