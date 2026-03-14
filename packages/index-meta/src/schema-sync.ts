/**
 * schema-sync — compileSchema 결과를 PrefixRegistry에 동기화
 *
 * compileSchema()가 계산한 CompiledSchema를 PrefixRegistry에 등록한다.
 * TableDef의 DAG 구조(composite refs)가 PrefixRegistryRecord.refs로 영속화된다.
 *
 * 이후 "perm:v1:1345" 같은 SemanticAddress를 PrefixRegistry만으로
 * 완전히 복원할 수 있게 된다.
 */

import type { CompiledSchema } from "./compile-schema.js";
import type { PrefixRegistry, PrefixRegistryRecord, DimRef } from "./prefix-registry.js";

/**
 * CompiledSchema → PrefixRegistry 일괄 등록.
 *
 * - leaf:      { prefix, versionId, capacity } 만 등록.
 * - composite: { prefix, versionId, capacity, refs } 등록.
 *              refs = 각 dim의 { prefix, versionId, capacity }.
 *
 * 이미 등록된 (prefix, versionId)는 건너뛴다 (idempotent).
 */
export async function syncSchemaToRegistry(
  schema: CompiledSchema,
  registry: PrefixRegistry
): Promise<void> {
  for (const table of schema.tables) {
    for (const [, version] of table.versions) {
      const existing = await registry.getCapacity(table.id, version.versionId);
      if (existing !== null) continue; // 이미 등록됨

      const record: PrefixRegistryRecord =
        table.kind === "leaf"
          ? {
              prefix:    table.id,
              versionId: version.versionId,
              capacity:  version.capacity,
            }
          : {
              prefix:    table.id,
              versionId: version.versionId,
              capacity:  version.capacity,
              refs: (version as import("./compile-schema.js").CompositeVersionSpec).dims.map(
                (dim): DimRef => ({
                  prefix:    dim.ref.prefix,
                  versionId: dim.ref.version,
                  capacity:  dim.ref.capacity,
                })
              ),
            };

      await registry.register(record);
    }
  }
}
