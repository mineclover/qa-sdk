import { describe, it, expect, beforeEach } from "vitest";
import { Hono } from "hono";
import { InMemoryPrefixRegistry, InMemoryVersionLifecycleStore } from "index-meta";
import { createApp } from "./app.js";
import { InMemoryPrefixOwnerStore } from "./stores/in-memory-prefix-owner-store.js";
import { InMemoryDraftLockStore } from "./stores/in-memory-draft-lock-store.js";
import { createErrorHandler } from "./middleware/error-handler.js";
import pino from "pino";

function buildApp() {
  const prefixRegistry = new InMemoryPrefixRegistry();
  const versionStore = new InMemoryVersionLifecycleStore();
  const ownerStore = new InMemoryPrefixOwnerStore();
  const lockStore = new InMemoryDraftLockStore();
  const logger = pino({ level: "silent" });

  const app = createApp({ prefixRegistry, versionStore, ownerStore, lockStore, logger });
  return { app, prefixRegistry, versionStore, ownerStore, lockStore };
}

async function json(res: Response) {
  return res.json();
}

// ── Helper: prefix 등록 ─────────────────────────────────

async function registerPrefix(
  app: Hono,
  prefix: string,
  opts?: { owner?: string; kind?: string; numberType?: string },
) {
  return app.request("/prefixes", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      prefix,
      owner: opts?.owner ?? "service-a",
      kind: opts?.kind ?? "leaf",
      numberType: opts?.numberType ?? "number",
    }),
  });
}

async function createDraft(
  app: Hono,
  prefix: string,
  versionId: string,
  capacity: number,
  opts?: { baseVersionId?: string; refs?: { prefix: string; versionId: string }[] },
) {
  return app.request(`/prefixes/${prefix}/versions`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      versionId,
      baseVersionId: opts?.baseVersionId ?? null,
      capacity,
      ...opts,
    }),
  });
}

// ══════════════════════════════════════════════════════════
// Phase 1: Health + Prefix CRUD
// ══════════════════════════════════════════════════════════

describe("Health", () => {
  it("GET /health returns ok", async () => {
    const { app } = buildApp();
    const res = await app.request("/health");
    expect(res.status).toBe(200);
    expect(await json(res)).toMatchObject({ ok: true });
  });
});

describe("Prefix CRUD", () => {
  it("POST /prefixes → 201", async () => {
    const { app } = buildApp();
    const res = await registerPrefix(app, "role");
    expect(res.status).toBe(201);
    const body = await json(res);
    expect(body.prefix).toBe("role");
    expect(body.owner).toBe("service-a");
    expect(body.kind).toBe("leaf");
  });

  it("POST duplicate → 409", async () => {
    const { app } = buildApp();
    await registerPrefix(app, "role");
    const res = await registerPrefix(app, "role");
    expect(res.status).toBe(409);
  });

  it("GET /prefixes → list all", async () => {
    const { app } = buildApp();
    await registerPrefix(app, "role");
    await registerPrefix(app, "action", { owner: "service-b" });
    const res = await app.request("/prefixes");
    expect(res.status).toBe(200);
    const body = await json(res);
    expect(body).toHaveLength(2);
  });

  it("GET /prefixes/:prefix → 200", async () => {
    const { app } = buildApp();
    await registerPrefix(app, "role");
    const res = await app.request("/prefixes/role");
    expect(res.status).toBe(200);
    const body = await json(res);
    expect(body.prefix).toBe("role");
    expect(body.versions).toEqual([]);
  });

  it("GET /prefixes/:prefix → 404 unknown", async () => {
    const { app } = buildApp();
    const res = await app.request("/prefixes/unknown");
    expect(res.status).toBe(404);
  });

  it("DELETE /prefixes/:prefix → 200", async () => {
    const { app } = buildApp();
    await registerPrefix(app, "role");
    const res = await app.request("/prefixes/role", { method: "DELETE" });
    expect(res.status).toBe(200);
  });

  it("DELETE with non-deprecated versions → 409", async () => {
    const { app } = buildApp();
    await registerPrefix(app, "role");
    await createDraft(app, "role", "v1", 10);
    const res = await app.request("/prefixes/role", { method: "DELETE" });
    expect(res.status).toBe(409);
  });
});

