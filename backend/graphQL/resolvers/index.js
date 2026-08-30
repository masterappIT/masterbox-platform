import accountsResolvers from './accountsResolvers.js';
import companyResolvers from './companyResolvers.js';
import messageResolvers from './messageResolvers.js';
import messageTemplateResolvers from './messageTemplateResolvers.js';
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
    },
    Mutation: {
        ...accountsResolvers.Mutation,
        ...companyResolvers.Mutation,
        ...messageResolvers.Mutation,
        ...messageTemplateResolvers.Mutation,
    },
    Subscription: {
        ...messageResolvers.Subscription,
        ...accountsResolvers.Subscription
    }
};