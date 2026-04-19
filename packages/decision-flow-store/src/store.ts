// @def.boundary persistence-system-root
// @def.doc persistence-system-root

/**
 * SqliteInstanceStore — decision-flow InstanceStore의 SQLite 구현.
 *
 * CLI 전용. decision-flow 패키지는 순수 라이브러리로 유지하고,
 * 영속은 CLI(소비자)의 책임.
 *
 * 저장 위치: ~/.qa-sdk/decision-flow.sqlite
 */

import type {
  InstanceStore,
  InstanceContextQuery,
  InstanceTimeRangeQuery,
  FlowInstance,
} from "decision-flow";
import { createLogger } from "@qa-sdk/core";
import { getDatabaseSync, type DatabaseSyncInstance } from "index-meta";
import { drizzle } from "drizzle-orm/node-sqlite";
import { migrate } from "drizzle-orm/node-sqlite/migrator";

const logger = createLogger("decision-flow-store");
import { flowInstances } from "./db/schema.js";
import {
  eq,
  and,
  desc,
  asc,
  gte,
  lte,
  sql,
  count,
  countDistinct,
  type SQL,
} from "drizzle-orm";

// drizzle() 반환 타입
type DrizzleDb = ReturnType<typeof drizzle>;

// ─── Store ───────────────────────────────────────────────

export class SqliteInstanceStore implements InstanceStore {
  private rawDb: DatabaseSyncInstance;
  private db: DrizzleDb;

  constructor(path: string) {
    const DatabaseSync = getDatabaseSync();
    this.rawDb = new DatabaseSync(path);
    this.rawDb.exec("PRAGMA journal_mode = WAL");
    this.rawDb.exec("PRAGMA busy_timeout = 3000");
    // drizzle 인스턴스 생성 + 마이그레이션 실행
    try {
      this.db = drizzle({ client: this.rawDb });
      migrate(this.db, {
        migrationsFolder: new URL("../drizzle", import.meta.url).pathname,
      });
    } catch (err) {
      logger.error({ err }, "drizzle 마이그레이션 실패");
      throw err;
    }
  }

  save(instance: FlowInstance): void {
    const values = {
      id: instance.id,
      schemaId: instance.schemaId,
      schemaVersion: instance.schemaVersion,
      status: instance.status,
      context: JSON.stringify(instance.context),
      selections: JSON.stringify(instance.selections),
      outcome: instance.outcome ?? null,
      address: instance.coordinateAddress ?? null,
      addressContext: instance.addressContext
        ? JSON.stringify(instance.addressContext)
        : null,
      verdict: instance.verdict ? JSON.stringify(instance.verdict) : null,
      testPlan: instance.testPlan ? JSON.stringify(instance.testPlan) : null,
      startedAt: instance.startedAt,
      completedAt: instance.completedAt ?? null,
    };
    this.db
      .insert(flowInstances)
      .values(values)
      .onConflictDoUpdate({
        target: flowInstances.id,
        set: {
          schemaId: values.schemaId,
          schemaVersion: values.schemaVersion,
          status: values.status,
          context: values.context,
          selections: values.selections,
          outcome: values.outcome,
          address: values.address,
          addressContext: values.addressContext,
          verdict: values.verdict,
          testPlan: values.testPlan,
          startedAt: values.startedAt,
          completedAt: values.completedAt,
        },
      })
      .run();
  }

  findBySchema(schemaId: string): FlowInstance[] {
    const rows = this.db
      .select()
      .from(flowInstances)
      .where(eq(flowInstances.schemaId, schemaId))
      .orderBy(asc(flowInstances.startedAt))
      .all();
    return rows.map(toFlowInstance);
  }

  findByContext(query: InstanceContextQuery): FlowInstance[] {
    const conditions: SQL[] = [];
    if (query.schemaId) {
      conditions.push(eq(flowInstances.schemaId, query.schemaId));
    }
    // SQLite에서 JSON 필드 검색 — json_extract 사용
    const jsonPath = `$.${query.key}`;
    if (Object.prototype.hasOwnProperty.call(query, "value")) {
      const value = query.value;
      if (value === null) {
        conditions.push(sql`json_type(${flowInstances.context}, ${jsonPath}) = 'null'`);
      } else if (typeof value === "boolean") {
        conditions.push(
          sql`json_type(${flowInstances.context}, ${jsonPath}) = ${value ? "true" : "false"}`,
        );
      } else if (typeof value === "number" || typeof value === "string") {
        conditions.push(sql`json_extract(${flowInstances.context}, ${jsonPath}) = ${value}`);
      } else {
        conditions.push(sql`json_extract(${flowInstances.context}, ${jsonPath}) = json(${JSON.stringify(value)})`);
      }
    } else {
      conditions.push(
        sql`json_extract(${flowInstances.context}, ${jsonPath}) IS NOT NULL`,
      );
    }
    const rows = this.db
      .select()
      .from(flowInstances)
      .where(and(...conditions))
      .orderBy(asc(flowInstances.startedAt))
      .all();
    return rows.map(toFlowInstance);
  }

