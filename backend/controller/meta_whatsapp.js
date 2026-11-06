import metaClient from '../api/metaClient.js';
import {masterBox_meta_Route, masterBox_Api_graphql} from '../api/masterBoxClient.js';

// Hold whatsapp message send by company
var wa_messages = []

// Webhook events and API responses prefix the same id differently.
export const whatsappMessageId = (id) => id.split('.')[1] || id


/**
 * 操作暫時存取的訊息陣列
 * @param {string} wamid - 列於 wamid 之後的 ID 
 * @param {object} message - 訊息物件
 * @param {string} mode - 操作模式, add, get, delete
 */
export const manage_wa_message = (wamid, message = {}, mode) => {
    switch(mode){
        case 'add':
        wa_messages.push({
            id: wamid,
            message: message
        })
        break
        case 'get':
        return wa_messages.find(id => id == wamid)
        case 'delete':
        let index = wa_messages.find(id => id == wamid)
        wa_messages.splice(index, 1)
        break
    }
}


/**
 * 處理 webhook 接收到的 whatsapp 訊息事件
 * @param {array} entry - 訊息物件的陣列
 */
export const whatsappWebhookMessages = async(entry) => {
    const results = []

    entry.forEach((data) => {
        data.changes.forEach(params => {
            // Status updates describe messages the company sent, which are stored when they are sent.
            if (params.field != "messages" || params.value.contacts === undefined || params.value.messages === undefined) return

            const contact = params.value.contacts[0]

            params.value.messages.forEach((msg) => {
                const content = {
                    id: whatsappMessageId(msg.id),
                    timestamp: msg.timestamp,
                }

                switch(msg.type){
                    case 'text':
                        content.message = msg.text
                    break;
                    case 'button':
                        content.message = msg.button
                    break;
                    case 'interactive':
                        content.message = { text: (msg.interactive?.button_reply || msg.interactive?.list_reply)?.title }
                    break;
                    // Media needs the channel's token to download, which happens when the message is stored.
                    // Without a media id (locations, contacts) the conversation shows what was sent instead.
                    default:
                        content.attachments = [{
                            type: msg.type, caption: msg[msg.type]?.caption, filename: msg[msg.type]?.filename,
                            media_id: msg[msg.type]?.id, mime_type: msg[msg.type]?.mime_type,
                        }]
                }

                results.push({
                    // Each customer's number is its own conversation.
                    chat_room_id: contact.wa_id,
                    content: content,
                    customer: { id: contact.wa_id, name: contact.profile?.name },
                    channel_id: params.value.metadata.phone_number_id,
                })
            })
        })
    })
    return results
}

/**
 * 找出 webhook 回報發送失敗的訊息。whatsapp 接受訊息後才判斷能否送達，例如超過 24 小時回覆期限
 * @param {array} entry - 訊息物件的陣列
 * @returns {array} 平台訊息 ID 與失敗原因
 */
export const whatsappFailedStatuses = (entry) => entry.flatMap((data) => data.changes.flatMap((params) =>
    (params.field == "messages" && params.value.statuses || [])
        .filter(({ status }) => status == 'failed')
        .map(({ id, errors }) => ({
            externalId: whatsappMessageId(id),
            error: errors?.[0],
        }))
))

/**
 * 查詢 whatsapp 商業帳號詳情
 * @param {*} res - 回應api呼叫的起始句
 * @param {string} whatsapp_business_account_id - 公司的 whatsapp 帳號 id
 * @param {string} access_token - user_access_token 
 */
export const getNumberDetail = (res, whatsapp_business_account_id, access_token) => {
    metaClient({
        endPoints: `${whatsapp_business_account_id}/phone_numbers`,
        method: 'GET',
        queryStrings: {
            'access_token': access_token
        }
    }).then((result) => {
        console.log('Whatsapp phone number:', JSON.parse(result))
        
        res.send(JSON.parse(result))
    })
}

/**
 * 從號碼ID查詢商業帳號的詳細資料
 * @param {*} res  - 回應api呼叫的起始句
 * @param {string} phone_number_id - whatsapp 號碼 ID
 * @param {string} access_token - user_access_token 
 */
