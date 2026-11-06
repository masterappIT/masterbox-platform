// The Flutter app ships separately and keeps sending the GraphQL it was built with, so every operation it uses
// must stay valid here: the ones installed copies send (frozen in test/fixtures), and the ones in the app's source now.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { makeExecutableSchema } from '@graphql-tools/schema';
import { parse, validate } from 'graphql';
import typeDefs from '../graphQL/typeDefs/index.js';

const APP_FILES = ['../flutter/lib/services/graphql_service.dart', '../flutter/lib/services/realtime_service.dart']
  .map(path => new URL(`../${path}`, import.meta.url));
const RELEASED = new URL('./fixtures/flutter-app-1.0.0.graphql', import.meta.url);

// The field lists the Dart code puts into its documents with $_name.
const dartConstants = (source) => Object.fromEntries([...source.matchAll(/const (_\w+) =\s*'([^']*)';/g)].map(([, name, value]) => [name, value]));

const appDocuments = () => APP_FILES.filter(fs.existsSync).flatMap((file) => {
  const source = fs.readFileSync(file, 'utf8');
  const constants = dartConstants(source);
  return [...source.matchAll(/r?'''([\s\S]*?)'''|'((?:query|mutation|subscription) [^'\n]*)'/g)]
    .map(match => (match[1] ?? match[2]).replace(/\\\$/g, '$').replace(/\$(_\w+)/g, (all, name) => constants[name] ?? all))
    .filter(text => /^\s*(query|mutation|subscription)\b/.test(text));
});

const releasedDocuments = () => fs.readFileSync(RELEASED, 'utf8').split(/\n(?=query |mutation |subscription )/)
  .map(text => text.replace(/^#.*$/gm, '').trim())
  .filter(Boolean);

const operationName = text => text.match(/(?:query|mutation|subscription)\s+(\w+)/)?.[1];

const checkAll = (documents) => {
  const schema = makeExecutableSchema({ typeDefs: [...typeDefs] });
  for (const text of documents) {
    const errors = validate(schema, parse(text)).map(({ message }) => message);
    assert.deepEqual(errors, [], text.trim().split('\n')[0]);
  }
};

test('the GraphQL installed copies of the Flutter app send is still valid', () => {
  const documents = releasedDocuments();
  const names = documents.map(operationName);
  for (const used of ['ChatRooms', 'Messages', 'SendMessage', 'MarkMessageRead', 'GetUserSubscribedChannels', 'MessageEvents']) {
    assert.ok(names.includes(used), `the frozen operations lost ${used}`);
  }
  assert.equal(documents.length, 23);
  checkAll(documents);
});

test('every GraphQL operation the Flutter app sends now is valid', { skip: !APP_FILES.some(fs.existsSync) && 'the Flutter app is not in this checkout' }, () => {
  const documents = appDocuments();
  const names = documents.map(operationName);
  for (const used of ['ChatRoomPage', 'ChatRoom', 'MessagePage', 'SendMessage', 'MarkChatRoomRead', 'WhatsappTemplates', 'SendWhatsappTemplate',
    'QuickReplies', 'RegisterPushDevice', 'UnregisterPushDevice', 'MessageEvents', 'ChatRoomUpdates']) {
    assert.ok(names.includes(used), `the app no longer has ${used}; update this test`);
  }
  checkAll(documents);
});
