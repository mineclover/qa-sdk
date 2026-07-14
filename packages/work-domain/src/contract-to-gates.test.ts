// @def.boundary shared-utility-group
// @def.doc shared-utility-group

import { describe, it, expect } from 'vitest';
import { isContractDoc, deriveGateKinds, GATE_KIND_SCOPE_MAP } from './contract-to-gates.js';

describe('isContractDoc', () => {
  it('interface scope → true', () => {
    expect(isContractDoc({ scope: 'interface', aspect: 'api_contract' })).toBe(true);
  });

  it('constraint scope → true', () => {
    expect(isContractDoc({ scope: 'constraint', aspect: 'tech_constraint' })).toBe(true);
  });

  it('feature scope → false', () => {
    expect(isContractDoc({ scope: 'feature', aspect: 'func_def' })).toBe(false);
  });

  it('data scope → false', () => {
    expect(isContractDoc({ scope: 'data', aspect: 'domain_data' })).toBe(false);
  });
});

describe('deriveGateKinds', () => {
  it('interface/api_contract → typecheck + api-contract', () => {
    const kinds = deriveGateKinds({ scope: 'interface', aspect: 'api_contract' });
    expect(kinds).toContain('typecheck');
    expect(kinds).toContain('api-contract');
  });

  it('interface/cli_contract → typecheck + integration-test', () => {
    const kinds = deriveGateKinds({ scope: 'interface', aspect: 'cli_contract' });
    expect(kinds).toContain('typecheck');
    expect(kinds).toContain('integration-test');
  });

  it('constraint/tech_constraint → unit-test + static-analysis', () => {
    const kinds = deriveGateKinds({ scope: 'constraint', aspect: 'tech_constraint' });
    expect(kinds).toContain('unit-test');
    expect(kinds).toContain('static-analysis');
  });

  it('security concern → security-audit 추가', () => {
    const kinds = deriveGateKinds({
      scope: 'interface',
      aspect: 'api_contract',
      tags: ['security'],
    });
    expect(kinds).toContain('security-audit');
  });

  it('performance concern → perf-benchmark 추가', () => {
    const kinds = deriveGateKinds({
      scope: 'constraint',
      aspect: 'tech_constraint',
      tags: ['performance'],
    });
    expect(kinds).toContain('perf-benchmark');
  });

  it('중복 없음', () => {
    const kinds = deriveGateKinds({
      scope: 'interface',
      aspect: 'api_contract',
      tags: ['security'],
    });
    expect(new Set(kinds).size).toBe(kinds.length);
  });
});

describe('GATE_KIND_SCOPE_MAP', () => {
  it('typecheck → static', () => {
    expect(GATE_KIND_SCOPE_MAP['typecheck']).toBe('static');
  });

  it('unit-test → unit', () => {
    expect(GATE_KIND_SCOPE_MAP['unit-test']).toBe('unit');
  });

  it('e2e-test → system', () => {
    expect(GATE_KIND_SCOPE_MAP['e2e-test']).toBe('system');
  });
});
