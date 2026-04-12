import {
  collectCommandUsageSpecs,
  descriptorsToTree,
  type CliCommandNode,
  type CommandDescriptor,
  type CommandUsageSpec,
  type RestCommandHandler,
} from "../command-spec.js";

const CACHE_COMMAND_DESCRIPTORS = [
  {
    id: "cache.stats",
    path: ["stats"],
    usage: "qa-sdk cache stats                    Redis 캐시 통계 조회",
    handlerKey: "cache.stats",
    options: [
      { flag: "--redis-url", valueHint: "<url>", type: "string", description: "Redis URL ($REDIS_URL)" },
      { flag: "--prefix", valueHint: "<prefix>", type: "string", description: "캐시 prefix 필터 (기본: decode:)" },
    ],
  },
  {
    id: "cache.clear",
    path: ["clear"],
    usage: "qa-sdk cache clear [--prefix <id>]   Redis 캐시 삭제",
    handlerKey: "cache.clear",
    options: [
      { flag: "--redis-url", valueHint: "<url>", type: "string", description: "Redis URL ($REDIS_URL)" },
      { flag: "--prefix", valueHint: "<id>", type: "string", description: "특정 prefix만 삭제 (기본: decode:)" },
      { flag: "--all", type: "boolean", description: "모든 캐시 prefix 삭제" },
    ],
  },
] as const satisfies readonly CommandDescriptor[];

export const CACHE_COMMAND_TREE =
  descriptorsToTree(CACHE_COMMAND_DESCRIPTORS) as readonly CliCommandNode[];

export const CACHE_COMMAND_SPECS =
  collectCommandUsageSpecs(["cache"], CACHE_COMMAND_TREE) as readonly CommandUsageSpec<string>[];

// esbuild가 모듈 경로를 해석하지 못하도록 런타임 import 사용
// ioredis와 @qa-sdk/store는 선택적 의존 — 캐시 명령 실행 시에만 필요
/* eslint-disable @typescript-eslint/no-implied-eval */
const lazyImport = new Function("specifier", "return import(specifier)") as (
  specifier: string,
) => Promise<any>;

async function createRedisAndCache(redisUrl: string, prefix: string) {
  const ioredis = await lazyImport("ioredis");
  const store = await lazyImport("@qa-sdk/store");
  const Redis = ioredis.default;
  const { RedisKeyCache } = store;
  const redis = new Redis(redisUrl);
  const cache = new RedisKeyCache(redis, { prefix });
  return { redis, cache, RedisKeyCache };
}

export const CACHE_HANDLER_REGISTRY: Record<string, RestCommandHandler> = {
  "cache.stats": async (rest) => {
    const { parseArgs } = await import("node:util");
    const { values } = parseArgs({
      args: rest,
      options: {
        "redis-url": { type: "string" },
        prefix: { type: "string" },
      },
      strict: false,
    });

    const redisUrl = (values["redis-url"] as string) || process.env.REDIS_URL;
    if (!redisUrl) {
      console.log("REDIS_URL이 설정되지 않았습니다. --redis-url 또는 REDIS_URL 환경변수를 지정하세요.");
      return;
    }

    const prefix = (values.prefix as string) || "decode:";
    const { redis, cache } = await createRedisAndCache(redisUrl, prefix);

    try {
      const size = await cache.scanSize();
      const info = await redis.info("memory");
      const memMatch = info.match(/used_memory_human:(.+)/);

      console.log(`[캐시 통계] prefix="${prefix}"`);
      console.log(`  키 수: ${size}`);
      console.log(`  Redis 메모리: ${memMatch?.[1]?.trim() ?? "N/A"}`);
    } finally {
      redis.disconnect();
    }
  },

  "cache.clear": async (rest) => {
    const { parseArgs } = await import("node:util");
    const { values } = parseArgs({
      args: rest,
      options: {
        "redis-url": { type: "string" },
        prefix: { type: "string" },
        all: { type: "boolean", default: false },
      },
      strict: false,
    });

    const redisUrl = (values["redis-url"] as string) || process.env.REDIS_URL;
    if (!redisUrl) {
      console.log("REDIS_URL이 설정되지 않았습니다. --redis-url 또는 REDIS_URL 환경변수를 지정하세요.");
      return;
    }

    const prefixes = values.all
      ? ["decode:", "kc:", "reg:"]
      : [(values.prefix as string) || "decode:"];

    const ioredis = await lazyImport("ioredis");
    const store = await lazyImport("@qa-sdk/store");
    const Redis = ioredis.default;
    const { RedisKeyCache } = store;
    const redis = new Redis(redisUrl);

    try {
      for (const p of prefixes) {
        const cache = new RedisKeyCache(redis, { prefix: p });
        const before = await cache.scanSize();
        await cache.clear();
        console.log(`[캐시 삭제] prefix="${p}" — ${before}건 삭제`);
      }
    } finally {
      redis.disconnect();
    }
  },
};
