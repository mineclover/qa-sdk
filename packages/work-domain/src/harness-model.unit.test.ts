// @def.boundary shared-utility-group
// @def.doc shared-utility-group

import { describe, it, expect } from 'vitest';
import { deriveHarnessState } from './harness-model.js';
import type { HarnessBundleDoc } from './harness-model.js';

// concept 문서: scope=flow, depth=overview
const conceptDoc: HarnessBundleDoc = {
  id: 'concept-1',
  scope: 'flow',
  aspect: 'core',
  depth: 'overview',
};

// contract 문서: scope=interface
const contractDoc: HarnessBundleDoc = {
  id: 'contract-1',
  scope: 'interface',
  aspect: 'core',
  depth: 'detail',
};

// gate 문서: scope=constraint, depth=validation
const gateDoc: HarnessBundleDoc = {
  id: 'gate-1',
  scope: 'constraint',
  aspect: 'core',
  depth: 'validation',
};

describe('deriveHarnessState 4단계 상태 판별', () => {
  it('빈 docs → current는 concept-defined이고 missing에 항목 존재', () => {
    const result = deriveHarnessState([]);
    expect(result.current).toBe('concept-defined');
    expect(result.reached).toEqual([]);
    expect(result.missing.length).toBeGreaterThan(0);
    expect(result.missing).toContain('개념 번들 문서');
  });

  it('concept 문서만 → concept-defined 도달, next는 contract-bound', () => {
    const result = deriveHarnessState([conceptDoc]);
    expect(result.reached).toContain('concept-defined');
    expect(result.reached).not.toContain('contract-bound');
    expect(result.current).toBe('concept-defined');
    expect(result.next).toBe('contract-bound');
  });

  it('concept + contract → contract-bound 도달, next는 gate-bound', () => {
    const result = deriveHarnessState([conceptDoc, contractDoc]);
    expect(result.reached).toContain('concept-defined');
    expect(result.reached).toContain('contract-bound');
    expect(result.reached).not.toContain('gate-bound');
    expect(result.current).toBe('contract-bound');
    expect(result.next).toBe('gate-bound');
  });

  it('concept + contract + gate → gate-bound 도달, next는 verified', () => {
    const result = deriveHarnessState([conceptDoc, contractDoc, gateDoc]);
    expect(result.reached).toContain('concept-defined');
    expect(result.reached).toContain('contract-bound');
    expect(result.reached).toContain('gate-bound');
    expect(result.reached).not.toContain('verified');
    expect(result.current).toBe('gate-bound');
    expect(result.next).toBe('verified');
  });

  it('concept + contract + gate + verified:true → verified 도달, next undefined', () => {
    const result = deriveHarnessState([conceptDoc, contractDoc, gateDoc], { verified: true });
    expect(result.reached).toContain('concept-defined');
    expect(result.reached).toContain('contract-bound');
    expect(result.reached).toContain('gate-bound');
    expect(result.reached).toContain('verified');
    expect(result.current).toBe('verified');
    expect(result.next).toBeUndefined();
    expect(result.missing).toHaveLength(0);
  });

  it('4단계 상태 순서 보장: concept-defined → contract-bound → gate-bound → verified', () => {
    const result = deriveHarnessState([conceptDoc, contractDoc, gateDoc], { verified: true });
    expect(result.reached[0]).toBe('concept-defined');
    expect(result.reached[1]).toBe('contract-bound');
    expect(result.reached[2]).toBe('gate-bound');
    expect(result.reached[3]).toBe('verified');
  });
});
