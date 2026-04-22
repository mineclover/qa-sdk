// @def.boundary sim-gateway
// @def.doc authorization-ontology-bitmap-pipeline

import { Hono } from "hono";
import { z } from "zod";
import { signBitmapJwt } from "../lib/jwt.js";
import type { VersionedBitmap } from "permission-engine";

export interface LoginRouteOptions {
  authApiUrl: string;
  jwtSecret: string;
  jwtTtlSeconds: number;
}

const loginBodySchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

const authResponseSchema = z.object({
  userId: z.string().min(1),
  displayName: z.string().optional(),
  departmentId: z.string().nullable().optional(),
});

const bitmapResponseSchema = z.object({
  prefix: z.string(),
  v: z.string(),
  maskBase64: z.string(),
  issuedAt: z.string(),
  expiresAt: z.string(),
  issuer: z.string(),
  signature: z.string(),
});

/**
 * POST /auth/login — 로그인 위임 + bitmap 발급 + JWT embed.
 *
 * 흐름:
 *   1. body { email, password } 검증
 *   2. auth-api POST /auth/authenticate → userId
 *   3. auth-api POST /bitmap/issue { userId } → VersionedBitmap (mask는 base64)
 *   4. signBitmapJwt → JWT 응답
 *
 * 모든 단계 fail-fast — silent fallback 없음.
 */
export function createLoginRoute(opts: LoginRouteOptions) {
  const r = new Hono();
  r.post("/auth/login", async (c) => {
    let body: unknown;
    try {
      body = await c.req.json();
    } catch {
      return c.json({ error: "invalid_json_body" }, 400);
    }
    const parsed = loginBodySchema.safeParse(body);
    if (!parsed.success) {
      return c.json(
        { error: "invalid_credentials_payload", issues: parsed.error.issues },
        400,
      );
    }

    // 1. 인증 위임
    const authRes = await fetch(`${opts.authApiUrl}/auth/authenticate`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(parsed.data),
      signal: AbortSignal.timeout(5_000),
    });
    if (authRes.status === 401) {
      return c.json({ error: "invalid_credentials" }, 401);
    }
    if (!authRes.ok) {
      return c.json(
        { error: "auth_upstream_failure", status: authRes.status },
        502,
      );
    }
    let authJson: unknown;
    try {
      authJson = await authRes.json();
    } catch {
      return c.json({ error: "auth_upstream_invalid_json" }, 502);
    }
    const authParsed = authResponseSchema.safeParse(authJson);
    if (!authParsed.success) {
      return c.json(
        { error: "auth_upstream_schema", issues: authParsed.error.issues },
        502,
      );
    }

    // 2. bitmap 발급
    const bmRes = await fetch(`${opts.authApiUrl}/bitmap/issue`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ userId: authParsed.data.userId }),
      signal: AbortSignal.timeout(5_000),
    });
    if (!bmRes.ok) {
      return c.json(
        { error: "bitmap_upstream_failure", status: bmRes.status },
        502,
      );
    }
    let bmJson: unknown;
    try {
      bmJson = await bmRes.json();
    } catch {
      return c.json({ error: "bitmap_upstream_invalid_json" }, 502);
    }
    const bmParsed = bitmapResponseSchema.safeParse(bmJson);
    if (!bmParsed.success) {
      return c.json(
        { error: "bitmap_upstream_schema", issues: bmParsed.error.issues },
        502,
      );
    }

    const bitmap: VersionedBitmap = {
      prefix: bmParsed.data.prefix,
      v: bmParsed.data.v,
      mask: new Uint8Array(Buffer.from(bmParsed.data.maskBase64, "base64")),
      issuedAt: bmParsed.data.issuedAt,
      expiresAt: bmParsed.data.expiresAt,
      issuer: bmParsed.data.issuer,
      signature: bmParsed.data.signature,
    };

    // 3. JWT 발급
    const token = await signBitmapJwt({
      userId: authParsed.data.userId,
      bitmap,
      secret: opts.jwtSecret,
      ttlSeconds: opts.jwtTtlSeconds,
    });

    return c.json({
      token,
      tokenType: "Bearer",
      expiresIn: opts.jwtTtlSeconds,
      userId: authParsed.data.userId,
      bitmapPrefix: bitmap.prefix,
      bitmapV: bitmap.v,
    });
  });

  return r;
}
