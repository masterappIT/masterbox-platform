import express from "express";
import meta from "../controller/meta.js";

import metaController from '../controller/meta.js';

const router = express.Router();

router
    .get('/webhook', metaController.webhookConnect)
    .post('/webhook', metaController.webhookEvent)
    
    // Get whatsapp business account access_token
    .get('/getDebugToken', metaController.getDebugToken)
    .post('/getWhatsappInfo', metaController.getWhatsappBusinessAccountInfo)

    // meta_user
    .get('/login', metaController.login)
    .get('/getToken', metaController.getToken, metaController.getDebugToken, metaController.getUserId, metaController.getPageToken)
    // .get('/getUserBusinessIds', metaController.getUserBusinessIds)
    .get('/getlongliveToken', metaController.getUserLongLivedToken)

    //meta_pages
    .get('/getPageToken', metaController.getPageToken)
    // .get('/getUserInfo', metaController.getUserInfo)
    .get('/getPageFollowers', metaController.getPageFollowers)
    .post('/getInstagramAccount', metaController.getInstagramBusinessAccount, metaController.getInstagramAccountBasicInfo)
    .post('/subscriptFBpage', metaController.subscriptFBpage)
    .post('/unsubscribeFBpage', metaController.unsubscribeFBpage)
    .get('/whatsappNumbers', metaController.getWhatsappNumberDetails)

    // meta_media
    // .get('/getWhatsappStickers', metaController.getWhatsappStickers)
    .post('/createTemplate', metaController.createTemplate)
    .get('/getTemplate', metaController.getTemplate)
    .post('/editTemplate', metaController.editTemplate)
    .post('/deleteTemplate', metaController.deleteTemplate)

    // meta_message
    .get('/getConversations', metaController.getConversationsList)
    // .get('/getInstagramConversations', metaController.getInstagramConversationsList)
    .get('/messagesList', metaController.getConversationMessages)
    .get('/message', metaController.getMessage)
    .post('/sendMessage', metaController.sendMessage)
    .post('/messenger', metaController.messenger)



export default router;

