import { describe, expect, it } from "vitest";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { SqliteAuthRepository } from "../sqlite/adapter.js";
import { SIM_AUTH_SQLITE_DDL } from "../sqlite/schema.js";
import { BitmapIssuerService } from "./bitmap-issuer.service.js";
import { AUTH_BITMASK_BYTES } from "../shared/auth-codec.js";

const SECRET = new TextEncoder().encode("test-secret-32bytes-long-enough-1234");

function fixture() {
  const raw = new Database(":memory:");
  raw.exec(SIM_AUTH_SQLITE_DDL);
  const repo = new SqliteAuthRepository(drizzle({ client: raw }));
  const svc = new BitmapIssuerService(repo, {
    secret: SECRET,
    ttlMs: 3600_000,
    issuer: "sim-auth-api",
  });
  return { repo, svc };
}

describe("BitmapIssuerService", () => {
  it("user 없으면 null 반환", async () => {
    const { svc } = fixture();
    expect(await svc.issueForUser("missing")).toBeNull();
  });

  it("user 있고 assignment 없음 → mask 모두 0인 VersionedBitmap", async () => {
    const { repo, svc } = fixture();
    const u = await repo.createUser({ email: "x@x", displayName: "x" });
    const bm = await svc.issueForUser(u.id);
    expect(bm).not.toBeNull();
    expect(bm!.mask.length).toBe(AUTH_BITMASK_BYTES);
    for (const b of bm!.mask) expect(b).toBe(0);
  });

  it("global admin role 부여 → mask 모든 비트 set", async () => {
    const { repo, svc } = fixture();
    const adminMaskHex = "ff".repeat(AUTH_BITMASK_BYTES);
    const role = await repo.createRole({
      name: "admin",
      scopeType: "global",
      defaultMaskHex: adminMaskHex,
    });
    const u = await repo.createUser({ email: "a@x", displayName: "a" });
    await repo.assignRole({
      userId: u.id,
      roleId: role.id,
      scopeType: "global",
      scopeId: null,
    });
    const bm = await svc.issueForUser(u.id);
    expect(bm).not.toBeNull();
    for (const b of bm!.mask) expect(b).toBe(0xff);
  });

  it("발급된 VersionedBitmap은 prefix='sim.bitmap' + signature 포함", async () => {
    const { repo, svc } = fixture();
    const u = await repo.createUser({ email: "y@x", displayName: "y" });
    const bm = await svc.issueForUser(u.id);
    expect(bm!.prefix).toBe("sim.bitmap");
    expect(bm!.v).toBeTruthy();
    expect(bm!.signature).toMatch(/^[0-9a-f]+$/);
    expect(bm!.expiresAt > bm!.issuedAt).toBe(true);
  });
});
