import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  bootstrapTestApi,
  closeTestApi,
  seedTestData,
  type TestApiHandle,
  type TestFixtureHandle,
} from "./test-bootstrap.js";

describe("sim-auth-api/test-bootstrap", () => {
  let handle: TestApiHandle;
  let fixtures: TestFixtureHandle;

  beforeEach(async () => {
    handle = await bootstrapTestApi();
    fixtures = await seedTestData(handle);
  }, 120_000);

  afterEach(async () => {
    await closeTestApi(handle);
  });

  it("bootstrapTestApi — listen port > 0", () => {
    expect(handle.port).toBeGreaterThan(0);
    expect(handle.baseUrl).toMatch(/^http:\/\/127\.0\.0\.1:\d+$/);
  });

  it("seedTestData — alice/bob/depts/roles 반환", () => {
    expect(fixtures.alice.email).toBe("alice@example.com");
    expect(fixtures.bob.email).toBe("bob@example.com");
    expect(fixtures.departments.engineering.name).toBe("Engineering");
    expect(fixtures.departments.marketing.name).toBe("Marketing");
    expect(fixtures.roles.manager.name).toBe("manager");
    expect(fixtures.roles.member.name).toBe("member");
    expect(fixtures.roles.admin.name).toBe("admin");
  });

  it("POST /auth/authenticate — 올바른 password → 201", async () => {
    // NestJS POST 기본 응답 코드는 201 Created — controller에서 @HttpCode 미설정
    const res = await fetch(`${handle.baseUrl}/auth/authenticate`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: fixtures.alice.email, password: fixtures.alice.password }),
    });
    expect(res.status).toBe(201);
    const body = (await res.json()) as {
      userId: string;
      departmentId: string;
      primaryRoleId: string | null;
      roleIds: string[];
      roleNames: string[];
      roleAssignments: Array<{ roleName: string; scopeType: string; scopeId: string | null }>;
    };
    expect(body.userId).toBe(fixtures.alice.id);
    expect(body.departmentId).toBe(fixtures.departments.engineering.id);
    expect(body.roleNames).toContain("manager");
    expect(body.roleAssignments).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          roleName: "manager",
          scopeType: "department",
          scopeId: fixtures.departments.engineering.id,
        }),
      ]),
    );
  });

  it("POST /auth/authenticate — 잘못된 password → 401", async () => {
    const res = await fetch(`${handle.baseUrl}/auth/authenticate`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: fixtures.alice.email, password: "wrong" }),
    });
    expect(res.status).toBe(401);
  });

  it("POST /auth/authenticate — 미등록 email → 401", async () => {
    const res = await fetch(`${handle.baseUrl}/auth/authenticate`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: "unknown@example.com", password: "any" }),
    });
    expect(res.status).toBe(401);
  });

  it("POST /bitmap/issue — alice 발급 → prefix sim.bitmap", async () => {
    const res = await fetch(`${handle.baseUrl}/bitmap/issue`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ userId: fixtures.alice.id }),
    });
    expect(res.status).toBe(201);
    const body = (await res.json()) as {
      prefix: string;
      maskBase64: string;
      signature: string;
    };
    expect(body.prefix).toBe("sim.bitmap");
    expect(body.maskBase64.length).toBeGreaterThan(0);
    expect(body.signature.length).toBeGreaterThan(0);
  });
});
