// @def.boundary qa-sdk-core-system
// @def.doc qa-sdk-core-system

/**
 * 테스트 공유 fixture — step(), simplePipe, branchPipe, simpleGraph
 *
 * 3개 이상 테스트 파일에서 사용되는 fixture를 추출.
 * test-split 표준: 3+ 파일 공유 시 __fixtures__/ 추출.
 */

import type { PipeSpec, PipeGraph, PipeFlow, PipeStep } from '../../types/pipe-spec.js';

/** PipeStep 생성 헬퍼 (전 변형 통합) */
export const step = (
  facet = '소비',
  eventKey?: string,
  overrides?: Partial<PipeStep>,
): PipeFlow => ({
  kind: 'step',
  facet,
  ...(eventKey != null ? { eventKey } : {}),
  ...overrides,
});

/** 단순 파이프 */
export const simplePipe: PipeSpec = {
  pipeId: 'p1',
  version: 'v1',
  trigger: { eventKey: 'e1' },
  flow: step(),
};

/** 분기 파이프 */
export const branchPipe: PipeSpec = {
  pipeId: 'p2',
  version: 'v1',
  trigger: { eventKey: 'e2' },
  flow: { kind: 'branch', condition: 'x', paths: [step('생산'), step('저장')] },
};

/** 단순 그래프 (simplePipe → branchPipe) */
export const simpleGraph: PipeGraph = {
  graphId: 'g1',
  version: 'v1',
  pipes: [simplePipe, branchPipe],
  connections: [{ from: 'p1', to: 'p2', kind: 'next' }],
  entryPipeId: 'p1',
};
