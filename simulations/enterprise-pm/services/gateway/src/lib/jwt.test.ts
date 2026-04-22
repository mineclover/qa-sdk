// @def.boundary sim-gateway
// @def.doc authorization-ontology-bitmap-pipeline

import { describe, expect, it } from "vitest";
import { signBitmapJwt, verifyBitmapJwt, JwtVerifyError } from "./jwt.js";
import type { VersionedBitmap } from "permission-engine";

const SECRET = "x".repeat(32);

const sampleBm: VersionedBitmap = {
  prefix: "sim.bitmap",
  v: "uv1",
  mask: new Uint8Array([0xff, 0x12, 0x34]),
  issuedAt: "2026-04-22T00:00:00.000Z",
  expiresAt: "2026-04-22T00:05:00.000Z",
  issuer: "sim-auth-api",
  signature: "sig",
};

describe("sim-gateway JWT — sign + verify round-trip", () => {
  it("sign → verify 라운드트립 (userId + bitmap 복원)", async () => {
    const token = await signBitmapJwt({
      userId: "user-1",
      bitmap: sampleBm,
      secret: SECRET,
      ttlSeconds: 300,
    });
    expect(token.split(".")).toHaveLength(3);

    const verified = await verifyBitmapJwt(token, SECRET);
    expect(verified.userId).toBe("user-1");
    expect(verified.bitmap.prefix).toBe("sim.bitmap");
    expect(verified.bitmap.v).toBe("uv1");
    expect(Array.from(verified.bitmap.mask)).toEqual([0xff, 0x12, 0x34]);
  });

  it("tampered token (mask 비트 변조) → JwtVerifyError", async () => {
    const token = await signBitmapJwt({
      userId: "user-1",
      bitmap: sampleBm,
      secret: SECRET,
      ttlSeconds: 300,
    });
    const parts = token.split(".");
    const payload = Buffer.from(parts[1], "base64url").toString("utf8");
    const tampered = JSON.parse(payload);
    tampered.bitmap_mask = Buffer.from([0x00]).toString("base64");
    parts[1] = Buffer.from(JSON.stringify(tampered)).toString("base64url");
    const bad = parts.join(".");

    await expect(verifyBitmapJwt(bad, SECRET)).rejects.toBeInstanceOf(JwtVerifyError);
  });

  it("wrong secret → JwtVerifyError", async () => {
    const token = await signBitmapJwt({
      userId: "user-1",
      bitmap: sampleBm,
      secret: SECRET,
      ttlSeconds: 300,
    });
    await expect(verifyBitmapJwt(token, "y".repeat(32))).rejects.toBeInstanceOf(JwtVerifyError);
  });

  it("expired token → JwtVerifyError(reason=expired)", async () => {
    const token = await signBitmapJwt({
      userId: "user-1",
      bitmap: sampleBm,
      secret: SECRET,
      ttlSeconds: 1,
    });
    await new Promise((r) => setTimeout(r, 1500));
    try {
      await verifyBitmapJwt(token, SECRET);
      throw new Error("should have thrown");
    } catch (err) {
      expect(err).toBeInstanceOf(JwtVerifyError);
      expect((err as JwtVerifyError).reason).toBe("expired");
    }
  });

  it("malformed token → JwtVerifyError", async () => {
    await expect(verifyBitmapJwt("not.a.jwt", SECRET)).rejects.toBeInstanceOf(JwtVerifyError);
  });
});
