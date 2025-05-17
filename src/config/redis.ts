import Redis from "ioredis";

let redis: Redis;
let pubClient: Redis;
let subClient: Redis;

export const initRedisClients = () => {
  const redisOptions = {
    host: process.env.REDIS_HOST || "localhost",
    port: Number(process.env.REDIS_PORT) || 6379,
    password: process.env.REDIS_PASSWORD || undefined,
  };

  redis = new Redis(redisOptions);
  pubClient = new Redis(redisOptions);
  subClient = pubClient.duplicate();
};

export { redis, pubClient, subClient };
