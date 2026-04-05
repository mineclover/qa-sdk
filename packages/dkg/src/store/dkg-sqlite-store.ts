/**
 * DKG SQLite Store — GraphRegistry + UsageData 영속화.
 *
 * node:sqlite (Node 내장) 사용.
 * save/load로 GraphRegistry를 SQLite와 동기화.
 * 집계 결과를 스냅샷으로 저장하여 누적/비교 가능.
 */

import { createLogger, type EventRecord } from "@qa-sdk/core";
import { getDatabaseSync, type DatabaseSyncInstance } from "index-meta";
import { drizzle } from "drizzle-orm/node-sqlite";
import { migrate } from "drizzle-orm/node-sqlite/migrator";

const logger = createLogger("dkg-store");
import {
  eq,
  and,
  ne,
  desc,
  like,
  sql,
  count,
  inArray,
  or,
} from "drizzle-orm";
import {
  dkgNodes,
  dkgEdges,
  usageSnapshots,
  versionUsages,
  cliAuditEvents,
  dkgMeta,
} from "../db/schema.js";
import { GraphRegistry } from "../graph-registry.js";
import type { DkgNode, DkgEdge } from "../dkg.types.js";
import type { UsageData, VersionUsage } from "@qa-sdk/convergence";

export type NodeSource = "bootstrap" | "manual" | "auto";

type DrizzleDb = ReturnType<typeof drizzle>;

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

export interface CliAuditEventInput {
  readonly record: EventRecord;
  readonly eventPrefix?: string;
  readonly command?: string;
  readonly targetId?: string;
  readonly targetKind?: string;
  readonly lifecycleFrom?: string;
  readonly lifecycleTo?: string;
}

export interface CliAuditEventRow {
  readonly id: number;
  readonly catalogId: string;
  readonly eventPrefix?: string;
  readonly command?: string;
  readonly eventKey: string;
  readonly eventVersion: string;
  readonly timestamp: string;
  readonly targetId?: string;
  readonly targetKind?: string;
  readonly lifecycleFrom?: string;
  readonly lifecycleTo?: string;
  readonly record: EventRecord;
}

export class DkgSqliteStore {
  private rawDb: DatabaseSyncInstance;
  private db: DrizzleDb;
  readonly catalogId: string;

  constructor(path: string = ":memory:", catalogId: string = "demo") {
    this.catalogId = catalogId;
    const Ctor = getDatabaseSync();
    this.rawDb = new Ctor(path);
    this.rawDb.exec("PRAGMA journal_mode = WAL");
    this.rawDb.exec("PRAGMA busy_timeout = 3000");
    this.rawDb.exec("PRAGMA foreign_keys = ON");

    // drizzle-kit 마이그레이션 실행
    try {
      this.db = drizzle({ client: this.rawDb });
      migrate(this.db, {
        migrationsFolder: new URL("../../drizzle", import.meta.url).pathname,
      });
      this.ensureAuxTables();
    } catch (err) {
      logger.error({ err }, "drizzle 마이그레이션 실패");
      throw err;
    }
  }

  private ensureAuxTables(): void {
    this.rawDb.exec(`
      CREATE TABLE IF NOT EXISTS cli_audit_events (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        catalog_id TEXT NOT NULL DEFAULT 'demo',
        event_prefix TEXT,
        command TEXT,
        event_key TEXT NOT NULL,
        event_version TEXT NOT NULL,
        record_kind TEXT NOT NULL DEFAULT 'log',
        log_id TEXT NOT NULL,
        trace_id TEXT NOT NULL,
        span_id TEXT NOT NULL,
        qa_session_id TEXT,
        target_id TEXT,
        target_kind TEXT,
        lifecycle_from TEXT,
        lifecycle_to TEXT,
        timestamp TEXT NOT NULL,
        address_context TEXT,
        payload TEXT,
        record_json TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      );
      CREATE INDEX IF NOT EXISTS idx_cli_audit_catalog ON cli_audit_events (catalog_id);
      CREATE INDEX IF NOT EXISTS idx_cli_audit_prefix ON cli_audit_events (event_prefix);
      CREATE INDEX IF NOT EXISTS idx_cli_audit_command ON cli_audit_events (command);
      CREATE INDEX IF NOT EXISTS idx_cli_audit_target ON cli_audit_events (target_id, target_kind);
      CREATE INDEX IF NOT EXISTS idx_cli_audit_lifecycle ON cli_audit_events (lifecycle_to);
      CREATE INDEX IF NOT EXISTS idx_cli_audit_timestamp ON cli_audit_events (timestamp);
    `);
  }

