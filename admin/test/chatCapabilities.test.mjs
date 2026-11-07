// The chat room decides what to show from the source's capabilities, never from its platform.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  can, canSendKind, canSendFiles, capabilitiesOf, composerTools, channelSubtitle, sourceLabel, sourcesOfChannels, SOURCES,
} from '../src/components/Chat/capabilities.js';
import { replyWindowOf, replyWindowNotice, windowEndIndex, STANDARD_WINDOW_MS, HUMAN_AGENT_WINDOW_MS } from '../src/utils/replyWindow.js';
import { replyInput } from '../src/utils/chatReply.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const HOUR = 60 * 60 * 1000;
const NOW = Date.parse('2026-11-07T12:00:00Z');
const ago = (ms) => new Date(NOW - ms).toISOString();

// What each source declares today (backend/lib/connectors), so the tests read like the four real conversations.
const FILES = ['send_image', 'send_video', 'send_audio', 'send_document'];
const CAPABILITIES = {
  messenger: [...FILES, 'reply_window'],
  instagram: [...FILES, 'reply_window'],
  whatsapp_cloud: [...FILES, 'caption', 'reply_window', 'templates'],
  whatsapp_web: [...FILES, 'caption'],
};

describe('capabilities', () => {
  test('can only answers for a declared capability', () => {
    assert.equal(can(CAPABILITIES.whatsapp_cloud, 'templates'), true);
    assert.equal(can(CAPABILITIES.messenger, 'templates'), false);
    assert.equal(can(undefined, 'templates'), false);
    assert.equal(can(null, 'reply_window'), false);
  });

  test('a kind of file can be sent only with its send_* capability', () => {
    assert.equal(canSendKind(['send_image'], 'image'), true);
    assert.equal(canSendKind(['send_image'], 'file'), false);
    assert.equal(canSendKind(['send_document'], 'file'), true);
    assert.equal(canSendFiles(['send_audio']), true);
    assert.equal(canSendFiles(['caption', 'templates']), false);
    assert.equal(canSendFiles([]), false);
  });

  test("a conversation uses its own capabilities, else its channel's", () => {
    assert.deepEqual(capabilitiesOf({ capabilities: ['templates'] }, { capabilities: ['send_image'] }), ['templates']);
    assert.deepEqual(capabilitiesOf({}, { capabilities: ['send_image'] }), ['send_image']);
    assert.deepEqual(capabilitiesOf({ capabilities: [] }, { capabilities: ['send_image'] }), []);
    assert.deepEqual(capabilitiesOf(null, null), []);
  });

  test('sources have the names people see', () => {
    assert.equal(sourceLabel('messenger'), 'Facebook');
    assert.equal(sourceLabel('instagram'), 'Instagram');
    assert.equal(sourceLabel('whatsapp_cloud'), 'WhatsApp 官方');
    assert.equal(sourceLabel('whatsapp_web'), 'WhatsApp 掃碼');
    assert.equal(sourceLabel('wechat'), null);
    assert.equal(sourceLabel(null), null);
  });

  test('the names match the server', () => {
    const server = fs.readFileSync(path.join(here, '../../backend/lib/connectors/source.js'), 'utf8');
    for (const source of SOURCES) assert.match(server, new RegExp(`${source}: '${sourceLabel(source)}'`), source);
  });
});

describe('message box tools', () => {
  test('every source writes text; files and templates follow the capabilities', () => {
    assert.deepEqual(composerTools(CAPABILITIES.messenger), { canWrite: true, files: true, templates: false, templateOnly: false });
    assert.deepEqual(composerTools(CAPABILITIES.whatsapp_cloud), { canWrite: true, files: true, templates: true, templateOnly: false });
    assert.deepEqual(composerTools(CAPABILITIES.whatsapp_web), { canWrite: true, files: true, templates: false, templateOnly: false });
    assert.deepEqual(composerTools([]), { canWrite: true, files: false, templates: false, templateOnly: false });
  });

  test('WhatsApp 官方 after 24 hours only takes a template', () => {
    const room = { lastCustomerMessageAt: ago(25 * HOUR) };
    const window = replyWindowOf(room, CAPABILITIES.whatsapp_cloud, NOW);
    assert.equal(window.state, 'closed');
    assert.equal(window.templateRequired, true);
    assert.deepEqual(composerTools(CAPABILITIES.whatsapp_cloud, window), { canWrite: false, files: false, templates: true, templateOnly: true });
  });

  test('a conversation that can\'t be answered here offers nothing to send', () => {
    const window = replyWindowOf({ replyWindow: { state: 'unsupported' } }, [], NOW);
    assert.deepEqual(composerTools([], window), { canWrite: false, files: false, templates: false, templateOnly: false });
  });
});

