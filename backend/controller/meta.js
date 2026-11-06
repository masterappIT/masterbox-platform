import metaClient from '../api/metaClient.js';
import { createHmac, timingSafeEqual } from 'node:crypto';
import jwt from 'jsonwebtoken';
import { getJwtSecret } from '../lib/auth/jwtSecret.js';
import { prisma } from '../lib/db/prisma.js';
import { sortChannelSchema, findChannelToken, saveInboundMessage, saveConversationHistory, markMessageFailed, metaFailureReason } from '../utils/utils.js';

// facebook
import { getUserAccessToken, getDebugToken,
    getUserLongLivedToken, getFacebookUserId,
    getMetaSenderInfo, getFacebookPageToken,
    getPageFollowers, getMetaConversations,
    getConversationMessages, getMessage,
    getAttachment, metaSendMessage,
    appSubscribePage, collectMetaChannels,
    getInstagramSenderInfo, messengerCustomer, instagramCustomer,
    getRecentConversations, historyAttachments } from './meta_facebook.js'

// whatsapp
import { getNumberDetail, getBusinessProfile, 
    whatsappSendMessage, manage_wa_message,
    createMessageTemplate, getMessageTemplate,
    editMessageTemplate, deleteMessageTemplate,
    whatsappWebhookMessages, whatsappFailedStatuses } from './meta_whatsapp.js';
import fs from 'node:fs'


// Separate from the login secret, so a connect link can never be used as an access token or vice versa.
const connectStateSecret = () => `${getJwtSecret()}:meta-connect`

/**
 * 建立串接 Meta 頻道的網址，登入狀態由簽章過的 state 帶過 Meta 授權頁
 * @param {object} account - 發起串接的帳號
 * @param {string} return_url - 串接完成後回到的後台頁面
 * @returns {string} 導向 Meta 授權的網址
 */
export const createConnectUrl = (account, return_url) => {
    if(!process.env.FB_APP_ID || !process.env.FB_APP_SECRET || !process.env.BASE_URL){
        throw new Error('尚未設定 FB_APP_ID、FB_APP_SECRET 或 BASE_URL，無法串接 Meta')
    }
    const state = jwt.sign({ account: account.account_id, company: account.company_id, return_url }, connectStateSecret(), { expiresIn: '15m' })
    return `${process.env.BASE_URL}/meta/login?state=${encodeURIComponent(state)}`
}

// Apple's link preview (UA "... facebookexternalhit/1.1 Facebot Twitterbot/") fetches the Meta callback URL a
// second time from the user's Mac. A code can only be exchanged once, so every request for the same code
// shares the first exchange and gets the same result instead of "This authorization code has been used".
const pendingConnects = new Map()

/**
 * 同一個授權碼只向 Meta 換一次，重複的回呼共用第一次的結果
 * @param {string} code - Meta 授權碼
 * @param {function} connect - 實際串接，回傳要帶回後台的參數
 * @returns {Promise<object>} 帶回後台的參數
 */
