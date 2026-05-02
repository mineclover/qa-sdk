// @def.boundary query-api-spec
// @def.doc query-api-spec

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  MetaRegistry,
  type MetaRegistryInput,
} from "index-meta";
import { InMemoryPolicyRuleStore } from "../stores/in-memory-policy-rule-store.js";
import type { StoredPolicyRule } from "../stores/policy-rule-store.js";
import {
  RuleMigrationService,
  createRuleMigrationService,
} from "./rule-migration-service.js";
import { createApp } from "../app.js";

const AT = new Date("2026-01-01T00:00:00.000Z");
const LATER = new Date("2026-01-01T00:10:00.000Z");

// ── 픽스처: append-only version 변경 ──────────────────────────────────────────

const APPEND_ONLY_INPUT: MetaRegistryInput = {
  dims: {
    role: {
      kind: { type: "string_enum" },
      snapshots: {
        rv1: { entries: ["admin", "editor", "viewer"] },
        rv2: { entries: ["admin", "editor", "viewer", "guest"] },
      },
    },
    action: {
      kind: { type: "string_enum" },
      snapshots: {
        av1: { entries: ["read", "write", "delete"] },
      },
    },
    resource: {
      kind: { type: "string_enum" },
      snapshots: {
        resv1: { entries: ["dashboard", "settings", "users"] },
      },
    },
  },
  indices: {
    perm: {
      dims: ["role", "action", "resource"],
      versions: {
        v1: { snapshots: { role: "rv1", action: "av1", resource: "resv1" } },
        v2: { snapshots: { role: "rv2", action: "av1", resource: "resv1" } },
      },
    },
  },
};

// ── 픽스처: migration edge가 있는 swap 시나리오 ──────────────────────────────

const SWAP_INPUT: MetaRegistryInput = {
  dims: {
    role: {
      kind: { type: "string_enum" },
      snapshots: {
        s1: { entries: ["admin", "editor", "viewer"] },
        s2: { entries: ["admin", "viewer", "editor", "guest"] },
      },
      migrations: [
        { fromSnapshotId: "s1", toSnapshotId: "s2", indexMap: { 2: 3, 3: 2 } },
      ],
    },
    action: {
      kind: { type: "string_enum" },
      snapshots: { av1: { entries: ["read", "write"] } },
    },
  },
  indices: {
    perm: {
      dims: ["role", "action"],
      versions: {
        v1: { snapshots: { role: "s1", action: "av1" } },
        v2: { snapshots: { role: "s2", action: "av1" } },
      },
    },
  },
};

// ── 픽스처: entity가 target version에 없는 시나리오 ────────────────────────────

const SHRINK_INPUT: MetaRegistryInput = {
  dims: {
    role: {
      kind: { type: "string_enum" },
      snapshots: {
        sv1: { entries: ["admin", "editor", "viewer"] },
        sv2: { entries: ["admin", "editor"] }, // viewer 제거
      },
    },
    action: {
      kind: { type: "string_enum" },
      snapshots: { av1: { entries: ["read", "write"] } },
    },
  },
  indices: {
    perm: {
      dims: ["role", "action"],
      versions: {
        v1: { snapshots: { role: "sv1", action: "av1" } },
        v2: { snapshots: { role: "sv2", action: "av1" } },
      },
    },
  },
};

function createStoredRule(
  overrides: Partial<StoredPolicyRule<unknown>> & { id: string },
): StoredPolicyRule<unknown> {
  return {
    indexId: "perm",
    versionId: "v1",
    pattern: ["1", null, null],
    value: { effect: "allow" },
    createdAt: AT.toISOString(),
    updatedAt: AT.toISOString(),
    ...overrides,
  };
}

function req(
  app: ReturnType<typeof createApp>,
  method: string,
  path: string,
  body?: unknown,
) {
  const init: RequestInit = { method };
  if (body !== undefined) {
    init.body = JSON.stringify(body);
    init.headers = { "Content-Type": "application/json" };
  }
  return app.request(path, init);
}

