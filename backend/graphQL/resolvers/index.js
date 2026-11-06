import accountsResolvers from './accountsResolvers.js';
import companyResolvers from './companyResolvers.js';
import messageResolvers from './messageResolvers.js';
import messageTemplateResolvers from './messageTemplateResolvers.js';
import pushResolvers from './pushResolvers.js';
import whatsappWebResolvers from './whatsappWebResolvers.js';
import { dateTimeScalar } from '../types/datetime.js';
import { objectIdScalar } from '../types/objectId.js';



export default {

    DateTime: dateTimeScalar,
    ObjectId: objectIdScalar,

    Query: {
        ...accountsResolvers.Query,
        ...companyResolvers.Query,
        ...messageResolvers.Query,
        ...messageTemplateResolvers.Query,
        ...pushResolvers.Query,
        ...whatsappWebResolvers.Query,
    },
    Mutation: {
        ...accountsResolvers.Mutation,
        ...companyResolvers.Mutation,
        ...messageResolvers.Mutation,
        ...messageTemplateResolvers.Mutation,
        ...pushResolvers.Mutation,
        ...whatsappWebResolvers.Mutation,
    },
    Subscription: {
        ...messageResolvers.Subscription,
        ...accountsResolvers.Subscription
    }
};