import { Hono } from "hono";
import type { KeyCache } from "@qa-sdk/core";
import { PrefixDecoder, PrefixDecoderBig } from "index-meta";
import type { DecoderPool } from "../lib/decoder-pool.js";
import { AppError, decoderNotLoaded } from "../lib/errors.js";
import {
  decodeRequestSchema,
  decodeBatchRequestSchema,
  decodeDeepRequestSchema,
  decodeBigRequestSchema,
  decodeBigBatchRequestSchema,
  decodeBigDeepRequestSchema,
} from "../schemas/decode.js";

export interface DecodeDeps {
  pool: DecoderPool;
  /** Redis L2 캐시 (없으면 L1 only) */
  decodeCache?: KeyCache;
  /** 캐시 TTL (밀리초) */
  cacheTtlMs?: number;
}

export function createDecodeRoutes(deps: DecodeDeps) {
  const { pool } = deps;
  const app = new Hono();

  // ── POST /decode ─────────────────────────────────────────────────────────

  app.post("/decode", async (c) => {
    const body = await c.req.json();
    const req = decodeRequestSchema.parse(body);

    // L2 캐시 조회
    const cacheKey = `${req.prefix ?? "auto"}:${req.version ?? "auto"}:${req.input}`;
    if (deps.decodeCache) {
      try {
        const cached = await deps.decodeCache.get(cacheKey);
        if (cached) return c.json(cached);
      } catch {
        // fail-open: 캐시 실패 → decode 진행
      }
    }

    const decoder = resolveDecoder(pool, req.input, req.prefix, req.version);
    const vv = decoder.resolve(req.input);
    const entities = decoder.decode(req.input);
    const result = {
      indexId: vv.indexId,
      versionId: vv.versionId,
      value: vv.value,
      entities,
    };

    // L2 캐시 저장
    if (deps.decodeCache) {
      try {
        await deps.decodeCache.set(cacheKey, result, deps.cacheTtlMs ?? 60_000);
      } catch {
        // fail-open
      }
    }

    return c.json(result);
  });

  // ── POST /decode/batch ───────────────────────────────────────────────────

  app.post("/decode/batch", async (c) => {
    const body = await c.req.json();
    const req = decodeBatchRequestSchema.parse(body);

    const raw = pool.get(req.prefix, req.version);
    if (!raw) throw decoderNotLoaded(req.prefix, req.version);
    if (raw instanceof PrefixDecoderBig) {
      throw new AppError(
        "INVALID_INPUT",
        `decoder "${req.prefix}/${req.version}" is BigInt-typed. Use /decode/big/batch instead.`,
        400,
      );
    }
    const decoder = raw;

    const results = req.inputs.map((input) => {
      const vv = decoder.resolve(input);
      const entities = decoder.decode(input);
      return { value: vv.value, entities };
    });

    return c.json({ results });
  });

  // ── POST /decode/deep ────────────────────────────────────────────────────

  app.post("/decode/deep", async (c) => {
    const body = await c.req.json();
    const req = decodeDeepRequestSchema.parse(body);

    const decoder = resolveDecoder(pool, req.input, req.prefix, req.version);
    const { entities, refs, unresolved } = decoder.decodeDeepDetailed(req.input);

    return c.json({
      entities,
      refs,
      ...(unresolved.length > 0 ? { unresolved } : {}),
    });
  });

  // ── POST /decode/big ─────────────────────────────────────────────────────

  app.post("/decode/big", async (c) => {
    const body = await c.req.json();
    const req = decodeBigRequestSchema.parse(body);

    const decoder = resolveBigDecoder(pool, req.prefix, req.version);
    const input = parseBigIntInput(req.input);
    const vv = decoder.resolve(input);
    const entities = decoder.decode(input);

    return c.json({
      indexId: vv.indexId,
      versionId: vv.versionId,
      value: vv.value.toString(),
      entities,
    });
  });

  // ── POST /decode/big/batch ───────────────────────────────────────────────

  app.post("/decode/big/batch", async (c) => {
    const body = await c.req.json();
    const req = decodeBigBatchRequestSchema.parse(body);

    const decoder = resolveBigDecoder(pool, req.prefix, req.version);

    const results = req.inputs.map((inputStr) => {
      const input = parseBigIntInput(inputStr);
      const entities = decoder.decode(input);
      return { value: input.toString(), entities };
    });

    return c.json({ results });
  });

  // ── POST /decode/big/deep ────────────────────────────────────────────────

  app.post("/decode/big/deep", async (c) => {
    const body = await c.req.json();
    const req = decodeBigDeepRequestSchema.parse(body);

    const decoder = resolveBigDecoder(pool, req.prefix, req.version);
    const input = parseBigIntInput(req.input);
    const { entities, refs, unresolved } = decoder.decodeDeepDetailed(input);

    return c.json({
      entities,
      refs,
      ...(unresolved.length > 0 ? { unresolved } : {}),
    });
  });

  // ── GET /decode-map/:prefix/:version ─────────────────────────────────────

  app.get("/decode-map/:prefix/:version", (c) => {
    const prefix = c.req.param("prefix");
    const version = c.req.param("version");

    const decoder = pool.get(prefix, version);
    if (!decoder) throw decoderNotLoaded(prefix, version);

    return c.json(decoder.toDecodeMap());
  });

  return app;
}

