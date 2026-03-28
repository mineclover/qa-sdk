/**
 * DKG SQLite Store — GraphRegistry + UsageData 영속화.
 *
 * node:sqlite (Node 내장) 사용.
 * save/load로 GraphRegistry를 SQLite와 동기화.
 * 집계 결과를 스냅샷으로 저장하여 누적/비교 가능.
 */

import { getDatabaseSync, type DatabaseSyncInstance } from "index-meta";
import { drizzle } from "drizzle-orm/node-sqlite";
import { migrate } from "drizzle-orm/node-sqlite/migrator";
import { GraphRegistry } from "../dkg/graph-registry.js";
import type { DkgNode, DkgEdge } from "../dkg/dkg.types.js";
import type { UsageData, VersionUsage } from "@qa-sdk/convergence";

export type NodeSource = "bootstrap" | "manual" | "auto";

type JsonValue =
  | string
  | number
  | boolean
  | null
  | JsonValue[]
  | JsonObject;

interface JsonObject {
  [key: string]: JsonValue;
}

type PersistedEdgeInput = {
  type: string;
  from: string;
  to: string;
  meta?: JsonObject;
};

interface ExportNodePayload extends JsonObject {
  id: string;
  kind: string;
}

interface ExportEdgePayload {
  type: string;
  from: string;
  to: string;
  meta?: JsonObject;
}

export class DkgSqliteStore {
  private db: DatabaseSyncInstance;
  readonly catalogId: string;

  constructor(path: string = ":memory:", catalogId: string = "demo") {
    this.catalogId = catalogId;
    const Ctor = getDatabaseSync();
    this.db = new Ctor(path);
    this.db.exec("PRAGMA journal_mode = WAL");
    this.db.exec("PRAGMA busy_timeout = 3000");
    this.db.exec("PRAGMA foreign_keys = ON");

    // drizzle-kit 마이그레이션 실행
    try {
      const drizzleDb = drizzle({ client: this.db });
      migrate(drizzleDb, {
        migrationsFolder: new URL("../../drizzle", import.meta.url).pathname,
      });
    } catch (err) {
      console.error("[dkg-store] drizzle 마이그레이션 실패:", err);
      throw err;
    }
  }

  // ── Graph: save/load ─────────────────────────────────

  /**
   * GraphRegistry의 전체 노드/엣지를 SQLite에 저장. 기존 데이터와 머지 (upsert).
   * @param source 저장 원천 — bootstrap(재생성 가능) | manual(사용자 기록) | auto(자동 파생)
   */
  saveGraph(graph: GraphRegistry, source: NodeSource = "bootstrap"): { nodesWritten: number; edgesWritten: number } {
    let nodesWritten = 0;
    let edgesWritten = 0;

    const upsertNode = this.db.prepare(
      `INSERT INTO dkg_nodes (id, kind, source, catalog_id, data, updated_at)
       VALUES (?, ?, ?, ?, ?, datetime('now'))
       ON CONFLICT(id) DO UPDATE SET kind=excluded.kind, source=excluded.source, catalog_id=excluded.catalog_id, data=excluded.data, updated_at=datetime('now')`,
    );

    const insertEdge = this.db.prepare(
      `INSERT OR IGNORE INTO dkg_edges (type, from_id, to_id, source, catalog_id, meta)
       VALUES (?, ?, ?, ?, ?, ?)`,
    );

    // 노드 저장
    for (const node of graph.getAllNodes()) {
      upsertNode.run(node.id, node.kind, source, this.catalogId, JSON.stringify(node));
      nodesWritten++;
    }

    // 엣지 저장 — 모든 노드의 forward edges
    const seenEdges = new Set<string>();
    for (const node of graph.getAllNodes()) {
      for (const edge of graph.edgesFrom(node.id)) {
        const key = `${edge.type}:${edge.from}:${edge.to}`;
        if (seenEdges.has(key)) continue;
        seenEdges.add(key);
        insertEdge.run(edge.type, edge.from, edge.to, source, this.catalogId, edge.meta ? JSON.stringify(edge.meta) : null);
        edgesWritten++;
      }
    }

    return { nodesWritten, edgesWritten };
  }

