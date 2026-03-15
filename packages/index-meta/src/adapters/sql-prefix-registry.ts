/**
 * SqlPrefixRegistry — 범용 SQLite/PostgreSQL 호환 PrefixRegistry 구현
 *
 * prefix_registry + prefix_ref 테이블을 SqlDriver로 읽고 쓴다.
 * node-sqlite-driver.ts의 SCHEMA_DDL이 먼저 적용된 DB가 필요하다.
 */

import { ValidationError } from "../errors.js";
import type { PrefixRegistry, PrefixRegistryRecord, DimRef, ResolvedAddress } from "../prefix-registry.js";
import type { SqlDriver } from "./sql-store.js";

// ── DB row 타입 ───────────────────────────────────────────

interface PrefixRegistryRow extends Record<string, unknown> {
  prefix:        string;
  version_id:    string;
  capacity:      number;
  registered_at: string;
}

interface PrefixRefRow extends Record<string, unknown> {
  parent_prefix:     string;
  parent_version_id: string;
  dim_order:         number;
  ref_prefix:        string;
  ref_version_id:    string;
  ref_capacity:      number;
}

// ── SqlPrefixRegistry ─────────────────────────────────────

export class SqlPrefixRegistry implements PrefixRegistry {
  constructor(private readonly driver: SqlDriver) {}

  async register(record: PrefixRegistryRecord): Promise<void> {
    const existing = await this.driver.queryOne<{ prefix: string }>(
      `SELECT prefix FROM prefix_registry WHERE prefix = ? AND version_id = ?`,
      [record.prefix, record.versionId]
    );
    if (existing) {
      throw new ValidationError(
        `PrefixRegistry: "${record.prefix}/${record.versionId}" already registered`
      );
    }

    const now = new Date().toISOString();
    await this.driver.transaction(async (tx) => {
      await tx.execute(
        `INSERT INTO prefix_registry (prefix, version_id, capacity, registered_at) VALUES (?, ?, ?, ?)`,
        [record.prefix, record.versionId, record.capacity, now]
      );

      if (record.refs && record.refs.length > 0) {
        for (let i = 0; i < record.refs.length; i++) {
          const ref = record.refs[i];
          await tx.execute(
            `INSERT INTO prefix_ref (parent_prefix, parent_version_id, dim_order, ref_prefix, ref_version_id, ref_capacity)
             VALUES (?, ?, ?, ?, ?, ?)`,
            [record.prefix, record.versionId, i, ref.prefix, ref.versionId, ref.capacity]
          );
        }
      }
    });
  }

  async getCapacity(prefix: string, versionId: string): Promise<number | null> {
    const row = await this.driver.queryOne<{ capacity: number }>(
      `SELECT capacity FROM prefix_registry WHERE prefix = ? AND version_id = ?`,
      [prefix, versionId]
    );
    return row?.capacity ?? null;
  }

  async getRecord(prefix: string, versionId: string): Promise<PrefixRegistryRecord | null> {
    const row = await this.driver.queryOne<PrefixRegistryRow>(
      `SELECT prefix, version_id, capacity, registered_at FROM prefix_registry WHERE prefix = ? AND version_id = ?`,
      [prefix, versionId]
    );
    if (!row) return null;

    const refs = await this._getRefs(prefix, versionId);
    return toRecord(row, refs);
  }

  async listVersions(prefix: string): Promise<PrefixRegistryRecord[]> {
    const rows = await this.driver.query<PrefixRegistryRow>(
      `SELECT prefix, version_id, capacity, registered_at FROM prefix_registry WHERE prefix = ? ORDER BY registered_at ASC`,
      [prefix]
    );
    // All rows share the same prefix — fetch refs with a single prefix filter
    const allRefRows = await this.driver.query<PrefixRefRow>(
      `SELECT parent_prefix, parent_version_id, dim_order, ref_prefix, ref_version_id, ref_capacity
       FROM prefix_ref WHERE parent_prefix = ?
       ORDER BY parent_version_id ASC, dim_order ASC`,
      [prefix]
    );
    return this._mergeRefs(rows, allRefRows);
  }

  async listAll(): Promise<PrefixRegistryRecord[]> {
    const [rows, allRefRows] = await Promise.all([
      this.driver.query<PrefixRegistryRow>(
        `SELECT prefix, version_id, capacity, registered_at FROM prefix_registry ORDER BY registered_at ASC`
      ),
      this.driver.query<PrefixRefRow>(
        `SELECT parent_prefix, parent_version_id, dim_order, ref_prefix, ref_version_id, ref_capacity
         FROM prefix_ref ORDER BY parent_prefix ASC, parent_version_id ASC, dim_order ASC`
      ),
    ]);
    return this._mergeRefs(rows, allRefRows);
  }