// ══════════════════════════════════════════════════════════
// Phase 2: Version Lifecycle + DAG
// ══════════════════════════════════════════════════════════

describe("Version Lifecycle", () => {
  it("POST draft → 201", async () => {
    const { app } = buildApp();
    await registerPrefix(app, "role");
    const res = await createDraft(app, "role", "v1", 10);
    expect(res.status).toBe(201);
    const body = await json(res);
    expect(body.prefix).toBe("role");
    expect(body.versionId).toBe("v1");
    expect(body.status).toBe("draft");
    expect(body.capacity).toBe(10);
  });

  it("GET versions list", async () => {
    const { app } = buildApp();
    await registerPrefix(app, "role");
    await createDraft(app, "role", "v1", 10);
    const res = await app.request("/prefixes/role/versions");
    expect(res.status).toBe(200);
    const body = await json(res);
    expect(body).toHaveLength(1);
    expect(body[0].versionId).toBe("v1");
  });

  it("GET single version", async () => {
    const { app } = buildApp();
    await registerPrefix(app, "role");
    await createDraft(app, "role", "v1", 10);
    const res = await app.request("/prefixes/role/versions/v1");
    expect(res.status).toBe(200);
    const body = await json(res);
    expect(body.versionId).toBe("v1");
  });

  it("PATCH draft capacity", async () => {
    const { app } = buildApp();
    await registerPrefix(app, "role");
    await createDraft(app, "role", "v1", 10);
    const res = await app.request("/prefixes/role/versions/v1", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ capacity: 20 }),
    });
    expect(res.status).toBe(200);
    const body = await json(res);
    expect(body.capacity).toBe(20);
  });

  it("draft → release → activate → deprecate", async () => {
    const { app } = buildApp();
    await registerPrefix(app, "role");
    await createDraft(app, "role", "v1", 10);

    let res = await app.request("/prefixes/role/versions/v1/release", { method: "POST" });
    expect(res.status).toBe(200);

    res = await app.request("/prefixes/role/versions/v1/activate", { method: "POST" });
    expect(res.status).toBe(200);

    res = await app.request("/prefixes/role/versions/v1/deprecate", { method: "POST" });
    expect(res.status).toBe(200);
  });

  it("composite draft auto-calculates capacity from refs", async () => {
    const { app } = buildApp();
    await registerPrefix(app, "role");
    await registerPrefix(app, "action");
    await registerPrefix(app, "perm", { kind: "composite" });

    await createDraft(app, "role", "v1", 10);
    await createDraft(app, "action", "v1", 5);

    const res = await createDraft(app, "perm", "v1", 0, {
      refs: [
        { prefix: "role", versionId: "v1" },
        { prefix: "action", versionId: "v1" },
      ],
    });
    expect(res.status).toBe(201);
    const body = await json(res);
    expect(body.capacity).toBe(50); // 10 * 5
    expect(body.shape).toEqual([10, 5]);
    expect(body.stride).toEqual([5, 1]);
    expect(body.product).toBe(50);
  });
});

