import metaClient from '../api/metaClient.js';
import {masterBox_meta_Route, masterBox_Api_graphql} from '../api/masterBoxClient.js';
import { sortChannelSchema, findChannelToken } from '../utils/utils.js';


/**
 * 換取 FB 使用者的 user_access_token
 * @param {string} code - FB 登入成功回傳的字串 
 * @returns user_access_token
 */
export const getUserAccessToken = async(code) => {
    let result = await metaClient({
        endPoints: 'oauth/access_token',
        method: 'POST',
        queryStrings: {
            'client_id': process.env.FB_APP_ID,
            'client_secret': process.env.FB_APP_SECRET,
            'code': code,
            'redirect_uri': process.env.BASE_URL + '/meta/getToken',
        }
    })

    return result
}


/**
 * 查看當前使用者權限，尋找whatsapp帳號
 * @param {object} req - requset物件
 * @param {string} access_token - user_access_token
 * @param {*} next - 串聯下一個 request 
 */
export const getDebugToken = (req, access_token, next) => {
    const nextStep = () => {
        req.headers['authorization'] = `Bearer ${access_token}`
        next()
       }

    metaClient({
        endPoints: 'debug_token',
        method: 'GET',
        queryStrings: {
            'input_token': access_token,
            'access_token': access_token
        }
    }).then((r) => {
        let result = JSON.parse(r)
        console.log('debug', result)
        req.query.whatsappAccounts = []
        let whatsappProcess = []
        
        if(result.error !== undefined){
            console.log(result.error)
        }else

        if(result.data.granular_scopes !== undefined){
            console.log(result.data.granular_scopes)
            const whatsapp = result.data.granular_scopes.find((el) => el.scope == "whatsapp_business_management")

            if(whatsapp !== undefined){
                whatsapp.target_ids.forEach((id, index) => {
                    // masterBox_meta_Route({
                    //     endPoints: '/getWhatsappInfo',
                    //     method: 'POST',
                    //     payloads: {
                    //         "whatsappID": id,
                    //     },
                    //     headers: { "authorization": `Bearer ${access_token}` }
                    // }).then((r) => {
                    //     req.headers['authorization'] = `Bearer ${access_token}`
                        
                    //     if(r.error !== undefined){
                    //         next()
                    //     }else{
                    //         req.query.whatsappAccounts.push(r)
                    //         if(index == (whatsapp.target_ids.length -1) && (req.query.whatsappAccounts.length - 1) == index){
                    //             next()
                    //         }                            
                    //     }
                    // })

                    // Get whatsapp number id
                    whatsappProcess.push(
                        masterBox_meta_Route({
                            endPoints: '/whatsappNumbers',
                            method: 'GET',
                            queryStrings: {
                                "whatsapp_business_account_id": id
                            },
                            headers: { "authorization": `Bearer ${access_token}` }
                        })
                    )

                    //subscribe whatsapp number messages
                    appSubscribePage(id, access_token)
                })

                Promise.all(whatsappProcess).then((res) => {
                    console.log('whatsapp result', res)

                    res.forEach((r, index) => {
                        let body = JSON.parse(r)
                        console.log('return from route', body)
                       
                        if(body.error !== undefined){
                            next()
                        }else{
                            console.log('begin iteration')
                            body.data.forEach(d => {
                                d['waid'] = whatsapp.target_ids[index]
                                req.query.whatsappAccounts.push(d)
                            })

                            console.log('count', index)
                            if(index == (whatsapp.target_ids.length -1) && (req.query.whatsappAccounts.length - 1) == index){
                                nextStep()
                            }                            
                        }
                    })
                })
            }else{
                nextStep()
            }
        }else{
            nextStep()
        }
    })
}


/**
 * 獲取長時間的 user_access_token
 * @param {*} res - api回應起始句
 * @param {string} access_token - user_access_token
 */
export const getUserLongLivedToken = (res, access_token) => {
    metaClient({
        endPoints: '/oauth/access_token',
        method: 'POST',
        queryStrings: {
            'grant_type': 'fb_exchange_token',
            'client_id': process.env.FB_APP_ID,
            'client_secret': process.env.FB_APP_SECRET,
            'fb_exchange_token': access_token
        }
    }).then((result) => {
        console.log('user long live toekn:', result)

        res.send(result)
    })
}


/**
 * 取得當前使用者ID
 * @param {*} req - requset物件
 * @param {string} access_token - user_access_token
 * @param {array} whatsappAccounts - 透過權限查閱到的 whatsapp_business_account
 * @param {*} next - 串聯下一個 request 
 */
