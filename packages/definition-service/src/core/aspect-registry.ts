// @def.doc definition-service

/**
 * AspectRegistry — Phase C-1 bridge (aspect-schema-hierarchy RFC)
 *
 * 부모 조회 경로의 DB-우선 helper. catalog 패키지의 `deriveAspectParent()` 는
 * 그대로 두고, service 측에서 본 bridge 를 통해 DB → runtime map 순으로 조회한다.
 *
 * Fail-open:
 *   - DB 미존재 / 테이블 없음 / 빈 상태 → runtime map fallback
 *   - DB 쿼리 예외 → 경고 로그 후 runtime map fallback
 *
 * Catalog 패키지 순수성 유지 (의존 방향: service → catalog, 역방향 금지).
 */

import {
  ASPECT_PARENTS,
  deriveAspectParent,
  getAspectFamily as getAspectFamilyFromMap,
} from "definition-catalog";
import { eq } from "drizzle-orm";
import type { DefinitionServiceDatabase } from "../database.module.js";
import { aspectParents } from "../db/schema.js";
import { createLogger } from "../lib/logger.js";

const logger = createLogger("definition-service");

/** 부모 조회 + 자식 조회 + family 조회 helper */
export interface AspectRegistry {
  /**
   * 자식 aspect id 로 부모 id 를 조회.
   * DB 에 row 가 있으면 해당 parent_id, 없으면 runtime `deriveAspectParent()` 로 폴백.
   */
  getAspectParent(childId: string): string | null;

  /** 부모 aspect id 로 자식 목록을 조회. */
  getChildrenOf(parentId: string): string[];

  /**
   * aspect 와 모든 후손 (BFS) 을 반환. 입력 aspect 가 결과의 첫 원소.
   * 자식이 없는 aspect 는 `[aspect]` 단독을 반환한다 (2-level 전제, RFC 00-design Q5).
   *
   * DB 우선 (aspect_parents 반복 조회) → runtime map fallback. 정렬은 알파벳 오름차순으로
   * 안정적 결정론을 보장한다. cycle 방어는 visited set 으로 수행.
   *
   * Phase C-2 — CLI `--include-children`, `--rollup-aspect` 의 기반 API.
   */
  getAspectFamily(aspect: string): string[];
}

/**
 * Service 측 bridge 를 생성한다.
 * `db` 가 전달되면 DB 우선, 없으면 runtime map 으로만 응답한다 (pure fallback 모드).
 */
export function createAspectRegistry(
  db?: DefinitionServiceDatabase,
): AspectRegistry {
  return {
    getAspectParent(childId: string): string | null {
      if (!db) return deriveAspectParent(childId);

      try {
        const row = db
          .select()
          .from(aspectParents)
          .where(eq(aspectParents.childId, childId))
          .get();
        if (row) return row.parentId;
      } catch (err) {
        logger.warn(
          { err, childId },
          "aspect_parents 조회 실패 — runtime map fallback 적용",
        );
      }
      return deriveAspectParent(childId);
    },

    getChildrenOf(parentId: string): string[] {
      if (!db) return childrenFromRuntimeMap(parentId);

      try {
        const rows = db
          .select()
          .from(aspectParents)
          .where(eq(aspectParents.parentId, parentId))
          .all();
        if (rows.length > 0) {
          return rows.map((row) => row.childId).toSorted((a, b) => a.localeCompare(b));
        }
      } catch (err) {
        logger.warn(
          { err, parentId },
          "aspect_parents children 조회 실패 — runtime map fallback 적용",
        );
      }
      return childrenFromRuntimeMap(parentId);
    },

    getAspectFamily(aspect: string): string[] {
      if (!db) return getAspectFamilyFromMap(aspect);

      // DB 우선 BFS — getChildrenOf 는 이미 DB → runtime map fallback 을 내장하므로
      // 본 method 는 단순히 그걸 반복 호출하면 된다. visited set 으로 cycle 방어.
      const visited = new Set<string>([aspect]);
      const family: string[] = [aspect];
      const queue: string[] = [aspect];
      try {
        while (queue.length > 0) {
          const current = queue.shift()!;
          const rows = db
            .select()
            .from(aspectParents)
            .where(eq(aspectParents.parentId, current))
            .all();
          const children =
            rows.length > 0
              ? rows.map((row) => row.childId).toSorted((a, b) => a.localeCompare(b))
              : childrenFromRuntimeMap(current);
          for (const child of children) {
            if (visited.has(child)) continue;
            visited.add(child);
            family.push(child);
            queue.push(child);
          }
        }
      } catch (err) {
        logger.warn(
          { err, aspect },
          "aspect_parents family BFS 실패 — runtime map fallback 적용",
        );
        return getAspectFamilyFromMap(aspect);
      }
      return family;
    },
  };
}

function childrenFromRuntimeMap(parentId: string): string[] {
  return Object.entries(ASPECT_PARENTS)
    .filter(([, parent]) => parent === parentId)
    .map(([child]) => child)
    .toSorted((a, b) => a.localeCompare(b));
}
