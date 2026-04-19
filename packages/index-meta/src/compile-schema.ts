// @def.boundary index-meta-system
// @def.doc index-meta-system

import { ValidationError } from "./errors.js";
import { type TableDef } from "./table-def.js";

// ── Output 타입 ───────────────────────────────────────────

export interface LeafVersionSpec {
  readonly versionId: string;
  readonly capacity: number;
}

export interface CompositeVersionDim {
  readonly dimId: string;
  readonly ref: {
    readonly prefix: string;
    readonly version: string;
    readonly capacity: number;
  };
}

export interface CompositeVersionSpec {
  readonly versionId: string;
  /** 모든 dim capacity의 곱 — 자동 계산 */
  readonly capacity: number;
  readonly dims: readonly CompositeVersionDim[];
}

export interface LeafTableSpec {
  readonly kind: "leaf";
  readonly id: string;
  readonly entryKind: { type: "string_enum" } | { type: "number_enum" };
  readonly versions: ReadonlyMap<string, LeafVersionSpec>;
  readonly description?: string;
}

export interface CompositeTableSpec {
  readonly kind: "composite";
  readonly id: string;
  readonly versions: ReadonlyMap<string, CompositeVersionSpec>;
  readonly description?: string;
}

export type TableSpec = LeafTableSpec | CompositeTableSpec;

// ── Diff 타입 ─────────────────────────────────────────────

export interface VersionCapacityChange {
  readonly versionId: string;
  readonly capacity: number;
  readonly previousCapacity?: number;
}

export interface TableVersionChange {
  readonly tableId: string;
  readonly addedVersions: readonly VersionCapacityChange[];
  readonly removedVersions: readonly string[];
}

export interface SchemaDiff {
  readonly added: readonly TableSpec[];
  readonly removed: readonly string[];
  readonly changed: readonly TableVersionChange[];
}

// ── CompiledSchema ────────────────────────────────────────

export interface CompiledSchema {
  readonly tables: readonly TableSpec[];
  getTable(id: string): TableSpec | undefined;
  diff(from: CompiledSchema): SchemaDiff;
}

// ── Implementation ────────────────────────────────────────

class CompiledSchemaImpl implements CompiledSchema {
  private readonly _map: ReadonlyMap<string, TableSpec>;

  constructor(readonly tables: readonly TableSpec[]) {
    this._map = new Map(tables.map((t) => [t.id, t]));
  }

  getTable(id: string): TableSpec | undefined {
    return this._map.get(id);
  }

  diff(from: CompiledSchema): SchemaDiff {
    const fromMap = new Map(from.tables.map((t) => [t.id, t]));
    const added: TableSpec[] = [];
    const removed: string[] = [];
    const changed: TableVersionChange[] = [];

    for (const [id, toSpec] of this._map) {
      if (!fromMap.has(id)) {
        added.push(toSpec);
      } else {
        // eslint-disable-next-line typescript/no-non-null-assertion -- fromMap.has(id) 확인 후 접근
        const change = diffVersions(id, fromMap.get(id)!, toSpec);
        if (change) changed.push(change);
      }
    }

    for (const id of fromMap.keys()) {
      if (!this._map.has(id)) removed.push(id);
    }

    return { added, removed, changed };
  }
}

function diffVersions(
  tableId: string,
  from: TableSpec,
  to: TableSpec
): TableVersionChange | null {
  const fromVersions = from.versions as ReadonlyMap<string, { capacity: number }>;
  const toVersions = to.versions as ReadonlyMap<string, { capacity: number }>;

  const addedVersions: VersionCapacityChange[] = [];
  const removedVersions: string[] = [];

  for (const [versionId, toV] of toVersions) {
    const fromV = fromVersions.get(versionId);
    if (!fromV) {
      addedVersions.push({ versionId, capacity: toV.capacity });
    } else if (fromV.capacity !== toV.capacity) {
      addedVersions.push({
        versionId,
        capacity: toV.capacity,
        previousCapacity: fromV.capacity,
      });
    }
  }

  for (const versionId of fromVersions.keys()) {
    if (!toVersions.has(versionId)) removedVersions.push(versionId);
  }

  if (addedVersions.length === 0 && removedVersions.length === 0) return null;
  return { tableId, addedVersions, removedVersions };
}

// ── compileSchema ─────────────────────────────────────────

export function compileSchema(defs: TableDef[]): CompiledSchema {
  const allDefs = collectAllDefs(defs);
  const sorted = topologicalSort(allDefs);
  const specMap = new Map<string, TableSpec>();

  for (const def of sorted) {
    if (def.source) {
      // leaf
      const versions = new Map<string, LeafVersionSpec>();
      for (const [versionId, v] of Object.entries(def.versions)) {
        const lv = v as { capacity: number };
        versions.set(versionId, { versionId, capacity: lv.capacity });
      }
      specMap.set(def.id, {
        kind: "leaf",
        id: def.id,
        entryKind: def.source.kind,
        versions,
        description: def.description,
      });
    } else {
      // composite
      const versions = new Map<string, CompositeVersionSpec>();
      for (const [versionId, v] of Object.entries(def.versions)) {
        const cv = v as { refs: Record<string, { prefix: string; version: string }> };
        const dims: CompositeVersionDim[] = [];
        let capacity = 1;

        // eslint-disable-next-line typescript/no-non-null-assertion -- composite(source 없음)는 반드시 dims 보유
        for (const dimDef of def.dims!) {
          const ref = cv.refs[dimDef.id];
          const refSpec = specMap.get(ref.prefix);
          if (!refSpec)
            throw new ValidationError(
              `Table "${def.id}" version "${versionId}": referenced table "${ref.prefix}" not found`
            );

          const refVersion = refSpec.versions.get(ref.version);
          if (!refVersion)
            throw new ValidationError(
              `Table "${def.id}" version "${versionId}": version "${ref.version}" not found in table "${ref.prefix}"`
            );

          dims.push({
            dimId: dimDef.id,
            ref: { prefix: ref.prefix, version: ref.version, capacity: refVersion.capacity },
          });
          capacity *= refVersion.capacity;
        }

        versions.set(versionId, { versionId, capacity, dims });
      }
      specMap.set(def.id, {
        kind: "composite",
        id: def.id,
        versions,
        description: def.description,
      });
    }
  }

  return new CompiledSchemaImpl([...specMap.values()]);
}

// ── 내부 헬퍼 ─────────────────────────────────────────────

function collectAllDefs(defs: TableDef[]): Map<string, TableDef> {
  const result = new Map<string, TableDef>();

  function visit(def: TableDef): void {
    if (result.has(def.id)) {
      if (result.get(def.id) !== def)
        throw new ValidationError(`Duplicate table id: "${def.id}"`);
      return;
    }
    result.set(def.id, def);
    for (const dim of def.dims ?? []) visit(dim);
  }

  for (const def of defs) visit(def);
  return result;
}

function topologicalSort(defs: Map<string, TableDef>): TableDef[] {
  const result: TableDef[] = [];
  const visited = new Set<string>();
  const visiting = new Set<string>();

  function visit(def: TableDef): void {
    if (visited.has(def.id)) return;
    if (visiting.has(def.id))
      throw new ValidationError(`Circular dependency detected involving "${def.id}"`);

    visiting.add(def.id);
    for (const dim of def.dims ?? []) {
      const dimDef = defs.get(dim.id);
      if (dimDef) visit(dimDef);
    }
    visiting.delete(def.id);
    visited.add(def.id);
    result.push(def);
  }

  for (const def of defs.values()) visit(def);
  return result;
}
