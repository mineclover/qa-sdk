// @def.boundary index-meta-system
// @def.doc index-meta-system

/**
 * SqlIndexMetaStore — 범용 SQLite 호환 어댑터
 *
 * IndexMetaStore 인터페이스를 SqlDriver로 구현한다.
 * sql/schema.sql이 먼저 적용된 DB가 필요하다.
 *
 * SqlDriver를 구현하면 D1 / Turso / libsql / better-sqlite3 등
 * 어떤 SQLite 호환 DB에도 동작한다.
 */

import type { IndexMetaStore, SchemaVersionRecord, EntryRecord } from "../index-meta-store.js";
import { ValidationError } from "../errors.js";
import type { EntityId } from "../types.js";
import { validateEntryForInsert } from "./validate-entry.js";

// ── SqlDialect — DB 종류 + 기능 플래그 ──────────────────────────────────────

/**
 * DB 종류와 기능 플래그.
 *
 * Sql* 어댑터가 DB별 분기에 사용한다.
 * 드라이버 구현자는 자신의 DB에 맞는 dialect을 제공한다.
 *
 * | DB | transaction | returning | jsonType | upsert |
 * |----|-------------|-----------|----------|--------|
 * | SQLite (better-sqlite3) | O | O (3.35+) | X | O |
 * | PostgreSQL | O | O | O (JSONB) | O |
 * | D1 (Workers) | X | O | X | O |
 * | DuckDB | O | O | O | O |
 * | ClickHouse | X | X | O | X (ReplacingMergeTree) |
 */
export interface SqlDialect {
  /** DB 식별자. */
  readonly name: string;
  /** 멀티 스테이트먼트 트랜잭션 지원 여부. */
  readonly supportsTransaction: boolean;
  /** INSERT ... RETURNING 지원 여부. */
  readonly supportsReturning: boolean;
  /** 네이티브 JSON 컬럼 타입 지원 여부 (JSONB 등). */
  readonly supportsJsonType: boolean;
  /** ON CONFLICT DO UPDATE (upsert) 지원 여부. */
  readonly supportsUpsert: boolean;
}

// ── ExecuteResult ─────────────────────────────────────────────────────────────

/**
 * INSERT/UPDATE/DELETE 실행 결과.
 *
 * execute() 호출자가 영향받은 행 수를 확인할 수 있다.
 * 기존 코드에서 결과를 무시해도 안전 (backwards-compatible).
 */
export interface ExecuteResult {
  /** 영향받은 행 수. DB가 제공하지 않으면 0. */
  readonly rowsAffected: number;
}

// ── SqlDriver — 범용 SQL 드라이버 인터페이스 ─────────────────────────────────

/**
 * 범용 SQL 드라이버 인터페이스.
 *
 * DB 종류와 무관하게 동일한 인터페이스로 SQL을 실행한다.
 * 파라미터는 항상 ? (positional) 스타일로 전달하며,
 * 드라이버 내부에서 $1/$2 등 네이티브 스타일로 변환한다.
 *
 * 구현 예:
 *   better-sqlite3 → Database.prepare().all() / get() / run()
 *   PostgreSQL     → pg Pool.query() (? → $1 변환)
 *   D1             → D1Database.prepare().bind().all() / first() / run()
 *   DuckDB         → duckdb Connection.all() / run()
 *   ClickHouse     → @clickhouse/client query() / insert()
 */
export interface SqlDriver {
  /** DB 종류 + 기능 플래그. */
  readonly dialect: SqlDialect;

  /**
   * 여러 행 반환 쿼리 (SELECT multiple).
   * 결과가 없으면 빈 배열.
   */
  query<T extends Record<string, unknown>>(
    sql: string,
    params?: unknown[]
  ): Promise<T[]>;

  /**
   * 단일 행 반환 쿼리 (SELECT one).
   * 결과가 없으면 null.
   */
  queryOne<T extends Record<string, unknown>>(
    sql: string,
    params?: unknown[]
  ): Promise<T | null>;