export const getFacebookUserId = (req, access_token, whatsappAccounts=[], next=null) => {
    metaClient({
        endPoints: 'me',
        method: 'GET',
        queryStrings:{ 'access_token': access_token, }
    }).then((result) => {
        console.log('user_id:', JSON.parse(result))
        let body = JSON.parse(result)
        // res.send({...body, "user_access_token": access_token})

        // metaClient({
        //     endPoints: `${body.id}/permissions`,
        //     method: 'GET',
        //     queryStrings: {
        //         "access_token": access_token
        //     }
        // }).then((r) => {
        //     console.log('permissions:', r)
        // })

        req.query.user_id = body.id
        req.headers['authorization'] = `Bearer ${access_token}`
        req.query.whatsappAccounts = whatsappAccounts
        next()
    })
}

/**
 * 查詢發送者的基本資料
 * @param {string} senderPsid - page scope user id, 使用者在粉絲頁的id
 * @param {string} access_token - page access token, 粉絲頁的 access token
 * @returns {object} Infomations of the sender, 發送者的基本資料
 */
export const getMetaSenderInfo = async(senderPsid, access_token) => {
    return new Promise((resolve, reject) => {
        metaClient({
            endPoints: `${senderPsid}`,
            method: 'GET',
            queryStrings: {
                "fields": "first_name,last_name,profile_pic",
                "access_token": access_token
            }   
        }).then((r) => {
            resolve(JSON.parse(r))
        }).catch((error) => {
            reject(error)
        })
    })
}


/**
 * 查詢當前使用者的粉專
 * @param {*} res - api回應起始句
 * @param {string} user_id - 當前使用者 ID 
 * @param {string} access_token - user_access_token
 * @param {array} whatsappAccounts - 透過權限查閱到的 whatsapp_business_account
 */
export const getFacebookPageToken = (res, user_id, access_token, whatsappAccounts=[]) => {
    metaClient({
        endPoints: `${user_id}/accounts`,
        method: 'GET',
        queryStrings: {'access_token': access_token} // user_access_token
    }).then((result) => {
        console.log('User PageToken:', JSON.parse(result));
        let response = JSON.parse(result)
        let body = {
            facebookPages: response.data,
            user_id: user_id,
            user_access_token: access_token,
            instagramAccounts: [],
            whatsappAccounts: whatsappAccounts
        } 

        let instagramProcess = [], subscribeFaildpage = []

        body.facebookPages.forEach((page, index) => {
            // Find the instragram account connected to the page 
            instagramProcess.push(
                masterBox_meta_Route({
                    endPoints: 'getInstagramAccount',
                    method: 'POST',
                    payloads: {
                        "page_id": page.id,
                    },
                    headers: { "authorization": `Bearer ${page.access_token}` }
                })
            )

           // Subscribe masterBox to the page
            masterBox_meta_Route({
                endPoints: 'subscriptFBpage',
                method: 'POST',
                payloads: {
                    "page_id": page.id,
                },
                headers: { "authorization": `Bearer ${page.access_token}` }
            }).then((r) => {
                // console.log('subscribe:', r)
                if(r.error !== undefined){
                    subscribeFaildpage.push(index)
                }
            })
        })

        Promise.all(instagramProcess).then((r) => {
            // console.log('faild:', subscribeFaildpage)

            // Remove the faild page if exist
            if(subscribeFaildpage.length > 0){
                subscribeFaildpage.forEach(p => {
                  body.facebookPages.splice(p, 1)  
                })
            }

            // console.log('after:', body.facebookPages)

            r.forEach((res, index) => {
                if(Object.keys(res).length > 0){
                    res['access_token'] = body.facebookPages[index].access_token
                    res.page_id = body.facebookPages[index].id
                    body.instagramAccounts.push(res)
                }                        
            })
            sortChannelSchema(body)
        })

        res.send(body)
    })
}


/**
 * 查詢粉絲頁的粉絲數量
 * @param {*} res - api回應起始句
 * @param {string} page_id - 粉絲頁的id 
 * @param {string} access_token - 粉絲頁的 access_token
 */
export const getPageFollowers = (res, page_id, access_token) => {
    metaClient({
        endPoints: `${page_id}`,
        method: 'GET',
        queryStrings: {
            "fields": "followers_count",
            "access_token": access_token
        }
    }).then((r) => {
        console.log(r)
        // {
        //     "followers_count": 2,
        //     "id": "107453962033819"
        // }
        res.send(r)
    })
}


/**
 * 查詢粉絲頁/instagram 的聊天紀錄
 * @param {*} res - api回應起始句
 * @param {string} page_id - 粉絲頁ID
 * @param {string} platform - 平台名稱, messenger or instagram
 * @param {string} access_token - page_access_token
 */
