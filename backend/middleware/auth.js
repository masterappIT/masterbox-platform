import { AuthenticationError, ForbiddenError } from 'apollo-server-express';
import jwt from 'jsonwebtoken';
import { prisma } from '../lib/db/prisma.js';
import { getJwtSecret } from '../lib/auth/jwtSecret.js';

const getBearerToken = (authorization = '') => {
    const [scheme, token] = authorization.trim().split(/\s+/);
    return scheme?.toLowerCase() === 'bearer' ? token : undefined;
};

export default async (context) => {
    const req = context.req;
    const token = getBearerToken(req?.headers?.authorization);
    if (!token) return { isAuth: false, req };

    try {
        const payload = jwt.verify(token, getJwtSecret());
        const accountId = payload.account_id || payload.user_id;
        if (!accountId) throw new AuthenticationError('Invalid token payload');

        // Resolve the current account so authorization uses the persisted role,
        // rather than a client-controlled or stale JWT claim.
        const accountRecord = await prisma.account.findUnique({ where: { id: accountId } });
        if (!accountRecord) throw new AuthenticationError('Invalid account');

        return {
            isAuth: true,
            account: {
                ...payload,
                account_id: accountRecord.id,
                company_id: accountRecord.companyId,
                role: accountRecord.role,
            },
        };
    } catch (error) {
        if (error instanceof AuthenticationError) throw error;
        throw new AuthenticationError('Invalid/Expired token');
    }
};

export function withAuth(isAuth) {
    if (!isAuth) throw new AuthenticationError('Invalid/No token provided');
}

export function requireAdmin({ isAuth, account } = {}) {
    withAuth(isAuth);
    if (account?.role !== 'admin') {
        throw new ForbiddenError('Admin role required');
    }
    return account;
}