  /**
   * 변경 쿼리 (INSERT / UPDATE / DELETE).
   * rowsAffected로 영향받은 행 수를 확인할 수 있다.
   */
  execute(sql: string, params?: unknown[]): Promise<ExecuteResult>;

  /**
   * 트랜잭션.
   *
   * dialect.supportsTransaction이 false인 DB에서는
   * fn을 순차 실행한다 (non-atomic). 원자성이 필요하면
   * dialect.supportsTransaction을 사전 확인할 것.
   *
   * @example
   * if (!driver.dialect.supportsTransaction) {
   *   console.warn("이 DB는 트랜잭션을 지원하지 않습니다");
   * }
   * await driver.transaction(async (tx) => {
   *   await tx.execute("INSERT ...");
   *   await tx.execute("INSERT ...");
   * });
   */
  transaction<T>(fn: (tx: SqlDriver) => Promise<T>): Promise<T>;

  /**
   * 동일 SQL을 여러 파라미터 셋으로 일괄 실행.
   *
   * 기본 동작: for-loop execute. 드라이버가 네이티브 batch를 지원하면
   * 오버라이드해 성능을 개선할 수 있다.
   *
   * @example
   * await driver.batchExecute(
   *   "INSERT INTO entry (prefix, version_id, position, value) VALUES (?, ?, ?, ?)",
   *   [
   *     ["perm", "v1", 1, "admin"],
   *     ["perm", "v1", 2, "editor"],
   *     ["perm", "v1", 3, "viewer"],
   *   ]
   * );
   */
  batchExecute(sql: string, paramsList: unknown[][]): Promise<void>;
}

// ── SqlIndexMetaStore ─────────────────────────────────────────────────────────

export class SqlIndexMetaStore implements IndexMetaStore {
  constructor(private readonly driver: SqlDriver) {}

  // ── schema_version ──────────────────────────────────────

  async insertSchemaVersion(record: SchemaVersionRecord): Promise<void> {
    await this.driver.execute(
      `INSERT INTO schema_version (prefix, version_id, capacity, created_at)
       VALUES (?, ?, ?, ?)`,
      [record.prefix, record.versionId, record.capacity, record.createdAt]
    );
  }

  async getSchemaVersions(prefix: string): Promise<SchemaVersionRecord[]> {
    const rows = await this.driver.query<SchemaVersionRow>(
      `SELECT prefix, version_id, capacity, created_at
       FROM schema_version WHERE prefix = ?
       ORDER BY created_at ASC`,
      [prefix]
    );
    return rows.map(toSchemaVersionRecord);
  }

  async getSchemaVersion(
    prefix: string,
    versionId: string
  ): Promise<SchemaVersionRecord | null> {
    const row = await this.driver.queryOne<SchemaVersionRow>(
      `SELECT prefix, version_id, capacity, created_at
       FROM schema_version WHERE prefix = ? AND version_id = ?`,
      [prefix, versionId]
    );
    return row ? toSchemaVersionRecord(row) : null;
  }

  async getCapacity(prefix: string, versionId: string): Promise<number | null> {
    const row = await this.driver.queryOne<{ capacity: number }>(
      `SELECT capacity FROM schema_version WHERE prefix = ? AND version_id = ?`,
      [prefix, versionId]
    );
    return row?.capacity ?? null;
  }

  // ── entry ───────────────────────────────────────────────

  async insertEntry(record: EntryRecord): Promise<void> {
    const [sv, existing] = await Promise.all([
      this.getSchemaVersion(record.prefix, record.versionId),
      this.getEntry(record.prefix, record.versionId, record.position),
    ]);

    validateEntryForInsert(record, sv, existing);

    await this.driver.execute(
      `INSERT INTO entry (prefix, version_id, position, value, created_at)
       VALUES (?, ?, ?, ?, ?)`,
      [record.prefix, record.versionId, record.position, String(record.value), record.createdAt]
    );
  }

