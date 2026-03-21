/**
 * DKG SQLite Store — GraphRegistry + UsageData 영속화.
 *
 * node:sqlite (Node 내장) 사용.
 * save/load로 GraphRegistry를 SQLite와 동기화.
 * 집계 결과를 스냅샷으로 저장하여 누적/비교 가능.
 */

import { createRequire } from "node:module";
import { GraphRegistry } from "../dkg/graph-registry.js";
import type { DkgNode, DkgEdge } from "../dkg/dkg.types.js";
import type { UsageData, VersionUsage } from "../convergence/convergence.types.js";
import { DKG_SCHEMA_DDL } from "./dkg-schema.sql.js";

type DatabaseSyncCtor = typeof import("node:sqlite").DatabaseSync;
type DatabaseSyncInstance = InstanceType<DatabaseSyncCtor>;

let _DatabaseSync: DatabaseSyncCtor | null = null;

function getDatabaseSync(): DatabaseSyncCtor {
  if (!_DatabaseSync) {
    const require = createRequire(import.meta.url);
    _DatabaseSync = (require("node:sqlite") as { DatabaseSync: DatabaseSyncCtor }).DatabaseSync;
  }
  return _DatabaseSync;
}

export type NodeSource = "bootstrap" | "manual" | "auto";

export class DkgSqliteStore {
  private db: DatabaseSyncInstance;

  constructor(path: string = ":memory:") {
    const Ctor = getDatabaseSync();
    this.db = new Ctor(path);
    this.db.exec(DKG_SCHEMA_DDL);
    this.migrate();
  }

