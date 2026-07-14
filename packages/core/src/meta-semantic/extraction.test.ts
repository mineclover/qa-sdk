// @def.boundary qa-sdk-core-system
// @def.doc qa-sdk-core-system

import { describe, it, expect } from 'vitest';
import {
  extractMarkerHints,
  countExecutionPaths,
  validateExtraction,
  summarizeExtraction,
  type BranchPoint,
  type ExecutionUnit,
  type ExtractionResult,
} from './extraction.js';

// ── 마커 힌트 추출 ──────────────────────────────────

describe('extractMarkerHints', () => {
  it('^intent, ^contract, ^branches 추출', () => {
    const comment = `
      * ^intent 결제 처리의 핵심 비즈니스 로직
      * ^contract 주문 상태가 PENDING일 때만 호출 가능
      * ^branches orderType(3), paymentMethod(4)
    `;
    const hints = extractMarkerHints(comment);

    expect(hints).toHaveLength(3);
    expect(hints[0]).toEqual({ marker: 'intent', content: '결제 처리의 핵심 비즈니스 로직' });
    expect(hints[1]).toEqual({
      marker: 'contract',
      content: '주문 상태가 PENDING일 때만 호출 가능',
    });
    expect(hints[2]).toEqual({ marker: 'branches', content: 'orderType(3), paymentMethod(4)' });
  });

  it('@def.doc 추출', () => {
    const comment = '// @def.doc payment-api#processPayment';
    const hints = extractMarkerHints(comment);

    expect(hints).toHaveLength(1);
    expect(hints[0]).toEqual({ marker: 'def.doc', content: 'payment-api#processPayment' });
  });

  it('마커 없음 → 빈 배열', () => {
    const hints = extractMarkerHints('일반 주석');
    expect(hints).toHaveLength(0);
  });
});

// ── 경로 수 계산 ────────────────────────────────────

describe('countExecutionPaths', () => {
  function makeUnit(entry: BranchPoint | null, graph: BranchPoint[]): ExecutionUnit {
    return {
      functionId: 'test',
      filePath: 'test.ts',
      entryPoint: entry,
      branchGraph: graph,
      totalPaths: 0,
      meta: {
        testable: true,
        sideEffects: [],
        inputTypes: [],
        outputType: 'void',
        confidence: 1,
        markers: [],
      },
    };
  }

  it('분기 없음 → 경로 1개', () => {
    const unit = makeUnit(null, []);
    expect(countExecutionPaths(unit)).toBe(1);
  });

  it('단일 분기점 3개 분기 → 3경로', () => {
    const bp: BranchPoint = { id: 'bp1', branches: 3, reachable: [], labels: ['a', 'b', 'c'] };
    const unit = makeUnit(bp, [bp]);
    expect(countExecutionPaths(unit)).toBe(3);
  });

  it('spec 예시: orderType(3) → payment(4) + shipping(2) = 18', () => {
    const payment: BranchPoint = {
      id: 'payment',
      branches: 4,
      reachable: [],
      labels: ['card', 'bank', 'crypto', 'point'],
    };
    const shipping: BranchPoint = {
      id: 'shipping',
      branches: 2,
      reachable: [],
      labels: ['standard', 'sameDay'],
    };
    const orderType: BranchPoint = {
      id: 'orderType',
      branches: 3,
      labels: ['normal', 'express', 'subscription'],
      reachable: [{ targetId: 'payment' }, { targetId: 'shipping' }],
    };

    const unit = makeUnit(orderType, [orderType, payment, shipping]);
    expect(countExecutionPaths(unit)).toBe(18); // 3*(4+2) = 18
  });

  it('직렬 분기: a(2) → b(3) = 6', () => {
    const b: BranchPoint = { id: 'b', branches: 3, reachable: [], labels: ['x', 'y', 'z'] };
    const a: BranchPoint = {
      id: 'a',
      branches: 2,
      reachable: [{ targetId: 'b' }],
      labels: ['p', 'q'],
    };

    const unit = makeUnit(a, [a, b]);
    expect(countExecutionPaths(unit)).toBe(6); // 2*3 = 6
  });

  it('다이아몬드 DAG: a(2) → b(3) + c(2), b + c 합산', () => {
    const b: BranchPoint = { id: 'b', branches: 3, reachable: [], labels: [] };
    const c: BranchPoint = { id: 'c', branches: 2, reachable: [], labels: [] };
    const a: BranchPoint = {
      id: 'a',
      branches: 2,
      reachable: [{ targetId: 'b' }, { targetId: 'c' }],
      labels: [],
    };

    const unit = makeUnit(a, [a, b, c]);
    expect(countExecutionPaths(unit)).toBe(10); // 2*(3+2) = 10
  });
});

// ── 검증 + 요약 ─────────────────────────────────────

describe('validateExtraction', () => {
  function makeResult(confidences: number[]): ExtractionResult {
    return {
      units: confidences.map((c, i) => ({
        functionId: `fn${i}`,
        filePath: 'test.ts',
        entryPoint: null,
        branchGraph: [],
        totalPaths: 1,
        meta: {
          testable: true,
          sideEffects: [],
          inputTypes: [],
          outputType: 'void',
          confidence: c,
          markers: [],
        },
      })),
      totalPaths: confidences.length,
      averageConfidence: confidences.reduce((s, c) => s + c, 0) / confidences.length,
      stats: {
        filesScanned: 1,
        functionsFound: 10,
        unitsIdentified: confidences.length,
        branchPointsFound: 0,
      },
    };
  }

  it('모두 threshold 이상 → valid', () => {
    const result = validateExtraction(makeResult([0.8, 0.9, 0.5]));
    expect(result.valid).toBe(true);
    expect(result.warnings).toHaveLength(0);
  });

  it('threshold 미만 → warnings', () => {
    const result = validateExtraction(makeResult([0.8, 0.2, 0.1]), 0.3);
    expect(result.valid).toBe(false);
    expect(result.warnings).toHaveLength(2);
    expect(result.warnings[0].functionId).toBe('fn1');
  });
});

describe('summarizeExtraction', () => {
  it('units에서 통계 생성', () => {
    const units: ExecutionUnit[] = [
      {
        functionId: 'processOrder',
        filePath: 'order.ts',
        entryPoint: null,
        branchGraph: [{ id: 'bp1', branches: 3, reachable: [], labels: [] }],
        totalPaths: 3,
        meta: {
          testable: true,
          sideEffects: ['db.write'],
          inputTypes: ['OrderInput'],
          outputType: 'OrderResult',
          confidence: 0.9,
          markers: [],
        },
      },
      {
        functionId: 'validateInput',
        filePath: 'validate.ts',
        entryPoint: null,
        branchGraph: [],
        totalPaths: 1,
        meta: {
          testable: true,
          sideEffects: [],
          inputTypes: ['unknown'],
          outputType: 'boolean',
          confidence: 0.7,
          markers: [],
        },
      },
    ];

    const result = summarizeExtraction(units, 5, 20);

    expect(result.totalPaths).toBe(4);
    expect(result.averageConfidence).toBe(0.8);
    expect(result.stats).toEqual({
      filesScanned: 5,
      functionsFound: 20,
      unitsIdentified: 2,
      branchPointsFound: 1,
    });
  });
});