// ── 내부 헬퍼 ────────────────────────────────────────────────────────────────

/**
 * BigInt input 문자열을 파싱한다.
 * @throws {AppError} 유효하지 않은 bigint 문자열
 */
function parseBigIntInput(input: string): bigint {
  try {
    return BigInt(input);
  } catch {
    throw new AppError(
      "INVALID_INPUT",
      `invalid BigInt input: "${input}"`,
      400,
    );
  }
}

/**
 * BigInt decoder를 조회한다.
 * @throws {AppError} 로드 안 됨 또는 Number decoder
 */
function resolveBigDecoder(
  pool: DecoderPool,
  prefix: string,
  version: string,
): PrefixDecoderBig {
  const decoder = pool.get(prefix, version);
  if (!decoder) throw decoderNotLoaded(prefix, version);
  if (!(decoder instanceof PrefixDecoderBig)) {
    throw new AppError(
      "INVALID_INPUT",
      `decoder "${prefix}/${version}" is not BigInt-typed. Use /decode instead.`,
      400,
    );
  }
  return decoder;
}

/**
 * input 타입과 prefix/version 조합에 따라 Number decoder를 찾는다.
 *
 * 우선순위:
 * 1. prefix + version 명시 → 직접 조회
 * 2. string 입력, prefix/version 미지정 → pool 내 auto-detect
 * 3. number 입력, prefix/version 미지정 → 에러
 * 4. prefix 또는 version 하나만 있으면 → 에러
 */
function resolveDecoder(
  pool: DecoderPool,
  input: number | string,
  prefix?: string,
  version?: string,
): PrefixDecoder {
  // 1. 둘 다 있으면 직접 조회
  if (prefix && version) {
    const decoder = pool.get(prefix, version);
    if (!decoder) throw decoderNotLoaded(prefix, version);
    if (decoder instanceof PrefixDecoderBig) {
      throw new AppError(
        "INVALID_INPUT",
        `decoder "${prefix}/${version}" is BigInt-typed. Use /decode/big instead.`,
        400,
      );
    }
    return decoder;
  }

  // 2. 하나만 있으면 불완전 — 에러
  if (prefix || version) {
    throw new AppError(
      "INVALID_INPUT",
      `both prefix and version are required (got prefix=${prefix ?? "undefined"}, version=${version ?? "undefined"})`,
      400,
    );
  }

  // 3. 둘 다 없고 number → 특정 불가
  if (typeof input === "number") {
    throw new AppError(
      "INVALID_INPUT",
      "prefix and version are required when input is a number",
      400,
    );
  }

  // 4. 둘 다 없고 string → auto-detect (Number decoder만)
  for (const decoder of pool.values()) {
    if (decoder instanceof PrefixDecoder && decoder.detect(input) !== null) {
      return decoder;
    }
  }

  throw new AppError(
    "NOT_FOUND",
    `no decoder could detect the input format: "${input}"`,
    404,
  );
}
