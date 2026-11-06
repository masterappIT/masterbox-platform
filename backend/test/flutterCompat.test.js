// The Flutter app ships separately and keeps sending the GraphQL it was built with, so every operation it uses
// must stay valid here. This reads the documents straight from the app's source and checks them against the schema.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { makeExecutableSchema } from '@graphql-tools/schema';
import { parse, validate } from 'graphql';
import typeDefs from '../graphQL/typeDefs/index.js';

const APP_FILES = ['../flutter/lib/services/graphql_service.dart', '../flutter/lib/services/realtime_service.dart']
  .map(path => new URL(`../${path}`, import.meta.url));

// The field lists the Dart code puts into its documents with $_name.
const dartConstants = (source) => Object.fromEntries([...source.matchAll(/const (_\w+) =\s*'([^']*)';/g)].map(([, name, value]) => [name, value]));

const appDocuments = () => APP_FILES.filter(fs.existsSync).flatMap((file) => {
  const source = fs.readFileSync(file, 'utf8');
  const constants = dartConstants(source);
  return [...source.matchAll(/r?'''([\s\S]*?)'''|'((?:query|mutation|subscription) [^'\n]*)'/g)]
    .map(match => (match[1] ?? match[2]).replace(/\\\$/g, '$').replace(/\$(_\w+)/g, (all, name) => constants[name] ?? all))
    .filter(text => /^\s*(query|mutation|subscription)\b/.test(text));
});

test('every GraphQL operation the Flutter app sends is still valid', { skip: !APP_FILES.some(fs.existsSync) && 'the Flutter app is not in this checkout' }, () => {
  const schema = makeExecutableSchema({ typeDefs: [...typeDefs] });
  const documents = appDocuments();
  const names = documents.map(text => text.match(/(?:query|mutation|subscription)\s+(\w+)/)?.[1]);
  for (const used of ['ChatRooms', 'Messages', 'SendMessage', 'MarkMessageRead', 'MessageTemplates', 'CreateMessageTemplate', 'UpdateMessageTemplate', 'DeleteMessageTemplate', 'GetUserSubscribedChannels', 'MessageEvents']) {
    assert.ok(names.includes(used), `the app no longer has ${used}; update this test`);
  }
  for (const text of documents) {
    const errors = validate(schema, parse(text)).map(({ message }) => message);
    assert.deepEqual(errors, [], text.trim().split('\n')[0]);
  }
});
