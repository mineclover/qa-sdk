/**
 * SqliteInstanceStore — decision-flow InstanceStore의 SQLite 구현.
 *
 * CLI 전용. decision-flow 패키지는 순수 라이브러리로 유지하고,
 * 영속은 CLI(소비자)의 책임.
 *
 * 저장 위치: ~/.qa-sdk/decision-flow.sqlite
 */

import { createRequire } from "node:module";
import type {
  InstanceStore,
  InstanceContextQuery,
  InstanceTimeRangeQuery,
  FlowInstance,
} from "decision-flow";

// node:sqlite 동적 로드 (Node.js 내장, 실험적)
interface DatabaseSyncInstance {
  exec(sql: string): void;
  prepare(sql: string): {
    run(...params: unknown[]): unknown;
    all(...params: unknown[]): unknown[];
    get(...params: unknown[]): unknown;
  };
  close(): void;
}

function createDatabase(path: string): DatabaseSyncInstance {
  const require = createRequire(import.meta.url);
  const { DatabaseSync } = require("node:sqlite") as { DatabaseSync: new (path: string) => DatabaseSyncInstance };
  return new DatabaseSync(path);
}

// ─── DDL ─────────────────────────────────────────────────

const FLOW_SCHEMA_DDL = `
CREATE TABLE IF NOT EXISTS flow_instances (
  id           TEXT NOT NULL PRIMARY KEY,
  schema_id    TEXT NOT NULL,
  schema_version TEXT NOT NULL,
  status       TEXT NOT NULL,
  context      TEXT NOT NULL DEFAULT '{}',
  selections   TEXT NOT NULL DEFAULT '[]',
  outcome      TEXT,
  address      INTEGER,
  address_context TEXT,
  verdict      TEXT,
  started_at   TEXT NOT NULL,
  completed_at TEXT,
  created_at   TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_fi_schema ON flow_instances (schema_id);
CREATE INDEX IF NOT EXISTS idx_fi_status ON flow_instances (status);
CREATE INDEX IF NOT EXISTS idx_fi_started ON flow_instances (started_at);
`;

// ─── Store ───────────────────────────────────────────────

export class SqliteInstanceStore implements InstanceStore {
  private db: DatabaseSyncInstance;

  constructor(path: string) {
    this.db = createDatabase(path);
    // WAL 모드: 읽기와 쓰기가 동시에 가능 (여러 CLI 프로세스 동시 사용)
    this.db.exec("PRAGMA journal_mode = WAL");
    // busy timeout: 다른 프로세스가 쓰는 중이면 3초까지 대기
    this.db.exec("PRAGMA busy_timeout = 3000");
    this.db.exec(FLOW_SCHEMA_DDL);
    this.migrate();
  }

  /** 기존 DB에 verdict 컬럼이 없으면 추가 */
  private migrate(): void {
    try {
      this.db.exec("ALTER TABLE flow_instances ADD COLUMN verdict TEXT");
    } catch {
      // 이미 존재하면 무시
    }
  }