  /**
   * 개별 노드 + 엣지를 저장. decide/observe 등 운영 기록용.
   * saveGraph와 달리 전체 그래프를 덮지 않고 추가만.
   */
  saveNodes(
    nodes: readonly DkgNode[],
    edges: readonly PersistedEdgeInput[],
    source: NodeSource = "manual",
  ): void {
    const upsertNode = this.db.prepare(
      `INSERT INTO dkg_nodes (id, kind, source, catalog_id, data, updated_at)
       VALUES (?, ?, ?, ?, ?, datetime('now'))
       ON CONFLICT(id) DO UPDATE SET kind=excluded.kind, source=excluded.source, catalog_id=excluded.catalog_id, data=excluded.data, updated_at=datetime('now')`,
    );
    const insertEdge = this.db.prepare(
      `INSERT OR IGNORE INTO dkg_edges (type, from_id, to_id, source, catalog_id, meta)
       VALUES (?, ?, ?, ?, ?, ?)`,
    );

    for (const node of nodes) {
      upsertNode.run(node.id, node.kind, source, this.catalogId, JSON.stringify(node));
    }
    for (const edge of edges) {
      insertEdge.run(edge.type, edge.from, edge.to, source, this.catalogId, edge.meta ? JSON.stringify(edge.meta) : null);
    }
  }

  /**
   * bootstrap 데이터만 삭제. manual/auto 운영 데이터는 보존.
   * refresh 전 호출하여 구조를 초기화한 후 재부트스트랩.
   */
  clearBootstrap(): { nodesDeleted: number; edgesDeleted: number } {
    const nodesBefore = (this.db.prepare("SELECT COUNT(*) as c FROM dkg_nodes WHERE source='bootstrap' AND catalog_id=?").get(this.catalogId) as { c: number }).c;
    const edgesBefore = (this.db.prepare("SELECT COUNT(*) as c FROM dkg_edges WHERE source='bootstrap' AND catalog_id=?").get(this.catalogId) as { c: number }).c;

    this.db.prepare("DELETE FROM dkg_edges WHERE source='bootstrap' AND catalog_id=?").run(this.catalogId);
    this.db.prepare("DELETE FROM dkg_nodes WHERE source='bootstrap' AND catalog_id=?").run(this.catalogId);

    return { nodesDeleted: nodesBefore, edgesDeleted: edgesBefore };
  }

  /** SQLite에서 GraphRegistry를 로드. */
  loadGraph(): GraphRegistry {
    const graph = new GraphRegistry();

    // 노드 로드
    const nodes = this.db.prepare("SELECT id, kind, data FROM dkg_nodes WHERE catalog_id=?").all(this.catalogId) as Array<{
      id: string; kind: string; data: string;
    }>;
    for (const row of nodes) {
      graph.addNode(JSON.parse(row.data) as DkgNode);
    }

    // 엣지 로드
    const edges = this.db.prepare("SELECT type, from_id, to_id, meta FROM dkg_edges WHERE catalog_id=?").all(this.catalogId) as Array<{
      type: string; from_id: string; to_id: string; meta: string | null;
    }>;
    for (const row of edges) {
      graph.addEdge(
        row.type as DkgEdge["type"],
        row.from_id,
        row.to_id,
        row.meta ? JSON.parse(row.meta) : undefined,
      );
    }

    return graph;
  }

  // ── Usage: 스냅샷 저장/로드 ──────────────────────────

  /** UsageData를 스냅샷으로 저장. 반환: snapshot ID. */
  saveUsageSnapshot(usage: UsageData): number {
    const stmt = this.db.prepare(
      `INSERT INTO usage_snapshots (period_from, period_to, total_records, data)
       VALUES (?, ?, ?, ?)`,
    );
    const from = String(usage.collectionPeriod?.from ?? new Date().toISOString());
    const to = String(usage.collectionPeriod?.to ?? from);
    const totalRecords = Number(usage.sourceStats?.totalRecords ?? 0);
    const data = JSON.stringify(usage);
    stmt.run(from, to, totalRecords, data);

    const row = this.db.prepare("SELECT last_insert_rowid() as id").get() as { id: number };
    const snapshotId = row.id;

    // versionUsages 저장
    if (usage.versionUsages) {
      const vuStmt = this.db.prepare(
        `INSERT INTO version_usages (snapshot_id, prefix, version, count, last_seen, sessions)
         VALUES (?, ?, ?, ?, ?, ?)`,
      );
      for (const vu of usage.versionUsages) {
        vuStmt.run(
          snapshotId,
          String(vu.prefix),
          String(vu.version),
          Number(vu.count),
          String(vu.lastSeen ?? new Date().toISOString()),
          JSON.stringify(vu.sessions ?? []),
        );
      }
    }

    return snapshotId;
  }

