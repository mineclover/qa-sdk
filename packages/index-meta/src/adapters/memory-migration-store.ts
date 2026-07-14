// @def.boundary index-meta-system
// @def.doc index-meta-system

import type {
  MigrationStore,
  MigrationMapping,
  MigrationResolveResult,
} from '../migration-store.js';
import type { EntityId } from '../types.js';

interface StoredMigrationMapping {
  readonly prefix: string;
  readonly mapping: MigrationMapping;
}

interface MigrationEdge {
  readonly fromVersionId: string;
  readonly toVersionId: string;
  readonly firstCreatedAt: string;
}

export class InMemoryMigrationStore implements MigrationStore {
  private readonly _mappings: StoredMigrationMapping[] = [];

  async saveMappings(prefix: string, mappings: readonly MigrationMapping[]): Promise<void> {
    if (mappings.length === 0) return;

    // 중복 방지: (prefix, fromVersionId, toVersionId, position) 기준
    for (const m of mappings) {
      const exists = this._mappings.some(
        (e) =>
          e.prefix === prefix &&
          e.mapping.fromVersionId === m.fromVersionId &&
          e.mapping.toVersionId === m.toVersionId &&
          e.mapping.position === m.position,
      );
      if (exists) {
        throw new Error(
          `Duplicate mapping: ${prefix} ${m.fromVersionId}→${m.toVersionId} position ${m.position}`,
        );
      }
      this._mappings.push({ prefix, mapping: m });
    }
  }

  async getHistory(prefix: string, position: number): Promise<MigrationMapping[]> {
    return this._mappings
      .filter((entry) => entry.prefix === prefix && entry.mapping.position === position)
      .map((entry) => entry.mapping)
      .toSorted((a, b) => compareHistory(a, b));
  }

  async getMappings(
    prefix: string,
    fromVersionId: string,
    toVersionId: string,
  ): Promise<MigrationMapping[]> {
    return this._mappings
      .filter(
        (entry) =>
          entry.prefix === prefix &&
          entry.mapping.fromVersionId === fromVersionId &&
          entry.mapping.toVersionId === toVersionId,
      )
      .map((entry) => entry.mapping)
      .toSorted((a, b) => a.position - b.position);
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

    const path = this.findPath(prefix, fromVersionId, latestVersionId);
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
      const currentVersionId = path[index];
      const toVersionId = path[index + 1];
      const mapping = this._mappings.find(
        (entry) =>
          entry.prefix === prefix &&
          entry.mapping.fromVersionId === currentVersionId &&
          entry.mapping.toVersionId === toVersionId &&
          entry.mapping.position === position,
      )?.mapping;

      if (mapping !== undefined) {
        chain.push(mapping);
        if (mapping.changeType === 'deactivated') {
          currentEntityId = null;
          return {
            currentVersionId: toVersionId,
            currentEntityId,
            chain,
          };
        }
        currentEntityId = mapping.newEntityId;
        foundChange = true;
      }
    }

    return {
      currentVersionId: latestVersionId,
      currentEntityId: foundChange ? currentEntityId : null,
      chain,
    };
  }

  private findPath(
    prefix: string,
    fromVersionId: string,
    latestVersionId: string,
  ): string[] | null {
    const edges = this.getEdges(prefix);
    const adjacency = new Map<string, MigrationEdge[]>();

    for (const edge of edges) {
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

  private getEdges(prefix: string): MigrationEdge[] {
    const edgeMap = new Map<string, MigrationEdge>();

    for (const entry of this._mappings) {
      if (entry.prefix !== prefix) continue;
      const key = `${entry.mapping.fromVersionId}\0${entry.mapping.toVersionId}`;
      const existing = edgeMap.get(key);
      if (!existing || entry.mapping.createdAt < existing.firstCreatedAt) {
        edgeMap.set(key, {
          fromVersionId: entry.mapping.fromVersionId,
          toVersionId: entry.mapping.toVersionId,
          firstCreatedAt: entry.mapping.createdAt,
        });
      }
    }

    return [...edgeMap.values()].toSorted(
      (a, b) =>
        a.firstCreatedAt.localeCompare(b.firstCreatedAt) ||
        a.fromVersionId.localeCompare(b.fromVersionId) ||
        a.toVersionId.localeCompare(b.toVersionId),
    );
  }
}

function compareHistory(a: MigrationMapping, b: MigrationMapping): number {
  return (
    a.createdAt.localeCompare(b.createdAt) ||
    a.fromVersionId.localeCompare(b.fromVersionId) ||
    a.toVersionId.localeCompare(b.toVersionId)
  );
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
