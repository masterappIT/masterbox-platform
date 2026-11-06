import test from 'node:test';
import assert from 'node:assert/strict';
import { toMasterboxMessage, customerOf, isCustomerChat, sendOptions } from '../src/messages.js';

const msg = (fields) => ({ id: { _serialized: 'false_886912345678@c.us_ABC' }, from: '886912345678@c.us', to: '886955000111@c.us', fromMe: false, timestamp: 1767225600, ...fields });

test('a customer text becomes a message in the customer chat', () => {
  const message = toMasterboxMessage(msg({ type: 'chat', body: '你好' }));
  assert.equal(message.chatId, '886912345678@c.us');
  assert.equal(message.fromMe, false);
  assert.equal(message.sentAt, '2026-01-01T00:00:00.000Z');
  assert.deepEqual(message.contents, { id: 'false_886912345678@c.us_ABC', timestamp: '1767225600', text: '你好' });
});

test('a message sent from the phone belongs to the chat it went to', () => {
  const message = toMasterboxMessage(msg({ fromMe: true, type: 'chat', body: 'ok', from: '886955000111@c.us', to: '886912345678@c.us' }));
  assert.equal(message.chatId, '886912345678@c.us');
  assert.equal(message.fromMe, true);
});

test('groups, status updates and notices are left out', () => {
  assert.equal(toMasterboxMessage(msg({ type: 'chat', body: 'hi', from: '120363@g.us' })), null);
  assert.equal(toMasterboxMessage(msg({ type: 'chat', body: 'hi', from: 'status@broadcast', isStatus: true })), null);
  assert.equal(toMasterboxMessage(msg({ type: 'e2e_notification', body: '' })), null);
  assert.equal(toMasterboxMessage(msg({ type: 'chat', body: '   ' })), null);
});

test('a picture keeps its caption and is marked for download', () => {
  const message = toMasterboxMessage(msg({ type: 'image', body: '看這個', hasMedia: true, _data: { mimetype: 'image/jpeg' } }));
  assert.equal(message.hasMedia, true);
  assert.equal(message.contents.text, '看這個');
  assert.deepEqual(message.contents.attachments, [{ type: 'image', mime_type: 'image/jpeg', wa_web_media: true }]);
});

test('a voice message is audio without a caption', () => {
  const message = toMasterboxMessage(msg({ type: 'ptt', body: 'base64junk', hasMedia: true, _data: { mimetype: 'audio/ogg; codecs=opus' } }));
  assert.equal(message.contents.text, undefined);
  assert.equal(message.contents.attachments[0].type, 'audio');
});

test('locations and contact cards are shown as what they are', () => {
  const location = toMasterboxMessage(msg({ type: 'location', location: { latitude: '25.03', longitude: '121.56', description: '台北 101' } }));
  assert.deepEqual(location.contents.attachments[0], { type: 'location', caption: '台北 101', payload: { coordinates: { lat: 25.03, long: 121.56 } } });
  const card = toMasterboxMessage(msg({ type: 'vcard', body: 'BEGIN:VCARD\nVERSION:3.0\nFN:王小明\nEND:VCARD' }));
  assert.deepEqual(card.contents.attachments[0], { type: 'contacts', caption: '王小明' });
});

test('newer chat ids (lid) count as customers', () => {
  assert.equal(isCustomerChat('123456789012345@lid'), true);
  assert.equal(isCustomerChat('120363@newsletter'), false);
});

test('a customer is named from the address book, then their own name, then the number', () => {
  assert.deepEqual(customerOf('886912345678@c.us', { name: '王先生', pushname: 'Wang', number: '886912345678' }), { id: '886912345678@c.us', name: '王先生', phone: '+886912345678' });
  assert.deepEqual(customerOf('886912345678@c.us', { pushname: 'Wang' }), { id: '886912345678@c.us', name: 'Wang' });
  assert.deepEqual(customerOf('886912345678@c.us', { number: '886912345678' }), { id: '886912345678@c.us', name: '+886912345678', phone: '+886912345678' });
  assert.deepEqual(customerOf('886912345678@c.us', null), { id: '886912345678@c.us' });
});

test('files that are not pictures, videos or audio go as documents', () => {
  assert.deepEqual(sendOptions({ text: 'hi' }), { content: 'hi', options: {} });
  assert.deepEqual(sendOptions({ text: '報價單', media: { url: 'x' }, sendType: 'document' }), { content: 'media', options: { caption: '報價單', sendMediaAsDocument: true } });
  assert.deepEqual(sendOptions({ media: { url: 'x' }, sendType: 'image' }), { content: 'media', options: {} });
});
