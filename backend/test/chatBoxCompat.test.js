// Chat Box (/chat-management) is its own chat room, separate from the inbox at /, and keeps its own GraphQL.
// Inbox work must not break it, so this reads the documents straight from the page and checks them against the schema.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { makeExecutableSchema } from '@graphql-tools/schema';
import { parse, validate } from 'graphql';
import typeDefs from '../graphQL/typeDefs/index.js';

const PAGE = new URL('../../admin/src/components/ChatManagement/ChatManagement.js', import.meta.url);

const pageDocuments = () => [...fs.readFileSync(PAGE, 'utf8').matchAll(/gql`([\s\S]*?)`/g)].map(([, text]) => text);

test('every GraphQL operation Chat Box sends is still valid', { skip: !fs.existsSync(PAGE) && 'the admin is not in this checkout' }, () => {
  const schema = makeExecutableSchema({ typeDefs: [...typeDefs] });
  const documents = pageDocuments();
  const names = documents.map(text => text.match(/(?:query|mutation|subscription)\s+(\w+)/)?.[1]);
  for (const used of ['ChatManagementRooms', 'ChatManagementMessages', 'ChatManagementSendMessage']) {
    assert.ok(names.includes(used), `Chat Box no longer has ${used}; update this test`);
  }
  for (const text of documents) {
    const errors = validate(schema, parse(text)).map(({ message }) => message);
    assert.deepEqual(errors, [], text.trim().split('\n')[0]);
  }
});