  /** 최근 N개 스냅샷의 versionUsages를 로드. */
  loadRecentVersionUsages(limit: number = 10): Array<{
    snapshotId: number;
    collectedAt: string;
    versionUsages: VersionUsage[];
  }> {
    const snapshots = this.db.prepare(
      `SELECT id, collected_at FROM usage_snapshots ORDER BY collected_at DESC LIMIT ?`,
    ).all(limit) as Array<{ id: number; collected_at: string }>;

    return snapshots.map(snap => {
      const rows = this.db.prepare(
        `SELECT prefix, version, count, last_seen, sessions FROM version_usages WHERE snapshot_id = ?`,
      ).all(snap.id) as Array<{
        prefix: string; version: string; count: number; last_seen: string; sessions: string;
      }>;

      return {
        snapshotId: snap.id,
        collectedAt: snap.collected_at,
        versionUsages: rows.map(r => ({
          prefix: r.prefix,
          version: r.version,
          count: r.count,
          lastSeen: r.last_seen,
          sessions: JSON.parse(r.sessions) as string[],
        })),
      };
    });
  }

  /**
   * UsageData 저장 + 분석 결과 observation을 함께 기록.
   * 분석은 호출자가 수행하고 결과만 전달한다 (store → convergence 의존 방지).
   * ObservationNode의 subjects 필드에서 observes 엣지를 자동 생성하여 그래프 정합성을 유지한다.
   */
  saveUsageSnapshotWithObservations(
    usage: UsageData,
    autoObservations: readonly DkgNode[],
  ): { snapshotId: number; observationsWritten: number } {
    const snapshotId = this.saveUsageSnapshot(usage);

    if (autoObservations.length > 0) {
      const upsertNode = this.db.prepare(
        `INSERT INTO dkg_nodes (id, kind, source, catalog_id, data, updated_at)
         VALUES (?, ?, ?, ?, ?, datetime('now'))
         ON CONFLICT(id) DO UPDATE SET kind=excluded.kind, source=excluded.source, catalog_id=excluded.catalog_id, data=excluded.data, updated_at=datetime('now')`,
      );
      const insertEdge = this.db.prepare(
        `INSERT OR IGNORE INTO dkg_edges (type, from_id, to_id, source, catalog_id, meta)
         VALUES (?, ?, ?, ?, ?, ?)`,
      );

      for (const obs of autoObservations) {
        upsertNode.run(obs.id, obs.kind, "auto", this.catalogId, JSON.stringify(obs));
        // ObservationNode.subjects → observes 엣지 자동 생성
        if (obs.kind === "observation") {
          const subjects = obs.subjects;
          for (const subjectId of subjects) {
            insertEdge.run("observes", obs.id, subjectId, "auto", this.catalogId, null);
          }
        }
      }
    }

    return { snapshotId, observationsWritten: autoObservations.length };
  }

  /** 단일 노드 upsert. resolution 영속화 등에 사용. */
  updateNode(node: DkgNode, source: NodeSource = "auto"): void {
    this.db.prepare(
      `INSERT INTO dkg_nodes (id, kind, source, catalog_id, data, updated_at)
       VALUES (?, ?, ?, ?, ?, datetime('now'))
       ON CONFLICT(id) DO UPDATE SET kind=excluded.kind, source=excluded.source, catalog_id=excluded.catalog_id, data=excluded.data, updated_at=datetime('now')`,
    ).run(node.id, node.kind, source, this.catalogId, JSON.stringify(node));
  }

  // ── Meta ──────────────────────────────────────────────

  setMeta(key: string, value: string): void {
    this.db.prepare(
      `INSERT INTO dkg_meta (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value=excluded.value`,
    ).run(key, value);
  }

