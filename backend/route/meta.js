import express from "express";
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
    .get('/getToken', metaController.getToken)
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




export default router;