export const getBusinessProfile = (res, phone_number_id, access_token) => {
    metaClient({
        endPoints: `${phone_number_id}/whatsapp_business_profile`,
        method: 'GET',
        queryStrings: {
            "access_token": access_token
        }
    }).then((r) => {
        console.log(r)

        res.send(r)
    })
}


/**
 * Whatsapp 發送訊息，失敗時丟出錯誤
 * @param {object} messageData - 訊息物件
 * @param {string} from - 公司的 whatsapp 號碼id
 * @param {string} access_token - user_access_token
 * @returns {object} Meta 的回應，messages[0].id 是訊息 ID
 */
export const sendWhatsappMessage = (messageData, from, access_token) => metaClient({
    endPoints: `${from}/messages`,
    method: 'POST',
    queryStrings: {
        'access_token': access_token,
    },
    payloads: messageData,
})


/**
 * Whatsapp 發送訊息
 * @param {*} res - 回應api呼叫的起始句
 * @param {object} messageData - 訊息物件 
 * @param {string} from - 公司的 whatsapp 號碼id
 * @param {string} access_token - user_access_token
 */
export const whatsappSendMessage = (res, messageData, from, access_token) => {
    sendWhatsappMessage(messageData, from, access_token).then((result) => {
        console.log('Whatsapp sendMessage', result)

        if(result.error !== undefined){
            console.log(result.error)
        }else{
            // keep message for a while
            manage_wa_message(
                result.messages[0].id.split('.')[1], 
                messageData, 'add'
            )           
        }

        res.send(result) 
    }).catch((error) => {
        console.log(error)
        res.status(error.statusCode || 500).send(error.responseBody || { error: { message: error.message } })
    })
}


/**
 * 建立訊息模板
 * @param {*} res - 回應api呼叫的起始句
 * @param {string} whatsapp_business_account_ID - 公司 whatsapp 帳號 ID
 * @param {object} templateData - 模板物件
 */
export const createMessageTemplate = (res, whatsapp_business_account_ID, templateData) => {
    metaClient({
        endPoints: `${whatsapp_business_account_ID}/message_templates`,
        method: "POST",
        queryStrings: templateData
    }).then((result) => {
        console.log('Template created:', result)

        res.send(JSON.parse(result))
    })
}


/**
 * 取得建立的訊息模板
 * @param {*} res - 回應api呼叫的起始句
 * @param {string} whatsapp_business_account_ID - 公司 whatsapp 帳號 ID
 * @param {object} params - 一次查詢的數量與 user_access_token
 */
export const getMessageTemplate = (res, whatsapp_business_account_ID, params) => {
    metaClient({
        endPoints: `${whatsapp_business_account_ID}/message_templates`,
        method: "GET",
        queryStrings: params
    }).then((result) => {
        console.log("Retrieve templates: ", result)

        res.send(JSON.parse(result))
    })
}

/**
 * 編輯訊息模板
 * @param {*} res - 回應api呼叫的起始句
 * @param {string} message_template_ID - 模板ID 
 * @param {object} templateData - 原始或是修改後的模板物件
 */
export const editMessageTemplate = (res, message_template_ID, templateData) => {
    metaClient({
        endPoints: message_template_ID,
        method: "POST",
        queryStrings: templateData
    }).then((result) => {
        console.log("Template edited: ", result)

        res.send(result) // Return with boolean
    })
}


/**
 * 刪除訊息模板
 * @param {*} res - 回應api呼叫的起始句
 * @param {string} whatsapp_business_account_ID - 公司 whatsapp 帳號 ID
 * @param {object} params - 模板名稱與 user_access_token 
 */
export const deleteMessageTemplate = (res, whatsapp_business_account_ID, params) => {
    metaClient({
        endPoints: `${whatsapp_business_account_ID}/message_templates`,
        method: "DELETE",
        queryStrings: params
    }).then((result) => {
        console.log("Template deleted: ", result)

        res.send(result) // Return with boolean
    })
}