export const getMetaConversations = (res,page_id, platform, access_token) => {
    let qs = { 
        'platform': platform, 
        'fields': "messages{from,to,message,created_time,id}",
        'access_token': access_token 
    }
    // if (user_id) qs = { ...qs, 'user_id': user_id }

    metaClient({
        endPoints: `${page_id}/conversations`,
        method: 'GET',
        queryStrings: qs
    }).then((result) => {
        console.log('page getConversations:', JSON.parse(result));

        res.send(JSON.parse(result))
    }).catch((e) => { console.error('conversation error',e.message) })
}


/**
 * 查詢聊天室訊息紀錄
 * @param {*} res - api回應起始句
 * @param {string} conversation_id - 聊天室id 
 * @param {string} access_token - page_access_token
 */
export const getConversationMessages = (res, conversation_id, access_token) => {
    metaClient({
        endPoints: `${conversation_id}/messages`,
        method: 'GET',
        queryStrings: {
            'access_token': access_token,
            'fields': 'messages, participants,updated_time '
        }
    }).then((result) => {
        console.log('List of message_id:', JSON.parse(result))
        res.send(JSON.parse(result))
    })
}


/**
 * 查看訊息內容
 * @param {*} res - api回應起始句
 * @param {string} message_id - 訊息id
 * @param {string} access_token - page_access_token
 */
export const getMessage = (res, message_id, access_token) => {
    metaClient({
        endPoints: message_id,
        method: 'GET',
        queryStrings: {
            'access_token': access_token,
            'fields': 'id,created_time,from,to,message'
        }
    }).then((result) => {
        console.log('message:', result)

        res.send(JSON.parse(result))
    })
}


/**
 * 查看訊息附件
 * @param {*} res - api回應起始句
 * @param {string} message_id - 訊息id
 * @param {string} access_token - page_access_token
 */
export const getAttachment = (res, message_id, access_token) => {
    metaClient({
        endPoints: `${message_id}/attachments`,
        method: 'GET',
        queryStrings: {
            'access_token': access_token,
        }
    }).then((result) => {
        console.log('Message attchment:', result)

        res.send(JSON.parse(result))
    })
}

/**
 * Messenger 發送訊息
 * @param {*} res - api回應起始句
 * @param {string} page_id - 粉絲頁ID
 * @param {object} content - 訊息物件
 * @param {string} platform - 平台名稱 
 * @param {string} to_chat_room_id - 聊天室ID 
 * @param {string} access_token - page_access_token 
 */
export const metaSendMessage = (res, page_id, content, platform, to_chat_room_id, access_token) => {
    metaClient({
        endPoints: `${page_id}/messages`,
        method: 'POST',
        queryStrings: { "access_token": access_token},
        ...(content.filedata == undefined?
            {payloads: content} : {formData: content})
        }).then((result) => {
        console.log('Message send:', result);
        if(result.message_id){
            /** Save to database  */

        }
        res.send(result)
    }).catch((error) => {
        console.log(error)
    })
}


/**
 * MasterBox 訂閱粉絲頁 / whatapp商業帳號 訊息
 * @param {*} page_id - 粉絲頁ID / whatapp商業帳號ID
 * @param {*} access_token - 粉絲頁的 access_token / user_access_token
 * @param {*} res - api回應起始句
 */
export const appSubscribePage = (page_id, access_token, res=null) => {
    metaClient({
        endPoints: `${page_id}/subscribed_apps`,
        method: "POST",
        queryStrings: {
            "subscribed_fields": "feed, mention, name, picture, category, description, conversations, feature_access_list, inbox_labels, standby, messages,  messaging_payments, messaging_postbacks, messaging_pre_checkouts, messaging_referrals, messaging_handovers, messaging_appointments, messaging_direct_sends, messaging_fblogin_account_linking, user_action, messaging_feedback, founded, company_overview, mission, products, general_info, leadgen, leadgen_fat, location, hours, parking, public_transit, page_about_story, mcom_invoice_change, invoice_access_invoice_change, invoice_access_onboarding_status_active, local_delivery, phone, email, website, ratings, attire, payment_options, culinary_team, general_manager, price_range, awards, hometown, current_location, bio, affiliation, birthday, personal_info, personal_interests, members, checkins, page_upcoming_change, page_change_proposal, merchant_review, product_review, videos, live_videos, video_text_question_responses, registration, publisher_subscriptions",
            "access_token": access_token
        }
    }).then((result) => {
        console.log('Page subscripted:', result)

        if(res !== null){
            res.send(JSON.parse(result))
        }
    })
}