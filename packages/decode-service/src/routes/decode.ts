import { Hono } from "hono";
import type { PrefixDecoder } from "index-meta";
import type { DecoderPool } from "../lib/decoder-pool.js";
import { AppError, decoderNotLoaded } from "../lib/errors.js";
import {
  decodeRequestSchema,
  decodeBatchRequestSchema,
  decodeDeepRequestSchema,
} from "../schemas/decode.js";

export interface DecodeDeps {
  pool: DecoderPool;
}

export function createDecodeRoutes(deps: DecodeDeps) {
  const { pool } = deps;
  const app = new Hono();

  // ── POST /decode ─────────────────────────────────────────────────────────

  app.post("/decode", async (c) => {
    const body = await c.req.json();
    const req = decodeRequestSchema.parse(body);

    const decoder = resolveDecoder(pool, req.input, req.prefix, req.version);
    const vv = decoder.resolve(req.input);
    const entities = decoder.decode(req.input);

    return c.json({
      indexId: vv.indexId,
      versionId: vv.versionId,
      value: vv.value,
      entities,
    });
  });

  // ── POST /decode/batch ───────────────────────────────────────────────────

  app.post("/decode/batch", async (c) => {
    const body = await c.req.json();
    const req = decodeBatchRequestSchema.parse(body);

    const decoder = pool.get(req.prefix, req.version);
    if (!decoder) throw decoderNotLoaded(req.prefix, req.version);

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
 * input 타입과 prefix/version 조합에 따라 decoder를 찾는다.
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

  // 4. 둘 다 없고 string → auto-detect
  for (const decoder of pool.values()) {
    if (decoder.detect(input) !== null) {
      return decoder;
    }
  }

  throw new AppError(
    "NOT_FOUND",
    `no decoder could detect the input format: "${input}"`,
    404,
  );
}
