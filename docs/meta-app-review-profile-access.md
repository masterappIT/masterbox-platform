# Meta 應用程式審查：Business Asset User Profile Access（進階存取）

MasterBox（App ID `1799599357757765`）目前只有這個功能的標準存取權限，所以讀不到一般客戶的大頭照。這份文件是申請進階存取時要貼上的內容和錄影步驟。

## 送出前要確認的事

- **商家驗證：** IM MASTER INC. LIMITED 要先通過商家驗證，否則不能申請進階存取。
- **隱私權政策：** `https://masterbox.masterappinc.com/privacy.html`，已經寫明會收集客戶的名稱和大頭照。
- **資料刪除說明：** `https://masterbox.masterappinc.com/data-deletion.html`
- **服務條款：** `https://masterbox.masterappinc.com/terms.html`
- **App 圖示和類別：** 在「應用程式設定 → 基本資料」填好，缺少的話審查會被退回。
- **審查用帳號：** 在後台另外開一個帳號給審查員用，不要給自己的帳號。這個帳號要分配到已串接的 Facebook 專頁頻道。
- **錄影前先讓頭像出現：** 現在只有在 App 裡有角色的人才查得到頭像。錄影前，先用一個有 App 角色（管理員、開發人員或測試人員）的 Facebook 帳號傳一則訊息給專頁，收件匣才會顯示這位客戶的頭像。

## 送出的位置

Meta 開發者後台 → MasterBox → 應用程式審查 → 權限和功能 → **Business Asset User Profile Access** → 要求進階存取。

## 用途說明（貼到「說明你的應用程式如何使用此功能」）

> MasterBox is a shared inbox for businesses. A business connects its Facebook Page and Instagram account, and its customer service team reads and replies to customer messages in one place.
>
> When a customer sends a message to the connected Page, MasterBox uses the Business Asset User Profile Access feature to read that customer's first name, last name and profile picture with the Page access token and the customer's page-scoped ID. We only request these fields for people who have messaged the business's own Page.
>
> The name and picture are shown in the conversation list and at the top of the conversation, so agents can tell customers apart and address them by name instead of seeing a numeric ID. Without this feature, every conversation shows only an ID, and agents cannot tell which customer they are replying to.
>
> We store the name and picture with the conversation in the business's own workspace. Only that business's team members can see them. We do not use the data for advertising, do not share it with third parties, and do not combine it across businesses. Picture links expire, so we refresh them when the customer sends a new message. Businesses can delete conversations, and customers can request deletion as described at https://masterbox.masterappinc.com/data-deletion.html.

中文對照（不用貼，給你核對內容）：MasterBox 是商家的共用收件匣。客戶傳訊息到已串接的專頁時，用專頁存取權杖和客戶的專頁範圍 ID，讀取客戶的名字、姓氏和大頭照，只查傳訊息給該商家專頁的人。名稱和頭像顯示在對話列表和對話頂部，讓客服分得出是誰，不必看數字 ID。資料只存在該商家的工作區，只有該商家的成員看得到，不用於廣告、不分享給第三方、不跨商家合併。頭像連結會過期，所以客戶傳新訊息時會更新。刪除方式見資料刪除頁。

## 錄影步驟（螢幕錄影，1 到 2 分鐘）

Meta 要看到功能實際被使用的畫面。錄影時介面請用英文；如果後台沒有英文介面，就在畫面上加英文字幕說明每一步。

1. 打開 `https://admin.masterbox.masterappinc.com/`，用審查用帳號登入。
2. 到「頻道管理」，畫面顯示已串接的 Facebook 專頁。
3. 換到手機或另一個瀏覽器，用有 App 角色的 Facebook 帳號從 Messenger 傳一則訊息給專頁。
4. 回到後台的收件匣，畫面顯示新對話出現，列表上有這位客戶的**名字和大頭照**。
5. 點開對話，畫面顯示對話頂部同樣有名字和大頭照。
6. 在後台回覆一則訊息，再到 Messenger 畫面顯示客戶收到回覆。

## 給審查員的測試說明（貼到「測試說明」）

> 1. Go to https://admin.masterbox.masterappinc.com/ and sign in with the test account below.
> 2. Open the inbox. Each conversation shows the customer's name and profile picture, which come from the Business Asset User Profile Access feature.
> 3. To see it with a new customer, send a message to the Facebook Page "<專頁名稱>" from Messenger. The conversation appears in the inbox within a few seconds with your name and profile picture.
>
> Test account: <審查用帳號的 email>
> Password: <在送出時填入，不要寫在這份文件裡>

## 通過之後

- **程式碼：** 不需要改程式碼。客戶傳下一則訊息時，頭像會自動補上；重新串接頻道也會補上已匯入對話的頭像。
- **Instagram：** 如果也要顯示 Instagram 客戶的頭像，同樣需要 Instagram 訊息相關權限的進階存取，可以和這個一起送出審查。
