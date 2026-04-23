// @def.boundary sim-gateway
// @def.doc authorization-ontology-bitmap-pipeline

import { describe, expect, it } from "vitest";
import { Hono } from "hono";
import { jwtVerifyMiddleware } from "./jwt-verify.js";
import { signBitmapJwt } from "../lib/jwt.js";
import type { VersionedBitmap } from "permission-engine";

const SECRET = "x".repeat(32);
const SAMPLE_BM: VersionedBitmap = {
  prefix: "sim.bitmap",
  v: "uv1",
  mask: new Uint8Array([0xab, 0xcd]),
  issuedAt: "2026-04-22T00:00:00.000Z",
  expiresAt: "2026-04-22T00:05:00.000Z",
  issuer: "sim-auth-api",
  signature: "sig",
};

function makeApp() {
  const app = new Hono();
  app.use("*", jwtVerifyMiddleware({ secret: SECRET, currentBitmapV: "uv1" }));
  app.get("/protected", (c) => {
    return c.json({
      userId: c.req.header("x-auth-user-id"),
      bitmapV: c.req.header("x-auth-bitmap-v"),
      bitmapMask: c.req.header("x-auth-bitmap-mask"),
      bitmapPrefix: c.req.header("x-auth-bitmap-prefix"),
      departmentId: c.req.header("x-auth-department-id"),
      roleNames: c.req.header("x-auth-role-names"),
    });
  });
  return app;
}

describe("jwt-verify middleware", () => {
  it("Authorization 헤더 없음 → 401", async () => {
    const app = makeApp();
    const res = await app.request("/protected");
    expect(res.status).toBe(401);
  });

  it("Bearer가 아닌 Authorization → 401", async () => {
    const app = makeApp();
    const res = await app.request("/protected", {
      headers: { Authorization: "Basic xxx" },
    });
    expect(res.status).toBe(401);
  });

  it("유효 JWT → 200 + downstream header 4개 주입", async () => {
    const token = await signBitmapJwt({
      userId: "user-42",
      bitmap: SAMPLE_BM,
      secret: SECRET,
      ttlSeconds: 300,
      authContext: {
        departmentId: "dept-eng",
        primaryRoleId: "role-manager",
        roleIds: ["role-manager"],
        roleNames: ["manager"],
        roleAssignments: [
          {
            roleId: "role-manager",
            roleName: "manager",
            scopeType: "department",
            scopeId: "dept-eng",
          },
        ],
      },
    });
    const app = makeApp();
    const res = await app.request("/protected", {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      userId: string;
      bitmapV: string;
      bitmapPrefix: string;
      bitmapMask: string;
      departmentId?: string | null;
      roleNames?: string;
    };
    expect(body.userId).toBe("user-42");
    expect(body.bitmapV).toBe("uv1");
    expect(body.bitmapPrefix).toBe("sim.bitmap");
    expect(body.bitmapMask).toBe(Buffer.from([0xab, 0xcd]).toString("base64"));
    expect(body.departmentId).toBe("dept-eng");
    expect(body.roleNames).toBe("manager");
  });

  it("invalid signature → 401", async () => {
    const token = await signBitmapJwt({
      userId: "user-1",
      bitmap: SAMPLE_BM,
      secret: "y".repeat(32),
      ttlSeconds: 300,
    });
    const app = makeApp();
    const res = await app.request("/protected", {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(res.status).toBe(401);
  });

  it("version mismatch → 401 + WWW-Authenticate: refresh_required (§2 §6)", async () => {
    const oldBm = { ...SAMPLE_BM, v: "uv0" };
    const token = await signBitmapJwt({
      userId: "user-1",
      bitmap: oldBm,
      secret: SECRET,
      ttlSeconds: 300,
    });
    const app = makeApp(); // currentBitmapV="uv1"
    const res = await app.request("/protected", {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(res.status).toBe(401);
    expect(res.headers.get("www-authenticate")).toContain("refresh_required");
  });
});
