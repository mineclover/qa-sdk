// @def.boundary sim-gateway
// @def.doc authorization-ontology-bitmap-pipeline

import type { MiddlewareHandler } from "hono";
import { JwtVerifyError, verifyBitmapJwt } from "../lib/jwt.js";

export interface JwtVerifyOptions {
  secret: string;
  /** §2 §6 unified version — 현재 활성 bitmap version. mismatch 시 refresh 강제. */
  currentBitmapV: string;
}

/**
 * Authorization: Bearer <jwt> 검증 → 성공 시 downstream에 header 주입:
 *   x-user-id              — JWT sub
 *   x-user-bitmap-prefix   — claim.bitmap_prefix
 *   x-user-bitmap-v        — claim.bitmap_v
 *   x-user-bitmap-mask     — base64 mask
 *
 * 실패:
 *   - 헤더 없음/형식 오류 → 401
 *   - signature/expired/malformed → 401 + WWW-Authenticate: invalid_token
 *   - version mismatch → 401 + WWW-Authenticate: refresh_required (§2 §6)
 */
export function jwtVerifyMiddleware(opts: JwtVerifyOptions): MiddlewareHandler {
  return async (c, next) => {
    const auth = c.req.header("authorization") ?? c.req.header("Authorization");
    if (!auth || !/^Bearer\s+/i.test(auth)) {
      return c.json({ error: "unauthorized", reason: "missing_bearer" }, 401);
    }
    const token = auth.replace(/^Bearer\s+/i, "").trim();
    try {
      const verified = await verifyBitmapJwt(token, opts.secret);
      // §2 §6 unified version binding 검증
      if (verified.bitmap.v !== opts.currentBitmapV) {
        c.header(
          "WWW-Authenticate",
          `Bearer error="refresh_required", current_v="${opts.currentBitmapV}"`,
        );
        return c.json(
          { error: "version_mismatch", expected: opts.currentBitmapV, got: verified.bitmap.v },
          401,
        );
      }
      // Hono req.raw.headers는 mutable Web Headers — downstream fetch에서 활용.
      c.req.raw.headers.set("x-user-id", verified.userId);
      c.req.raw.headers.set("x-user-bitmap-prefix", verified.bitmap.prefix);
      c.req.raw.headers.set("x-user-bitmap-v", verified.bitmap.v);
      c.req.raw.headers.set(
        "x-user-bitmap-mask",
        Buffer.from(verified.bitmap.mask).toString("base64"),
      );
      c.set("verifiedJwt", verified);
      await next();
      return;
    } catch (err) {
      if (err instanceof JwtVerifyError) {
        c.header(
          "WWW-Authenticate",
          `Bearer error="invalid_token", reason="${err.reason}"`,
        );
        return c.json({ error: "invalid_token", reason: err.reason }, 401);
      }
      throw err;
    }
  };
}
