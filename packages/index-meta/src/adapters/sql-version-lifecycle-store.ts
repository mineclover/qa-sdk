// @def.boundary index-meta-system
// @def.doc index-meta-system

/**
 * SqlVersionLifecycleStore — VersionLifecycleStore의 SQL 구현
 *
 * version_lifecycle 테이블을 SqlDriver로 읽고 쓴다.
 * sql/schema.sql이 먼저 적용된 DB가 필요하다.
 */

import type {
  DeactivationMode,
  VersionLifecycleStore,
  VersionRecord,
  VersionStatus,
} from "../version-lifecycle.js";
import type { SqlDriver } from "./sql-store.js";

interface VersionLifecycleRow extends Record<string, unknown> {
  prefix: string;
  version_id: string;
  status: string;
  base_version_id: string | null;
  capacity: number;
  deactivation_mode: string;
  created_at: string;
  released_at: string | null;
}

export class SqlVersionLifecycleStore implements VersionLifecycleStore {
  constructor(private readonly driver: SqlDriver) {}

  async createDraft(
    prefix: string,
    versionId: string,
    baseVersionId: string | null,
    capacity: number,
    deactivationMode?: DeactivationMode,
  ): Promise<VersionRecord> {
    const existing = await this.getVersion(prefix, versionId);
    if (existing) {
      throw new Error(`Version ${versionId} already exists for prefix "${prefix}"`);
    }

    const mode = await this.resolveDeactivationMode(prefix, baseVersionId, deactivationMode);
    const record: VersionRecord = {
      prefix,
      versionId,
      status: "draft",
      baseVersionId,
      capacity,
      deactivationMode: mode,
      createdAt: new Date().toISOString(),
      releasedAt: null,
    };

    await this.driver.execute(
      `INSERT INTO version_lifecycle
         (prefix, version_id, status, base_version_id, capacity, deactivation_mode, created_at, released_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        record.prefix,
        record.versionId,
        record.status,
        record.baseVersionId,
        record.capacity,
        record.deactivationMode,
        record.createdAt,
        record.releasedAt,
      ],
    );

    return record;
  }

  async release(prefix: string, versionId: string): Promise<void> {
    const record = await this.mustGet(prefix, versionId);
    if (record.status !== "draft") {
      throw new Error(`Cannot release: version ${versionId} is "${record.status}", expected "draft"`);
    }

    await this.driver.execute(
      `UPDATE version_lifecycle
       SET status = ?, released_at = ?
       WHERE prefix = ? AND version_id = ?`,
      ["released", new Date().toISOString(), prefix, versionId],
    );
  }

  async activate(prefix: string, versionId: string): Promise<void> {
    const record = await this.mustGet(prefix, versionId);
    if (record.status !== "released") {
      throw new Error(`Cannot activate: version ${versionId} is "${record.status}", expected "released"`);
    }

    await this.driver.transaction(async (tx) => {
      await tx.execute(
        `UPDATE version_lifecycle
         SET status = ?
         WHERE prefix = ? AND status = ?`,
        ["released", prefix, "active"],
      );
      await tx.execute(
        `UPDATE version_lifecycle
         SET status = ?
         WHERE prefix = ? AND version_id = ?`,
        ["active", prefix, versionId],
      );
    });
  }

  async deprecate(prefix: string, versionId: string): Promise<void> {
    const record = await this.mustGet(prefix, versionId);
    if (record.status === "draft") {
      throw new Error("Cannot deprecate a draft version");
    }

    await this.driver.execute(
      `UPDATE version_lifecycle
       SET status = ?
       WHERE prefix = ? AND version_id = ?`,
      ["deprecated", prefix, versionId],
    );
  }

  async getActive(prefix: string): Promise<VersionRecord | null> {
    const row = await this.driver.queryOne<VersionLifecycleRow>(
      `SELECT prefix, version_id, status, base_version_id, capacity, deactivation_mode, created_at, released_at
       FROM version_lifecycle
       WHERE prefix = ? AND status = ?
       ORDER BY created_at ASC
       LIMIT 1`,
      [prefix, "active"],
    );
    return row ? toRecord(row) : null;
  }

  async getVersion(prefix: string, versionId: string): Promise<VersionRecord | null> {
    const row = await this.driver.queryOne<VersionLifecycleRow>(
      `SELECT prefix, version_id, status, base_version_id, capacity, deactivation_mode, created_at, released_at
       FROM version_lifecycle
       WHERE prefix = ? AND version_id = ?`,
      [prefix, versionId],
    );
    return row ? toRecord(row) : null;
  }

  async getVersions(prefix: string, status?: VersionStatus): Promise<VersionRecord[]> {
    const rows = status
      ? await this.driver.query<VersionLifecycleRow>(
          `SELECT prefix, version_id, status, base_version_id, capacity, deactivation_mode, created_at, released_at
           FROM version_lifecycle
           WHERE prefix = ? AND status = ?
           ORDER BY created_at ASC`,
          [prefix, status],
        )
      : await this.driver.query<VersionLifecycleRow>(
          `SELECT prefix, version_id, status, base_version_id, capacity, deactivation_mode, created_at, released_at
           FROM version_lifecycle
           WHERE prefix = ?
           ORDER BY created_at ASC`,
          [prefix],
        );

    return rows.map(toRecord);
  }

  private async resolveDeactivationMode(
    prefix: string,
    baseVersionId: string | null,
    deactivationMode?: DeactivationMode,
  ): Promise<DeactivationMode> {
    if (deactivationMode) {
      return deactivationMode;
    }
    if (!baseVersionId) {
      return "strict";
    }
    const base = await this.getVersion(prefix, baseVersionId);
    return base?.deactivationMode ?? "strict";
  }

  private async mustGet(prefix: string, versionId: string): Promise<VersionRecord> {
    const record = await this.getVersion(prefix, versionId);
    if (!record) {
      throw new Error(`Version ${versionId} not found for prefix "${prefix}"`);
    }
    return record;
  }
}

function toRecord(row: VersionLifecycleRow): VersionRecord {
  return {
    prefix: row.prefix,
    versionId: row.version_id,
    status: row.status as VersionStatus,
    baseVersionId: row.base_version_id,
    capacity: row.capacity,
    deactivationMode: row.deactivation_mode as DeactivationMode,
    createdAt: row.created_at,
    releasedAt: row.released_at,
  };
}