// ── 단위 테스트: RuleMigrationService ────────────────────────────────────────

describe("RuleMigrationService", () => {
  let store: InMemoryPolicyRuleStore<unknown>;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(LATER);
    store = new InMemoryPolicyRuleStore<unknown>();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("append-only version 변경 시 position이 보존된다", async () => {
    const registry = new MetaRegistry(APPEND_ONLY_INPUT);
    const service = createRuleMigrationService({
      policyRuleStore: store,
      metaRegistry: registry,
      now: () => LATER,
    });

    // admin(1), read(1), dashboard(1) 규칙
    await store.insert(createStoredRule({
      id: "rule-admin",
      pattern: ["1", "1", "1"],
      value: { effect: "allow" },
    }));
    // editor(2), wildcard action, wildcard resource
    await store.insert(createStoredRule({
      id: "rule-editor",
      pattern: ["2", null, null],
      value: { effect: "deny" },
    }));

    const result = await service.migrateRules("perm", "v1", "v2");

    expect(result.migrated).toBe(2);
    expect(result.skipped).toEqual([]);

    // append-only이므로 position 보존
    const adminRule = result.rules.find((r) => r.id === "rule-admin")!;
    expect(adminRule.pattern).toEqual(["1", "1", "1"]);
    expect(adminRule.versionId).toBe("v2");
    expect(adminRule.updatedAt).toBe(LATER.toISOString());

    const editorRule = result.rules.find((r) => r.id === "rule-editor")!;
    expect(editorRule.pattern).toEqual(["2", null, null]);
    expect(editorRule.versionId).toBe("v2");
  });

  it("migration edge가 있으면 position이 올바르게 변환된다 (swap)", async () => {
    const registry = new MetaRegistry(SWAP_INPUT);
    const service = createRuleMigrationService({
      policyRuleStore: store,
      metaRegistry: registry,
      now: () => LATER,
    });

    // editor = pos 2 in s1, should become pos 3 in s2
    await store.insert(createStoredRule({
      id: "rule-editor",
      indexId: "perm",
      versionId: "v1",
      pattern: ["2", null],
      value: { effect: "allow" },
    }));

    // viewer = pos 3 in s1, should become pos 2 in s2
    await store.insert(createStoredRule({
      id: "rule-viewer",
      indexId: "perm",
      versionId: "v1",
      pattern: ["3", "1"],
      value: { effect: "deny" },
    }));

    const result = await service.migrateRules("perm", "v1", "v2");

    expect(result.migrated).toBe(2);
    expect(result.skipped).toEqual([]);

    const editorRule = result.rules.find((r) => r.id === "rule-editor")!;
    expect(editorRule.pattern).toEqual(["3", null]); // 2→3

    const viewerRule = result.rules.find((r) => r.id === "rule-viewer")!;
    expect(viewerRule.pattern).toEqual(["2", "1"]); // 3→2
  });

  it("entity가 target version에 없는 규칙은 skipped 처리된다", async () => {
    const registry = new MetaRegistry(SHRINK_INPUT);
    const service = createRuleMigrationService({
      policyRuleStore: store,
      metaRegistry: registry,
      now: () => LATER,
    });

    // admin(1) — 변환 가능
    await store.insert(createStoredRule({
      id: "rule-admin",
      indexId: "perm",
      versionId: "v1",
      pattern: ["1", null],
      value: { effect: "allow" },
    }));

    // viewer(3) — target version에 없음
    await store.insert(createStoredRule({
      id: "rule-viewer",
      indexId: "perm",
      versionId: "v1",
      pattern: ["3", null],
      value: { effect: "deny" },
    }));

    const result = await service.migrateRules("perm", "v1", "v2");

    expect(result.migrated).toBe(1);
    expect(result.skipped).toEqual(["rule-viewer"]);
    expect(result.rules).toHaveLength(1);
    expect(result.rules[0]!.id).toBe("rule-admin");

    // skipped된 규칙은 원본 그대로 store에 남아 있어야 한다
    const viewer = await store.findById("rule-viewer");
    expect(viewer.versionId).toBe("v1");
    expect(viewer.pattern).toEqual(["3", null]);
  });

  it("fromVersion === toVersion이면 INVALID_INPUT 에러", async () => {
    const registry = new MetaRegistry(APPEND_ONLY_INPUT);
    const service = createRuleMigrationService({
      policyRuleStore: store,
      metaRegistry: registry,
    });

    await expect(
      service.migrateRules("perm", "v1", "v1"),
    ).rejects.toMatchObject({
      code: "INVALID_INPUT",
      statusCode: 400,
    });
  });

  it("존재하지 않는 index면 NOT_FOUND 에러", async () => {
    const registry = new MetaRegistry(APPEND_ONLY_INPUT);
    const service = createRuleMigrationService({
      policyRuleStore: store,
      metaRegistry: registry,
    });

    await expect(
      service.migrateRules("nonexistent", "v1", "v2"),
    ).rejects.toMatchObject({
      code: "NOT_FOUND",
      statusCode: 404,
    });
  });

  it("존재하지 않는 fromVersion이면 NOT_FOUND 에러", async () => {
    const registry = new MetaRegistry(APPEND_ONLY_INPUT);
    const service = createRuleMigrationService({
      policyRuleStore: store,
      metaRegistry: registry,
    });

    await expect(
      service.migrateRules("perm", "v99", "v2"),
    ).rejects.toMatchObject({
      code: "NOT_FOUND",
      statusCode: 404,
    });
  });

  it("존재하지 않는 toVersion이면 NOT_FOUND 에러", async () => {
    const registry = new MetaRegistry(APPEND_ONLY_INPUT);
    const service = createRuleMigrationService({
      policyRuleStore: store,
      metaRegistry: registry,
    });

    await expect(
      service.migrateRules("perm", "v1", "v99"),
    ).rejects.toMatchObject({
      code: "NOT_FOUND",
      statusCode: 404,
    });
  });

  it("해당 version에 규칙이 없으면 migrated=0", async () => {
    const registry = new MetaRegistry(APPEND_ONLY_INPUT);
    const service = createRuleMigrationService({
      policyRuleStore: store,
      metaRegistry: registry,
    });

    const result = await service.migrateRules("perm", "v1", "v2");

    expect(result.migrated).toBe(0);
    expect(result.skipped).toEqual([]);
    expect(result.rules).toEqual([]);
  });

  it("와일드카드 패턴은 변환 없이 유지된다", async () => {
    const registry = new MetaRegistry(APPEND_ONLY_INPUT);
    const service = createRuleMigrationService({
      policyRuleStore: store,
      metaRegistry: registry,
      now: () => LATER,
    });

    await store.insert(createStoredRule({
      id: "rule-wildcard",
      pattern: [null, null, null],
      value: { effect: "allow" },
    }));

    const result = await service.migrateRules("perm", "v1", "v2");

    expect(result.migrated).toBe(1);
    const rule = result.rules[0]!;
    expect(rule.pattern).toEqual([null, null, null]);
    expect(rule.versionId).toBe("v2");
  });

  it("range constraint도 올바르게 변환된다", async () => {
    const registry = new MetaRegistry(APPEND_ONLY_INPUT);
    const service = createRuleMigrationService({
      policyRuleStore: store,
      metaRegistry: registry,
      now: () => LATER,
    });

    // "1-2" = admin(1), editor(2)
    await store.insert(createStoredRule({
      id: "rule-range",
      pattern: ["1-2", null, null],
      value: { effect: "allow" },
    }));

    const result = await service.migrateRules("perm", "v1", "v2");

    expect(result.migrated).toBe(1);
    // append-only이므로 position 보존
    expect(result.rules[0]!.pattern).toEqual(["1-2", null, null]);
  });

  it("createdAt은 변경되지 않고 updatedAt만 갱신된다", async () => {
    const registry = new MetaRegistry(APPEND_ONLY_INPUT);
    const service = createRuleMigrationService({
      policyRuleStore: store,
      metaRegistry: registry,
      now: () => LATER,
    });

    const originalCreatedAt = "2025-06-01T00:00:00.000Z";
    await store.insert(createStoredRule({
      id: "rule-timestamps",
      pattern: ["1", null, null],
      value: "test",
      createdAt: originalCreatedAt,
      updatedAt: originalCreatedAt,
    }));

    const result = await service.migrateRules("perm", "v1", "v2");

    const rule = result.rules[0]!;
    expect(rule.createdAt).toBe(originalCreatedAt);
    expect(rule.updatedAt).toBe(LATER.toISOString());
  });
});

