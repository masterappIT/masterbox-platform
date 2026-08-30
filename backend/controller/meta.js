import metaClient from '../api/metaClient.js';
import {masterBox_meta_Route, masterBox_Api_graphql} from '../api/masterBoxClient.js';
import { sortChannelSchema, findChannelToken } from '../utils/utils.js';

// facebook
import { getUserAccessToken, getDebugToken,
    getUserLongLivedToken, getFacebookUserId,
    getMetaSenderInfo, getFacebookPageToken,
    getPageFollowers, getMetaConversations,
    getConversationMessages, getMessage,
    getAttachment, metaSendMessage,
    appSubscribePage } from './meta_facebook.js'

// whatsapp
import { getNumberDetail, getBusinessProfile, 
    whatsappSendMessage, manage_wa_message,
    createMessageTemplate, getMessageTemplate,
    editMessageTemplate, deleteMessageTemplate,
    whatsappWebhookMessages } from './meta_whatsapp.js';
import fs from 'node:fs'


/**
 * 檢查附件檔案大小
 * @param {string} file - 檔案名稱 
 * @returns {boolean} true or false
 */
const checkFileSize = (file) => {
    let fileStatus = fs.statSync(file)
    if((fileStatus / (1024 * 1000)) > 25){
        return true
    }else{
        return false
    }
}

/**
 * 根據收到訊息決定回復方式
 * @param receivedMessage object, 顧客的訊息物件
 */
const handleMessage = (receivedMessage) => {
    let response;
    console.log(receivedMessage)
    // Checks if the message contains text
    if (receivedMessage.text) {
        // Create the payload for a basic text message, which
        // will be added to the body of your request to the Send API
        response = {
            'text': `You sent the message: '${receivedMessage.text}'. Now send me an attachment!`
        };
    } else if (receivedMessage.attachments) {

        // Get the URL of the message attachment
        let attachmentUrl = receivedMessage.attachments[0].payload.url;
        console.log('attachmentUrl', attachmentUrl)
        response = {
            'attachment': {
                'type': 'template',
                'payload': {
                    'template_type': 'generic',
                    'elements': [{
                        'title': 'Is this the right picture?',
                        'subtitle': 'Tap a button to answer.',
                        'image_url': attachmentUrl,
                        'buttons': [
                            {
                                'type': 'postback',
                                'title': 'Yes!',
                                'payload': 'yes',
                            },
                            {
                                'type': 'postback',
                                'title': 'No!',
                                'payload': 'no',
                            }
                        ],
                    }]
                }
            }
        };
    }

    // Send the response message
    return response;
}

/**
 * 處理顧客回應
 * @param receivedPostback object, 顧客回應的訊息物件
 */
const handlePostback = (receivedPostback) => {
    let response;
    console.log(receivedPostback)
    // Get the payload for the postback
    let payload = receivedPostback.payload;

    // Set the response based on the postback payload
    if (payload === 'yes') {
        response = { 'text': 'Thanks!' };
    } else if (payload === 'no') {
        response = { 'text': 'Oops, try sending another image.' };
    }
    // Send the message to acknowledge the postback
    return response;
}


/** 呼叫聊天機器人
 * @param recipient_id string, 收件人id，這裡做為發送方
 * @param messageRes object 用於回應的訊息物件
 * @param access_token string, 該粉絲頁的access_token 
 */
const chatBotResponse = (recipient_id, messageRes, access_token) => {

    metaClient({
        endPoints: `${recipient_id}/messages`,
        method: "POST",
        queryStrings: { "access_token": access_token },
        payloads: messageRes
    }).then((result) => {
        console.log('message sent!', result)
    })
}

// Check if property exist then call chatbot
/** 過濾訊息類型
 * @param webhookEvent object, 訊息物件
 * @param recipient_id string, 收件人id，這裡做為發送方
 * @param senderPsid string 寄件人id, 這裡做為接收方
 * @param access_token string, 該粉絲頁的access_token 
 */
const filterMessage = (webhookEvent, recipient_id, senderPsid, access_token) => {
    let messageRes = {};
    if (webhookEvent.message) {
        messageRes = handleMessage(senderPsid, webhookEvent.message);
        chatBotResponse(messageRes, recipient_id, senderPsid, access_token) 
    }
    
    if (webhookEvent.postback) {
        messageRes = handlePostback(senderPsid, webhookEvent.postback);
        chatBotResponse(messageRes, recipient_id, senderPsid, access_token) 
    }

    //... more rules here
}