  getMeta(key: string): string | null {
    const row = this.db.prepare("SELECT value FROM dkg_meta WHERE key = ?").get(key) as { value: string } | undefined;
    return row?.value ?? null;
  }

  /**
   * 결정적 ID 전환 후 남은 timestamp 기반 stale observation을 정리한다.
   * ID 패턴: OBS-METRIC-...-{timestamp}-{counter} (13자리 숫자 + 하이픈 + 숫자로 끝남)
   * 보존 대상: OBS-METRIC-...-{no-timestamp} (결정적 ID)
   */
  cleanStaleMetricObservations(): number {
    // timestamp 패턴: 13자리 숫자-숫자 로 끝나는 OBS-METRIC ID
    const stale = this.db.prepare(
      `SELECT id FROM dkg_nodes WHERE catalog_id=? AND kind='observation' AND id LIKE 'OBS-METRIC-%' AND id GLOB 'OBS-METRIC-*-[0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9]*-[0-9]*'`,
    ).all(this.catalogId) as Array<{ id: string }>;

    if (stale.length === 0) return 0;

    for (const row of stale) {
      this.db.prepare("DELETE FROM dkg_edges WHERE catalog_id=? AND (from_id=? OR to_id=?)").run(this.catalogId, row.id, row.id);
      this.db.prepare("DELETE FROM dkg_nodes WHERE catalog_id=? AND id=?").run(this.catalogId, row.id);
    }

    return stale.length;
  }

  /**
   * resolution이 설정된(닫힌) observation을 정리한다.
   * daysOld 이상 경과한 resolved observation만 삭제. 기본 30일.
   */
  pruneResolvedObservations(daysOld = 30): number {
    // resolution이 있는 observation 중 date가 daysOld 이전인 것
    const cutoff = new Date(Date.now() - daysOld * 86_400_000).toISOString().slice(0, 10);
    const resolved = this.db.prepare(
      `SELECT id FROM dkg_nodes WHERE catalog_id=? AND kind='observation' AND data LIKE '%"resolution":%' AND data LIKE '%"outcome":%'`,
    ).all(this.catalogId) as Array<{ id: string }>;

    let pruned = 0;
    for (const row of resolved) {
      // date 확인 — JSON에서 date 추출
      const nodeData = this.db.prepare(
        "SELECT data FROM dkg_nodes WHERE catalog_id=? AND id=?",
      ).get(this.catalogId, row.id) as { data: string } | undefined;
      if (!nodeData) continue;
      try {
        const parsed = JSON.parse(nodeData.data);
        if (parsed.date && parsed.date <= cutoff) {
          this.db.prepare("DELETE FROM dkg_edges WHERE catalog_id=? AND (from_id=? OR to_id=?)").run(this.catalogId, row.id, row.id);
          this.db.prepare("DELETE FROM dkg_nodes WHERE catalog_id=? AND id=?").run(this.catalogId, row.id);
          pruned++;
        }
      } catch { /* JSON 파싱 실패 시 건너뜀 */ }
    }
    return pruned;
  }

  // ── Stats ────────────────────────────────────────────

  stats(): {
    nodes: number; edges: number; snapshots: number; versionUsages: number;
    bootstrapNodes: number; manualNodes: number;
    bootstrapEdges: number; manualEdges: number;
  } {
    const nodes = (this.db.prepare("SELECT COUNT(*) as c FROM dkg_nodes WHERE catalog_id=?").get(this.catalogId) as { c: number }).c;
    const edges = (this.db.prepare("SELECT COUNT(*) as c FROM dkg_edges WHERE catalog_id=?").get(this.catalogId) as { c: number }).c;
    const snapshots = (this.db.prepare("SELECT COUNT(*) as c FROM usage_snapshots").get() as { c: number }).c;
    const versionUsages = (this.db.prepare("SELECT COUNT(*) as c FROM version_usages").get() as { c: number }).c;
    const bootstrapNodes = (this.db.prepare("SELECT COUNT(*) as c FROM dkg_nodes WHERE source='bootstrap' AND catalog_id=?").get(this.catalogId) as { c: number }).c;
    const manualNodes = (this.db.prepare("SELECT COUNT(*) as c FROM dkg_nodes WHERE source='manual' AND catalog_id=?").get(this.catalogId) as { c: number }).c;
    const bootstrapEdges = (this.db.prepare("SELECT COUNT(*) as c FROM dkg_edges WHERE source='bootstrap' AND catalog_id=?").get(this.catalogId) as { c: number }).c;
    const manualEdges = (this.db.prepare("SELECT COUNT(*) as c FROM dkg_edges WHERE source='manual' AND catalog_id=?").get(this.catalogId) as { c: number }).c;
    return { nodes, edges, snapshots, versionUsages, bootstrapNodes, manualNodes, bootstrapEdges, manualEdges };
  }