  save(instance: FlowInstance): void {
    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO flow_instances
        (id, schema_id, schema_version, status, context, selections, outcome, address, address_context, verdict, started_at, completed_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    stmt.run(
      instance.id,
      instance.schemaId,
      instance.schemaVersion,
      instance.status,
      JSON.stringify(instance.context),
      JSON.stringify(instance.selections),
      instance.outcome ?? null,
      instance.coordinateAddress ?? null,
      instance.addressContext ? JSON.stringify(instance.addressContext) : null,
      instance.verdict ? JSON.stringify(instance.verdict) : null,
      instance.startedAt,
      instance.completedAt ?? null,
    );
  }

  findBySchema(schemaId: string): FlowInstance[] {
    const rows = this.db.prepare(
      "SELECT * FROM flow_instances WHERE schema_id = ? ORDER BY started_at ASC",
    ).all(schemaId) as RawRow[];
    return rows.map(toFlowInstance);
  }

  findByContext(query: InstanceContextQuery): FlowInstance[] {
    // SQLite에서 JSON 필드 검색 — json_extract 사용
    let sql = "SELECT * FROM flow_instances WHERE 1=1";
    const params: unknown[] = [];

    if (query.schemaId) {
      sql += " AND schema_id = ?";
      params.push(query.schemaId);
    }

    // context 키 검색: json_extract(context, '$.key')
    const jsonPath = `$.${query.key}`;
    if (Object.prototype.hasOwnProperty.call(query, "value")) {
      sql += ` AND json_extract(context, ?) = ?`;
      params.push(jsonPath, query.value as string);
    } else {
      sql += ` AND json_extract(context, ?) IS NOT NULL`;
      params.push(jsonPath);
    }

    sql += " ORDER BY started_at ASC";
    const rows = this.db.prepare(sql).all(...params) as RawRow[];
    return rows.map(toFlowInstance);
  }

  findByTimeRange(query: InstanceTimeRangeQuery): FlowInstance[] {
    let sql = "SELECT * FROM flow_instances WHERE 1=1";
    const params: unknown[] = [];

    if (query.schemaId) {
      sql += " AND schema_id = ?";
      params.push(query.schemaId);
    }
    if (query.from) {
      sql += " AND started_at >= ?";
      params.push(query.from);
    }
    if (query.to) {
      sql += " AND started_at <= ?";
      params.push(query.to);
    }

    sql += " ORDER BY started_at ASC";
    const rows = this.db.prepare(sql).all(...params) as RawRow[];
    return rows.map(toFlowInstance);
  }

  /** 키워드로 context 값 또는 schema_id 검색 */
  search(keyword: string): FlowInstance[] {
    const like = `%${keyword}%`;
    const rows = this.db.prepare(
      "SELECT * FROM flow_instances WHERE schema_id LIKE ? OR context LIKE ? ORDER BY started_at DESC LIMIT 50",
    ).all(like, like) as RawRow[];
    return rows.map(toFlowInstance);
  }

  /** 최근 N건 조회 */
  recent(limit: number = 20, schemaId?: string): FlowInstance[] {
    let sql = "SELECT * FROM flow_instances";
    const params: unknown[] = [];
    if (schemaId) {
      sql += " WHERE schema_id = ?";
      params.push(schemaId);
    }
    sql += " ORDER BY started_at DESC LIMIT ?";
    params.push(limit);
    const rows = this.db.prepare(sql).all(...params) as RawRow[];
    return rows.map(toFlowInstance);
  }

  /** 인스턴스 단건 조회 */
  findById(id: string): FlowInstance | undefined {
    const row = this.db.prepare(
      "SELECT * FROM flow_instances WHERE id = ?",
    ).get(id) as RawRow | undefined;
    return row ? toFlowInstance(row) : undefined;
  }

  /** active 인스턴스 목록 (세션 간 복원용) */
  findActive(): FlowInstance[] {
    const rows = this.db.prepare(
      "SELECT * FROM flow_instances WHERE status = 'active' ORDER BY started_at DESC",
    ).all() as RawRow[];
    return rows.map(toFlowInstance);
  }

  /** 통계 */
  stats(): { total: number; completed: number; active: number; schemas: number } {
    const count = (sql: string): number => {
      const row = this.db.prepare(sql).get() as Record<string, unknown> | undefined;
      return typeof row?.cnt === "number" ? row.cnt : 0;
    };
    return {
      total: count("SELECT COUNT(*) as cnt FROM flow_instances"),
      completed: count("SELECT COUNT(*) as cnt FROM flow_instances WHERE status = 'completed'"),
      active: count("SELECT COUNT(*) as cnt FROM flow_instances WHERE status = 'active'"),
      schemas: count("SELECT COUNT(DISTINCT schema_id) as cnt FROM flow_instances"),
    };
  }

  close(): void {
    this.db.close();
  }
}

// ─── 내부 ────────────────────────────────────────────────

interface RawRow {
  id: string;
  schema_id: string;
  schema_version: string;
  status: string;
  context: string;
  selections: string;
  outcome: string | null;
  address: number | null;
  address_context: string | null;
  verdict: string | null;
  started_at: string;
  completed_at: string | null;
}

function toFlowInstance(row: RawRow): FlowInstance {
  return {
    id: row.id,
    schemaId: row.schema_id,
    schemaVersion: row.schema_version,
    status: row.status as FlowInstance["status"],
    context: safeJsonParse(row.context, {}),
    selections: safeJsonParse(row.selections, []),
    outcome: row.outcome ?? undefined,
    coordinateAddress: row.address ?? undefined,
    addressContext: row.address_context ? safeJsonParse(row.address_context, undefined) : undefined,
    verdict: row.verdict ? safeJsonParse(row.verdict, undefined) : undefined,
    startedAt: row.started_at,
    completedAt: row.completed_at ?? undefined,
  };
}

function safeJsonParse<T>(json: string, fallback: T): T {
  try {
    return JSON.parse(json) as T;
  } catch {
    console.warn(`[flow-sqlite] JSON 파싱 실패 — fallback 사용: ${json.slice(0, 50)}`);
    return fallback;
  }
}
