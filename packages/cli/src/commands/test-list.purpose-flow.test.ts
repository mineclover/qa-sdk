// @def.boundary docs-control-plane
// @def.doc docs-control-plane

/**
 * @purpose P2 테스트 목록 관리 — 핵심 흐름 (docs/proposals/swc-next-qa-sdk-optimization/07-purpose-alignment.md §5 단계 1)
 *
 * spec frontmatter `tests:` 선언 → `test scan`(declared) → `test assign`(B 좌표·파일 경로) → `test report`.
 * 실행 결과로 collected·verified로 넘어가는 경로는 아직 CLI에 없다 (07 §2 P2 참고) — 이 흐름은 assigned까지 고정한다.
 */
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { SqliteTestScenarioStore } from 'test-scenario-store';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { testAssign, testReport, testScan } from './test.js';

const SPEC = `---
id: checkout-flow
tests:
  - kind: unit
    module: '@qa-sdk/shop/checkout'
    intent: 결제 금액 계산
  - kind: ui-logic
    intent: 모듈 미선언 — 할당 보류
  - kind: unit
    module: '@qa-sdk/shop/checkout'
    intent: 같은 kind 중복 선언
---

# checkout
`;

let root: string;
let db: string;

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'purpose-p2-'));
  mkdirSync(join(root, 'docs'), { recursive: true });
  writeFileSync(join(root, 'docs', 'checkout.spec.md'), SPEC);
  db = join(root, 'test-scenarios.sqlite');
  vi.spyOn(console, 'log').mockImplementation(() => {});
  vi.spyOn(console, 'warn').mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
  rmSync(root, { recursive: true, force: true });
});

describe('P2 테스트 목록 관리 — 선언 → 좌표 부여 → 리포트', () => {
  it('spec 선언이 테스트 시나리오가 되고, 모듈이 있는 선언만 B 좌표를 받는다', () => {
    testScan({ dir: root, db });
    // 같은 spec·같은 kind의 두 번째 선언은 조용히 버리지 않고 경고한다
    expect(vi.mocked(console.warn).mock.calls.join('\n')).toContain('같은 kind 중복 선언');
    const store = new SqliteTestScenarioStore(db);
    expect(
      store
        .listByLifecycle('declared')
        .map((s) => s.intent)
        .toSorted(),
    ).toEqual(['결제 금액 계산', '모듈 미선언 — 할당 보류'].toSorted());

    testAssign({ db });
    const assigned = store.listByLifecycle('assigned');
    expect(assigned).toHaveLength(1);
    expect(assigned[0]).toMatchObject({
      intent: '결제 금액 계산',
      filePath: 'packages/shop/src/checkout.unit.test.ts',
    });
    expect(assigned[0].id).toMatch(/^test_scenario:v1:\d+$/);
    // 모듈 미선언 선언은 --force 없이는 declared에 남는다
    expect(store.listByLifecycle('declared').map((s) => s.intent)).toEqual([
      '모듈 미선언 — 할당 보류',
    ]);

    const log = vi.mocked(console.log);
    log.mockClear();
    testReport({ db });
    const report = log.mock.calls.map((args) => args.join(' ')).join('\n');
    expect(report).toContain('@qa-sdk/shop/checkout');
    expect(report).toContain('○'); // assigned
  });
});