  async getEntries(prefix: string, versionId: string): Promise<EntryRecord[]> {
    const rows = await this.driver.query<EntryRow>(
      `SELECT prefix, version_id, position, value, created_at
       FROM entry WHERE prefix = ? AND version_id = ?
       ORDER BY position ASC`,
      [prefix, versionId]
    );
    return rows.map(toEntryRecord);
  }

  async getEntriesInRange(
    prefix: string,
    versionId: string,
    from: number,
    to: number
  ): Promise<EntryRecord[]> {
    const rows = await this.driver.query<EntryRow>(
      `SELECT prefix, version_id, position, value, created_at
       FROM entry
       WHERE prefix = ? AND version_id = ? AND position >= ? AND position <= ?
       ORDER BY position ASC`,
      [prefix, versionId, from, to]
    );
    return rows.map(toEntryRecord);
  }

  async getEntry(
    prefix: string,
    versionId: string,
    position: number
  ): Promise<EntryRecord | null> {
    const row = await this.driver.queryOne<EntryRow>(
      `SELECT prefix, version_id, position, value, created_at
       FROM entry WHERE prefix = ? AND version_id = ? AND position = ?`,
      [prefix, versionId, position]
    );
    return row ? toEntryRecord(row) : null;
  }

  async getEntryByValue(prefix: string, versionId: string, value: EntityId): Promise<EntryRecord | null> {
    const row = await this.driver.queryOne<EntryRow>(
      `SELECT prefix, version_id, position, value, created_at
       FROM entry WHERE prefix = ? AND version_id = ? AND value = ?`,
      [prefix, versionId, String(value)]
    );
    return row ? toEntryRecord(row) : null;
  }

  async migrateEntries(
    prefix: string,
    fromVersion: string,
    toVersion: string,
    positionMap?: Record<number, number>
  ): Promise<{ migrated: number; skipped: number }> {
    const sv = await this.getSchemaVersion(prefix, toVersion);
    if (!sv) {
      throw new ValidationError(
        `SchemaVersion not found: "${prefix}/${toVersion}". Insert schema version first.`
      );
    }

    const [sourceEntries, existingEntries] = await Promise.all([
      this.getEntries(prefix, fromVersion),
      this.getEntries(prefix, toVersion),
    ]);
    const existingPositions = new Set(existingEntries.map((e) => e.position));

    let migrated = 0;
    let skipped = 0;

    await this.driver.transaction(async (tx) => {
      const now = new Date().toISOString();

      for (const entry of sourceEntries) {
        const newPosition = positionMap?.[entry.position] ?? entry.position;
        if (existingPositions.has(newPosition)) {
          skipped++;
          continue;
        }
        if (newPosition < 1 || newPosition > sv.capacity) {
          throw new ValidationError(
            `Mapped position ${newPosition} out of range [1, ${sv.capacity}] for "${prefix}/${toVersion}"`
          );
        }
        await tx.execute(
          `INSERT INTO entry (prefix, version_id, position, value, created_at) VALUES (?, ?, ?, ?, ?)`,
          [prefix, toVersion, newPosition, String(entry.value), now]
        );
        existingPositions.add(newPosition);
        migrated++;
      }
    });

    return { migrated, skipped };
  }
}

// ── DB row 타입 + 변환 헬퍼 ──────────────────────────────────────────────────

interface SchemaVersionRow extends Record<string, unknown> {
  prefix: string;
  version_id: string;
  capacity: number;
  created_at: string;
}

interface EntryRow extends Record<string, unknown> {
  prefix: string;
  version_id: string;
  position: number;
  value: string;
  created_at: string;
}

function toSchemaVersionRecord(row: SchemaVersionRow): SchemaVersionRecord {
  return {
    prefix:    row.prefix,
    versionId: row.version_id,
    capacity:  row.capacity,
    createdAt: row.created_at,
  };
}

function toEntryRecord(row: EntryRow): EntryRecord {
  return {
    prefix:    row.prefix,
    versionId: row.version_id,
    position:  row.position,
    value:     row.value,
    createdAt: row.created_at,
  };
}
