import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { DEMO_CATALOG, encodePrefixByValue } from "demo-snapshot";
import { DkgSqliteStore } from "./dkg-sqlite-store.js";
import { bootstrapDkg } from "../dkg/bootstrap.js";
import { aggregateUsageData, type AddressContextRecord } from "../convergence/usage-aggregator.js";
import { analyzeDeploymentSkew } from "../convergence/deployment-skew.js";

let store: DkgSqliteStore;

beforeEach(() => {
  store = new DkgSqliteStore(":memory:");
});

afterEach(() => {
  store.close();
});

describe("DKG SQLite Store — Graph", () => {

  it("save → load → 노드/엣지 수 일치", () => {
    const graph = bootstrapDkg();
    const saved = store.saveGraph(graph);

    console.log(`\n  saved: ${saved.nodesWritten} nodes, ${saved.edgesWritten} edges`);

    const loaded = store.loadGraph();
    expect(loaded.nodeCount).toBe(graph.nodeCount);
    // 엣지는 unique index로 중복 제거되므로 정확히 일치
    expect(loaded.edgeCount).toBe(graph.edgeCount);
  });

  it("upsert — 같은 노드 2번 저장해도 1개", () => {
    const graph = bootstrapDkg();
    store.saveGraph(graph);
    store.saveGraph(graph); // 2번째

    const stats = store.stats();
    expect(stats.nodes).toBe(graph.nodeCount);
  });

  it("load 후 cascade 질의 동작", () => {
    const graph = bootstrapDkg();
    store.saveGraph(graph);

    const loaded = store.loadGraph();
    const cascade = loaded.cascadeFromAxis("role");
    expect(cascade.length).toBeGreaterThan(0);
    expect(cascade.some(c => c.id === "permission")).toBe(true);
  });
});

describe("DKG SQLite Store — Usage 스냅샷", () => {

  it("집계 결과 저장 → 로드 → versionUsages 보존", () => {
    const svcRef = DEMO_CATALOG.prefixes.permission.versions[0].refEntries!.perm_svc.values[0];
    const records: AddressContextRecord[] = [];

    for (let i = 0; i < 100; i++) {
      const addr = encodePrefixByValue(DEMO_CATALOG, "permission", "v4", {
        perm_svc: svcRef, role: "admin",
      });
      records.push({
        address_context: { permission: `permission:v4:${addr}` },
        timestamp: new Date(2026, 2, 20, 0, 0, i).toISOString(),
        session_id: "auth-service",
      });
    }

    const usage = aggregateUsageData(DEMO_CATALOG, records);
    const snapshotId = store.saveUsageSnapshot(usage);

    console.log(`\n  snapshot saved: id=${snapshotId}`);

    const recent = store.loadRecentVersionUsages(5);
    expect(recent.length).toBe(1);
    expect(recent[0].versionUsages.length).toBeGreaterThan(0);
    expect(recent[0].versionUsages[0].prefix).toBe("permission");
    expect(recent[0].versionUsages[0].sessions).toContain("auth-service");
  });

  it("누적 스냅샷 — 3회 저장 → 히스토리 3개", () => {
    const svcRef = DEMO_CATALOG.prefixes.endpoint.versions[0].refEntries!.svc_ref.values[0];

    for (let round = 1; round <= 3; round++) {
      const records: AddressContextRecord[] = [];
      for (let i = 0; i < 50; i++) {
        const addr = encodePrefixByValue(DEMO_CATALOG, "endpoint", "v1", {
          svc_ref: svcRef, resource_type: "api", http_method: "POST", api_version: "v1",
        });
        records.push({
          address_context: { endpoint: `endpoint:v1:${addr}` },
          timestamp: new Date(2026, 2, 20 + round, 0, 0, i).toISOString(),
          session_id: `service-R${round}`,
        });
      }

      const usage = aggregateUsageData(DEMO_CATALOG, records);
      store.saveUsageSnapshot(usage);
    }

    const stats = store.stats();
    expect(stats.snapshots).toBe(3);

    const recent = store.loadRecentVersionUsages(10);
    expect(recent.length).toBe(3);
  });

  it("배포 스큐 — 저장된 스냅샷에서 감지", () => {
    const svcRef = DEMO_CATALOG.prefixes.permission.versions[0].refEntries!.perm_svc.values[0];
    const records: AddressContextRecord[] = [];

    // auth: v4, payment: v3
    for (let i = 0; i < 100; i++) {
      records.push({
        address_context: {
          permission: `permission:v4:${encodePrefixByValue(DEMO_CATALOG, "permission", "v4", { perm_svc: svcRef, role: "admin" })}`,
        },
        timestamp: new Date(2026, 2, 20, 0, 0, i).toISOString(),
        session_id: "auth-service",
      });
    }
    for (let i = 0; i < 80; i++) {
      records.push({
        address_context: {
          permission: `permission:v3:${encodePrefixByValue(DEMO_CATALOG, "permission", "v3", { perm_svc: svcRef, role: "admin" })}`,
        },
        timestamp: new Date(2026, 2, 20, 1, 0, i).toISOString(),
        session_id: "payment-service",
      });
    }

    const usage = aggregateUsageData(DEMO_CATALOG, records);
    store.saveUsageSnapshot(usage);

    // 저장된 스냅샷에서 스큐 감지
    const recent = store.loadRecentVersionUsages(1);
    const skews = analyzeDeploymentSkew(recent[0].versionUsages);

    const permSkew = skews.find(s => s.prefix === "permission")!;
    expect(permSkew.hasSkew).toBe(true);
    expect(permSkew.severity).toBe("critical");
    expect(permSkew.staleConsumers[0].session).toBe("payment-service");

    console.log(`\n  저장된 스냅샷 기반 스큐: ${permSkew.summary}`);
  });
});