  // ── JSON export/import ───────────────────────────────

  /** 전체 상태를 JSON으로 export. */
  exportJson(): string {
    const nodes = this.db.prepare("SELECT id, kind, data FROM dkg_nodes WHERE catalog_id=?").all(this.catalogId) as Array<{
      id: string; kind: string; data: string;
    }>;
    const edges = this.db.prepare("SELECT type, from_id, to_id, meta FROM dkg_edges WHERE catalog_id=?").all(this.catalogId) as Array<{
      type: string; from_id: string; to_id: string; meta: string | null;
    }>;
    const snapshots = this.db.prepare("SELECT * FROM usage_snapshots ORDER BY collected_at").all();
    const meta = this.db.prepare("SELECT * FROM dkg_meta").all();

    return JSON.stringify({
      version: 1,
      catalogId: this.catalogId,
      exportedAt: new Date().toISOString(),
      nodes: nodes.map(n => ({ id: n.id, kind: n.kind, ...JSON.parse(n.data) })),
      edges: edges.map(e => ({ type: e.type, from: e.from_id, to: e.to_id, meta: e.meta ? JSON.parse(e.meta) : undefined })),
      snapshots,
      meta,
    }, null, 2);
  }

  /** JSON에서 상태를 import. 기존 데이터에 머지. */
  importJson(json: string): { nodesImported: number; edgesImported: number } {
    const data = JSON.parse(json) as {
      nodes: ExportNodePayload[];
      edges: ExportEdgePayload[];
    };

    const upsertNode = this.db.prepare(
      `INSERT INTO dkg_nodes (id, kind, catalog_id, data, updated_at) VALUES (?, ?, ?, ?, datetime('now'))
       ON CONFLICT(id) DO UPDATE SET kind=excluded.kind, catalog_id=excluded.catalog_id, data=excluded.data, updated_at=datetime('now')`,
    );
    const insertEdge = this.db.prepare(
      `INSERT OR IGNORE INTO dkg_edges (type, from_id, to_id, catalog_id, meta) VALUES (?, ?, ?, ?, ?)`,
    );

    let nodesImported = 0;
    let edgesImported = 0;

    for (const node of data.nodes) {
      upsertNode.run(node.id, node.kind, this.catalogId, JSON.stringify(node));
      nodesImported++;
    }
    for (const edge of data.edges) {
      insertEdge.run(edge.type, edge.from, edge.to, this.catalogId, edge.meta ? JSON.stringify(edge.meta) : null);
      edgesImported++;
    }

    return { nodesImported, edgesImported };
  }

  // ── Decisions export/import ─────────────────────────

  /**
   * manual/auto 의사결정 데이터만 export.
   * bootstrap 데이터는 카탈로그에서 재생성 가능하므로 제외.
   * decision, observation, version-event 노드 + 관련 엣지만 추출.
   */
  exportDecisions(): string {
    const nodes = this.db.prepare(
      `SELECT id, kind, source, data FROM dkg_nodes WHERE catalog_id=? AND source IN ('manual','auto')`,
    ).all(this.catalogId) as Array<{ id: string; kind: string; source: string; data: string }>;

    const nodeIds = new Set(nodes.map(n => n.id));

    // 관련 엣지: from 또는 to가 manual/auto 노드인 것
    const allEdges = this.db.prepare(
      `SELECT type, from_id, to_id, source, meta FROM dkg_edges WHERE catalog_id=?`,
    ).all(this.catalogId) as Array<{ type: string; from_id: string; to_id: string; source: string; meta: string | null }>;

    const edges = allEdges.filter(e => nodeIds.has(e.from_id) || nodeIds.has(e.to_id));

    return JSON.stringify({
      version: 1,
      type: "decisions",
      catalogId: this.catalogId,
      exportedAt: new Date().toISOString(),
      summary: {
        decisions: nodes.filter(n => n.kind === "decision").length,
        observations: nodes.filter(n => n.kind === "observation").length,
        versionEvents: nodes.filter(n => n.kind === "version-event").length,
        edges: edges.length,
      },
      nodes: nodes.map(n => ({ id: n.id, kind: n.kind, source: n.source, ...JSON.parse(n.data) })),
      edges: edges.map(e => ({ type: e.type, from: e.from_id, to: e.to_id, source: e.source, meta: e.meta ? JSON.parse(e.meta) : undefined })),
    }, null, 2);
  }

