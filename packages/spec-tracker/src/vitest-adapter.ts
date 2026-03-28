/**
 * Vitest 어댑터 — spec(specId) 헬퍼로 테스트↔문서 연결.
 *
 * 사용법:
 *   import { spec } from "spec-tracker";
 *   const s = spec("registry-api");
 *   s.describe("POST /prefixes", () => {
 *     s.it("prefix를 등록한다", () => { ... });
 *   });
 */
import { SpecCollector } from "./collector.js";
import type { ContractMarkerKind } from "./types.js";

/** 글로벌 수집기 — 프로세스당 1개 */
const globalCollector = new SpecCollector();

export function getGlobalCollector(): SpecCollector {
  return globalCollector;
}

export interface SpecHelper {
  /** specId가 연결된 describe */
  readonly describe: (name: string, fn: () => void) => void;
  /** specId가 연결된 it */
  readonly it: (name: string, fn: () => void | Promise<void>) => void;
  /** 마커 지정 it */
  readonly marker: (marker: ContractMarkerKind) => {
    readonly it: (name: string, fn: () => void | Promise<void>) => void;
  };
}

/**
 * specId에 연결된 테스트 헬퍼를 반환한다.
 *
 * vitest의 describe/it을 래핑하여 실행 결과를 자동으로 ContractEvidence로 수집한다.
 * 커스텀 collector를 주입하면 테스트용으로 사용 가능.
 */
export function spec(specId: string, collector?: SpecCollector): SpecHelper {
  const col = collector ?? globalCollector;

  function wrapIt(marker?: ContractMarkerKind) {
    return (name: string, fn: () => void | Promise<void>) => {
      // vitest 런타임이 없어도 동작하도록 직접 실행
      const start = Date.now();
      try {
        const result = fn();
        if (result instanceof Promise) {
          result
            .then(() => {
              col.record({ specId, status: "pass", marker, testName: name, duration: Date.now() - start });
            })
            .catch((err) => {
              col.record({ specId, status: "fail", marker, testName: name, duration: Date.now() - start, error: String(err) });
            });
        } else {
          col.record({ specId, status: "pass", marker, testName: name, duration: Date.now() - start });
        }
      } catch (err) {
        col.record({ specId, status: "fail", marker, testName: name, duration: Date.now() - start, error: String(err) });
      }
    };
  }

  return {
    describe(name: string, fn: () => void) {
      fn();
    },
    it: wrapIt(),
    marker(marker: ContractMarkerKind) {
      return { it: wrapIt(marker) };
    },
  };
}
