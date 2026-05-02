// @def.doc definition-catalog-spec

/**
 * aspect family BFS helper 테스트 (Phase C-2, aspect-schema-hierarchy RFC).
 *
 * - getAspectChildren: 부모 → 직속 자식 (sorted, 역 inversion)
 * - getAspectFamily:  aspect → [self, ...descendants] BFS (deterministic, cycle-safe)
 */

import { describe, expect, it } from "vitest";
import {
  ASPECT_PARENTS,
  deriveAspectParent,
  getAspectChildren,
  getAspectFamily,
} from "./vocabulary.js";

describe("getAspectChildren", () => {
  it("func_def 는 ASPECT_PARENTS 에 등록된 모든 자식을 반환", () => {
    const children = getAspectChildren("func_def");
    const expected = Object.entries(ASPECT_PARENTS)
      .filter(([, parent]) => parent === "func_def")
      .map(([child]) => child)
      .toSorted((a, b) => a.localeCompare(b));
    expect(children).toEqual(expected);
    expect(children.length).toBeGreaterThan(0);
  });

  it("leaf aspect (codegen_func) 는 자식이 없으므로 빈 배열", () => {
    expect(getAspectChildren("codegen_func")).toEqual([]);
  });

  it("미등록 aspect 는 빈 배열", () => {
    expect(getAspectChildren("__unknown_aspect__")).toEqual([]);
  });

  it("결과는 알파벳 오름차순 정렬 (결정론)", () => {
    const children = getAspectChildren("func_def");
    const sorted = [...children].toSorted((a, b) => a.localeCompare(b));
    expect(children).toEqual(sorted);
  });
});

describe("getAspectFamily", () => {
  it("부모 aspect — [self, ...sorted children] BFS 순서", () => {
    const family = getAspectFamily("func_def");
    expect(family[0]).toBe("func_def"); // self first
    expect(family.length).toBeGreaterThan(1);

    // 후손은 모두 부모 체인 상 func_def 로 수렴한다
    for (const aspect of family.slice(1)) {
      let current: string | null = aspect;
      let resolved: string | null = null;
      const visited = new Set<string>();
      while (current && !visited.has(current)) {
        visited.add(current);
        const parent = deriveAspectParent(current);
        if (!parent) {
          resolved = current;
          break;
        }
        current = parent;
      }
      expect(resolved).toBe("func_def");
    }
  });

  it("leaf aspect (codegen_func) — 자기 자신만 단독 반환", () => {
    expect(getAspectFamily("codegen_func")).toEqual(["codegen_func"]);
  });

  it("미등록 aspect — 자기 자신만 단독 반환 (신규 aspect 수용)", () => {
    expect(getAspectFamily("__unknown_aspect__")).toEqual(["__unknown_aspect__"]);
  });

  it("중복 제거 — visited set 으로 가상의 cycle 도 방어", () => {
    // ASPECT_PARENTS 에 cycle 은 없지만, 결과에 중복이 절대 없어야 함.
    const family = getAspectFamily("func_def");
    const unique = new Set(family);
    expect(unique.size).toBe(family.length);
  });

  it("process_flow — 2-level tree 상 부모 + 5+ 자식 반환", () => {
    const family = getAspectFamily("process_flow");
    expect(family[0]).toBe("process_flow");
    // process_flow 의 자식들은 ASPECT_PARENTS 에서 parent="process_flow" 인 모든 항목
    const expectedChildren = Object.entries(ASPECT_PARENTS)
      .filter(([, parent]) => parent === "process_flow")
      .map(([child]) => child);
    for (const child of expectedChildren) {
      expect(family).toContain(child);
    }
    expect(family.length).toBe(1 + expectedChildren.length);
  });

  it("family 순서는 deterministic — 여러 번 호출해도 동일", () => {
    const a = getAspectFamily("func_def");
    const b = getAspectFamily("func_def");
    expect(a).toEqual(b);
  });
});