  /**
   * 의사결정 JSON을 현재 카탈로그에 import (머지).
   * 기존 bootstrap 데이터 위에 manual/auto 노드를 덮어쓴다.
   */
  importDecisions(json: string): { nodesImported: number; edgesImported: number } {
    const data = JSON.parse(json) as {
      type?: string;
      nodes: Array<ExportNodePayload & { source?: string }>;
      edges: Array<ExportEdgePayload & { source?: string }>;
    };

    const upsertNode = this.db.prepare(
      `INSERT INTO dkg_nodes (id, kind, source, catalog_id, data, updated_at)
       VALUES (?, ?, ?, ?, ?, datetime('now'))
       ON CONFLICT(id) DO UPDATE SET kind=excluded.kind, source=excluded.source, catalog_id=excluded.catalog_id, data=excluded.data, updated_at=datetime('now')`,
    );
    const insertEdge = this.db.prepare(
      `INSERT OR IGNORE INTO dkg_edges (type, from_id, to_id, source, catalog_id, meta)
       VALUES (?, ?, ?, ?, ?, ?)`,
    );

    let nodesImported = 0;
    let edgesImported = 0;

    for (const node of data.nodes) {
      const source = node.source ?? "manual";
      upsertNode.run(node.id, node.kind, source, this.catalogId, JSON.stringify(node));
      nodesImported++;
    }
    for (const edge of data.edges) {
      const source = edge.source ?? "manual";
      insertEdge.run(edge.type, edge.from, edge.to, source, this.catalogId, edge.meta ? JSON.stringify(edge.meta) : null);
      edgesImported++;
    }

    return { nodesImported, edgesImported };
  }

  /**
   * 최근 의사결정/관측 노드 목록 조회.
   * @param limit 최대 N개 (기본 20)
   * @param kinds 필터할 노드 종류 (기본: decision + observation)
   */
  listRecentDecisions(
    limit: number = 20,
    kinds: readonly string[] = ["decision", "observation"],
  ): Array<{ id: string; kind: string; source: string; date: string; data: JsonObject }> {
    const placeholders = kinds.map(() => "?").join(",");
    const rows = this.db.prepare(
      `SELECT id, kind, source, data, updated_at FROM dkg_nodes
       WHERE catalog_id=? AND kind IN (${placeholders})
       ORDER BY updated_at DESC LIMIT ?`,
    ).all(this.catalogId, ...kinds, limit) as Array<{
      id: string; kind: string; source: string; data: string; updated_at: string;
    }>;

    return rows.map(r => {
      const parsed = JSON.parse(r.data) as JsonObject;
      return {
        id: r.id,
        kind: r.kind,
        source: r.source,
        date: (parsed.date as string) ?? r.updated_at,
        data: parsed,
      };
    });
  }

  /** 등록된 모든 카탈로그 ID 목록. */
  listCatalogIds(): string[] {
    const rows = this.db.prepare(
      "SELECT DISTINCT catalog_id FROM dkg_nodes UNION SELECT DISTINCT catalog_id FROM dkg_edges",
    ).all() as Array<{ catalog_id: string }>;
    return [...new Set(rows.map(r => r.catalog_id))];
  }