describe("DAG", () => {
  it("getDeps returns composite refs", async () => {
    const { app } = buildApp();
    await registerPrefix(app, "role");
    await registerPrefix(app, "action");
    await registerPrefix(app, "perm", { kind: "composite" });

    await createDraft(app, "role", "v1", 10);
    await createDraft(app, "action", "v1", 5);
    await createDraft(app, "perm", "v1", 0, {
      refs: [
        { prefix: "role", versionId: "v1" },
        { prefix: "action", versionId: "v1" },
      ],
    });

    const res = await app.request("/dag/perm/v1/deps");
    expect(res.status).toBe(200);
    const body = await json(res);
    expect(body).toHaveLength(2);
    expect(body[0].prefix).toBe("role");
    expect(body[1].prefix).toBe("action");
  });

  it("getReverseRefs returns composites referencing a leaf", async () => {
    const { app } = buildApp();
    await registerPrefix(app, "role");
    await registerPrefix(app, "action");
    await registerPrefix(app, "perm", { kind: "composite" });

    await createDraft(app, "role", "v1", 10);
    await createDraft(app, "action", "v1", 5);
    await createDraft(app, "perm", "v1", 0, {
      refs: [
        { prefix: "role", versionId: "v1" },
        { prefix: "action", versionId: "v1" },
      ],
    });

    const res = await app.request("/dag/role/v1/reverse-refs");
    expect(res.status).toBe(200);
    const body = await json(res);
    expect(body).toHaveLength(1);
    expect(body[0].prefix).toBe("perm");
  });

  it("DAG graph includes nodes and edges", async () => {
    const { app } = buildApp();
    await registerPrefix(app, "role");
    await registerPrefix(app, "perm", { kind: "composite" });

    await createDraft(app, "role", "v1", 10);
    await createDraft(app, "perm", "v1", 0, {
      refs: [{ prefix: "role", versionId: "v1" }],
    });

    const res = await app.request("/dag/graph");
    expect(res.status).toBe(200);
    const body = await json(res);
    expect(body.nodes.length).toBeGreaterThanOrEqual(2);
    expect(body.edges).toHaveLength(1);
    expect(body.edges[0]).toEqual({ from: "perm:v1", to: "role:v1" });
  });
});

// ══════════════════════════════════════════════════════════
// Phase 3: DraftWorkspace (simulate + analyze)
// ══════════════════════════════════════════════════════════

describe("Workspace", () => {
  async function setupScenario(app: Hono) {
    await registerPrefix(app, "role");
    await registerPrefix(app, "action");
    await registerPrefix(app, "perm", { kind: "composite", owner: "service-c" });

    await createDraft(app, "role", "v1", 100);
    await createDraft(app, "action", "v1", 15);
    await createDraft(app, "perm", "v1", 0, {
      refs: [
        { prefix: "role", versionId: "v1" },
        { prefix: "action", versionId: "v1" },
      ],
    });
  }

  it("GET /workspace/drafts lists all drafts", async () => {
    const { app } = buildApp();
    await setupScenario(app);

    const res = await app.request("/workspace/drafts");
    expect(res.status).toBe(200);
    const body = await json(res);
    expect(body).toHaveLength(3);
  });

  it("POST /workspace/simulate returns impact", async () => {
    const { app } = buildApp();
    await setupScenario(app);

    const res = await app.request("/workspace/simulate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        changes: { role: { capacity: 200 } },
      }),
    });
    expect(res.status).toBe(200);
    const body = await json(res);

    expect(body.impact).toHaveLength(1);
    expect(body.impact[0].prefix).toBe("perm");
    expect(body.impact[0].newShape).toEqual([200, 15]);
    expect(body.impact[0].newProduct).toBe(3000);
    expect(body.impact[0].strideChanged).toBe(false); // stride [15,1] → [15,1]
    expect(body.ready).toBe(true);
  });

  it("simulate detects stride change", async () => {
    const { app } = buildApp();
    await setupScenario(app);

    // action capacity 변경 → stride 변경
    const res = await app.request("/workspace/simulate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        changes: { action: { capacity: 20 } },
      }),
    });
    expect(res.status).toBe(200);
    const body = await json(res);

    expect(body.impact[0].strideChanged).toBe(true);
    expect(body.impact[0].currentStride).toEqual([15, 1]);
    expect(body.impact[0].newStride).toEqual([20, 1]);
  });

  it("POST /workspace/analyze returns readiness", async () => {
    const { app } = buildApp();
    await setupScenario(app);

    const res = await app.request("/workspace/analyze", { method: "POST" });
    expect(res.status).toBe(200);
    const body = await json(res);

    expect(body.drafts).toHaveLength(3);
    expect(body.releaseOrder).toBeDefined();
    expect(body.migrationSummary).toBeDefined();
    // leaf들이 composite보다 먼저
    const roleIdx = body.releaseOrder.indexOf("role");
    const actionIdx = body.releaseOrder.indexOf("action");
    const permIdx = body.releaseOrder.indexOf("perm");
    expect(roleIdx).toBeLessThan(permIdx);
    expect(actionIdx).toBeLessThan(permIdx);
  });
});

