// @def.boundary qa-sdk-core-system
// @def.doc qa-sdk-core-system

import { describe, it, expect } from 'vitest';
import { compareIntentWithExecution, auditShadowImplementation } from './ir-alignment.js';
import type { DefinitionEntry } from 'definition-catalog';
import type { ModuleIR } from './ir-types.js';

// ── fixtures ──────────────────────────────────────────

const mockIntent: DefinitionEntry = {
  id: 'payment-logic',
  title: '결제 로직',
  scope: 'feature',
  aspect: 'func_def',
  depth: 'specification',
  lifecycle: 'approved',
  intent_hierarchy: 'core',
  projection_plane: 'intent',
  createdAt: '',
  updatedAt: '',
};

const mockExecution: ModuleIR = {
  id: 'exec-payment',
  source: { filePath: 'src/payment.ts', line: 10, kind: 'function' },
  interface: { inputs: [], outputs: [], sideEffects: [] },
  relations: { parent: null, children: [], internal: [], external: [] },
  meta: {
    level: 'leaf',
    projectionPlane: 'execution',
    intentHierarchy: 'core',
    defDocRef: 'payment-logic',
  },
};

// ── 테스트 ───────────────────────────────────────────

describe('Alignment Engine — compareIntentWithExecution', () => {
  it('의도와 구현이 완벽히 일치하면 100점 판정', () => {
    const result = compareIntentWithExecution(mockIntent, [mockExecution]);
    expect(result.score).toBe(100);
    expect(result.issues).toHaveLength(0);
    expect(result.summary.matchedUnits).toBe(1);
  });

  it('구현이 누락되면 0점 및 broken-promise 발생', () => {
    const result = compareIntentWithExecution(mockIntent, []); // 빈 구현 목록
    expect(result.score).toBe(0);
    expect(result.issues[0].type).toBe('broken-promise');
  });

  it('위계(Hierarchy)가 불일치하면 감점 및 경고 발생 — sidecar(core↔aux) 예외 외', () => {
    // 의도는 보조(auxiliary)인데 구현이 코어(core)로 추출 → mismatch (sidecar 패턴 아님)
    // commit 1a85f3c2: core+aux는 sidecar로 의도적 제외, 그 외 mismatch는 경고.
    const auxIntent: DefinitionEntry = { ...mockIntent, intent_hierarchy: 'auxiliary' };
    const result = compareIntentWithExecution(auxIntent, [mockExecution]);
    expect(result.score).toBeLessThan(100);
    expect(result.issues.some((i) => i.type === 'hierarchy-mismatch')).toBe(true);
  });

  it('core 의도 + auxiliary 구현은 sidecar로 간주되어 hierarchy-mismatch 없음', () => {
    // commit 1a85f3c2 의도적 정책 — alignment score penalty에서 제외
    const sidecarExec: ModuleIR = {
      ...mockExecution,
      meta: { ...mockExecution.meta, intentHierarchy: 'auxiliary' },
    };
    const result = compareIntentWithExecution(mockIntent, [sidecarExec]);
    expect(result.issues.some((i) => i.type === 'hierarchy-mismatch')).toBe(false);
  });
});

describe('Alignment Engine — auditShadowImplementation', () => {
  it('설계 문서가 없는 코어 로직을 쉐도우로 감지한다', () => {
    const shadowExec: ModuleIR = {
      ...mockExecution,
      id: 'untracked-core-logic',
      meta: { ...mockExecution.meta, defDocRef: undefined }, // 문서 연결 없음
    };
    const issues = auditShadowImplementation([mockIntent], [shadowExec]);
    expect(issues).toHaveLength(1);
    expect(issues[0].type).toBe('shadow-implementation');
    expect(issues[0].message).toContain('untracked-core-logic');
  });

  it('연결된 문서가 있으면 쉐도우가 아님', () => {
    const issues = auditShadowImplementation([mockIntent], [mockExecution]);
    expect(issues).toHaveLength(0);
  });
});