  /** 특정 카탈로그의 모든 DKG 데이터 삭제. */
  /** 관측/결정 노드만 삭제 (source=manual|auto|metric|runtime). 구조(bootstrap)는 보존. */
  clearOperational(): { nodesDeleted: number; edgesDeleted: number } {
    const nodesBefore = (this.db.prepare(
      "SELECT COUNT(*) as c FROM dkg_nodes WHERE source != 'bootstrap' AND catalog_id=?",
    ).get(this.catalogId) as { c: number }).c;
    const edgesBefore = (this.db.prepare(
      "SELECT COUNT(*) as c FROM dkg_edges WHERE source != 'bootstrap' AND catalog_id=?",
    ).get(this.catalogId) as { c: number }).c;

    this.db.prepare("DELETE FROM dkg_edges WHERE source != 'bootstrap' AND catalog_id=?").run(this.catalogId);
    this.db.prepare("DELETE FROM dkg_nodes WHERE source != 'bootstrap' AND catalog_id=?").run(this.catalogId);

    return { nodesDeleted: nodesBefore, edgesDeleted: edgesBefore };
  }

  /** usage 스냅샷만 삭제. DKG 그래프는 보존. */
  clearSnapshots(): { snapshotsDeleted: number; versionUsagesDeleted: number } {
    const snapCount = (this.db.prepare("SELECT COUNT(*) as c FROM usage_snapshots").get() as { c: number }).c;
    const vuCount = (this.db.prepare("SELECT COUNT(*) as c FROM version_usages").get() as { c: number }).c;
    this.db.exec("DELETE FROM version_usages");
    this.db.exec("DELETE FROM usage_snapshots");
    return { snapshotsDeleted: snapCount, versionUsagesDeleted: vuCount };
  }

  /** 특정 source의 노드/엣지만 삭제. */
  clearBySource(source: NodeSource): { nodesDeleted: number; edgesDeleted: number } {
    const nodesBefore = (this.db.prepare(
      "SELECT COUNT(*) as c FROM dkg_nodes WHERE source=? AND catalog_id=?",
    ).get(source, this.catalogId) as { c: number }).c;
    const edgesBefore = (this.db.prepare(
      "SELECT COUNT(*) as c FROM dkg_edges WHERE source=? AND catalog_id=?",
    ).get(source, this.catalogId) as { c: number }).c;

    this.db.prepare("DELETE FROM dkg_edges WHERE source=? AND catalog_id=?").run(source, this.catalogId);
    this.db.prepare("DELETE FROM dkg_nodes WHERE source=? AND catalog_id=?").run(source, this.catalogId);

    return { nodesDeleted: nodesBefore, edgesDeleted: edgesBefore };
  }

  deleteCatalog(catalogId: string): { nodesDeleted: number; edgesDeleted: number } {
    const nodesBefore = (this.db.prepare("SELECT COUNT(*) as c FROM dkg_nodes WHERE catalog_id=?").get(catalogId) as { c: number }).c;
    const edgesBefore = (this.db.prepare("SELECT COUNT(*) as c FROM dkg_edges WHERE catalog_id=?").get(catalogId) as { c: number }).c;
    this.db.prepare("DELETE FROM dkg_edges WHERE catalog_id=?").run(catalogId);
    this.db.prepare("DELETE FROM dkg_nodes WHERE catalog_id=?").run(catalogId);
    return { nodesDeleted: nodesBefore, edgesDeleted: edgesBefore };
  }

  // ── Usage Snapshot 조회 ──────────────────────────────

  /** 최근 N건의 usage snapshot raw data를 반환한다 */
  getRecentUsageSnapshots(limit = 500): Array<{ id: number; data: string; createdAt: string }> {
    return this.db.prepare(
      "SELECT id, data, collected_at as createdAt FROM usage_snapshots ORDER BY id DESC LIMIT ?",
    ).all(limit) as Array<{ id: number; data: string; createdAt: string }>;
  }

  // ── Meta 범위 조회 ─────────────────────────────────

  /** prefix로 시작하는 모든 meta 키-값 쌍을 반환한다 */
  getMetaByPrefix(prefix: string): Array<{ key: string; value: string }> {
    return this.db.prepare(
      "SELECT key, value FROM dkg_meta WHERE key LIKE ? AND value != ''",
    ).all(`${prefix}%`) as Array<{ key: string; value: string }>;
  }

  close(): void {
    this.db.close();
  }
}
