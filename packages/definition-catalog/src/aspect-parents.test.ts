// @def.doc definition-catalog-spec

/**
 * ASPECT_PARENTS + ROOT_ASPECTS 완결성 불변식 테스트 (Phase C-3, aspect-schema-hierarchy RFC).
 *
 * silent drift 방어 — 신규 aspect 가 `DEF_ASPECT.entries` 에만 추가되고
 * `ASPECT_PARENTS` 또는 `ROOT_ASPECTS` 중 어디에도 등록되지 않으면 `getAspectFamily`
 * 가 불완전한 결과를 반환하는 문제 (Phase C 리뷰에서 식별) 를 CI 단에서 차단한다.
 *
 * 4 경로 검증:
 *   1. 모든 aspect 는 ROOT_ASPECTS 또는 ASPECT_PARENTS 에 존재
 *   2. 같은 aspect 가 양쪽에 동시 존재 금지
 *   3. ASPECT_PARENTS 의 parent 값은 DEF_ASPECT.entries 내 존재
 *   4. ROOT_ASPECTS 원소는 DEF_ASPECT.entries 내 존재
 *   5. ASPECT_PARENTS 내 cycle 금지
 */

import { describe, expect, it } from "vitest";
import {
  ASPECT_PARENTS,
  DEF_ASPECT,
  ROOT_ASPECTS,
} from "./vocabulary.js";

describe("ASPECT_PARENTS 완결성 불변식", () => {
  it("모든 aspect 는 ROOT_ASPECTS 또는 ASPECT_PARENTS 중 정확히 하나에 속함", () => {
    for (const aspect of DEF_ASPECT.entries) {
      const isRoot = ROOT_ASPECTS.has(aspect);
      const hasParent = aspect in ASPECT_PARENTS;

      if (!isRoot && !hasParent) {
        throw new Error(
          `Aspect "${aspect}" 는 ROOT_ASPECTS 에도 없고 ASPECT_PARENTS 에도 없다. ` +
            `둘 중 하나에 등록하라 (aspect-naming-convention.rule.md §2.2 참조).`,
        );
      }
      if (isRoot && hasParent) {
        throw new Error(
          `Aspect "${aspect}" 가 ROOT_ASPECTS 와 ASPECT_PARENTS 양쪽에 모두 등록됨. ` +
            `하나만 선택하라.`,
        );
      }
    }
  });

  it("ASPECT_PARENTS 의 모든 parent 는 DEF_ASPECT.entries 에 존재", () => {
    const entries = new Set<string>(DEF_ASPECT.entries);
    for (const [child, parent] of Object.entries(ASPECT_PARENTS)) {
      if (!entries.has(parent)) {
        throw new Error(
          `"${child}" 의 parent "${parent}" 가 DEF_ASPECT.entries 에 존재하지 않음`,
        );
      }
    }
  });

  it("ROOT_ASPECTS 의 모든 원소는 DEF_ASPECT.entries 에 존재", () => {
    const entries = new Set<string>(DEF_ASPECT.entries);
    for (const root of ROOT_ASPECTS) {
      if (!entries.has(root)) {
        throw new Error(
          `ROOT_ASPECTS 의 "${root}" 가 DEF_ASPECT.entries 에 존재하지 않음`,
        );
      }
    }
  });

  it("ASPECT_PARENTS 내 cycle 없음", () => {
    for (const startChild of Object.keys(ASPECT_PARENTS)) {
      const visited = new Set<string>();
      let current: string | undefined = startChild;
      while (current !== undefined && current in ASPECT_PARENTS) {
        if (visited.has(current)) {
          throw new Error(
            `"${startChild}" 로부터 시작하는 부모 체인에서 cycle 감지됨 (경유: ${[...visited].join(" → ")})`,
          );
        }
        visited.add(current);
        current = ASPECT_PARENTS[current];
      }
    }
  });

  it("|ROOT_ASPECTS| + |ASPECT_PARENTS| == |DEF_ASPECT.entries| (delta 등식)", () => {
    // aspect-naming-convention.rule.md §2.2 의 검증 등식.
    // 완결성 불변식이 유지되면 자동으로 성립하지만 빠른 요약 정수 체크로 유지한다.
    const rootCount = ROOT_ASPECTS.size;
    const parentCount = Object.keys(ASPECT_PARENTS).length;
    const entriesCount = DEF_ASPECT.entries.length;
    expect(rootCount + parentCount).toBe(entriesCount);
  });
});