  async getDeps(prefix: string, versionId: string): Promise<readonly DimRef[]> {
    return this._getRefs(prefix, versionId);
  }

  async getTransitiveDeps(prefix: string, versionId: string): Promise<readonly DimRef[]> {
    const result: DimRef[] = [];
    const visited = new Set<string>();

    const visit = async (p: string, v: string): Promise<void> => {
      const key = `${p}:${v}`;
      if (visited.has(key)) return;
      visited.add(key);

      const refs = await this._getRefs(p, v);
      for (const ref of refs) {
        result.push(ref);
        await visit(ref.prefix, ref.versionId);
      }
    };

    await visit(prefix, versionId);
    return result;
  }

  async getReverseRefs(prefix: string, versionId: string): Promise<readonly PrefixRegistryRecord[]> {
    // Find all composite prefixes that have this prefix:versionId as a dim
    const refRows = await this.driver.query<{ parent_prefix: string; parent_version_id: string }>(
      `SELECT DISTINCT parent_prefix, parent_version_id FROM prefix_ref
       WHERE ref_prefix = ? AND ref_version_id = ?`,
      [prefix, versionId]
    );

    const records: PrefixRegistryRecord[] = [];
    for (const { parent_prefix, parent_version_id } of refRows) {
      const record = await this.getRecord(parent_prefix, parent_version_id);
      if (record) records.push(record);
    }
    return records;
  }

  async getShape(prefix: string, versionId: string): Promise<number[] | null> {
    const row = await this.driver.queryOne<{ capacity: number }>(
      `SELECT capacity FROM prefix_registry WHERE prefix = ? AND version_id = ?`,
      [prefix, versionId]
    );
    if (!row) return null;

    const refs = await this._getRefs(prefix, versionId);
    return refs.length > 0 ? refs.map((r) => r.capacity) : [row.capacity];
  }

  async resolveAddress(serialized: string): Promise<ResolvedAddress | null> {
    const last = serialized.lastIndexOf(":");
    if (last === -1) return null;
    const indexStr = serialized.slice(last + 1);
    const rest = serialized.slice(0, last);

    const second = rest.lastIndexOf(":");
    if (second === -1) return null;
    const prefix = rest.slice(0, second);
    const versionId = rest.slice(second + 1);

    const index = Number(indexStr);
    if (!prefix || !versionId || !Number.isInteger(index) || index < 0) return null;

    const record = await this.getRecord(prefix, versionId);
    if (!record) return null;

    const shape = record.refs && record.refs.length > 0
      ? record.refs.map((r) => r.capacity)
      : [record.capacity];

    return {
      prefix,
      versionId,
      index,
      capacity: record.capacity,
      shape,
      refs: record.refs ?? [],
      valid: index < record.capacity,
    };
  }

  // ── 내부 헬퍼 ──────────────────────────────────────────────

  private async _getRefs(prefix: string, versionId: string): Promise<DimRef[]> {
    const rows = await this.driver.query<PrefixRefRow>(
      `SELECT ref_prefix, ref_version_id, ref_capacity FROM prefix_ref
       WHERE parent_prefix = ? AND parent_version_id = ?
       ORDER BY dim_order ASC`,
      [prefix, versionId]
    );
    return rows.map((r) => ({
      prefix:    r.ref_prefix,
      versionId: r.ref_version_id,
      capacity:  r.ref_capacity,
    }));
  }

  private _mergeRefs(rows: PrefixRegistryRow[], refRows: PrefixRefRow[]): PrefixRegistryRecord[] {
    if (rows.length === 0) return [];

    const refMap = new Map<string, DimRef[]>();
    for (const row of rows) refMap.set(`${row.prefix}:${row.version_id}`, []);

    for (const ref of refRows) {
      const key = `${ref.parent_prefix}:${ref.parent_version_id}`;
      const list = refMap.get(key);
      if (list) {
        list.push({
          prefix:    ref.ref_prefix,
          versionId: ref.ref_version_id,
          capacity:  ref.ref_capacity,
        });
      }
    }

    return rows.map((row) => {
      const refs = refMap.get(`${row.prefix}:${row.version_id}`) ?? [];
      return toRecord(row, refs);
    });
  }
}

// ── 변환 헬퍼 ─────────────────────────────────────────────

function toRecord(row: PrefixRegistryRow, refs: DimRef[]): PrefixRegistryRecord {
  return {
    prefix:    row.prefix,
    versionId: row.version_id,
    capacity:  row.capacity,
    ...(refs.length > 0 ? { refs } : {}),
  };
}
