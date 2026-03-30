/**
 * SqlMigrationStore — MigrationStore의 SQL 구현
 *
 * migration_mapping 테이블을 SqlDriver로 읽고 쓴다.
 * sql/schema.sql이 먼저 적용된 DB가 필요하다.
 */

import type {
  MigrationStore,
  MigrationMapping,
  MigrationResolveResult,
} from "../migration-store.js";
import type { EntityId } from "../types.js";
import type { SqlDriver } from "./sql-store.js";

interface MigrationMappingRow extends Record<string, unknown> {
  prefix: string;
  from_version_id: string;
  to_version_id: string;
  position: number;
  change_type: string;
  old_entity_id: string | null;
  new_entity_id: string | null;
  created_at: string;
}

interface MigrationEdgeRow extends Record<string, unknown> {
  from_version_id: string;
  to_version_id: string;
  first_created_at: string;
}

interface MigrationEdge {
  readonly fromVersionId: string;
  readonly toVersionId: string;
  readonly firstCreatedAt: string;
}

export class SqlMigrationStore implements MigrationStore {
  constructor(private readonly driver: SqlDriver) {}

  async saveMappings(prefix: string, mappings: readonly MigrationMapping[]): Promise<void> {
    if (mappings.length === 0) return;

    const paramsList = mappings.map((mapping) => [
      prefix,
      mapping.fromVersionId,
      mapping.toVersionId,
      mapping.position,
      mapping.changeType,
      mapping.oldEntityId,
      mapping.newEntityId,
      mapping.createdAt,
    ]);

    await this.driver.batchExecute(
      `INSERT INTO migration_mapping
         (prefix, from_version_id, to_version_id, position, change_type, old_entity_id, new_entity_id, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      paramsList,
    );
  }

  async getHistory(prefix: string, position: number): Promise<MigrationMapping[]> {
    const rows = await this.driver.query<MigrationMappingRow>(
      `SELECT prefix, from_version_id, to_version_id, position, change_type, old_entity_id, new_entity_id, created_at
       FROM migration_mapping
       WHERE prefix = ? AND position = ?
       ORDER BY created_at ASC, from_version_id ASC, to_version_id ASC`,
      [prefix, position],
    );

    return rows.map(toMapping);
  }

  async getMappings(
    prefix: string,
    fromVersionId: string,
    toVersionId: string,
  ): Promise<MigrationMapping[]> {
    const rows = await this.driver.query<MigrationMappingRow>(
      `SELECT prefix, from_version_id, to_version_id, position, change_type, old_entity_id, new_entity_id, created_at
       FROM migration_mapping
       WHERE prefix = ? AND from_version_id = ? AND to_version_id = ?
       ORDER BY position ASC`,
      [prefix, fromVersionId, toVersionId],
    );

    return rows.map(toMapping);
  }

  async resolveToLatest(
    prefix: string,
    fromVersionId: string,
    position: number,
    latestVersionId: string,
  ): Promise<MigrationResolveResult> {
    if (fromVersionId === latestVersionId) {
      return {
        currentVersionId: fromVersionId,
        currentEntityId: null,
        chain: [],
      };
    }

    const path = await this.findPath(prefix, fromVersionId, latestVersionId);
    if (!path) {
      return {
        currentVersionId: fromVersionId,
        currentEntityId: null,
        chain: [],
      };
    }

    const chain: MigrationMapping[] = [];
    let currentEntityId: EntityId | null = null;
    let foundChange = false;

    for (let index = 0; index < path.length - 1; index++) {
      const currentVersion = path[index];
      const nextVersion = path[index + 1];
      const row = await this.driver.queryOne<MigrationMappingRow>(
        `SELECT prefix, from_version_id, to_version_id, position, change_type, old_entity_id, new_entity_id, created_at
         FROM migration_mapping
         WHERE prefix = ? AND from_version_id = ? AND to_version_id = ? AND position = ?`,
        [prefix, currentVersion, nextVersion, position],
      );

      if (!row) continue;

      const mapping = toMapping(row);
      chain.push(mapping);
      if (mapping.changeType === "deactivated") {
        return {
          currentVersionId: nextVersion,
          currentEntityId: null,
          chain,
        };
      }

      currentEntityId = mapping.newEntityId;
      foundChange = true;
    }

    return {
      currentVersionId: latestVersionId,
      currentEntityId: foundChange ? currentEntityId : null,
      chain,
    };
  }

  private async findPath(
    prefix: string,
    fromVersionId: string,
    latestVersionId: string,
  ): Promise<string[] | null> {
    const rows = await this.driver.query<MigrationEdgeRow>(
      `SELECT from_version_id, to_version_id, MIN(created_at) AS first_created_at
       FROM migration_mapping
       WHERE prefix = ?
       GROUP BY from_version_id, to_version_id
       ORDER BY first_created_at ASC, from_version_id ASC, to_version_id ASC`,
      [prefix],
    );

    const adjacency = new Map<string, MigrationEdge[]>();
    for (const row of rows) {
      const edge: MigrationEdge = {
        fromVersionId: row.from_version_id,
        toVersionId: row.to_version_id,
        firstCreatedAt: row.first_created_at,
      };
      const neighbors = adjacency.get(edge.fromVersionId) ?? [];
      neighbors.push(edge);
      adjacency.set(edge.fromVersionId, neighbors);
    }

    const queue = [fromVersionId];
    const previous = new Map<string, string | null>([[fromVersionId, null]]);

    while (queue.length > 0) {
      // eslint-disable-next-line typescript/no-non-null-assertion -- while 조건이 queue.length > 0 보장
      const current = queue.shift()!;
      for (const edge of adjacency.get(current) ?? []) {
        if (previous.has(edge.toVersionId)) continue;
        previous.set(edge.toVersionId, current);
        if (edge.toVersionId === latestVersionId) {
          return reconstructPath(previous, latestVersionId);
        }
        queue.push(edge.toVersionId);
      }
    }

    return null;
  }
}

function toMapping(row: MigrationMappingRow): MigrationMapping {
  return {
    fromVersionId: row.from_version_id,
    toVersionId: row.to_version_id,
    position: row.position,
    changeType: row.change_type as "modified" | "deactivated",
    oldEntityId: row.old_entity_id as EntityId | null,
    newEntityId: row.new_entity_id as EntityId | null,
    createdAt: row.created_at,
  };
}

function reconstructPath(previous: Map<string, string | null>, target: string): string[] {
  const path: string[] = [];
  let current: string | null = target;

  while (current !== null) {
    path.push(current);
    current = previous.get(current) ?? null;
  }

  return path.toReversed();
}
