// @def.boundary qa-sdk-core-system
// @def.doc qa-sdk-core-system

import { describe, it, expect } from 'vitest';
import { testName, testGroup } from './test-name.js';

// ── testName 기본 ───────────────────────────────────

describe('testName', () => {
  it('기본 이름 생성', () => {
    const n = testName({
      module: 'pipe-lineage',
      fn: 'deriveStaticLineage',
      category: '정상',
      input: 'a+b',
      resolved: 'c',
      expect: '양쪽 기여',
    });

    expect(n.describe).toBe('pipe-lineage > deriveStaticLineage');
    expect(n.it).toBe('정상: a+b → c — 양쪽 기여');
    expect(n.id).toBe('pipe-lineage > deriveStaticLineage > 정상: a+b → c');
  });

  it('facet 포함', () => {
    const n = testName({
      module: 'pipe-lineage',
      fn: 'deriveStaticLineage',
      facet: '기여추적',
      category: '소비',
      input: 'a통과+b소비',
      resolved: 'c',
      expect: 'b 제외',
    });

    expect(n.describe).toBe('pipe-lineage > deriveStaticLineage [기여추적]');
    expect(n.it).toBe('소비: a통과+b소비 → c — b 제외');
  });

  it('verify 메타데이터 보존', () => {
    const n = testName({
      module: 'pipe-lineage',
      fn: 'findFieldOrigin',
      category: '체인',
      input: '3단계 sequence',
      resolved: 'final',
      expect: '최초 입력까지',
      verify: 'summary-outputs',
    });

    expect(n.meta.verify).toBe('summary-outputs');
    expect(n.meta.module).toBe('pipe-lineage');
  });
});

// ── testGroup 배치 ──────────────────────────────────

describe('testGroup', () => {
  it('배치 이름 생성', () => {
    const g = testGroup({
      module: 'pipe-lineage',
      fn: 'deriveStaticLineage',
      facet: '기여추적',
      cases: [
        { category: '정상', input: 'a+b', resolved: 'c', expect: '양쪽 기여' },
        { category: '소비', input: 'a+b(consumed)', resolved: 'c', expect: 'a만' },
        { category: '엣지', input: '빈 contract', resolved: '없음', expect: '계보 0건' },
      ],
    });

    expect(g.describe).toBe('pipe-lineage > deriveStaticLineage [기여추적]');
    expect(g.cases).toHaveLength(3);
    expect(g.cases[0].it).toBe('정상: a+b → c — 양쪽 기여');
    expect(g.cases[1].it).toBe('소비: a+b(consumed) → c — a만');
    expect(g.cases[2].it).toBe('엣지: 빈 contract → 없음 — 계보 0건');
  });
});

// ── 실사용 PoC — 기존 테스트 패턴 변환 ──────────────

describe('PoC: testName으로 기존 패턴 변환', () => {
  const n1 = testName({
    module: 'pipe-lineage',
    fn: 'summarizeFlowLineage',
    facet: '계보압축',
    category: '체인',
    input: 'rawOrder→validated→paymentResult',
    resolved: 'paymentResult',
    expect: 'rawOrder까지 압축',
    verify: 'summary-outputs',
  });

  // testName이 생성한 이름으로 실제 테스트 실행
  it(n1.it, () => {
    // 기존 assert 로직 그대로 — 이름만 바뀜
    expect(n1.id).toContain('pipe-lineage > summarizeFlowLineage');
    expect(n1.meta.verify).toBe('summary-outputs');
  });
});
