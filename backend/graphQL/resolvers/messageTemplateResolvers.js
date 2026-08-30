import { ApolloError } from 'apollo-server-errors';
import { prisma } from '../../lib/db/prisma.js';
import { requireAdmin } from '../../middleware/auth.js';

const parseContents = (value) => {
  try { return typeof value === 'string' ? JSON.parse(value) : value; }
  catch { throw new ApolloError('contents 必須是有效 JSON', 'BAD_USER_INPUT'); }
};
const view = (template) => ({ ...template, contents: JSON.stringify(template.contents) });
const scoped = async (id, companyId) => {
  const template = await prisma.messageTemplate.findUnique({ where: { id } });
  if (!template || template.companyId !== companyId) throw new ApolloError('範本不存在', 'NOT_FOUND');
  return template;
};

export default {
  Query: {
    async messageTemplates(_, __, context) {
      const admin = requireAdmin(context);
      const templates = await prisma.messageTemplate.findMany({ where: { companyId: admin.company_id }, orderBy: { updatedAt: 'desc' } });
      return templates.map(view);
    },
  },
  Mutation: {
    async createMessageTemplate(_, { input }, context) {
      const admin = requireAdmin(context);
      const template = await prisma.messageTemplate.create({ data: { companyId: admin.company_id, createdBy: admin.account_id, updatedBy: admin.account_id, name: input.name.trim(), category: input.category || 'general', platform: input.platform, contents: parseContents(input.contents) } });
      return view(template);
    },
    async updateMessageTemplate(_, { id, input }, context) {
      const admin = requireAdmin(context);
      await scoped(id, admin.company_id);
      const template = await prisma.messageTemplate.update({ where: { id }, data: { name: input.name.trim(), category: input.category || 'general', platform: input.platform, contents: parseContents(input.contents), updatedBy: admin.account_id } });
      return view(template);
    },
    async deleteMessageTemplate(_, { id }, context) {
      const admin = requireAdmin(context);
      await scoped(id, admin.company_id);
      await prisma.messageTemplate.delete({ where: { id } });
      return true;
    },
  },
};