describe('reply window', () => {
  test('only sources with reply_window have one', () => {
    const room = { lastCustomerMessageAt: ago(30 * 24 * HOUR), replyWindow: { state: 'no_limit' } };
    assert.equal(replyWindowOf(room, CAPABILITIES.whatsapp_web, NOW), null);
    assert.equal(replyWindowOf(room, [], NOW), null);
    assert.notEqual(replyWindowOf(room, CAPABILITIES.messenger, NOW), null);
  });

  test('open for 24 hours after the customer\'s last message', () => {
    const window = replyWindowOf({ lastCustomerMessageAt: ago(2 * HOUR) }, CAPABILITIES.whatsapp_cloud, NOW);
    assert.equal(window.state, 'open');
    assert.equal(window.closesAt, NOW - 2 * HOUR + STANDARD_WINDOW_MS);
    assert.equal(window.templateRequired, false);
    assert.equal(window.windowEndedAt, null);
  });

  test('without templates, 7 more days with the human agent tag once Meta approved it', () => {
    const room = { lastCustomerMessageAt: ago(30 * HOUR), replyWindow: { humanAgentAvailable: true } };
    const window = replyWindowOf(room, CAPABILITIES.instagram, NOW);
    assert.equal(window.state, 'human_agent');
    assert.equal(window.closesAt, NOW - 30 * HOUR + HUMAN_AGENT_WINDOW_MS);
    assert.equal(window.templateRequired, false);
    assert.equal(composerTools(CAPABILITIES.instagram, window).canWrite, true);
    // A source with templates never uses the tag.
    assert.equal(replyWindowOf(room, CAPABILITIES.whatsapp_cloud, NOW).state, 'closed');
  });

  test('Messenger after the window warns but still lets the agent try', () => {
    const window = replyWindowOf({ lastCustomerMessageAt: ago(8 * 24 * HOUR) }, CAPABILITIES.messenger, NOW);
    assert.equal(window.state, 'closed');
    assert.equal(window.templateRequired, false);
    assert.equal(composerTools(CAPABILITIES.messenger, window).canWrite, true);
    const notice = replyWindowNotice(window, { capabilities: CAPABILITIES.messenger, sourceName: 'Facebook' }, NOW);
    assert.equal(notice.templateAction, false);
  });

  test('a customer who hasn\'t written yet: templates where the source has them', () => {
    const cloud = replyWindowOf({}, CAPABILITIES.whatsapp_cloud, NOW);
    assert.equal(cloud.state, 'no_customer_message');
    assert.equal(cloud.templateRequired, true);
    assert.equal(replyWindowNotice(cloud, { capabilities: CAPABILITIES.whatsapp_cloud }, NOW).templateAction, true);
    const messenger = replyWindowOf({}, CAPABILITIES.messenger, NOW);
    assert.equal(messenger.templateRequired, false);
  });

  test('the notice says why and offers 選擇範本 once only a template can go', () => {
    const room = { lastCustomerMessageAt: '2026-11-06T02:12:00Z' };
    const now = Date.parse('2026-11-07T12:00:00Z');
    const window = replyWindowOf(room, CAPABILITIES.whatsapp_cloud, now);
    const notice = replyWindowNotice(window, { capabilities: CAPABILITIES.whatsapp_cloud, lastCustomerMessageAt: room.lastCustomerMessageAt, sourceName: 'WhatsApp 官方' }, now);
    assert.equal(notice.title, '已超過 24 小時回覆期限');
    assert.match(notice.detail, /WhatsApp 官方規定之後只能傳送已核准的範本/);
    assert.match(notice.detail, /客戶最後一則訊息在 /);
    assert.equal(notice.templateAction, true);
  });

  test('no notice while plenty of time is left, a countdown near the end', () => {
    const plenty = replyWindowOf({ lastCustomerMessageAt: ago(2 * HOUR) }, CAPABILITIES.whatsapp_cloud, NOW);
    assert.equal(replyWindowNotice(plenty, { capabilities: CAPABILITIES.whatsapp_cloud }, NOW), null);
    const soon = replyWindowOf({ lastCustomerMessageAt: ago(22 * HOUR) }, CAPABILITIES.whatsapp_cloud, NOW);
    assert.match(replyWindowNotice(soon, { capabilities: CAPABILITIES.whatsapp_cloud }, NOW).title, /^回覆期限剩 2 小時/);
    assert.equal(replyWindowNotice(null, { capabilities: [] }, NOW), null);
  });

  test('the 期限到期 line goes before the first message after the 24 hours', () => {
    const last = ago(30 * HOUR);
    const messages = [
      { createdAt: ago(31 * HOUR) },
      { createdAt: last },
      { createdAt: ago(3 * HOUR) },
    ];
    assert.equal(windowEndIndex(messages, last, NOW), 2);
    assert.equal(windowEndIndex(messages.slice(0, 2), last, NOW), 2);
    assert.equal(windowEndIndex(messages, ago(HOUR), NOW), -1);
    assert.equal(windowEndIndex(messages, null, NOW), -1);
  });
});

