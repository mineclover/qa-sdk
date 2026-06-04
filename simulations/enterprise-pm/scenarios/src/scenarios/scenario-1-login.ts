// @def.boundary sim-scenarios
// @def.doc authorization-ontology-bitmap-pipeline

import { ok } from "node:assert/strict";
import type { Scenario } from "../runner/types.js";

interface S1Ctx {
  email: string;
  password: string;
  jwtSecret: string;
}

/**
 * 시나리오 1 — 로그인 → bitmap 발행 → JWT 검증.
 *
 * authorization-ontology-bitmap-pipeline §2 (Issuance):
 *   1. 로그인 성공 → BitmapIssuerService 호출
 *   2. computeUserBits → mask 생성
 *   3. JWT embed → 클라이언트 응답
 *
 * 본 시나리오는 alice (manager role) 로 로그인 후 발급된 JWT 의
 * bitmap 이 예상된 길이(AUTH_BITMASK_BYTES)와 version/prefix 를 갖는지 검증.
 */
export const scenario1Login: Scenario<S1Ctx> = {
  name: "scenario-1-login",
  description: "로그인 → bitmap 발행 → JWT 검증",
  validates: [
    "weighted-index DisjointUnionIndex",
    "VersionedBitmap issuance",
    "JWT embed",
  ],

  async setup() {
    const handle = (globalThis as any).__simHandle;
    if (!handle) throw new Error("__simHandle not bound");
    return {
      email: handle.fixtures.alice.email,
      password: handle.fixtures.alice.password,
      jwtSecret: process.env.JWT_SECRET ?? "x".repeat(32),
    };
  },

  async act(ctx) {
    const gatewayFetch = (globalThis as any).__simGatewayFetch;
    if (!gatewayFetch) {
      throw new Error("__simGatewayFetch not bound");
    }
    const loginRes = await gatewayFetch(
      new Request("http://sim/auth/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email: ctx.email, password: ctx.password }),
      }),
    );
    if (!loginRes.ok) {
      throw new Error(`login failed: ${loginRes.status} ${await loginRes.text()}`);
    }
    const body = (await loginRes.json()) as {
      token: string;
      userId: string;
      bitmapPrefix: string;
      bitmapV: string;
      expiresIn: number;
    };
    return {
      data: {
        token: body.token,
        userId: body.userId,
        bitmapPrefix: body.bitmapPrefix,
        bitmapV: body.bitmapV,
        expiresIn: body.expiresIn,
      },
      traceIds: [loginRes.headers.get("x-trace-id") ?? ""].filter(Boolean),
      stepCount: 1,
    };
  },

  async assert(ctx, actResult) {
    const d = actResult.data as {
      token: string;
      userId: string;
      bitmapPrefix: string;
      bitmapV: string;
      expiresIn: number;
    };
    ok(d.token && d.token.length > 0, "token must be non-empty");
    ok(d.userId && d.userId.length > 0, "userId must be non-empty");
    ok(d.bitmapPrefix === "sim.bitmap", `prefix mismatch: ${d.bitmapPrefix}`);
    ok(d.bitmapV === "v1", `version mismatch: ${d.bitmapV}`);
    ok(d.expiresIn > 0, `expiresIn must be > 0, got ${d.expiresIn}`);

    // §2 §2 issuance 검증 — JWT 검증으로 bitmap embed 확인
    const { verifyBitmapJwt } = await import("@qa-sdk/sim-gateway/jwt");
    const verified = await verifyBitmapJwt(d.token, ctx.jwtSecret);
    ok(verified.userId === d.userId, `verified.userId mismatch`);
    ok(verified.bitmap.prefix === "sim.bitmap", `verified prefix mismatch`);
    ok(verified.bitmap.v === "v1", `verified version mismatch`);

    // mask 길이 — AUTH_BITMASK_BYTES (=2) 와 일치
    const { AUTH_BITMASK_BYTES } = await import("@qa-sdk/sim-auth-api/auth-codec");
    ok(
      verified.bitmap.mask.length === AUTH_BITMASK_BYTES,
      `mask length ${verified.bitmap.mask.length} !== ${AUTH_BITMASK_BYTES}`,
    );

    // manager role mask = 0xffff — 모든 bit set
    ok(
      verified.bitmap.mask[0] === 0xff && verified.bitmap.mask[1] === 0xff,
      `manager mask must be 0xffff, got: ${Buffer.from(verified.bitmap.mask).toString("hex")}`,
    );
  },

  async teardown() {
    // handles (in-process or http) cleanup
  },
};
