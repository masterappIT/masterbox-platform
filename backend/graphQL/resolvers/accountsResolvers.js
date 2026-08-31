import { ApolloError } from 'apollo-server-errors'
import jwt from "jsonwebtoken"
import bcrypt from "bcryptjs"
import { prisma } from '../../lib/db/prisma.js';
import { pubsub } from '../../config/redis.js';
import { getJwtSecret } from '../../lib/auth/jwtSecret.js';
import { withAuth, requireAdmin } from '../../middleware/auth.js';

const ACCESS_TOKEN_TTL = '2h';
const REFRESH_TOKEN_TTL = '30d';

const issueTokens = (account) => ({
    token: jwt.sign({ account_id: account.id }, getJwtSecret(), { expiresIn: ACCESS_TOKEN_TTL }),
    refreshToken: jwt.sign({ account_id: account.id, company_id: account.companyId, token_type: 'refresh' }, getJwtSecret(), { expiresIn: REFRESH_TOKEN_TTL }),
});

const accountView = (account, tokens = {}) => account && ({
    _id: account.id,
    email: account.email,
    company_id: account.companyId,
    role: account.role,
    permissions: account.permissions,
    info: account.userInfo,
    token: tokens.token,
    refreshToken: tokens.refreshToken,
});

const parseJsonInput = (value, field) => {
    if (value === undefined) return undefined;
    if (value === null) return null;
    try {
        return typeof value === 'string' ? JSON.parse(value) : value;
    } catch {
        throw new ApolloError(`Invalid ${field} JSON`, 'BAD_USER_INPUT');
    }
};

const permissionsValue = (permissions) => Array.isArray(permissions) ? permissions.join(',') : permissions;

const scopedAccountId = (context, companyId, accountId) => {
    const admin = requireAdmin(context);
    if (companyId && admin.company_id !== companyId) {
        throw new ApolloError('Account is outside your company', 'FORBIDDEN');
    }
    return admin;
};