describe("DKG SQLite Store — JSON export/import", () => {

  it("export → import → 동일 상태", () => {
    const graph = bootstrapDkg();
    store.saveGraph(graph);

    const json = store.exportJson();
    const parsed = JSON.parse(json);
    expect(parsed.version).toBe(1);
    expect(parsed.nodes.length).toBe(graph.nodeCount);

    // 새 store에 import
    const store2 = new DkgSqliteStore(":memory:");
    const result = store2.importJson(json);
    expect(result.nodesImported).toBe(graph.nodeCount);

    const loaded = store2.loadGraph();
    expect(loaded.nodeCount).toBe(graph.nodeCount);

    store2.close();
  });

  it("meta 저장/조회", () => {
    store.setMeta("last_bootstrap", "2026-03-20T00:00:00Z");
    store.setMeta("catalog_hash", "abc123");

    expect(store.getMeta("last_bootstrap")).toBe("2026-03-20T00:00:00Z");
    expect(store.getMeta("catalog_hash")).toBe("abc123");
    expect(store.getMeta("nonexistent")).toBeNull();
  });
});

// ── Phase 6b: 멀티 카탈로그 격리 ──────────────────────

describe("DKG SQLite Store — 멀티 카탈로그 격리", () => {

  it("catalogId 기본값 'demo'", () => {
    expect(store.catalogId).toBe("demo");
  });

  it("커스텀 catalogId로 생성", () => {
    const s = new DkgSqliteStore(":memory:", "custom");
    expect(s.catalogId).toBe("custom");
    s.close();
  });

  it("exportJson에 catalogId 포함", () => {
    const s = new DkgSqliteStore(":memory:", "export-test");
    const graph = bootstrapDkg();
    s.saveGraph(graph);

    const exported = JSON.parse(s.exportJson());
    expect(exported.catalogId).toBe("export-test");
    s.close();
  });

  it("listCatalogIds — 저장된 카탈로그 목록", () => {
    const graph = bootstrapDkg();
    store.saveGraph(graph);

    const ids = store.listCatalogIds();
    expect(ids).toContain("demo");
  });

  it("deleteCatalog — 특정 카탈로그만 삭제", () => {
    const graph = bootstrapDkg();
    store.saveGraph(graph);
    const before = store.stats();
    expect(before.nodes).toBeGreaterThan(0);

    const deleted = store.deleteCatalog("demo");
    expect(deleted.nodesDeleted).toBe(before.nodes);

    const after = store.stats();
    expect(after.nodes).toBe(0);
  });

  it("importJson은 현재 catalogId에 저장", () => {
    const src = new DkgSqliteStore(":memory:", "src");
    src.saveGraph(bootstrapDkg());
    const json = src.exportJson();
    src.close();

    const dest = new DkgSqliteStore(":memory:", "dest");
    const result = dest.importJson(json);
    expect(result.nodesImported).toBeGreaterThan(0);

    const loaded = dest.loadGraph();
    expect(loaded.nodeCount).toBe(result.nodesImported);
    dest.close();
  });
});