describe('channels', () => {
  test('the channel menu shows the phone number or the page name, never the internal id', () => {
    assert.equal(channelSubtitle({ channel_id: '1234567890', source: 'whatsapp_cloud', name: 'MasterBox 客服', phone: '+886 912 345 678' }), 'WhatsApp 官方・+886 912 345 678');
    assert.equal(channelSubtitle({ channel_id: '1234567890', source: 'whatsapp_web', name: '門市', phone: '+886 987 654 321' }), 'WhatsApp 掃碼・+886 987 654 321');
    assert.equal(channelSubtitle({ channel_id: '1234567890', source: 'messenger', name: 'MasterBox 粉專', phone: null }), 'Facebook・MasterBox 粉專');
    assert.equal(channelSubtitle({ channel_id: '1234567890', source: null, name: 'WeChat', phone: null }), 'WeChat');
    assert.doesNotMatch(channelSubtitle({ channel_id: '1234567890', source: 'instagram', name: 'masterbox.tw' }), /1234567890/);
  });

  test('the list filters on the sources of the channels, WhatsApp 官方 and 掃碼 apart', () => {
    const channels = [{ source: 'whatsapp_web' }, { source: 'messenger' }, { source: 'whatsapp_cloud' }, { source: 'messenger' }, { source: null }];
    assert.deepEqual(sourcesOfChannels(channels), ['messenger', 'whatsapp_cloud', 'whatsapp_web']);
    assert.deepEqual(sourcesOfChannels([]), []);
  });
});

describe('replies', () => {
  test('every source sends the same text and attachments', () => {
    const attachment = { type: 'image', payload: { url: 'https://files.example/a.png' }, filename: 'a.png', mime_type: 'image/png', size: 10 };
    for (const platform of ['fb', 'ig', 'whatsapp']) {
      const input = replyInput({ chat_room_id: 'c1', channel_id: 'ch1', platform }, { text: '你好', attachments: [attachment] });
      assert.deepEqual(JSON.parse(input.contents), { text: '你好', attachments: [attachment] });
      assert.equal(input.to_chat_room_id, 'c1');
      assert.equal(input.channel_id, 'ch1');
    }
    assert.deepEqual(JSON.parse(replyInput({ chat_room_id: 'c1' }, { text: '只有文字' }).contents), { text: '只有文字' });
  });
});

test('the chat room checks capabilities, not platforms', () => {
  // Quick replies are labelled with the platform they were written for and list the conversation's first; matching
  // that label decides an order, not a feature.
  const files = [
    ...fs.readdirSync(path.join(here, '../src/components/Chat')).filter((name) => name !== 'QuickReplyPicker.js').map((name) => `src/components/Chat/${name}`),
    'src/utils/replyWindow.js',
    'src/utils/chatReply.js',
    'pages/index.js',
  ];
  for (const file of files) {
    const code = fs.readFileSync(path.join(here, '..', file), 'utf8')
      // Comments may name platforms.
      .replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');
    assert.doesNotMatch(code, /platform\s*[!=]==|[!=]==\s*['"](fb|ig|whatsapp|line|wechat)['"]|isWhatsapp|isMeta\b/, file);
  }
});
