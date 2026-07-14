// @def.boundary qa-sdk-core-system
// @def.doc qa-sdk-core-system

/**
 * TestRegistry 품질 지표 — 패싯/단계/파이프 메트릭
 */

import { describe, it, expect } from 'vitest';
import { TestRegistry } from './test-tracking.js';
import type { PipeSpec } from '../types/pipe-spec.js';
import { step } from './__fixtures__/pipe-fixtures.js';
import { makeCase, makeResult } from './__fixtures__/test-tracking-fixtures.js';

describe('패싯 품질 지표', () => {
  it('통과율 계산', () => {
    const reg = new TestRegistry();
    reg.registerCase(makeCase('t1', '소비', 's1'));
    reg.registerCase(makeCase('t2', '소비', 's1'));
    reg.registerCase(makeCase('t3', '소비', 's1'));
    reg.recordResult(makeResult('t1', 'pass'));
    reg.recordResult(makeResult('t2', 'pass'));
    reg.recordResult(makeResult('t3', 'fail'));

    const m = reg.computeFacetMetrics('소비');
    expect(m.totalTests).toBe(3);
    expect(m.passedTests).toBe(2);
    expect(m.passRate).toBe(67);
    expect(m.hasCoverage).toBe(true);
  });

  it('drift 감지 — 스키마 변경 후 미실행', () => {
    const reg = new TestRegistry();
    reg.registerCase(makeCase('t1', '소비', 's1'));
    reg.recordResult({ ...makeResult('t1', 'pass'), executedAt: '2026-03-01T00:00:00Z' });

    const m = reg.computeFacetMetrics('소비', '2026-04-01T00:00:00Z');
    expect(m.hasDrift).toBe(true);
  });

  it('drift 없음 — 스키마 변경 후 재실행', () => {
    const reg = new TestRegistry();
    reg.registerCase(makeCase('t1', '소비', 's1'));
    reg.recordResult({ ...makeResult('t1', 'pass'), executedAt: '2026-04-02T00:00:00Z' });

    const m = reg.computeFacetMetrics('소비', '2026-04-01T00:00:00Z');
    expect(m.hasDrift).toBe(false);
  });

  it('contract 검증률', () => {
    const reg = new TestRegistry();
    reg.registerCase(makeCase('t1', '소비', 's1', 'rule-1'));
    reg.registerCase(makeCase('t2', '소비', 's1', 'rule-2'));
    reg.registerCase(makeCase('t3', '소비', 's1'));
    reg.recordResult(makeResult('t1', 'pass'));
    reg.recordResult(makeResult('t2', 'fail'));
    reg.recordResult(makeResult('t3', 'pass'));

    const m = reg.computeFacetMetrics('소비');
    expect(m.contractVerifiedRate).toBe(50);
  });

  it('커버리지 없음', () => {
    const reg = new TestRegistry();
    const m = reg.computeFacetMetrics('정의');
    expect(m.hasCoverage).toBe(false);
    expect(m.totalTests).toBe(0);
  });
});

describe('단계 품질 지표', () => {
  it('통과율 계산', () => {
    const reg = new TestRegistry();
    reg.registerCase(makeCase('t1', '소비', 's1', undefined, 'arrange'));
    reg.registerCase(makeCase('t2', '소비', 's1', undefined, 'arrange'));
    reg.registerCase(makeCase('t3', '소비', 's1', undefined, 'arrange'));
    reg.recordResult(makeResult('t1', 'pass'));
    reg.recordResult(makeResult('t2', 'pass'));
    reg.recordResult(makeResult('t3', 'fail'));

    const m = reg.computePhaseMetrics('arrange');
    expect(m.phase).toBe('arrange');
    expect(m.totalTests).toBe(3);
    expect(m.passedTests).toBe(2);
    expect(m.passRate).toBe(67);
    expect(m.hasCoverage).toBe(true);
  });

  it('drift 감지', () => {
    const reg = new TestRegistry();
    reg.registerCase(makeCase('t1', '소비', 's1', undefined, 'act'));
    reg.recordResult({ ...makeResult('t1', 'pass'), executedAt: '2026-03-01T00:00:00Z' });

    const m = reg.computePhaseMetrics('act', '2026-04-01T00:00:00Z');
    expect(m.hasDrift).toBe(true);
  });

  it('커버리지 없음', () => {
    const reg = new TestRegistry();
    const m = reg.computePhaseMetrics('teardown');
    expect(m.hasCoverage).toBe(false);
    expect(m.totalTests).toBe(0);
  });
});

describe('파이프 품질 지표', () => {
  it('경로 커버리지 + 패싯/단계 분포', () => {
    const reg = new TestRegistry();
    const pipe: PipeSpec = {
      pipeId: 'order-process',
      version: 'v1',
      trigger: { eventKey: 'start' },
      flow: { kind: 'branch', condition: 'x', paths: [step('소비'), step('생산')] },
    };

    reg.registerCase({
      ...makeCase('t1', '소비', 'order-process', undefined, 'arrange'),
      tags: ['order-process'],
    });
    reg.registerCase({
      ...makeCase('t2', '생산', 'order-process', undefined, 'assert-primary'),
      tags: ['order-process'],
    });
    reg.recordResult(makeResult('t1', 'pass'));
    reg.recordResult(makeResult('t2', 'pass'));

    const m = reg.computePipeMetrics(pipe);
    expect(m.totalPaths).toBe(2);
    expect(m.testedPaths).toBe(2);
    expect(m.pathCoverage).toBe(100);
    expect(m.facetDistribution['소비']).toBe(1);
    expect(m.facetDistribution['생산']).toBe(1);
    expect(m.uncoveredFacets).toContain('관리');
    expect(m.uncoveredFacets).toContain('저장');
    expect(m.phaseDistribution['arrange']).toBe(1);
    expect(m.phaseDistribution['assert-primary']).toBe(1);
    expect(m.uncoveredPhases).toContain('act');
    expect(m.uncoveredPhases).toContain('teardown');
  });
});
