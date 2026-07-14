// @def.boundary spec-engine-system
// @def.doc spec-engine-system

/**
 * Vitest 어댑터 — 테스트↔스펙 문서 연결.
 *
 * vitest의 describe/it을 그대로 사용하되, afterEach 훅으로
 * 테스트 결과를 ContractEvidence로 수집한다.
 *
 * 사용법 1 — 파일 단위 연결:
 *   import { linkSpec } from "spec-tracker";
 *   linkSpec("error-handling-convention");
 *   // 이후 일반 vitest describe/it 사용
 *
 * 사용법 2 — 개별 테스트 연결:
 *   import { specIt } from "spec-tracker";
 *   describe("에러 처리", () => {
 *     specIt("error-handling-convention", "AppError를 사용한다", () => { ... });
 *   });
 */
import { SpecCollector } from './collector.js';
import type { ContractMarkerKind } from './types.js';

/** 글로벌 수집기 — 프로세스당 1개 */
const globalCollector = new SpecCollector();

export function getGlobalCollector(): SpecCollector {
  return globalCollector;
}

/**
 * 파일 단위로 specId를 연결한다.
 * 이후 같은 파일의 모든 테스트가 이 specId에 증거를 기록한다.
 */
export function linkSpec(specId: string, collector?: SpecCollector): void {
  const col = collector ?? globalCollector;

  // vitest afterEach 훅이 있으면 자동 수집
  try {
    const g = globalThis as Record<string, unknown>;
    const afterEachFn = g['afterEach'] as ((fn: (ctx: unknown) => void) => void) | undefined;
    if (typeof afterEachFn === 'function') {
      afterEachFn((ctx: unknown) => {
        const c = ctx as {
          task?: { result?: { state?: string }; name?: string };
          file?: { filepath?: string };
        };
        const state = c.task?.result?.state;
        const status =
          state === 'pass'
            ? ('pass' as const)
            : state === 'fail'
              ? ('fail' as const)
              : ('skip' as const);
        col.record({
          specId,
          status,
          testName: c.task?.name ?? 'unknown',
          testFile: c.file?.filepath,
        });
      });
    }
  } catch {
    // vitest 런타임 없으면 무시
  }
}

/**
 * 개별 테스트를 specId에 연결하는 it 래퍼.
 * vitest의 it 대신 사용.
 */
export function specIt(
  specId: string,
  name: string,
  fn: () => void | Promise<void>,
  options?: { marker?: ContractMarkerKind; collector?: SpecCollector },
): void {
  const col = options?.collector ?? globalCollector;
  const marker = options?.marker;

  // vitest it이 있으면 사용
  const g = globalThis as Record<string, unknown>;
  const vitestIt = g['it'] as ((name: string, fn: () => void | Promise<void>) => void) | undefined;
  if (typeof vitestIt === 'function') {
    vitestIt(name, async () => {
      const start = Date.now();
      try {
        await fn();
        col.record({
          specId,
          status: 'pass',
          marker,
          testName: name,
          duration: Date.now() - start,
        });
      } catch (err) {
        col.record({
          specId,
          status: 'fail',
          marker,
          testName: name,
          duration: Date.now() - start,
          error: String(err),
        });
        throw err; // vitest가 실패를 인식하도록 re-throw
      }
    });
  } else {
    // vitest 없으면 직접 실행
    const start = Date.now();
    try {
      const result = fn();
      if (result instanceof Promise) {
        result
          .then(() =>
            col.record({
              specId,
              status: 'pass',
              marker,
              testName: name,
              duration: Date.now() - start,
            }),
          )
          .catch((err) =>
            col.record({
              specId,
              status: 'fail',
              marker,
              testName: name,
              duration: Date.now() - start,
              error: String(err),
            }),
          );
      } else {
        col.record({
          specId,
          status: 'pass',
          marker,
          testName: name,
          duration: Date.now() - start,
        });
      }
    } catch (err) {
      col.record({
        specId,
        status: 'fail',
        marker,
        testName: name,
        duration: Date.now() - start,
        error: String(err),
      });
    }
  }
}

/** @deprecated spec() 대신 linkSpec() 또는 specIt() 사용 */
export function spec(specId: string, collector?: SpecCollector) {
  const col = collector ?? globalCollector;
  return {
    describe(name: string, fn: () => void) {
      fn();
    },
    it: (name: string, fn: () => void | Promise<void>) =>
      specIt(specId, name, fn, { collector: col }),
    marker: (marker: ContractMarkerKind) => ({
      it: (name: string, fn: () => void | Promise<void>) =>
        specIt(specId, name, fn, { marker, collector: col }),
    }),
  };
}

export type SpecHelper = ReturnType<typeof spec>;
