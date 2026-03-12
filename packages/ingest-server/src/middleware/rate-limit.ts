import type { Context, MiddlewareHandler } from "hono";

const DEFAULT_RATE_LIMIT_WINDOW_MS = 60_000;
const DEFAULT_RATE_LIMIT_MAX_REQUESTS = 100;

interface RateLimitBucket {
  timestamps: number[];
}

export interface RateLimiterOptions {
  maxRequests?: number;
  now?: () => number;
  windowMs?: number;
}

export function createIngestRateLimiter(
  options: RateLimiterOptions = {},
): MiddlewareHandler {
  const windowMs = options.windowMs ?? DEFAULT_RATE_LIMIT_WINDOW_MS;
  const maxRequests = options.maxRequests ?? DEFAULT_RATE_LIMIT_MAX_REQUESTS;
  const now = options.now ?? Date.now;
  const buckets = new Map<string, RateLimitBucket>();

  return async (c, next) => {
    if (c.req.method !== "POST") {
      await next();
      return;
    }

    const clientKey = resolveClientKey(c);
    const currentTime = now();
    const bucket = getOrCreateBucket(buckets, clientKey);

    pruneExpiredRequests(bucket.timestamps, currentTime, windowMs);

    const resetAt = getResetAt(bucket.timestamps, currentTime, windowMs);

    if (bucket.timestamps.length >= maxRequests) {
      const retryAfterMs = Math.max(0, resetAt - currentTime);
      setRateLimitHeaders(c, {
        limit: maxRequests,
        remaining: 0,
        resetAt,
      });

      return c.json(
        {
          error: {
            code: "RATE_LIMITED",
            message: `rate limit exceeded for POST /v1/ingest (max ${maxRequests} requests per ${windowMs}ms window)`,
            retryAfterMs,
          },
        },
        429,
      );
    }

    bucket.timestamps.push(currentTime);
    setRateLimitHeaders(c, {
      limit: maxRequests,
      remaining: Math.max(0, maxRequests - bucket.timestamps.length),
      resetAt: getResetAt(bucket.timestamps, currentTime, windowMs),
    });

    await next();
  };
}

function getOrCreateBucket(
  buckets: Map<string, RateLimitBucket>,
  clientKey: string,
) {
  const existing = buckets.get(clientKey);
  if (existing) {
    return existing;
  }

  const bucket = { timestamps: [] };
  buckets.set(clientKey, bucket);
  return bucket;
}

function pruneExpiredRequests(
  timestamps: number[],
  currentTime: number,
  windowMs: number,
) {
  const cutoff = currentTime - windowMs;

  while (timestamps[0] !== undefined && timestamps[0] <= cutoff) {
    timestamps.shift();
  }
}

function getResetAt(
  timestamps: number[],
  currentTime: number,
  windowMs: number,
) {
  return timestamps[0] === undefined
    ? currentTime + windowMs
    : timestamps[0] + windowMs;
}

function setRateLimitHeaders(
  c: Context,
  values: {
    limit: number;
    remaining: number;
    resetAt: number;
  },
) {
  c.header("X-RateLimit-Limit", String(values.limit));
  c.header("X-RateLimit-Remaining", String(values.remaining));
  c.header("X-RateLimit-Reset", String(values.resetAt));
}

function resolveClientKey(c: Context) {
  const forwardedFor = c.req.header("x-forwarded-for");
  if (forwardedFor) {
    const forwardedAddress = forwardedFor
      .split(",")
      .map((part) => part.trim())
      .find((part) => part.length > 0);

    if (forwardedAddress) {
      return forwardedAddress;
    }
  }

  const nodeBindings = (c.env ?? {}) as {
    incoming?: {
      socket?: {
        remoteAddress?: string;
      };
    };
    server?: {
      incoming?: {
        socket?: {
          remoteAddress?: string;
        };
      };
    };
  };

  return (
    nodeBindings.server?.incoming?.socket?.remoteAddress ??
    nodeBindings.incoming?.socket?.remoteAddress ??
    "unknown"
  );
}