  // ── Graph: save/load ─────────────────────────────────

  /**
   * GraphRegistry의 전체 노드/엣지를 SQLite에 저장. 기존 데이터와 머지 (upsert).
   * @param source 저장 원천 — bootstrap(재생성 가능) | manual(사용자 기록) | auto(자동 파생)
   */
  saveGraph(graph: GraphRegistry, source: NodeSource = "bootstrap"): { nodesWritten: number; edgesWritten: number } {
    let nodesWritten = 0;
    let edgesWritten = 0;

    // 노드 저장
    for (const node of graph.getAllNodes()) {
      this.db
        .insert(dkgNodes)
        .values({
          id: node.id,
          kind: node.kind,
          source,
          catalogId: this.catalogId,
          data: JSON.stringify(node),
          updatedAt: sql`datetime('now')`,
        })
        .onConflictDoUpdate({
          target: dkgNodes.id,
          set: {
            kind: node.kind,
            source,
            catalogId: this.catalogId,
            data: JSON.stringify(node),
            updatedAt: sql`datetime('now')`,
          },
        })
        .run();
      nodesWritten++;
    }

    // 엣지 저장 — 모든 노드의 forward edges
    const seenEdges = new Set<string>();
    for (const node of graph.getAllNodes()) {
      for (const edge of graph.edgesFrom(node.id)) {
        const key = `${edge.type}:${edge.from}:${edge.to}`;
        if (seenEdges.has(key)) continue;
        seenEdges.add(key);
        this.db
          .insert(dkgEdges)
          .values({
            type: edge.type,
            fromId: edge.from,
            toId: edge.to,
            source,
            catalogId: this.catalogId,
            meta: edge.meta ? JSON.stringify(edge.meta) : null,
          })
          .onConflictDoNothing()
          .run();
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
    for (const node of nodes) {
      this.db
        .insert(dkgNodes)
        .values({
          id: node.id,
          kind: node.kind,
          source,
          catalogId: this.catalogId,
          data: JSON.stringify(node),
          updatedAt: sql`datetime('now')`,
        })
        .onConflictDoUpdate({
          target: dkgNodes.id,
          set: {
            kind: node.kind,
            source,
            catalogId: this.catalogId,
            data: JSON.stringify(node),
            updatedAt: sql`datetime('now')`,
          },
        })
        .run();
    }
    for (const edge of edges) {
      this.db
        .insert(dkgEdges)
        .values({
          type: edge.type,
          fromId: edge.from,
          toId: edge.to,
          source,
          catalogId: this.catalogId,
          meta: edge.meta ? JSON.stringify(edge.meta) : null,
        })
        .onConflictDoNothing()
        .run();
    }
  }

  /**
   * bootstrap 데이터만 삭제. manual/auto 운영 데이터는 보존.
   * refresh 전 호출하여 구조를 초기화한 후 재부트스트랩.
   */
  clearBootstrap(): { nodesDeleted: number; edgesDeleted: number } {
    const nodesCountRow = this.db
      .select({ c: count() })
      .from(dkgNodes)
      .where(and(eq(dkgNodes.source, "bootstrap"), eq(dkgNodes.catalogId, this.catalogId)))
      .get();
    const edgesCountRow = this.db
      .select({ c: count() })
      .from(dkgEdges)
      .where(and(eq(dkgEdges.source, "bootstrap"), eq(dkgEdges.catalogId, this.catalogId)))
      .get();

    this.db
      .delete(dkgEdges)
      .where(and(eq(dkgEdges.source, "bootstrap"), eq(dkgEdges.catalogId, this.catalogId)))
      .run();
    this.db
      .delete(dkgNodes)
      .where(and(eq(dkgNodes.source, "bootstrap"), eq(dkgNodes.catalogId, this.catalogId)))
      .run();

    return {
      nodesDeleted: nodesCountRow?.c ?? 0,
      edgesDeleted: edgesCountRow?.c ?? 0,
    };
  }

  /** SQLite에서 GraphRegistry를 로드. */
  loadGraph(): GraphRegistry {
    const graph = new GraphRegistry();

    // 노드 로드
    const nodes = this.db
      .select({ id: dkgNodes.id, kind: dkgNodes.kind, data: dkgNodes.data })
      .from(dkgNodes)
      .where(eq(dkgNodes.catalogId, this.catalogId))
      .all();
    for (const row of nodes) {
      graph.addNode(JSON.parse(row.data) as DkgNode);
    }

    // 엣지 로드
    const edges = this.db
      .select({
        type: dkgEdges.type,
        fromId: dkgEdges.fromId,
        toId: dkgEdges.toId,
        meta: dkgEdges.meta,
      })
      .from(dkgEdges)
      .where(eq(dkgEdges.catalogId, this.catalogId))
      .all();
    for (const row of edges) {
      graph.addEdge(
        row.type as DkgEdge["type"],
        row.fromId,
        row.toId,
        row.meta ? JSON.parse(row.meta) : undefined,
      );
    }

    return graph;
  }

  // ── Usage: 스냅샷 저장/로드 ──────────────────────────

  /** UsageData를 스냅샷으로 저장. 반환: snapshot ID. */
  saveUsageSnapshot(usage: UsageData): number {
    const from = String(usage.collectionPeriod?.from ?? new Date().toISOString());
    const to = String(usage.collectionPeriod?.to ?? from);
    const totalRecords = Number(usage.sourceStats?.totalRecords ?? 0);
    const data = JSON.stringify(usage);

    this.db
      .insert(usageSnapshots)
      .values({
        periodFrom: from,
        periodTo: to,
        totalRecords,
        data,
      })
      .run();

    const row = this.db
      .select({ id: sql<number>`last_insert_rowid()` })
      .from(usageSnapshots)
      .get();
    const snapshotId = row?.id ?? 0;

    // versionUsages 저장
    if (usage.versionUsages) {
      for (const vu of usage.versionUsages) {
        this.db
          .insert(versionUsages)
          .values({
            snapshotId,
            prefix: String(vu.prefix),
            version: String(vu.version),
            count: Number(vu.count),
            lastSeen: String(vu.lastSeen ?? new Date().toISOString()),
            sessions: JSON.stringify(vu.sessions ?? []),
          })
          .run();
      }
    }

    return snapshotId;
  }

  saveCliAuditEvent(input: CliAuditEventInput): number {
    const recordJson = JSON.stringify(input.record);
    const payloadJson = input.record.payload === undefined ? null : JSON.stringify(input.record.payload);
    const addressContextJson = input.record.address_context
      ? JSON.stringify(input.record.address_context)
      : null;

    this.db
      .insert(cliAuditEvents)
      .values({
        catalogId: this.catalogId,
        eventPrefix: input.eventPrefix ?? null,
        command: input.command ?? null,
        eventKey: input.record.event_key,
        eventVersion: input.record.event_version,
        recordKind: input.record.record_kind,
        logId: input.record.log_id,
        traceId: input.record.trace_id,
        spanId: input.record.span_id,
        qaSessionId: input.record.qa_session_id ?? null,
        targetId: input.targetId ?? null,
        targetKind: input.targetKind ?? null,
        lifecycleFrom: input.lifecycleFrom ?? null,
        lifecycleTo: input.lifecycleTo ?? null,
        timestamp: input.record.timestamp,
        addressContext: addressContextJson,
        payload: payloadJson,
        recordJson,
      })
      .run();

    const row = this.db
      .select({ id: sql<number>`last_insert_rowid()` })
      .from(cliAuditEvents)
      .get();
    return row?.id ?? 0;
  }

  /** 최근 N개 스냅샷의 versionUsages를 로드. */
  loadRecentVersionUsages(limit: number = 10): Array<{
    snapshotId: number;
    collectedAt: string;
    versionUsages: VersionUsage[];
  }> {
    const snapshots = this.db
      .select({ id: usageSnapshots.id, collectedAt: usageSnapshots.collectedAt })
      .from(usageSnapshots)
      .orderBy(desc(usageSnapshots.collectedAt))
      .limit(limit)
      .all();

    return snapshots.map(snap => {
      const rows = this.db
        .select({
          prefix: versionUsages.prefix,
          version: versionUsages.version,
          count: versionUsages.count,
          lastSeen: versionUsages.lastSeen,
          sessions: versionUsages.sessions,
        })
        .from(versionUsages)
        .where(eq(versionUsages.snapshotId, snap.id))
        .all();

      return {
        snapshotId: snap.id,
        collectedAt: snap.collectedAt,
        versionUsages: rows.map(r => ({
          prefix: r.prefix,
          version: r.version,
          count: r.count,
          lastSeen: r.lastSeen,
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
      for (const obs of autoObservations) {
        this.db
          .insert(dkgNodes)
          .values({
            id: obs.id,
            kind: obs.kind,
            source: "auto",
            catalogId: this.catalogId,
            data: JSON.stringify(obs),
            updatedAt: sql`datetime('now')`,
          })
          .onConflictDoUpdate({
            target: dkgNodes.id,
            set: {
              kind: obs.kind,
              source: "auto",
              catalogId: this.catalogId,
              data: JSON.stringify(obs),
              updatedAt: sql`datetime('now')`,
            },
          })
          .run();
        // ObservationNode.subjects → observes 엣지 자동 생성
        if (obs.kind === "observation") {
          const subjects = obs.subjects;
          for (const subjectId of subjects) {
            this.db
              .insert(dkgEdges)
              .values({
                type: "observes",
                fromId: obs.id,
                toId: subjectId,
                source: "auto",
                catalogId: this.catalogId,
                meta: null,
              })
              .onConflictDoNothing()
              .run();
          }
        }
      }
    }

    return { snapshotId, observationsWritten: autoObservations.length };
  }

  /** 단일 노드 upsert. resolution 영속화 등에 사용. */
  updateNode(node: DkgNode, source: NodeSource = "auto"): void {
    this.db
      .insert(dkgNodes)
      .values({
        id: node.id,
        kind: node.kind,
        source,
        catalogId: this.catalogId,
        data: JSON.stringify(node),
        updatedAt: sql`datetime('now')`,
      })
      .onConflictDoUpdate({
        target: dkgNodes.id,
        set: {
          kind: node.kind,
          source,
          catalogId: this.catalogId,
          data: JSON.stringify(node),
          updatedAt: sql`datetime('now')`,
        },
      })
      .run();
  }

  // ── Meta ──────────────────────────────────────────────

  setMeta(key: string, value: string): void {
    this.db
      .insert(dkgMeta)
      .values({ key, value })
      .onConflictDoUpdate({
        target: dkgMeta.key,
        set: { value },
      })
      .run();
  }

  getMeta(key: string): string | null {
    const row = this.db
      .select({ value: dkgMeta.value })
      .from(dkgMeta)
      .where(eq(dkgMeta.key, key))
      .get();
    return row?.value ?? null;
  }

  /**
   * 결정적 ID 전환 후 남은 timestamp 기반 stale observation을 정리한다.
   * ID 패턴: OBS-METRIC-...-{timestamp}-{counter} (13자리 숫자 + 하이픈 + 숫자로 끝남)
   * 보존 대상: OBS-METRIC-...-{no-timestamp} (결정적 ID)
   */
  cleanStaleMetricObservations(): number {
    // timestamp 패턴: 13자리 숫자-숫자 로 끝나는 OBS-METRIC ID
    // drizzle에서 GLOB은 직접 지원하지 않으므로 sql 템플릿 사용
    const stale = this.db
      .select({ id: dkgNodes.id })
      .from(dkgNodes)
      .where(
        and(
          eq(dkgNodes.catalogId, this.catalogId),
          eq(dkgNodes.kind, "observation"),
          like(dkgNodes.id, "OBS-METRIC-%"),
          sql`${dkgNodes.id} GLOB 'OBS-METRIC-*-[0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9]*-[0-9]*'`,
        ),
      )
      .all();

    if (stale.length === 0) return 0;

    for (const row of stale) {
      this.db
        .delete(dkgEdges)
        .where(
          and(
            eq(dkgEdges.catalogId, this.catalogId),
            or(eq(dkgEdges.fromId, row.id), eq(dkgEdges.toId, row.id)),
          ),
        )
        .run();
      this.db
        .delete(dkgNodes)
        .where(and(eq(dkgNodes.catalogId, this.catalogId), eq(dkgNodes.id, row.id)))
        .run();
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
    const resolved = this.db
      .select({ id: dkgNodes.id })
      .from(dkgNodes)
      .where(
        and(
          eq(dkgNodes.catalogId, this.catalogId),
          eq(dkgNodes.kind, "observation"),
          like(dkgNodes.data, '%"resolution":%'),
          like(dkgNodes.data, '%"outcome":%'),
        ),
      )
      .all();

    let pruned = 0;
    for (const row of resolved) {
      // date 확인 — JSON에서 date 추출
      const nodeData = this.db
        .select({ data: dkgNodes.data })
        .from(dkgNodes)
        .where(and(eq(dkgNodes.catalogId, this.catalogId), eq(dkgNodes.id, row.id)))
        .get();
      if (!nodeData) continue;
      try {
        const parsed = JSON.parse(nodeData.data);
        if (parsed.date && parsed.date <= cutoff) {
          this.db
            .delete(dkgEdges)
            .where(
              and(
                eq(dkgEdges.catalogId, this.catalogId),
                or(eq(dkgEdges.fromId, row.id), eq(dkgEdges.toId, row.id)),
              ),
            )
            .run();
          this.db
            .delete(dkgNodes)
            .where(and(eq(dkgNodes.catalogId, this.catalogId), eq(dkgNodes.id, row.id)))
            .run();
          pruned++;
        }
      } catch { /* JSON 파싱 실패 시 건너뜀 */ }
    }
    return pruned;
  }

  // ── Stats ────────────────────────────────────────────

  stats(): {
    nodes: number; edges: number; snapshots: number; versionUsages: number; auditEvents: number;
    bootstrapNodes: number; manualNodes: number;
    bootstrapEdges: number; manualEdges: number;
  } {
    const nodes = this.db.select({ c: count() }).from(dkgNodes).where(eq(dkgNodes.catalogId, this.catalogId)).get()?.c ?? 0;
    const edges = this.db.select({ c: count() }).from(dkgEdges).where(eq(dkgEdges.catalogId, this.catalogId)).get()?.c ?? 0;
    const snapshots = this.db.select({ c: count() }).from(usageSnapshots).get()?.c ?? 0;
    const vuCount = this.db.select({ c: count() }).from(versionUsages).get()?.c ?? 0;
    const auditEvents = this.db
      .select({ c: count() })
      .from(cliAuditEvents)
      .where(eq(cliAuditEvents.catalogId, this.catalogId))
      .get()?.c ?? 0;
    const bootstrapNodes = this.db.select({ c: count() }).from(dkgNodes).where(and(eq(dkgNodes.source, "bootstrap"), eq(dkgNodes.catalogId, this.catalogId))).get()?.c ?? 0;
    const manualNodes = this.db.select({ c: count() }).from(dkgNodes).where(and(eq(dkgNodes.source, "manual"), eq(dkgNodes.catalogId, this.catalogId))).get()?.c ?? 0;
    const bootstrapEdges = this.db.select({ c: count() }).from(dkgEdges).where(and(eq(dkgEdges.source, "bootstrap"), eq(dkgEdges.catalogId, this.catalogId))).get()?.c ?? 0;
    const manualEdges = this.db.select({ c: count() }).from(dkgEdges).where(and(eq(dkgEdges.source, "manual"), eq(dkgEdges.catalogId, this.catalogId))).get()?.c ?? 0;
    return {
      nodes,
      edges,
      snapshots,
      versionUsages: vuCount,
      auditEvents,
      bootstrapNodes,
      manualNodes,
      bootstrapEdges,
      manualEdges,
    };
  }

  // ── JSON export/import ───────────────────────────────

  /** 전체 상태를 JSON으로 export. */
  exportJson(): string {
    const nodes = this.db
      .select({ id: dkgNodes.id, kind: dkgNodes.kind, data: dkgNodes.data })
      .from(dkgNodes)
      .where(eq(dkgNodes.catalogId, this.catalogId))
      .all();
    const edges = this.db
      .select({
        type: dkgEdges.type,
        fromId: dkgEdges.fromId,
        toId: dkgEdges.toId,
        meta: dkgEdges.meta,
      })
      .from(dkgEdges)
      .where(eq(dkgEdges.catalogId, this.catalogId))
      .all();
    const snapshotRows = this.db
      .select()
      .from(usageSnapshots)
      .orderBy(usageSnapshots.collectedAt)
      .all();
    const metaRows = this.db
      .select()
      .from(dkgMeta)
      .all();

    return JSON.stringify({
      version: 1,
      catalogId: this.catalogId,
      exportedAt: new Date().toISOString(),
      nodes: nodes.map(n => (Object.assign({id:n.id,kind:n.kind}, JSON.parse(n.data)))),
      edges: edges.map(e => ({ type: e.type, from: e.fromId, to: e.toId, meta: e.meta ? JSON.parse(e.meta) : undefined })),
      snapshots: snapshotRows,
      meta: metaRows,
    }, null, 2);
  }

  /** JSON에서 상태를 import. 기존 데이터에 머지. */
  importJson(json: string): { nodesImported: number; edgesImported: number } {
    const data = JSON.parse(json) as {
      nodes: ExportNodePayload[];
      edges: ExportEdgePayload[];
    };

    let nodesImported = 0;
    let edgesImported = 0;

    for (const node of data.nodes) {
      this.db
        .insert(dkgNodes)
        .values({
          id: node.id,
          kind: node.kind,
          catalogId: this.catalogId,
          data: JSON.stringify(node),
          updatedAt: sql`datetime('now')`,
        })
        .onConflictDoUpdate({
          target: dkgNodes.id,
          set: {
            kind: node.kind,
            catalogId: this.catalogId,
            data: JSON.stringify(node),
            updatedAt: sql`datetime('now')`,
          },
        })
        .run();
      nodesImported++;
    }
    for (const edge of data.edges) {
      this.db
        .insert(dkgEdges)
        .values({
          type: edge.type,
          fromId: edge.from,
          toId: edge.to,
          catalogId: this.catalogId,
          meta: edge.meta ? JSON.stringify(edge.meta) : null,
        })
        .onConflictDoNothing()
        .run();
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
    const nodes = this.db
      .select({
        id: dkgNodes.id,
        kind: dkgNodes.kind,
        source: dkgNodes.source,
        data: dkgNodes.data,
      })
      .from(dkgNodes)
      .where(
        and(
          eq(dkgNodes.catalogId, this.catalogId),
          inArray(dkgNodes.source, ["manual", "auto"]),
        ),
      )
      .all();

    const nodeIds = new Set(nodes.map(n => n.id));

    // 관련 엣지: from 또는 to가 manual/auto 노드인 것
    const allEdges = this.db
      .select({
        type: dkgEdges.type,
        fromId: dkgEdges.fromId,
        toId: dkgEdges.toId,
        source: dkgEdges.source,
        meta: dkgEdges.meta,
      })
      .from(dkgEdges)
      .where(eq(dkgEdges.catalogId, this.catalogId))
      .all();

    const edges = allEdges.filter(e => nodeIds.has(e.fromId) || nodeIds.has(e.toId));

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
      nodes: nodes.map(n => (Object.assign({id:n.id,kind:n.kind,source:n.source}, JSON.parse(n.data)))),
      edges: edges.map(e => ({ type: e.type, from: e.fromId, to: e.toId, source: e.source, meta: e.meta ? JSON.parse(e.meta) : undefined })),
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

    let nodesImported = 0;
    let edgesImported = 0;

    for (const node of data.nodes) {
      const source = node.source ?? "manual";
      this.db
        .insert(dkgNodes)
        .values({
          id: node.id,
          kind: node.kind,
          source,
          catalogId: this.catalogId,
          data: JSON.stringify(node),
          updatedAt: sql`datetime('now')`,
        })
        .onConflictDoUpdate({
          target: dkgNodes.id,
          set: {
            kind: node.kind,
            source,
            catalogId: this.catalogId,
            data: JSON.stringify(node),
            updatedAt: sql`datetime('now')`,
          },
        })
        .run();
      nodesImported++;
    }
    for (const edge of data.edges) {
      const source = edge.source ?? "manual";
      this.db
        .insert(dkgEdges)
        .values({
          type: edge.type,
          fromId: edge.from,
          toId: edge.to,
          source,
          catalogId: this.catalogId,
          meta: edge.meta ? JSON.stringify(edge.meta) : null,
        })
        .onConflictDoNothing()
        .run();
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
    const rows = this.db
      .select({
        id: dkgNodes.id,
        kind: dkgNodes.kind,
        source: dkgNodes.source,
        data: dkgNodes.data,
        updatedAt: dkgNodes.updatedAt,
      })
      .from(dkgNodes)
      .where(
        and(
          eq(dkgNodes.catalogId, this.catalogId),
          inArray(dkgNodes.kind, kinds as string[]),
        ),
      )
      .orderBy(desc(dkgNodes.updatedAt))
      .limit(limit)
      .all();

    return rows.map(r => {
      const parsed = JSON.parse(r.data) as JsonObject;
      return {
        id: r.id,
        kind: r.kind,
        source: r.source,
        date: (parsed.date as string) ?? r.updatedAt,
        data: parsed,
      };
    });
  }

  /** 등록된 모든 카탈로그 ID 목록. */
  listCatalogIds(): string[] {
    // UNION은 drizzle query builder로 직접 표현하기 어려우므로 sql 템플릿 사용
    const rows = this.db
      .select({ catalogId: sql<string>`catalog_id` })
      .from(sql`(SELECT DISTINCT catalog_id FROM dkg_nodes UNION SELECT DISTINCT catalog_id FROM dkg_edges)`)
      .all();
    return [...new Set(rows.map(r => r.catalogId))];
  }

  /** 특정 카탈로그의 모든 DKG 데이터 삭제. */
  /** 관측/결정 노드만 삭제 (source=manual|auto|metric|runtime). 구조(bootstrap)는 보존. */
  clearOperational(): { nodesDeleted: number; edgesDeleted: number } {
    const nodesBefore = this.db
      .select({ c: count() })
      .from(dkgNodes)
      .where(and(ne(dkgNodes.source, "bootstrap"), eq(dkgNodes.catalogId, this.catalogId)))
      .get()?.c ?? 0;
    const edgesBefore = this.db
      .select({ c: count() })
      .from(dkgEdges)
      .where(and(ne(dkgEdges.source, "bootstrap"), eq(dkgEdges.catalogId, this.catalogId)))
      .get()?.c ?? 0;

    this.db
      .delete(dkgEdges)
      .where(and(ne(dkgEdges.source, "bootstrap"), eq(dkgEdges.catalogId, this.catalogId)))
      .run();
    this.db
      .delete(dkgNodes)
      .where(and(ne(dkgNodes.source, "bootstrap"), eq(dkgNodes.catalogId, this.catalogId)))
      .run();

    return { nodesDeleted: nodesBefore, edgesDeleted: edgesBefore };
  }

  /** usage 스냅샷만 삭제. DKG 그래프는 보존. */
  clearSnapshots(): { snapshotsDeleted: number; versionUsagesDeleted: number } {
    const snapCount = this.db.select({ c: count() }).from(usageSnapshots).get()?.c ?? 0;
    const vuCount = this.db.select({ c: count() }).from(versionUsages).get()?.c ?? 0;
    this.db.delete(versionUsages).run();
    this.db.delete(usageSnapshots).run();
    return { snapshotsDeleted: snapCount, versionUsagesDeleted: vuCount };
  }

  clearCliAuditEvents(): number {
    const before = this.db
      .select({ c: count() })
      .from(cliAuditEvents)
      .where(eq(cliAuditEvents.catalogId, this.catalogId))
      .get()?.c ?? 0;
    this.db.delete(cliAuditEvents).where(eq(cliAuditEvents.catalogId, this.catalogId)).run();
    return before;
  }

  /** 특정 source의 노드/엣지만 삭제. */
  clearBySource(source: NodeSource): { nodesDeleted: number; edgesDeleted: number } {
    const nodesBefore = this.db
      .select({ c: count() })
      .from(dkgNodes)
      .where(and(eq(dkgNodes.source, source), eq(dkgNodes.catalogId, this.catalogId)))
      .get()?.c ?? 0;
    const edgesBefore = this.db
      .select({ c: count() })
      .from(dkgEdges)
      .where(and(eq(dkgEdges.source, source), eq(dkgEdges.catalogId, this.catalogId)))
      .get()?.c ?? 0;

    this.db
      .delete(dkgEdges)
      .where(and(eq(dkgEdges.source, source), eq(dkgEdges.catalogId, this.catalogId)))
      .run();
    this.db
      .delete(dkgNodes)
      .where(and(eq(dkgNodes.source, source), eq(dkgNodes.catalogId, this.catalogId)))
      .run();

    return { nodesDeleted: nodesBefore, edgesDeleted: edgesBefore };
  }

  deleteCatalog(catalogId: string): { nodesDeleted: number; edgesDeleted: number } {
    const nodesBefore = this.db
      .select({ c: count() })
      .from(dkgNodes)
      .where(eq(dkgNodes.catalogId, catalogId))
      .get()?.c ?? 0;
    const edgesBefore = this.db
      .select({ c: count() })
      .from(dkgEdges)
      .where(eq(dkgEdges.catalogId, catalogId))
      .get()?.c ?? 0;

    this.db.delete(dkgEdges).where(eq(dkgEdges.catalogId, catalogId)).run();
    this.db.delete(dkgNodes).where(eq(dkgNodes.catalogId, catalogId)).run();

    return { nodesDeleted: nodesBefore, edgesDeleted: edgesBefore };
  }

  // ── Usage Snapshot 조회 ──────────────────────────────

  /** 최근 N건의 usage snapshot raw data를 반환한다 */
  getRecentUsageSnapshots(limit = 500): Array<{ id: number; data: string; createdAt: string }> {
    return this.db
      .select({
        id: usageSnapshots.id,
        data: usageSnapshots.data,
        createdAt: usageSnapshots.collectedAt,
      })
      .from(usageSnapshots)
      .orderBy(desc(usageSnapshots.id))
      .limit(limit)
      .all();
  }

  listRecentCliAuditEvents(
    limit = 50,
    filters: {
      eventPrefix?: string;
      command?: string;
      targetId?: string;
      lifecycleTo?: string;
    } = {},
  ): CliAuditEventRow[] {
    const conditions = [eq(cliAuditEvents.catalogId, this.catalogId)];
    if (filters.eventPrefix) conditions.push(eq(cliAuditEvents.eventPrefix, filters.eventPrefix));
    if (filters.command) conditions.push(eq(cliAuditEvents.command, filters.command));
    if (filters.targetId) conditions.push(eq(cliAuditEvents.targetId, filters.targetId));
    if (filters.lifecycleTo) conditions.push(eq(cliAuditEvents.lifecycleTo, filters.lifecycleTo));

    const rows = this.db
      .select()
      .from(cliAuditEvents)
      .where(and(...conditions))
      .orderBy(desc(cliAuditEvents.id))
      .limit(limit)
      .all();

    return rows.map((row) => ({
      id: row.id,
      catalogId: row.catalogId,
      eventPrefix: row.eventPrefix ?? undefined,
      command: row.command ?? undefined,
      eventKey: row.eventKey,
      eventVersion: row.eventVersion,
      timestamp: row.timestamp,
      targetId: row.targetId ?? undefined,
      targetKind: row.targetKind ?? undefined,
      lifecycleFrom: row.lifecycleFrom ?? undefined,
      lifecycleTo: row.lifecycleTo ?? undefined,
      record: JSON.parse(row.recordJson) as EventRecord,
    }));
  }

  // ── Meta 범위 조회 ─────────────────────────────────

  /** prefix로 시작하는 모든 meta 키-값 쌍을 반환한다 */
  getMetaByPrefix(prefix: string): Array<{ key: string; value: string }> {
    return this.db
      .select({ key: dkgMeta.key, value: dkgMeta.value })
      .from(dkgMeta)
      .where(and(like(dkgMeta.key, `${prefix}%`), ne(dkgMeta.value, "")))
      .all();
  }

  close(): void {
    this.rawDb.close();
  }
}
