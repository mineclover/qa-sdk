// @def.doc definition-service

/**
 * Aspect Parents Sync — Phase C-0/C-1 (aspect-schema-hierarchy RFC)
 *
 * Source of truth: definition-catalog/src/vocabulary.ts §ASPECT_PARENTS (build-time).
 * 본 모듈은 map 을 읽어 `aspect_parents` 테이블에 idempotent upsert 한다.
 *
 * 호출 시점:
 * - 초기 migration 직후 (부팅 시 1 회)
 * - `def sync` / POST /sync 실행 시 (self-heal, insert-on-discovery)
 *
 * Drift 규칙:
 * - map 에 있는데 DB 에 없음 → INSERT (자가 치유)
 * - map 에 있고 DB 에도 있는데 parent_id 가 다름 → UPDATE (map 이 SSOT)
 * - DB 에 있는데 map 에 없음 → orphan 로그만 남기고 삭제 금지 (수동 검토)
 */

import { ASPECT_PARENTS, DEFINITION_TAXONOMY } from "definition-catalog";
import { eq } from "drizzle-orm";
import type { DefinitionServiceDatabase } from "../database.module.js";
import { aspectParents } from "../db/schema.js";

export interface AspectParentSyncReport {
  readonly inserted: number;
  readonly updated: number;
  readonly unchanged: number;
  readonly driftOrphans: readonly string[];
}

/**
 * aspect_parents 테이블을 ASPECT_PARENTS map 과 동기화한다.
 * Idempotent: 같은 입력 반복 호출 시 동일 결과.
 */
export function syncAspectParents(
  db: DefinitionServiceDatabase,
): AspectParentSyncReport {
  const descriptionByAspect = buildDescriptionMap();
  const mapEntries = Object.entries(ASPECT_PARENTS);

  const dbRows = db.select().from(aspectParents).all();
  const rowByChild = new Map(dbRows.map((row) => [row.childId, row] as const));

  let inserted = 0;
  let updated = 0;
  let unchanged = 0;

  for (const [child, parent] of mapEntries) {
    const existing = rowByChild.get(child);
    const description = descriptionByAspect.get(child) ?? null;

    if (!existing) {
      db.insert(aspectParents)
        .values({ childId: child, parentId: parent, description })
        .run();
      inserted++;
      continue;
    }

    if (existing.parentId !== parent || existing.description !== description) {
      db.update(aspectParents)
        .set({ parentId: parent, description })
        .where(eq(aspectParents.childId, child))
        .run();
      updated++;
      continue;
    }

    unchanged++;
  }

  const mapChildren = new Set(mapEntries.map(([c]) => c));
  const driftOrphans = dbRows
    .filter((row) => !mapChildren.has(row.childId))
    .map((row) => row.childId);

  return { inserted, updated, unchanged, driftOrphans };
}

/** `DEFINITION_TAXONOMY` 를 평탄화해 aspect id → description 으로 매핑. */
function buildDescriptionMap(): Map<string, string> {
  const result = new Map<string, string>();
  for (const scope of DEFINITION_TAXONOMY.scopes) {
    for (const aspect of scope.aspects) {
      result.set(aspect.id, aspect.description);
    }
  }
  return result;
}