// ══════════════════════════════════════════════════════════
// Phase 4: Lock + Release Coordinator
// ══════════════════════════════════════════════════════════

describe("Lock & Release", () => {
  async function setupAndDraft(app: Hono) {
    await registerPrefix(app, "role");
    await registerPrefix(app, "action");
    await createDraft(app, "role", "v1", 10);
    await createDraft(app, "action", "v1", 5);
  }

  it("lock → PATCH rejected", async () => {
    const { app } = buildApp();
    await setupAndDraft(app);

    let res = await app.request("/prefixes/role/versions/v1/lock", { method: "POST" });
    expect(res.status).toBe(200);

    // PATCH should fail
    res = await app.request("/prefixes/role/versions/v1", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ capacity: 20 }),
    });
    expect(res.status).toBe(409);
    const body = await json(res);
    expect(body.error.code).toBe("DRAFT_LOCKED");
  });

  it("unlock → PATCH allowed", async () => {
    const { app } = buildApp();
    await setupAndDraft(app);

    await app.request("/prefixes/role/versions/v1/lock", { method: "POST" });
    await app.request("/prefixes/role/versions/v1/unlock", { method: "POST" });

    const res = await app.request("/prefixes/role/versions/v1", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ capacity: 20 }),
    });
    expect(res.status).toBe(200);
  });

  it("lock-all → release-all", async () => {
    const { app } = buildApp();
    await setupAndDraft(app);

    let res = await app.request("/workspace/lock-all", { method: "POST" });
    expect(res.status).toBe(200);
    let body = await json(res);
    expect(body.locked).toHaveLength(2);

    res = await app.request("/workspace/release-all", { method: "POST" });
    expect(res.status).toBe(200);
    body = await json(res);
    expect(body.released).toHaveLength(2);

    // versions should be released now
    res = await app.request("/prefixes/role/versions/v1");
    body = await json(res);
    expect(body.status).toBe("released");
  });

  it("locked version shows locked status", async () => {
    const { app } = buildApp();
    await setupAndDraft(app);

    await app.request("/prefixes/role/versions/v1/lock", { method: "POST" });

    const res = await app.request("/prefixes/role/versions/v1");
    const body = await json(res);
    expect(body.status).toBe("locked");
    expect(body.lockedAt).toBeDefined();
  });
});

// ══════════════════════════════════════════════════════════
// Phase 5: Resolve
// ══════════════════════════════════════════════════════════

