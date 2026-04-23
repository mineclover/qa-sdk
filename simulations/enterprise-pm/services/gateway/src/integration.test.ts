// @def.boundary sim-gateway
// @def.doc authorization-ontology-bitmap-pipeline

/**
 * sim-gateway ↔ sim-auth-api 통합 — login + protected proxy 흐름 e2e 검증.
 */

import { afterEach, describe, expect, it } from "vitest";
import { createApp } from "./app.js";
import { verifyBitmapJwt } from "./lib/jwt.js";
import {
  bootstrapTestApi,
  closeTestApi,
  seedTestData,
  type TestApiHandle,
  type TestFixtureHandle,
} from "../../auth-api/src/test-bootstrap.js";

const SECRET = "x".repeat(32);

describe("sim-gateway integration — real sim-auth-api", () => {
  let authHandle: TestApiHandle;
  let fixtures: TestFixtureHandle;

  afterEach(async () => {
    if (authHandle) {
      await closeTestApi(authHandle);
    }
  });

  it("delegates login to auth-api, embeds bitmap JWT, and passes protected routing", async () => {
    authHandle = await bootstrapTestApi({ jwtSecret: SECRET });
    fixtures = await seedTestData(authHandle);

    const targets = {
      "sim-pm-api": authHandle.baseUrl,
      "sim-approval-api": authHandle.baseUrl,
      "sim-notification-api": authHandle.baseUrl,
      "sim-reporting-api": authHandle.baseUrl,
      "sim-document-api": authHandle.baseUrl,
      "sim-audit-browser-api": authHandle.baseUrl,
    };

    const app = createApp({
      authApiUrl: authHandle.baseUrl,
      jwtSecret: SECRET,
      jwtTtlSeconds: 300,
      currentBitmapV: "v1",
      proxyTimeoutMs: 5_000,
      proxyTargets: targets,
    });

    const loginRes = await app.request("/auth/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        email: fixtures.alice.email,
        password: fixtures.alice.password,
      }),
    });
    expect(loginRes.status).toBe(200);
    const loginBody = (await loginRes.json()) as {
      token: string;
      userId: string;
      bitmapV: string;
      bitmapPrefix: string;
    };
    expect(loginBody.userId).toBe(fixtures.alice.id);
    expect(loginBody.bitmapPrefix).toBe("sim.bitmap");
    expect(loginBody.bitmapV).toBe("v1");

    const verified = await verifyBitmapJwt(loginBody.token, SECRET);
    expect(verified.userId).toBe(fixtures.alice.id);
    expect(verified.bitmap.prefix).toBe("sim.bitmap");
    expect(verified.bitmap.v).toBe("v1");

    const protectedRes = await app.request("/projects/smoke", {
      headers: { Authorization: `Bearer ${loginBody.token}` },
    });

    // auth-api에는 /projects 경로가 없으므로 downstream 404가 정상이다.
    // 중요한 것은 gateway가 401에서 멈추지 않고 JWT 검증 후 proxy까지 진행한다는 점이다.
    expect(protectedRes.status).toBe(404);
  });
});