  findByTimeRange(query: InstanceTimeRangeQuery): FlowInstance[] {
    const conditions: SQL[] = [];
    if (query.schemaId) {
      conditions.push(eq(flowInstances.schemaId, query.schemaId));
    }
    if (query.from) {
      conditions.push(gte(flowInstances.startedAt, query.from));
    }
    if (query.to) {
      conditions.push(lte(flowInstances.startedAt, query.to));
    }
    const rows = this.db
      .select()
      .from(flowInstances)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(asc(flowInstances.startedAt))
      .all();
    return rows.map(toFlowInstance);
  }

  /** 키워드로 context 값 또는 schema_id 검색 */
  search(keyword: string): FlowInstance[] {
    const pattern = `%${keyword}%`;
    const rows = this.db
      .select()
      .from(flowInstances)
      .where(
        sql`${flowInstances.schemaId} LIKE ${pattern} OR ${flowInstances.context} LIKE ${pattern}`,
      )
      .orderBy(desc(flowInstances.startedAt))
      .limit(50)
      .all();
    return rows.map(toFlowInstance);
  }

  /** 최근 N건 조회 */
  recent(limit: number = 20, schemaId?: string): FlowInstance[] {
    const rows = this.db
      .select()
      .from(flowInstances)
      .where(schemaId ? eq(flowInstances.schemaId, schemaId) : undefined)
      .orderBy(desc(flowInstances.startedAt))
      .limit(limit)
      .all();
    return rows.map(toFlowInstance);
  }

  /** 인스턴스 단건 조회 */
  findById(id: string): FlowInstance | undefined {
    const row = this.db
      .select()
      .from(flowInstances)
      .where(eq(flowInstances.id, id))
      .get();
    return row ? toFlowInstance(row) : undefined;
  }

  /** active 인스턴스 목록 (세션 간 복원용) */
  findActive(): FlowInstance[] {
    const rows = this.db
      .select()
      .from(flowInstances)
      .where(eq(flowInstances.status, "active"))
      .orderBy(desc(flowInstances.startedAt))
      .all();
    return rows.map(toFlowInstance);
  }

  /** 통계 */
  stats(): {
    total: number;
    completed: number;
    active: number;
    schemas: number;
  } {
    const totalRow = this.db
      .select({ cnt: count() })
      .from(flowInstances)
      .get();
    const completedRow = this.db
      .select({ cnt: count() })
      .from(flowInstances)
      .where(eq(flowInstances.status, "completed"))
      .get();
    const activeRow = this.db
      .select({ cnt: count() })
      .from(flowInstances)
      .where(eq(flowInstances.status, "active"))
      .get();
    const schemasRow = this.db
      .select({ cnt: countDistinct(flowInstances.schemaId) })
      .from(flowInstances)
      .get();
    return {
      total: totalRow?.cnt ?? 0,
      completed: completedRow?.cnt ?? 0,
      active: activeRow?.cnt ?? 0,
      schemas: schemasRow?.cnt ?? 0,
    };
  }

  close(): void {
    this.rawDb.close();
  }
}

// ─── 내부 ────────────────────────────────────────────────

/** Drizzle select 결과 → FlowInstance 변환 */
type DrizzleRow = typeof flowInstances.$inferSelect;

function toFlowInstance(row: DrizzleRow): FlowInstance {
  return {
    id: row.id,
    schemaId: row.schemaId,
    schemaVersion: row.schemaVersion,
    status: row.status,
    context: safeJsonParse(row.context, {}),
    selections: safeJsonParse(row.selections, []),
    outcome: row.outcome ?? undefined,
    coordinateAddress: row.address ?? undefined,
    addressContext: row.addressContext
      ? safeJsonParse(row.addressContext, undefined)
      : undefined,
    verdict: row.verdict ? safeJsonParse(row.verdict, undefined) : undefined,
    testPlan: row.testPlan ? safeJsonParse(row.testPlan, undefined) : undefined,
    startedAt: row.startedAt,
    completedAt: row.completedAt ?? undefined,
  };
}

function safeJsonParse<T>(json: string, fallback: T): T {
  try {
    return JSON.parse(json) as T;
  } catch {
    logger.warn({ snippet: json.slice(0, 50) }, "JSON 파싱 실패 — fallback 사용");
    return fallback;
  }
}