/**
 * 尋找該訊息的聊天室id
 * @param page_id 粉絲頁id, string
 * @param object 訊息物件類型， string
 * @param message_id 訊息id
 * @param access_token 該粉絲頁的 access_token, string
 */

const chat_room_id = async(page_id, object, message_id, access_token) => {
    // console.log(page_id, object, message_id, access_token)

    return new Promise((resolve, reject) => {
        masterBox_meta_Route({
            endPoints: 'getConversations',
            method: 'GET',
            queryStrings: {
                "page_id": page_id,
                "platform": (object == 'page')? "messenger": 'instagram'
            },
            headers: { "authorization": `Bearer ${access_token}` }
        }).then((r) => {
            // console.log('return from route', JSON.parse(r))
            let result = JSON.parse(r)
            
            if(result.data !== undefined){
                result.data.forEach(conversations => {
                    conversations.messages.data.forEach(m => {
                        if(message_id == m.id){
                            resolve(conversations.id)
                        }
                    })
                })                
            }else{
                // console.log('return from route', result.error)
                reject(result)
            }
        }).catch((err) => {
            // console.log('request_error', err)
            reject(err)
        })      
    }).catch((err) => {
        console.log('promise_error', err)
    })  

}

/**
 * 推入新的聊天室訊息到資料庫
 * @param {string} to_chat_room_id - 聊天室ID
 * @param {string} platform - 平台名稱
 * @param {object} contents - 訊息內容
 * @param {object} info_Content - 寄件人詳情 
 * @param {string} channel_id - 頻道/粉絲頁 ID
 */
const appendMessage = (to_chat_room_id, platform, contents, info_Content, channel_id) => {
    let query = `mutation ($MessageInput: MessageInput) {
        receivedMessageFromWebhook(MessageInput: $MessageInput) {
            to_chat_room_id, contents, platform, info_Content, channel_id
            }
    }`

    masterBox_Api_graphql({
        endPoints: '',
        method: 'POST',
        body: JSON.stringify({
            query, variables: {
                MessageInput: {
                    to_chat_room_id: to_chat_room_id,
                    contents: JSON.stringify(contents), 
                    platform: (platform == 'page')? 'fb': platform, 
                    info_Content: JSON.stringify(info_Content),
                    channel_id: channel_id
                }
            }
        })
    }).then((r) => {
        console.log('Pushed to graphql:', r)

        if(platform.includes('whatsapp')){
            // delete object in wa_message
            let message = manage_wa_message(contents.id, 'get')
            if(message !== undefined){
                manage_wa_message(contents.id, 'delete')
            }
        }
    })
}

/**
 * 從收到的訊息取出需要的資料
 * @param res repond, 用於回復FB 
 * @param body object, 訊息物件，用於判斷來源
 */

const webhookMessage = (res, body) => {
  /**
   * TODO - call our graphql resolver to save the message and publish to our users as well.
   */

    // If not respond immediately, facebook will call the webhook once more thus begin the multiple event 
    res.sendStatus(200)

    // Iterates over each entry - there may be multiple if batched
    body.entry.forEach( async function (data) {
        // Gets the body of the webhook event
        let webhookEvent = data.messaging[0];
        console.log(webhookEvent);
        // Get the sender PSID
        let chatters = [webhookEvent.sender.id, webhookEvent.recipient.id]
        let chaterIndex = 0 
        let message_id = webhookEvent.message.mid
        let page_id = ''

        console.log('Sender PSID: ' + webhookEvent.sender.id);

        /** page_access_token  */
        let access_token = ''
        if(body.object == 'instagram'){
            // Findout who is the company
            
            for(let i=0; i < chatters.length; i++){
                let result = await findChannelToken(chatters[i], 'instagram')

                console.log('result returned', result)

                if(result !== null){
                    access_token = result.access_token; chaterIndex = i;
                    page_id = result.channel_id
                    break;
                }
            }

        }else{
           access_token = await findChannelToken(webhookEvent.recipient.id, 'page')
           page_id = webhookEvent.recipient.id
        }
        console.log('page_access_token:', access_token)

        console.log('chatter', chatters[chaterIndex])

        let cid = await chat_room_id(page_id, body.object, message_id, access_token)

        console.log('chat room id:', cid)

        //get sender's infomation
        let sender
        if(body.object == 'page'){
            sender = await getMetaSenderInfo(webhookEvent.sender.id, access_token)
        }else{
            sender = await masterBox_meta_Route({
                endPoints: 'getInstagramAccount',
                method: 'POST',
                payloads: { 'page_id': page_id },
                headers: { "authorization": `Bearer ${access_token}` }
            })
        }
        console.log('sender', sender)


        //Check if sender followed the page or not


        // if chatbot is set
        //filterMessage(webhookEvent, recipient_id, senderPsid, access_token)

        //Save infomations to database
        if(cid !== undefined && sender !== undefined){
            appendMessage(
                cid, 
                (body.object == 'instagram')? 'ig' : 'fb', 
                webhookEvent.message, sender, 
                (body.object == 'instagram')?
                chatters[chaterIndex] : webhookEvent.recipient.id
            )            
        }
    });
}