describe("Resolve", () => {
  async function setupActive(app: Hono) {
    await registerPrefix(app, "role");
    await registerPrefix(app, "action");
    await createDraft(app, "role", "v1", 10);
    await createDraft(app, "action", "v1", 5);

    // release + activate
    await app.request("/prefixes/role/versions/v1/release", { method: "POST" });
    await app.request("/prefixes/role/versions/v1/activate", { method: "POST" });
    await app.request("/prefixes/action/versions/v1/release", { method: "POST" });
    await app.request("/prefixes/action/versions/v1/activate", { method: "POST" });
  }

  it("GET /resolve/active returns all active versions", async () => {
    const { app } = buildApp();
    await setupActive(app);

    const res = await app.request("/resolve/active");
    expect(res.status).toBe(200);
    const body = await json(res);

    expect(body.role).toBeDefined();
    expect(body.role.versionId).toBe("v1");
    expect(body.role.capacity).toBe(10);
    expect(body.action.versionId).toBe("v1");
  });

  it("GET /resolve/active/:prefix returns enriched data", async () => {
    const { app } = buildApp();
    await setupActive(app);

    const res = await app.request("/resolve/active/role");
    expect(res.status).toBe(200);
    const body = await json(res);
    expect(body.versionId).toBe("v1");
    expect(body.capacity).toBe(10);
    expect(body.numberType).toBe("number");
  });

  it("GET /resolve/active/:prefix → 404 no active", async () => {
    const { app } = buildApp();
    await registerPrefix(app, "role");
    const res = await app.request("/resolve/active/role");
    expect(res.status).toBe(404);
  });

  it("GET /resolve/manifest", async () => {
    const { app } = buildApp();
    await setupActive(app);

    const res = await app.request("/resolve/manifest");
    expect(res.status).toBe(200);
    const body = await json(res);

    expect(body.versions).toBeDefined();
    expect(body.versions.role).toBeDefined();
    expect(body.generatedAt).toBeDefined();
  });

  it("manifest includes shape/stride for composite", async () => {
    const { app } = buildApp();
    await registerPrefix(app, "role");
    await registerPrefix(app, "action");
    await registerPrefix(app, "perm", { kind: "composite" });

    await createDraft(app, "role", "v1", 10);
    await createDraft(app, "action", "v1", 5);
    await createDraft(app, "perm", "v1", 0, {
      refs: [
        { prefix: "role", versionId: "v1" },
        { prefix: "action", versionId: "v1" },
      ],
    });

    // release + activate all
    for (const p of ["role", "action", "perm"]) {
      await app.request(`/prefixes/${p}/versions/v1/release`, { method: "POST" });
      await app.request(`/prefixes/${p}/versions/v1/activate`, { method: "POST" });
    }

    const res = await app.request("/resolve/manifest");
    const body = await json(res);

    expect(body.versions.perm.shape).toEqual([10, 5]);
    expect(body.versions.perm.stride).toEqual([5, 1]);
    expect(body.versions.perm.capacity).toBe(50);
  });
});

// ══════════════════════════════════════════════════════════
// E2E: Full workflow
// ══════════════════════════════════════════════════════════

describe("E2E: Full Workflow", () => {
  it("register → draft → simulate → analyze → lock-all → release-all → resolve", async () => {
    const { app } = buildApp();

    // 1. Register prefixes
    await registerPrefix(app, "role");
    await registerPrefix(app, "action");
    await registerPrefix(app, "perm", { kind: "composite", owner: "service-c" });

    // 2. Create drafts
    await createDraft(app, "role", "v1", 100);
    await createDraft(app, "action", "v1", 15);
    await createDraft(app, "perm", "v1", 0, {
      refs: [
        { prefix: "role", versionId: "v1" },
        { prefix: "action", versionId: "v1" },
      ],
    });

    // 3. Simulate
    const simRes = await app.request("/workspace/simulate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        changes: { role: { capacity: 200 } },
      }),
    });
    const sim = await json(simRes);
    expect(sim.ready).toBe(true);

    // 4. Analyze
    const analyzeRes = await app.request("/workspace/analyze", { method: "POST" });
    const analysis = await json(analyzeRes);
    expect(analysis.drafts).toHaveLength(3);
    expect(analysis.releaseOrder.indexOf("role")).toBeLessThan(
      analysis.releaseOrder.indexOf("perm"),
    );

    // 5. Lock all
    const lockRes = await app.request("/workspace/lock-all", { method: "POST" });
    const lockBody = await json(lockRes);
    expect(lockBody.locked).toHaveLength(3);

    // 6. Release all (leaf → composite 순서)
    const releaseRes = await app.request("/workspace/release-all", { method: "POST" });
    const releaseBody = await json(releaseRes);
    expect(releaseBody.released).toHaveLength(3);

    // 7. Activate all
    for (const p of ["role", "action", "perm"]) {
      await app.request(`/prefixes/${p}/versions/v1/activate`, { method: "POST" });
    }

    // 8. Resolve
    const resolveRes = await app.request("/resolve/active");
    const resolved = await json(resolveRes);
    expect(resolved.role.versionId).toBe("v1");
    expect(resolved.perm.versionId).toBe("v1");
    expect(resolved.perm.shape).toEqual([100, 15]);
    expect(resolved.perm.stride).toEqual([15, 1]);
  });
});
