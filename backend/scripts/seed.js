import 'dotenv/config.js';
import bcrypt from 'bcryptjs';
import { prisma } from '../lib/db/prisma.js';

const companyId = 'cm_masterbox_demo_company';
const accountId = 'cm_masterbox_demo_admin';
const channelId = 'cm_masterbox_demo_channel';
const roomId = 'cm_masterbox_demo_room';

async function main() {
  const password = await bcrypt.hash('MasterBox123!', 10);
  const company = await prisma.company.upsert({ where: { id: companyId }, update: {}, create: { id: companyId, chineseName: 'MasterBox 示範公司', englishName: 'MasterBox Demo', email: 'demo-company@masterbox.local', country: 'TW' } });
  const account = await prisma.account.upsert({ where: { id: accountId }, update: { password, companyId: company.id, role: 'admin' }, create: { id: accountId, email: 'demo@masterbox.local', password, companyId: company.id, role: 'admin', userInfo: { name: '示範管理員' } } });
  const channel = await prisma.companyChannel.upsert({ where: { id: channelId }, update: {}, create: { id: channelId, companyId: company.id, platform: 'fb', name: 'MasterBox 測試頻道', accessInfo: { id: 'demo-channel' }, info: { description: 'Local test channel' } } });
  await prisma.accountChannel.upsert({ where: { accountId_channelId: { accountId: account.id, channelId: channel.id } }, update: {}, create: { accountId: account.id, channelId: channel.id } });
  const room = await prisma.chatRoom.upsert({ where: { id: roomId }, update: {}, create: { id: roomId, companyId: company.id, platform: 'fb', channelId: channel.id, chatRoomId: 'demo-room-001', users: [{ id: 'demo-customer', name: '測試客戶' }, { id: channel.id, name: 'MasterBox' }] } });
  if (!(await prisma.message.count({ where: { companyId: company.id } }))) await prisma.message.create({ data: { companyId: company.id, createdBy: account.id, platform: 'fb', contents: '歡迎使用 MasterBox 測試聊天室', recipients: { create: [{ channelId: channel.id, chatRoomIds: [room.chatRoomId] }] } } });
  console.log(JSON.stringify({ email: account.email, password: 'MasterBox123!', channel: channel.name, room: room.chatRoomId }, null, 2));
}
main().catch((error) => { console.error(error); process.exitCode = 1; }).finally(async () => prisma.$disconnect());
