import { RedisPubSub } from 'graphql-redis-subscriptions';
import Redis from 'ioredis'
import 'dotenv/config.js'

const url = process.env.REDIS_CONNECTION;

const noopPubSub = {
  asyncIterator() {
    throw new Error('Redis is not configured for subscriptions.');
  },
  publish() {
    return Promise.resolve();
  },
};

export const pubsub = url
  ? new RedisPubSub({
      publisher: new Redis(url),
      subscriber: new Redis(url),
    })
  : noopPubSub;

