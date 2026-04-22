import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { AccessChecker } from "permission-engine";
import {
  bootstrapTestApi,
  createTestProject,
  seedTestData,
  type TestPmApiHandle,
} from "./test-bootstrap.js";

function fakeAllowChecker(): AccessChecker {
  return {
    check: async () => ({
      allowed: true,
      executionSpanId: "root-allow",
    }),
  } as unknown as AccessChecker;
}

describe("sim-pm-api/test-bootstrap", () => {
  let handle: TestPmApiHandle;

  beforeEach(async () => {
    handle = await bootstrapTestApi({ overrideChecker: fakeAllowChecker() });
  }, 60_000);

  afterEach(async () => {
    await handle.close();
  });

  it("bootstrapTestApi — port > 0", () => {
    expect(handle.port).toBeGreaterThan(0);
  });

  it("createTestProject — direct svc 호출 → project 생성 + UNREGISTERED policy 자동", async () => {
    const p = await createTestProject(handle, {
      name: "Demo",
      ownerId: "user-alice",
      departmentId: "dept-eng",
    });
    expect(p.ownerId).toBe("user-alice");
    expect(p.departmentId).toBe("dept-eng");
  });

  it("seedTestData — 2 projects + 1 member", async () => {
    const { projects } = await seedTestData(handle, {
      projects: [
        { name: "P1", ownerId: "user-alice", departmentId: "dept-eng" },
        { name: "P2", ownerId: "user-bob", departmentId: "dept-mkt" },
      ],
    });
    expect(projects).toHaveLength(2);
    const p1 = projects[0];
    await seedTestData(handle, {
      members: [{ projectId: p1.id, userId: "user-bob", role: "contributor" }],
    });
  });

  it("POST /projects — gateway header 없음 → 401", async () => {
    const res = await fetch(`${handle.baseUrl}/projects`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: "X", departmentId: "dept-eng" }),
    });
    expect(res.status).toBe(401);
  });

  it("POST /projects — gateway header + allow checker → 201 + rootSpanId", async () => {
    const maskB64 = Buffer.from([0xff, 0xff]).toString("base64");
    const res = await fetch(`${handle.baseUrl}/projects`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-auth-user-id": "user-alice",
        "x-auth-bitmap-mask": maskB64,
        "x-auth-bitmap-v": "uv1",
      },
      body: JSON.stringify({ name: "Scenario2", departmentId: "dept-eng" }),
    });
    expect(res.status).toBe(201);
    const body = (await res.json()) as { id: string; ownerId: string; rootSpanId: string };
    expect(body.ownerId).toBe("user-alice");
    expect(body.rootSpanId).toBe("root-allow");
  });
});