export default {
    Mutation: {
        async registerAccount(_, { AccountRegisterInput: { email, password, company_id, role } }, context) {
            requireAdmin(context);
            const normalizedEmail = email.toLowerCase();
            const [oldUser, existsCompany] = await Promise.all([
                prisma.account.findUnique({ where: { email: normalizedEmail } }),
                prisma.company.findUnique({ where: { id: company_id } }),
            ]);
            if (oldUser) throw new ApolloError('A user is already registered with the email' + email, 'USER_ALREADY_EXISTS');
            if (!company_id || !existsCompany) throw new ApolloError('Invalid company');

            const newUser = await prisma.account.create({
                data: {
                    email: normalizedEmail,
                    password: await bcrypt.hash(password, 10),
                    companyId: company_id,
                    ...(role ? { role } : {}),
                },
            });
            return accountView(newUser, issueTokens(newUser));
        },

        async createAccount(_, { input, company_id }, context) {
            scopedAccountId(context, company_id);
            const normalizedEmail = input.email.toLowerCase();
            const existsCompany = await prisma.company.findUnique({ where: { id: company_id }, select: { id: true } });
            if (!existsCompany) throw new ApolloError('Invalid company', 'BAD_USER_INPUT');
            const data = {
                email: normalizedEmail,
                password: await bcrypt.hash(input.password, 10),
                companyId: company_id,
                ...(input.role ? { role: input.role } : {}),
                ...(input.permissions ? { permissions: permissionsValue(input.permissions) } : {}),
                ...(input.user_info !== undefined ? { userInfo: parseJsonInput(input.user_info, 'user_info') } : {}),
            };
            try {
                return accountView(await prisma.account.create({ data }));
            } catch (error) {
                if (error.code === 'P2002') throw new ApolloError('A user is already registered with that email', 'USER_ALREADY_EXISTS');
                throw error;
            }
        },

        async updateAccount(_, { _id, input }, context) {
            const admin = scopedAccountId(context);
            const existing = await prisma.account.findUnique({ where: { id: _id } });
            if (!existing || existing.companyId !== admin.company_id) throw new ApolloError('Account not found', 'NOT_FOUND');
            const data = Object.fromEntries(Object.entries({
                email: input.email?.toLowerCase(),
                password: input.password ? await bcrypt.hash(input.password, 10) : undefined,
                role: input.role,
                permissions: input.permissions ? permissionsValue(input.permissions) : undefined,
                userInfo: input.user_info !== undefined ? parseJsonInput(input.user_info, 'user_info') : undefined,
            }).filter(([, value]) => value !== undefined));
            try {
                return accountView(await prisma.account.update({ where: { id: _id }, data }));
            } catch (error) {
                if (error.code === 'P2002') throw new ApolloError('A user is already registered with that email', 'USER_ALREADY_EXISTS');
                throw error;
            }
        },

        async deleteAccount(_, { _id }, context) {
            const admin = scopedAccountId(context);
            const existing = await prisma.account.findUnique({ where: { id: _id }, select: { id: true, companyId: true } });
            if (!existing || existing.companyId !== admin.company_id) throw new ApolloError('Account not found', 'NOT_FOUND');
            if (existing.id === admin.account_id) throw new ApolloError('You cannot delete your own account', 'BAD_USER_INPUT');
            await prisma.account.delete({ where: { id: _id } });
            return true;
        },

        async loginAccount(_, { LoginInput: { email, password } }) {
            const existAccount = await prisma.account.findUnique({ where: { email: email.toLowerCase() } });
            if (!existAccount) throw new ApolloError('Incorrect email', 'INCORRECT_EMAIL');
            if (!(await bcrypt.compare(password, existAccount.password))) {
                throw new ApolloError('Incorrect password', 'INCORRECT_PASSWORD');
            }
            return accountView(existAccount, issueTokens(existAccount));
        },

        async refreshToken(_, { refreshTokenInput: { refreshToken, account_id, company_id } }) {
            let payload;
            try { payload = jwt.verify(refreshToken, getJwtSecret()); } catch { throw new ApolloError('Invalid or expired refresh token', 'UNAUTHENTICATED'); }
            if (payload.token_type !== 'refresh' || payload.account_id !== account_id || payload.company_id !== company_id) {
                throw new ApolloError('Invalid refresh token scope', 'UNAUTHENTICATED');
            }
            const account = await prisma.account.findUnique({ where: { id: account_id } });
            if (!account || account.companyId !== company_id) throw new ApolloError('Account not found', 'UNAUTHENTICATED');
            return accountView(account, issueTokens(account));
        },

        async insertSubscribeChannelsToAccount(_, { channels }, context) {
            const account = requireAdmin(context);
            await prisma.accountChannel.createMany({
                data: channels.map(channelId => ({ accountId: account.account_id, channelId })),
                skipDuplicates: true,
            });
            const updated = await prisma.account.findUnique({ where: { id: account.account_id } });
            return accountView(updated, undefined);
        },
    },
    Query: {
        findAccountByEmail: async (_, { email }, { isAuth }) => {
            withAuth(isAuth);
            return accountView(await prisma.account.findUnique({ where: { email: email.toLowerCase() } }));
        },
        listAccounts: async (_, { input = {} }, context) => {
            const admin = requireAdmin(context);
            const companyId = input.company_id || admin.company_id;
            if (companyId !== admin.company_id) throw new ApolloError('Company scope violation', 'FORBIDDEN');
            const [items, total] = await Promise.all([
                prisma.account.findMany({ where: { companyId }, orderBy: { createdAt: 'desc' } }),
                prisma.account.count({ where: { companyId } }),
            ]);
            return { items: items.map(account => accountView(account)), total };
        },

    },
    Subscription: {
        numberIncremented: { subscribe: () => pubsub.asyncIterator(["NUMBER_INCREMENTED"]) },
    },
};
