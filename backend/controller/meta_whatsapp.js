import metaClient from '../api/metaClient.js';
import {masterBox_meta_Route, masterBox_Api_graphql} from '../api/masterBoxClient.js';

// Hold whatsapp message send by company
var wa_messages = []


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
    let chat_room_id = '', senderwaid = '', recipient_id = '', content = {}, result = {}

    entry.forEach((data) => {
        data.changes.forEach(params => {
            console.log(params)

            // 公司主動寄出時收到的訊息
            if(params.value.statuses !== undefined){
                params.value.statuses.forEach((status) => {
                    console.log(status)    

                    if(status.status == 'sent' || status.status == 'deliverd'){
                        chat_room_id = status.conversation.id
                        senderwaid = params.value.metadata.phone_number_id
                        recipient_id = status.recipient_id
                        content = {
                            id: status.id.split('.')[1],
                            timestamp: status.timestamp,
                            message: manage_wa_message(status.id.split('.')[1], 'get')
                        }

                        // appendMessage(chat_room_id, 'whatsapp', content, senderwaid, senderwaid)
                        result = { 
                            chat_room_id: chat_room_id,
                            content: content,
                            info_Content: senderwaid,
                            channel_id: senderwaid
                         }
                    }

                    // 如果出錯
                    if(status.errors !== undefined){
                        status.errors.data.forEach(error => {
                            // let code = error.code

                            res.status(404).send(error.details)
                        })                                 
                    }
                })
                
            }

            // 被動接收公司客戶傳來的訊息
            if (params.field == "messages") {
                if(params.value.contacts !== undefined){
                    chat_room_id = data.id
                    
                    params.value.contacts.forEach((contact) => {
                        console.log('contact', contact)

                        senderwaid = contact
                    })

                    params.value.messages.forEach((msg) => {
                        console.log('message', msg)

                        recipient_id = params.value.metadata.phone_number_id
                        content = {
                            id: msg.id.split('.')[1],
                            timestamp: msg.timestamp,
                        }

                        switch(msg.type){
                            case 'text':
                                content.message = msg.text
                            break;
                            case 'image':
                                content.message = msg.image_url
                            break;
                            case 'sticker':
                                content.message = msg.sticker
                            break;
                            case 'button':
                                content.message = msg.button
                            break;
                            case 'order':
                                content.message = msg.order
                            break;
                            case 'unkonwn':
                                content.message = msg.errors
                            break;
                            default:
                            if(msg.contacts !== undefined){
                                content.message = msg.contacts
                            }

                            if(msg.location !== undefined){
                                content.message = msg.location
                            }
                        }
                    })
                    
                    // appendMessage(chat_room_id, 'whatsapp', content, senderwaid, params.value.metadata.phone_number_id)
                    result = { 
                        chat_room_id: chat_room_id,
                        content: content,
                        info_Content: senderwaid,
                        channel_id: params.value.metadata.phone_number_id
                     }
                }
            }
        })
    })
    return result
}

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
 * Whatsapp 發送訊息
 * @param {*} res - 回應api呼叫的起始句
 * @param {object} messageData - 訊息物件 
 * @param {string} from - 公司的 whatsapp 號碼id
 * @param {string} access_token - user_access_token
 */
export const whatsappSendMessage = (res, messageData, from, access_token) => {
    metaClient({
        endPoints: `${from}/messages`,
        method: 'POST',
        queryStrings: {
            'access_token': access_token,
        },
        payloads: messageData,
    }).then((result) => {
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