  /** 기존 DB에 source 컬럼이 없으면 추가 */
  private migrate(): void {
    try {
      // source 컬럼 존재 여부 확인
      this.db.prepare("SELECT source FROM dkg_nodes LIMIT 1").get();
    } catch {
      // 컬럼 없으면 추가
      this.db.exec("ALTER TABLE dkg_nodes ADD COLUMN source TEXT NOT NULL DEFAULT 'bootstrap'");
    }
    try {
      this.db.prepare("SELECT source FROM dkg_edges LIMIT 1").get();
    } catch {
      this.db.exec("ALTER TABLE dkg_edges ADD COLUMN source TEXT NOT NULL DEFAULT 'bootstrap'");
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
      `INSERT INTO dkg_nodes (id, kind, source, data, updated_at)
       VALUES (?, ?, ?, ?, datetime('now'))
       ON CONFLICT(id) DO UPDATE SET kind=excluded.kind, source=excluded.source, data=excluded.data, updated_at=datetime('now')`,
    );

    const insertEdge = this.db.prepare(
      `INSERT OR IGNORE INTO dkg_edges (type, from_id, to_id, source, meta)
       VALUES (?, ?, ?, ?, ?)`,
    );

    // 노드 저장
    for (const node of graph.getAllNodes()) {
      upsertNode.run(node.id, node.kind, source, JSON.stringify(node));
      nodesWritten++;
    }

    // 엣지 저장 — 모든 노드의 forward edges
    const seenEdges = new Set<string>();
    for (const node of graph.getAllNodes()) {
      for (const edge of graph.edgesFrom(node.id)) {
        const key = `${edge.type}:${edge.from}:${edge.to}`;
        if (seenEdges.has(key)) continue;
        seenEdges.add(key);
        insertEdge.run(edge.type, edge.from, edge.to, source, edge.meta ? JSON.stringify(edge.meta) : null);
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
    edges: readonly { type: string; from: string; to: string; meta?: Record<string, unknown> }[],
    source: NodeSource = "manual",
  ): void {
    const upsertNode = this.db.prepare(
      `INSERT INTO dkg_nodes (id, kind, source, data, updated_at)
       VALUES (?, ?, ?, ?, datetime('now'))
       ON CONFLICT(id) DO UPDATE SET kind=excluded.kind, source=excluded.source, data=excluded.data, updated_at=datetime('now')`,
    );
    const insertEdge = this.db.prepare(
      `INSERT OR IGNORE INTO dkg_edges (type, from_id, to_id, source, meta)
       VALUES (?, ?, ?, ?, ?)`,
    );

    for (const node of nodes) {
      upsertNode.run(node.id, node.kind, source, JSON.stringify(node));
    }
    for (const edge of edges) {
      insertEdge.run(edge.type, edge.from, edge.to, source, edge.meta ? JSON.stringify(edge.meta) : null);
    }
  }

  /**
   * bootstrap 데이터만 삭제. manual/auto 운영 데이터는 보존.
   * refresh 전 호출하여 구조를 초기화한 후 재부트스트랩.
   */
  clearBootstrap(): { nodesDeleted: number; edgesDeleted: number } {
    const nodesBefore = (this.db.prepare("SELECT COUNT(*) as c FROM dkg_nodes WHERE source='bootstrap'").get() as { c: number }).c;
    const edgesBefore = (this.db.prepare("SELECT COUNT(*) as c FROM dkg_edges WHERE source='bootstrap'").get() as { c: number }).c;

    this.db.exec("DELETE FROM dkg_edges WHERE source='bootstrap'");
    this.db.exec("DELETE FROM dkg_nodes WHERE source='bootstrap'");

    return { nodesDeleted: nodesBefore, edgesDeleted: edgesBefore };
  }

  /** SQLite에서 GraphRegistry를 로드. */
  loadGraph(): GraphRegistry {
    const graph = new GraphRegistry();

    // 노드 로드
    const nodes = this.db.prepare("SELECT id, kind, data FROM dkg_nodes").all() as Array<{
      id: string; kind: string; data: string;
    }>;
    for (const row of nodes) {
      graph.addNode(JSON.parse(row.data) as DkgNode);
    }

    // 엣지 로드
    const edges = this.db.prepare("SELECT type, from_id, to_id, meta FROM dkg_edges").all() as Array<{
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
    stmt.run(
      usage.collectionPeriod.from,
      usage.collectionPeriod.to,
      usage.sourceStats?.totalRecords ?? 0,
      JSON.stringify(usage),
    );

    const row = this.db.prepare("SELECT last_insert_rowid() as id").get() as { id: number };
    const snapshotId = row.id;

    // versionUsages 저장
    if (usage.versionUsages) {
      const vuStmt = this.db.prepare(
        `INSERT INTO version_usages (snapshot_id, prefix, version, count, last_seen, sessions)
         VALUES (?, ?, ?, ?, ?, ?)`,
      );
      for (const vu of usage.versionUsages) {
        vuStmt.run(snapshotId, vu.prefix, vu.version, vu.count, vu.lastSeen, JSON.stringify(vu.sessions));
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
        `INSERT INTO dkg_nodes (id, kind, source, data, updated_at)
         VALUES (?, ?, ?, ?, datetime('now'))
         ON CONFLICT(id) DO UPDATE SET kind=excluded.kind, source=excluded.source, data=excluded.data, updated_at=datetime('now')`,
      );
      const insertEdge = this.db.prepare(
        `INSERT OR IGNORE INTO dkg_edges (type, from_id, to_id, source, meta)
         VALUES (?, ?, ?, ?, ?)`,
      );

      for (const obs of autoObservations) {
        upsertNode.run(obs.id, obs.kind, "auto", JSON.stringify(obs));
        // ObservationNode.subjects → observes 엣지 자동 생성
        const subjects = (obs as any).subjects as readonly string[] | undefined;
        if (subjects) {
          for (const subjectId of subjects) {
            insertEdge.run("observes", obs.id, subjectId, "auto", null);
          }
        }
      }
    }

    return { snapshotId, observationsWritten: autoObservations.length };
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

  // ── Stats ────────────────────────────────────────────

  stats(): {
    nodes: number; edges: number; snapshots: number; versionUsages: number;
    bootstrapNodes: number; manualNodes: number;
    bootstrapEdges: number; manualEdges: number;
  } {
    const nodes = (this.db.prepare("SELECT COUNT(*) as c FROM dkg_nodes").get() as { c: number }).c;
    const edges = (this.db.prepare("SELECT COUNT(*) as c FROM dkg_edges").get() as { c: number }).c;
    const snapshots = (this.db.prepare("SELECT COUNT(*) as c FROM usage_snapshots").get() as { c: number }).c;
    const versionUsages = (this.db.prepare("SELECT COUNT(*) as c FROM version_usages").get() as { c: number }).c;
    const bootstrapNodes = (this.db.prepare("SELECT COUNT(*) as c FROM dkg_nodes WHERE source='bootstrap'").get() as { c: number }).c;
    const manualNodes = (this.db.prepare("SELECT COUNT(*) as c FROM dkg_nodes WHERE source='manual'").get() as { c: number }).c;
    const bootstrapEdges = (this.db.prepare("SELECT COUNT(*) as c FROM dkg_edges WHERE source='bootstrap'").get() as { c: number }).c;
    const manualEdges = (this.db.prepare("SELECT COUNT(*) as c FROM dkg_edges WHERE source='manual'").get() as { c: number }).c;
    return { nodes, edges, snapshots, versionUsages, bootstrapNodes, manualNodes, bootstrapEdges, manualEdges };
  }

  // ── JSON export/import ───────────────────────────────

  /** 전체 상태를 JSON으로 export. */
  exportJson(): string {
    const nodes = this.db.prepare("SELECT id, kind, data FROM dkg_nodes").all() as Array<{
      id: string; kind: string; data: string;
    }>;
    const edges = this.db.prepare("SELECT type, from_id, to_id, meta FROM dkg_edges").all() as Array<{
      type: string; from_id: string; to_id: string; meta: string | null;
    }>;
    const snapshots = this.db.prepare("SELECT * FROM usage_snapshots ORDER BY collected_at").all();
    const meta = this.db.prepare("SELECT * FROM dkg_meta").all();

    return JSON.stringify({
      version: 1,
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
      nodes: Array<{ id: string; kind: string; [k: string]: unknown }>;
      edges: Array<{ type: string; from: string; to: string; meta?: Record<string, unknown> }>;
    };

    const upsertNode = this.db.prepare(
      `INSERT INTO dkg_nodes (id, kind, data, updated_at) VALUES (?, ?, ?, datetime('now'))
       ON CONFLICT(id) DO UPDATE SET kind=excluded.kind, data=excluded.data, updated_at=datetime('now')`,
    );
    const insertEdge = this.db.prepare(
      `INSERT OR IGNORE INTO dkg_edges (type, from_id, to_id, meta) VALUES (?, ?, ?, ?)`,
    );

    let nodesImported = 0;
    let edgesImported = 0;

    for (const node of data.nodes) {
      upsertNode.run(node.id, node.kind, JSON.stringify(node));
      nodesImported++;
    }
    for (const edge of data.edges) {
      insertEdge.run(edge.type, edge.from, edge.to, edge.meta ? JSON.stringify(edge.meta) : null);
      edgesImported++;
    }

    return { nodesImported, edgesImported };
  }

  close(): void {
    this.db.close();
  }
}
