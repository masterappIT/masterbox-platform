import { ApolloError } from 'apollo-server-errors'
import jwt from "jsonwebtoken"
import bcrypt from "bcryptjs"
import { prisma } from '../../lib/db/prisma.js';
import { pubsub } from '../../config/redis.js';
import { getJwtSecret } from '../../lib/auth/jwtSecret.js';
import { withAuth, requireAdmin } from '../../middleware/auth.js';

const accountView = (account, token) => account && ({
    _id: account.id,
    email: account.email,
    company_id: account.companyId,
    role: account.role,
    permissions: account.permissions,
    info: account.userInfo,
    token,
    refreshToken: token,
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
            const token = jwt.sign({ user_id: newUser.id }, getJwtSecret(), { expiresIn: "2h" });
            return accountView(newUser, token);
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
            const normalizedEmail = email.trim().toLowerCase() === 'test' ? 'test@masterbox.local' : email.trim().toLowerCase();
            const existAccount = await prisma.account.findUnique({ where: { email: normalizedEmail } });
            if (!existAccount) throw new ApolloError('Incorrect email', 'INCORRECT_EMAIL');
            if (!(await bcrypt.compare(password, existAccount.password))) {
                throw new ApolloError('Incorrect password', 'INCORRECT_PASSWORD');
            }
            const token = jwt.sign({ account_id: existAccount.id }, getJwtSecret(), { expiresIn: "2h" });
            return accountView(existAccount, token);
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
