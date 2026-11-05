import { ApolloError } from 'apollo-server-errors'
import request from 'request';
import { createConnectUrl } from '../../controller/meta.js'
import { prisma } from '../../lib/db/prisma.js';
import { errorGenerator } from "../../utils/errorHandler.js";
import { requireAdmin } from '../../middleware/auth.js';

// Channel tokens are only for the server's calls to the platforms.
const publicAccessInfo = ({ access_token, user_access_token, ...accessInfo } = {}) => accessInfo;

// Same origins the backend accepts browser requests from, so a connect link can only return to the admin.
const isAdminOrigin = (url) => {
    try {
        const { origin } = new URL(url);
        const allowed = (process.env.CORS_ALLOWED_ORIGINS || '').split(',').map((value) => value.trim());
        return /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin) || allowed.includes(origin);
    } catch {
        return false;
    }
};

const companyView = (company) => company && ({
    _id: company.id,
    email: company.email,
    chinese_name: company.chineseName,
    english_name: company.englishName,
    logo: company.logo,
    mobile: company.mobile,
    subscription: company.subscriptionName ? {
        name: company.subscriptionName,
        period: { start: company.subscriptionStart, end: company.subscriptionEnd },
    } : null,
    country: company.country,
    pin_number: company.pinNumber,
    address: company.address,
    channels: company.channels?.map(channel => ({
        platform: channel.platform,
        name: channel.name,
        access_info: JSON.stringify(publicAccessInfo(channel.accessInfo || {})),
        info: JSON.stringify(channel.info),
    })),
    labels: company.labels?.map(label => label.value),
    principal_info: company.principalInfo,
});

export default {
    Mutation: {
        createMetaConnectUrl(_, { return_url }, context) {
            const account = requireAdmin(context);
            if (!isAdminOrigin(return_url)) throw new ApolloError('Invalid return_url', 'BAD_USER_INPUT');
            try {
                return createConnectUrl(account, return_url);
            } catch (error) {
                throw new ApolloError(error.message, 'META_NOT_CONFIGURED');
            }
        },

        async registerCompany(_, { CompanyRegisterInput: { chinese_name, english_name, email, country, mobile } }) {
            try {
                const newCompany = await prisma.company.create({
                    data: { chineseName: chinese_name, englishName: english_name, email, country, mobile },
                    include: { channels: true, labels: true },
                });
                return companyView(newCompany);
            } catch (error) {
                return errorGenerator("INTERNAL_SERVER_ERROR", error);
            }
        },

        async updateCompanyInfo(_, { UpdateCompanyInput }, context) {
            requireAdmin(context);
            try {
                const { _id, subscription, principal_info, ...input } = UpdateCompanyInput;
                if (!_id) return errorGenerator("MISS_REQUEUED_PRAMS", "_id");
                const data = Object.fromEntries(Object.entries({
                    email: input.email,
                    chineseName: input.chinese_name,
                    englishName: input.english_name,
                    logo: input.logo,
                    mobile: input.mobile,
                    country: input.country,
                    pinNumber: input.pin_number,
                    address: input.address,
                    principalInfo: principal_info,
                    subscriptionName: subscription?.name,
                    subscriptionStart: subscription?.period?.start ? new Date(subscription.period.start) : undefined,
                    subscriptionEnd: subscription?.period?.end ? new Date(subscription.period.end) : undefined,
                }).filter(([, value]) => value !== undefined && value !== null));
                const update = await prisma.company.updateMany({ where: { id: _id }, data });
                return update.count ? 'success' : errorGenerator("NOTHING_TO_UPDATED");
            } catch (error) {
                return errorGenerator("INTERNAL_SERVER_ERROR", error);
            }
        },
    },
    Query: {
        findCompanyById: async (_, { _id }) => companyView(await prisma.company.findUnique({ where: { id: _id }, include: { channels: true, labels: true } })),
        findCompanyByEmail: async (_, { email }) => companyView(await prisma.company.findUnique({ where: { email }, include: { channels: true, labels: true } })),
    }
};