export default {
    /**
     * meta 各平台 webhook 回應網址設定
     */
    webhookConnect: async (req, res, next) => {
        const VERIFY_TOKEN = process.env.VERIFY_TOKEN;
        console.log('req.body', req.body)
        // Parse the query params
        let mode = req.query['hub.mode'];
        let token = req.query['hub.verify_token'];
        let challenge = req.query['hub.challenge'];

        // Checks if a token and mode is in the query string of the request
        if (mode && token) {

            // Checks the mode and token sent is correct
            if (mode === 'subscribe' && token === VERIFY_TOKEN) {

                // Responds with the challenge token from the request
                console.log('WEBHOOK_VERIFIED');
                res.status(200).send(challenge);

            } else {
                // Responds with '403 Forbidden' if verify tokens do not match
                res.sendStatus(403);
            }
        }
    },


/**
 * messenger, instagram direct message, whatsapp 訊息接收
 */
    webhookEvent: async (req, res, next) => {
        let body = req.body;
        const { entry, object } = body
        console.log('req.body', req.body)
        // console.log('entry', object)
        // Checks if this is an event from a page subscription
        if (object === 'page' || object == 'instagram') {
            webhookMessage(res, body)    
        }else

        if (object === 'whatsapp_business_account') {
            /**
             * @return {array} message - 
             * messaging_product: 'whatsapp',
                metadata: { display_phone_number: '16505551111', phone_number_id: '123456123' },
                contacts: [ { profile: [Object], wa_id: '16315551181' } ],
                messages: [
                 {
                 from: '16315551181',
                 id: 'ABGGFlA5Fpa',
                timestamp: '1504902988',
                type: 'text',
                text: [Object]
                }
                ]
             */    

            res.sendStatus(200)

            let whatsappMessages = await whatsappWebhookMessages(entry)

            console.log(whatsappMessages)
            if(Object.keys(whatsappMessages).length > 0){
                appendMessage(
                    whatsappMessages.chat_room_id,
                    'whatsapp',
                    whatsappMessages.content,
                    whatsappMessages.info_Content,
                    whatsappMessages.channel_id
                )
            }
        }else {

            // Returns a '404 Not Found' if event is not from a page subscription
            res.sendStatus(404);
        }
    },

    /**
     * FaceBook 登入
     */
    login: (req, res, next) => {
        //https://developers.facebook.com/docs/permissions/reference
        //whatsapp_business_management whatsapp_business_messaging
        
        // const { account_id } = req.body

        // let _ = "630c766d1c270a272c6e9528"

        /**
         * 給前端導向FB登入，回傳網址填masterBox
         * masterBox 取得回傳的code， 發給後端換 user_access_token
         */

        try {
            const permissions =
                'pages_messaging,business_management,whatsapp_business_management,whatsapp_business_messaging,pages_show_list,public_profile,pages_manage_metadata,instagram_basic,instagram_manage_messages,leads_retrieval'
            
            // whatsapp_business_management permission seems to be granted when extras is not included    
            // const extras = { feature: 'whatsapp_embedded_signup' }
            //&extras=${JSON.stringify(extras)}
            res.redirect(`https://www.facebook.com/dialog/oauth?response_type=code&display=popup&client_id=${process.env.FB_APP_ID}&redirect_uri=${process.env.BASE_URL}/meta/getToken&scope=${permissions}`);
        } catch (error) {
            return res.sendStatus(500)
        }
    },

    /**
     * 取得使用者的 access_token
     * @param code string, 登入FB取得的字串，用於換取 user_access_token
     */
    getToken: (req, res, next) => {
        const code = req.query.code
        console.log('code', code)
        // const _ = req.query._
        /**
         * TODO - call our graphql 
         */

        try {
            getUserAccessToken(code)
            .then((result) => {
                console.log('access_token:', result)
                let body = JSON.parse(result)
                req.headers['authorization'] = `Bearer ${body.access_token}`  
                next()
            })
        } catch (error) {
            console.log(error)
            res.status(500).send(error)
        }
    },

    /**
     * 使用存取權杖取得共享的 WABA 編號
     * @param {string} access_token - Facebook 登入換取的 user_access_token
     */
    getDebugToken: (req, res, next) => {
        // console.log(req.headers.authorization)
        const access_token = req.headers.authorization?.split('Bearer ')[1]
        // console.log(access_token)

        try {
            getDebugToken(req, access_token, next)
        } catch (error) {
            console.log(error)
            res.status(500).send(error)
        }
    },

    getWhatsappBusinessAccountInfo: (req, res, next) => {
        const whatsappID = req.body.whatsappID
        const access_token = req.headers['authorization']?.split('Bearer ')[1]

        metaClient({
            endPoints: whatsappID,
            method: 'GET',
            queryStrings: {
                "fields": "id, account_review_status, currency, message_template_namespace, name, timezone_id",
                "access_token": access_token
            }
        }).then((r) => {
            console.log('account infomation:', JSON.parse(r))
            res.send(JSON.parse(r))
        })
    },

    getUserLongLivedToken: (req, res, next) => {
        const access_token = req.headers['authorization']?.split('Bearer ')[1]

        try {
            getUserLongLivedToken(res, access_token)
        } catch (error) {
            console.log(error)
            res.status(500).send(error)
        }
    },

    /**
     * 取得使用者id
     * @param access_token string, 使用者的 access_token
     */
    getUserId: (req, res, next) => {
        const whatsappAccounts = req.query.whatsappAccounts
        const access_token = req.headers['authorization']?.split('Bearer ')[1]

        try {
            getFacebookUserId(req, access_token, whatsappAccounts, next)
        } catch (error) {
            console.log(error)
            res.status(500).send(error)
        }
    },

    /**
     * 找出與該粉絲專業連動的 Instagram 帳號
     * @param page_id string, 粉絲頁id
     * @param access_token string, 粉絲頁的 access_token
     */
    getInstagramBusinessAccount: (req, res, next) => {
        const page_id = req.body.page_id
        // console.log('getInstagramBusinessAccount:', req.headers)
        const access_token = req.headers['authorization']?.split('Bearer ')[1]
        metaClient({
            endPoints: `${page_id}`,
            method: "GET",
            queryStrings: {
                "fields": "connected_instagram_account",
                "access_token": access_token // FB pageToken
            }
        }).then((result) => {
            console.log('Connected Instagram account:', JSON.parse(result));
            const body = JSON.parse(result)
            if(body.connected_instagram_account !== undefined){
                req.body.instagram_id = body.connected_instagram_account.id
                req.headers['authorization'] = `Bearer ${access_token}`
                // return res.json(_res.body)
                next()                
            }else{
                res.send({})
            }
        })
    },
    
    /**
     * 取的 Instagram 帳號的基本資料
     * @param instagram_id string, Instagram 帳號id
     * @param access_token string, 粉絲頁的 access_token
     */
    getInstagramAccountBasicInfo: (req, res, next) => {
        const instagram_id = req.body.instagram_id
        const access_token = req.headers['authorization'].split('Bearer ')[1]
        metaClient({
            endPoints: instagram_id,
            method: "GET",
            queryStrings: {
                "fields": "biography,followers_count,follows_count,media_count,name,profile_picture_url,username,website",
                "access_token": access_token // FB pageToken
            }
        }).then((result) => {
            console.log('Instagram account profile:', JSON.parse(result))

            res.send(JSON.parse(result))
        })
    },

    //token will keep live if the user is not call any api request in 60 days , otherwise  will keep live
    /**
     * 找出當前帳號所有的粉絲專頁
     * @param user_id string, 使用者id
     * @param access_token string, 使用者的 access_token
     */
    getPageToken: (req, res, next) => {
        //from getUserLongLivedToken function
        const { user_id, whatsappAccounts } = req.query;
        const access_token = req.headers['authorization'].split('Bearer ')[1]
        try {
            getFacebookPageToken(res, user_id, access_token, whatsappAccounts)
        } catch (error) {
            console.log(error)
            res.status(500).send(error)
        }
    },

    /**
     * 查詢粉絲頁的粉絲數量
     * @param {string} page_id - 粉絲頁的id 
     * @param {string} access_token - 粉絲頁的 access_token
     */
    getPageFollowers: (req, res, next) => {
        const page_id = req.query.page_id
        const access_token = req.headers['authorization'].split('Bearer ')[1]
        
        try{
            getPageFollowers(res, page_id, access_token)
        }catch(error){
            console.log(error)
            res.status(500).send(error)
        }
    },
    
    //List of Conversations
    /**
     * 查詢粉絲頁的聊天訊息
     * @param page_id string, 粉絲頁id
     * @param platform string, 訊息收發平台
     * @param access_token string, 粉絲頁的 access_token
     * @param user_id stirng, 粉絲頁讀者id, 非必填
     */
    getConversationsList: async(req, res, next) => {
        //from getUserLongLivedToken function
        const { page_id, platform, user_id } = req.query;
        const access_token = req.headers['authorization']?.split('Bearer ')[1]

        try {
            getMetaConversations(res, page_id, platform, access_token)
        } catch (error) {
            console.log(error)
            res.status(500).send(error)
        }
    },

    //recent 20 messages of a conversation
    /**
     * 查詢聊天室的對話訊息
     * @param conversation_id string, 聊天室id 
     * @param access_token string, 粉絲頁的 access_token
     */
    getConversationMessages: (req, res, next) => {
        const conversation_id = req.query.conversation_id;
        const access_token = req.headers['authorization'].split('Bearer ')[1]
        try {
            getConversationMessages(res, conversation_id, access_token)
        } catch (error) {
            console.log(error)
            res.status(500).send(error)
        }
    },

    /**
     * 查詢訊息內容
     * @param message_id string, 訊息id
     * @param access_token string, 粉絲頁的 access_token
     */
    getMessage: (req, res, next) => {
        const message_id = req.query.message_id;
        const access_token = req.headers['authorization']?.split('Bearer ')[1]
        // /shares 分享的項目，包含連結、相片、影片、貼圖和產品。
        // /attachments 訊息附加的檔案。
        // 'fields': 'id,created_time,from,to,message,file_url'
        try {
            getMessage(res, message_id, access_token)
        } catch (error) {
            console.log(error)
            res.status(500).send(error)
        }
    },

    /**
     * 取得訊息附件
     * @param message_id string, 訊息id
     * @param access_token string, 粉絲頁的 access_token
     */
    getAttachment: (req, res, next) => {
        const message_id = req.query.message_id
        const access_token = req.headers['authorization']?.split('Bearer ')[1]
        
        try{
            getAttachment(res, message_id, access_token)
        }catch(error){
            console.log(error)
            res.status(500).send(error)
        }
    },

    // Send text/template message or attachment
    /**
     * Messenger 發送訊息
     * @param content - object, 要發送的訊息物件
     * @param page_id - string, channel_id / 公司粉絲頁id
     * @param platform - string, 平台名稱，由masterBox紀錄
     * @param to_chat_room_id - string, 平台生成的聊天室id
     * @param access_token - string, 粉絲頁的 access_token
     */
    messenger: (req, res, next) => {
        const { content, page_id, platform, to_chat_room_id } = req.body
        const access_token = req.headers['authorization']?.split('Bearer ')[1]
        
        try{
            metaSendMessage(res, page_id, content, platform, to_chat_room_id, access_token)
        }catch(error){
            console.log(error)
            res.status(500).send(error)
        }
    },

    // subScribeButtonMessage: (req, res, next) => {
    //     const { page_id, access_token } = req.body

    //     const subscribeButton = {
    //         "recipient":{
    //           "id":"<PSID>"
    //         },
    //         "message":{
    //           "attachment":{
    //             "type":"template",
    //             "payload":{
    //               "template_type":"button",
    //               "text":"點我開始訂閱",
    //               "buttons":[
    //                 {
    //                   "type":"postback",
    //                   "title":"Visit Messenger",
    //                   "payload": 
    //                 }
    //               ]
    //             }
    //           }
    //         }
    //       }
    // },

    /**
     * 取得 whatsapp 號碼
     * @param {string} whatsapp_business_account_id - 公司的 whatsapp 帳號 id
     * @param {string} access_token - user_access_token 
     */
    getWhatsappNumberDetails: (req, res, next) => {
        const { whatsapp_business_account_id } = req.query;
        const access_token = req.headers['authorization'].split('Bearer ')[1]
        console.log('whatsapp_business_account_id', whatsapp_business_account_id)
        /**
         * access_token=system-user-access-token
         * data"data": [{
         "verified_name": "Jasper's Market",
        "display_phone_number": "+1 631-555-5555",
        "id": "1906385232743451",
        "quality_rating": "GREEN" }]
         */
        try {
            getNumberDetail(res, whatsapp_business_account_id, access_token)
        } catch (error) {
            console.log(error)
            res.status(500).send(error)
        }
    },

    /**
     * Whatsapp 發送訊息
     * @param {object} messageData - 欲發送的訊息物件
     * @param {string} from - 公司的 whatsapp 號碼id
     * @param {string} access_token - user_access_token
     */
    sendMessage: (req, res, next) => {
        const { messageData, from } = req.body;
        const access_token = req.headers?.['authorization'].split('Bearer ')[1]
        try {
            whatsappSendMessage(res, messageData, from, access_token)
        } catch (error) {
            console.log(error)
            res.status(500).send(error)
        }
    },

    /**
     * 建立 whatsapp 訊息模板
     * @param whatsapp_business_account_ID string, 公司的 whatsapp 帳號 id
     * @param templateData object, 欲建立的模板物件與 user_access_token
     */
    createTemplate: (req, res, next) => {
        const { whatsapp_business_account_ID, templateData } = req.body
        
        try{
            createMessageTemplate(res, whatsapp_business_account_ID, templateData)
        }catch(error) {
            console.log(error)
            res.status(500).send(error)
        }
    },

    /**
     * 查詢模板
     * @param whatsapp_business_account_ID string, 公司的 whatsapp 帳號 id
     * @param params object, 一次查詢的數量與 user_access_token
     */
    getTemplate: (req, res, next) => {
        const { whatsapp_business_account_ID, params } = req.body

        try{
            getMessageTemplate(res, whatsapp_business_account_ID, params)
        }catch (error){
            console.log(error)
            res.status(500).send(error)
        }
    },


    /**
     * 編輯 whatsapp 訊息模板，2022年9月7號才開放
     * @param message_template_ID string, 模板id
     * @param templateData object, 原始或是編輯過後的模板物件與 user_access_token
     */
    editTemplate: (req, res, next) => {
        const { message_template_ID, templateData } = req.body

        try{
            editMessageTemplate(res, message_template_ID, templateData)
        }catch (error){
            console.log(error)
            res.status(500).send(error)
        }
    },

    /**
     * 刪除 whatsapp 訊息模板, 使用 user_access_token
     * @param whatsapp_business_account_ID string, 公司的 whatsapp 帳號 id
     * @param params object, 模板名稱與使用者的 access_token
     */
    deleteTemplate: (req, res, next) => {
        const { whatsapp_business_account_ID, params } = req.query

        try{
            deleteMessageTemplate(res, whatsapp_business_account_ID, params)
        }catch (error){
            console.error('error', error);
            res.status(500).send(error);
        }
    },

    /**
     * 連結 masterBox 訂閱公司的粉絲頁 / whatapp商業帳號訊息
     * @param page_id string, 公司粉絲頁id / whatapp商業帳號ID
     * @param access_token string, 粉絲頁的 access_token / user_access_token
     */
    subscriptFBpage: (req, res, next) => {
        const page_id = req.body.page_id
        const access_token = req.headers['authorization']?.split('Bearer ')[1]
        
        try{
            appSubscribePage(page_id, access_token, res)
        }catch(error){
            console.log(error)
            res.status(500).send(error)
        }
    },

    /**
     * 解除 masterBox 與粉絲專業的連結
     * @param page_id string, 公司粉絲頁id
     * @param access_token string, 粉絲頁的 access_token
     */
    unsubscribeFBpage: (req, res, next) => {
        const page_id = req.body.page_id
        const access_token = req.headers['authorization'].split('Bearer ')[1]
        metaClient({
            endPoints: `${page_id}/subscribed_apps`,
            method: "DELETE",
            queryStrings: { "access_token": access_token }
        }).then((result) => {
            console.log('Page unsubscripted:', result)

            res.send(JSON.parse(result))
        })
    },
}