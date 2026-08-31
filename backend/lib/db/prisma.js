import 'dotenv/config.js';
import prismaClientPackage from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

const { PrismaClient } = prismaClientPackage;

const globalForPrisma = globalThis;
const connectionString = process.env.DATABASE_URL;

export const prisma = globalForPrisma.__prisma ?? new PrismaClient({
  adapter: connectionString ? new PrismaPg({ connectionString }) : undefined,
});

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.__prisma = prisma;
}

export default prisma;