const connectOnce = (code, connect) => {
    if(!pendingConnects.has(code)){
        pendingConnects.set(code, connect())
        // Meta codes expire after 10 minutes, so a repeat after that could not succeed anyway.
        setTimeout(() => pendingConnects.delete(code), 10 * 60 * 1000).unref()
    }
    return pendingConnects.get(code)
}

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
        metaClient({
            endPoints: `${page_id}/conversations`,
            method: 'GET',
            queryStrings: {
                "platform": (object == 'page')? "messenger": 'instagram',
                "fields": "messages{id}",
                "access_token": access_token
            }
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
                resolve(undefined)
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
 * 確認 webhook 請求確實來自 Meta
 * @param req 請求物件，rawBody 是收到的原始內容
 * @returns {boolean} true or false
 */
const isSignedByMeta = (req) => {
    const secret = process.env.FB_APP_SECRET
    const signature = req.get('x-hub-signature-256')
    if(!secret || !signature || !req.rawBody){
        return false
    }
    const expected = Buffer.from(`sha256=${createHmac('sha256', secret).update(req.rawBody).digest('hex')}`)
    const received = Buffer.from(signature)
    return expected.length === received.length && timingSafeEqual(expected, received)
}

/**
 * 推入新的聊天室訊息到資料庫
 * @param {string} to_chat_room_id - 聊天室ID
 * @param {string} platform - 平台名稱
 * @param {object} contents - 訊息內容
 * @param {object} customer - 傳訊息的客戶
 * @param {string} channel_id - 頻道/粉絲頁 ID
 * @param {string} message_id - 平台上的訊息 ID
 */
const appendMessage = async (to_chat_room_id, platform, contents, customer, channel_id, message_id) => {
    const message = await saveInboundMessage({
        externalChannelId: channel_id,
        platform: platform,
        chatRoomId: to_chat_room_id,
        // Stored as JSON once its attachments are saved.
        contents: contents,
        customer: customer,
        externalId: message_id,
    })
    if(!message){
        console.log('Inbound message not stored:', message_id)
    }
}

// Runs work on a few items at a time, so a big inbox doesn't fire hundreds of Meta requests at once.
const mapInBatches = async (items, size, work) => {
    const results = []
    for (let i = 0; i < items.length; i += size) results.push(...await Promise.all(items.slice(i, i + size).map(work)))
    return results
}

// Brings in each new Messenger and Instagram channel's recent conversations; WhatsApp has no history to read.
export const importRecentHistory = async (channels, accountId) => {
    for (const channel of channels) {
        if (!channel.enabled || !['fb', 'ig'].includes(channel.platform)) continue
        const { id, page_id, access_token } = channel.accessInfo || {}
        const ownIds = [id, page_id].filter(Boolean)
        const isInstagram = channel.platform === 'ig'
        try {
            const conversations = await getRecentConversations(page_id || id, isInstagram ? 'instagram' : 'messenger', access_token)
            const history = await mapInBatches(conversations, 5, async (conversation) => {
                const participant = conversation.participants?.data?.find(({ id }) => !ownIds.includes(id))
                if (!participant) return null
                const profile = await (isInstagram ? getInstagramSenderInfo : getMetaSenderInfo)(participant.id, access_token).catch(() => undefined)
                return {
                    chatRoomId: conversation.id,
                    customer: isInstagram ? instagramCustomer(participant.id, profile, participant.username) : messengerCustomer(participant.id, profile, participant.name),
                    messages: (conversation.messages?.data || []).filter(({ id }) => id).map((message) => ({
                        externalId: message.id,
                        sentAt: message.created_time,
                        fromCompany: ownIds.includes(message.from?.id),
                        contents: { mid: message.id, text: message.message || undefined, attachments: historyAttachments(message) },
                    })),
                }
            })
            const stored = await saveConversationHistory(channel, history.filter(Boolean), accountId)
            console.log(`History import for ${channel.platform} channel ${channel.id}: ${stored} messages from ${conversations.length} conversations`)
        } catch (error) {
            console.log(`History import failed for ${channel.platform} channel ${channel.id}:`, error.responseBody || error.message)
        }
    }
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
        try {
            // Gets the body of the webhook event
            let webhookEvent = data.messaging?.[0];
            // Delivery and read receipts have no message; echoes are the company's own replies.
            if(!webhookEvent?.message || webhookEvent.message.is_echo){
                return
            }
            let chatters = [webhookEvent.sender.id, webhookEvent.recipient.id]
            let message_id = webhookEvent.message.mid
            let page_id = ''
            let customer

            /** page_access_token  */
            let access_token = ''
            if(body.object == 'instagram'){
                // Findout who is the company
                for(let i=0; i < chatters.length; i++){
                    let result = await findChannelToken(chatters[i], 'instagram')

                    if(result !== null){
                        access_token = result.access_token
                        page_id = result.channel_id
                        const customerId = chatters[1 - i]
                        // A failed profile lookup shouldn't lose the customer's message.
                        const profile = await getInstagramSenderInfo(customerId, access_token).catch(() => undefined)
                        customer = instagramCustomer(customerId, profile)
                        break;
                    }
                }
            }else{
                access_token = await findChannelToken(webhookEvent.recipient.id, 'page')
                page_id = webhookEvent.recipient.id
                //get sender's infomation
                if(access_token){
                    // A failed profile lookup shouldn't lose the customer's message.
                    let sender = await getMetaSenderInfo(webhookEvent.sender.id, access_token).catch(() => undefined)
                    customer = messengerCustomer(webhookEvent.sender.id, sender)
                }
            }

            if(!access_token){
                console.log('Webhook message for an unknown channel:', message_id)
                return
            }

            // Without a conversation id from Meta, the customer's id still identifies the conversation.
            let cid = await chat_room_id(page_id, body.object, message_id, access_token) || customer.id

            //Check if sender followed the page or not


            // if chatbot is set
            //filterMessage(webhookEvent, recipient_id, senderPsid, access_token)

            //Save infomations to database
            await appendMessage(
                cid,
                (body.object == 'instagram')? 'ig' : 'fb',
                webhookEvent.message, customer,
                page_id,
                message_id
            )
        } catch (error) {
            console.log('webhook_error', error)
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
        if(!isSignedByMeta(req)){
            return res.sendStatus(403)
        }
        let body = req.body;
        const { entry, object } = body
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

            try {
                let whatsappMessages = await whatsappWebhookMessages(entry)

                for(const { chat_room_id, content, customer, channel_id } of whatsappMessages){
                    await appendMessage(chat_room_id, 'whatsapp', content, customer, channel_id, content.id)
                }

                for(const { externalId, error } of whatsappFailedStatuses(entry)){
                    await markMessageFailed(externalId, metaFailureReason(error))
                }
            } catch (error) {
                console.log('webhook_error', error)
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

        /**
         * 給前端導向FB登入，回傳網址填masterBox
         * masterBox 取得回傳的code， 發給後端換 user_access_token
         */

        try {
            jwt.verify(req.query.state, connectStateSecret())
        } catch (error) {
            return res.status(400).send('串接連結已失效，請回到後台重新串接。')
        }

        const permissions =
            'pages_messaging,business_management,whatsapp_business_management,whatsapp_business_messaging,pages_show_list,public_profile,pages_manage_metadata,pages_read_engagement,instagram_basic,instagram_manage_messages,leads_retrieval'

        // whatsapp_business_management permission seems to be granted when extras is not included
        // const extras = { feature: 'whatsapp_embedded_signup' }
        //&extras=${JSON.stringify(extras)}
        res.redirect(`https://www.facebook.com/dialog/oauth?response_type=code&display=popup&client_id=${process.env.FB_APP_ID}&redirect_uri=${encodeURIComponent(`${process.env.BASE_URL}/meta/getToken`)}&scope=${permissions}&state=${encodeURIComponent(req.query.state)}`);
    },

    /**
     * Meta 授權完成後，把授權範圍內的頻道存到發起串接的公司，再回到後台
     * @param code string, 登入FB取得的字串，用於換取 user_access_token
     * @param state string, 發起串接時簽章的帳號與回到的頁面
     */
    getToken: async (req, res, next) => {
        let state
        try {
            state = jwt.verify(req.query.state, connectStateSecret())
        } catch (error) {
            return res.status(400).send('串接連結已失效，請回到後台重新串接。')
        }

        const backToAdmin = (result) => {
            const url = new URL(state.return_url)
            Object.entries(result).forEach(([key, value]) => url.searchParams.set(key, value))
            res.redirect(url.toString())
        }

        if(!req.query.code){
            return backToAdmin({ meta_error: '已取消 Meta 授權，沒有串接任何頻道。' })
        }

        backToAdmin(await connectOnce(req.query.code, async() => {
            try {
                const account = await prisma.account.findFirst({ where: { id: state.account, companyId: state.company } })
                if(!account){
                    return { meta_error: '找不到發起串接的帳號，請重新登入後再試。' }
                }

                const { failed, ...channels } = await collectMetaChannels(req.query.code)
                const { saved, skipped } = await sortChannelSchema({ companyId: account.companyId, accountId: account.id, ...channels })
                // The inbox fills in by itself; connecting shouldn't wait for it.
                importRecentHistory(saved, account.id)

                return {
                    meta_connected: saved.length,
                    ...(skipped.length > 0 && { meta_skipped: skipped.join('、') }),
                    ...(failed.length > 0 && { meta_failed: failed.join('、') }),
                }
            } catch (error) {
                console.log('Meta connect failed:', error.responseBody || error.message)
                return { meta_error: '串接 Meta 失敗，請稍後再試。' }
            }
        }))
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