// ── 통합 테스트: POST /rules/migrate 엔드포인트 ────────────────────────────────

describe("POST /rules/migrate", () => {
  let store: InMemoryPolicyRuleStore<unknown>;
  let app: ReturnType<typeof createApp>;
  let metaRegistry: MetaRegistry;

  beforeEach(async () => {
    vi.useFakeTimers();
    vi.setSystemTime(AT);

    store = new InMemoryPolicyRuleStore<unknown>();
    metaRegistry = new MetaRegistry(APPEND_ONLY_INPUT);

    app = createApp({
      policyRuleStore: store,
      metaRegistry,
      version: "test",
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("규칙을 성공적으로 마이그레이션한다", async () => {
    // 먼저 규칙 생성
    await store.insert(createStoredRule({
      id: "rule-1",
      pattern: ["1", "1", "1"],
      value: { effect: "allow" },
    }));

    vi.setSystemTime(LATER);

    const response = await req(app, "POST", "/rules/migrate", {
      indexId: "perm",
      fromVersion: "v1",
      toVersion: "v2",
    });

    expect(response.status).toBe(200);
    const body = await response.json() as { migrated: number; skipped: string[]; rules: unknown[] };
    expect(body.migrated).toBe(1);
    expect(body.skipped).toEqual([]);
    expect(body.rules).toHaveLength(1);
  });

  it("fromVersion === toVersion이면 400 에러", async () => {
    const response = await req(app, "POST", "/rules/migrate", {
      indexId: "perm",
      fromVersion: "v1",
      toVersion: "v1",
    });

    expect(response.status).toBe(400);
    const body = await response.json() as { error: { code: string } };
    expect(body.error.code).toBe("INVALID_INPUT");
  });

  it("존재하지 않는 index면 404 에러", async () => {
    const response = await req(app, "POST", "/rules/migrate", {
      indexId: "nonexistent",
      fromVersion: "v1",
      toVersion: "v2",
    });

    expect(response.status).toBe(404);
    const body = await response.json() as { error: { code: string } };
    expect(body.error.code).toBe("NOT_FOUND");
  });

  it("잘못된 payload면 400 에러", async () => {
    const response = await req(app, "POST", "/rules/migrate", {
      indexId: "",
      fromVersion: "v1",
      toVersion: "v2",
    });

    expect(response.status).toBe(400);
  });

  it("마이그레이션 후 규칙이 새 versionId로 조회된다", async () => {
    await store.insert(createStoredRule({
      id: "rule-1",
      pattern: ["1", null, null],
      value: { effect: "allow" },
    }));

    const migrateResponse = await req(app, "POST", "/rules/migrate", {
      indexId: "perm",
      fromVersion: "v1",
      toVersion: "v2",
    });
    expect(migrateResponse.status).toBe(200);

    // v1에서는 비어 있어야 한다
    const v1Rules = await store.findByIndex("perm", "v1");
    expect(v1Rules).toEqual([]);

    // v2에서 조회 가능해야 한다
    const v2Rules = await store.findByIndex("perm", "v2");
    expect(v2Rules).toHaveLength(1);
    expect(v2Rules[0]!.versionId).toBe("v2");
  });
});
