// @def.boundary sim-gateway
// @def.doc authorization-ontology-bitmap-pipeline

import { describe, expect, it } from "vitest";
import {
  createGatewayTestApp,
  issueTestToken,
  DEFAULT_TEST_PROXY_TARGETS,
} from "./test-bootstrap.js";
import { verifyBitmapJwt } from "./lib/jwt.js";

describe("gateway test-bootstrap", () => {
  it("createGatewayTestApp — 기본 옵션만으로 Hono app 생성 + /health 200", async () => {
    const handle = createGatewayTestApp({});
    const res = await handle.app.request("/health");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.service).toBe("sim-gateway");
    expect(handle.secret.length).toBeGreaterThanOrEqual(32);
  });

  it("createGatewayTestApp — proxy targets override", () => {
    const handle = createGatewayTestApp({
      proxyTargets: {
        ...DEFAULT_TEST_PROXY_TARGETS,
        "sim-pm-api": "http://custom-host:9999",
      },
    });
    expect(handle.proxyTargets["sim-pm-api"]).toBe("http://custom-host:9999");
  });

  it("issueTestToken — 유효 JWT 발급 + verify 라운드트립", async () => {
    const handle = createGatewayTestApp({});
    const token = await issueTestToken({
      userId: "alice-1",
      departmentId: "dept-eng",
      secret: handle.secret,
      bitmapV: "uv1",
      ttlSeconds: 300,
    });
    expect(token.split(".")).toHaveLength(3);
    const verified = await verifyBitmapJwt(token, handle.secret);
    expect(verified.userId).toBe("alice-1");
    expect(verified.bitmap.prefix).toBe("sim.bitmap");
    expect(verified.bitmap.v).toBe("uv1");
  });

  it("DEFAULT_TEST_PROXY_TARGETS — PROXY_TARGETS 6 서비스 모두 포함", () => {
    expect(Object.keys(DEFAULT_TEST_PROXY_TARGETS)).toEqual(
      expect.arrayContaining([
        "sim-pm-api",
        "sim-approval-api",
        "sim-notification-api",
        "sim-reporting-api",
        "sim-document-api",
        "sim-audit-browser-api",
      ]),
    );
  });

  it("createGatewayTestApp — /projects/x JWT 없이 401 (protected 동작 회귀)", async () => {
    const handle = createGatewayTestApp({});
    const res = await handle.app.request("/projects/x");
    expect(res.status).toBe(401);
  });
});
