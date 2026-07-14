// @def.boundary qa-sdk-core-system
// @def.doc qa-sdk-core-system

import { describe, it, expect } from 'vitest';
import type { ScopeNesting } from '../scope-nesting.js';
import type { IRGraph } from './ir-validate.js';
import { crossValidate, nestingToModuleIRs } from './ir-nesting-bridge.js';
import { makeModule, makeData } from './__fixtures__/ir-fixtures.js';

// ── 테스트 fixture ────────────────────────────────────

const cleanNesting: ScopeNesting = {
  nestingId: 'order-flow',
  scopes: [
    {
      scopeId: 'app',
      provides: [
        { contractId: 'db', type: 'persist' },
        { contractId: 'auth', type: 'state' },
      ],
      consumes: [],
    },
    {
      scopeId: 'order-service',
      provides: [{ contractId: 'order-api', type: 'adapter' }],
      consumes: [
        { contractId: 'db', type: 'persist' },
        { contractId: 'auth', type: 'state' },
      ],
    },
    {
      scopeId: 'order-handler',
      provides: [],
      consumes: [{ contractId: 'order-api', type: 'adapter' }],
    },
  ],
};

function buildMatchingIR(): IRGraph {
  const app = makeModule('app', {
    relations: {
      parent: null,
      children: [{ moduleId: 'order-service' }],
      internal: [],
      external: [],
    },
    interface: {
      inputs: [],
      outputs: [
        { dataId: 'db', schemaHash: '' },
        { dataId: 'auth', schemaHash: '' },
      ],
      sideEffects: [],
    },
    meta: { level: 'group' },
  });
  const svc = makeModule('order-service', {
    relations: {
      parent: { moduleId: 'app' },
      children: [{ moduleId: 'order-handler' }],
      internal: [],
      external: [],
    },
    interface: {
      inputs: [
        { dataId: 'db', schemaHash: '' },
        { dataId: 'auth', schemaHash: '' },
      ],
      outputs: [{ dataId: 'order-api', schemaHash: '' }],
      sideEffects: [],
    },
    meta: { level: 'module' },
  });
  const handler = makeModule('order-handler', {
    relations: { parent: { moduleId: 'order-service' }, children: [], internal: [], external: [] },
    interface: { inputs: [{ dataId: 'order-api', schemaHash: '' }], outputs: [], sideEffects: [] },
  });
  return {
    modules: [app, svc, handler],
    data: [makeData('db', 'app'), makeData('auth', 'app'), makeData('order-api', 'order-service')],
    pipes: [],
  };
}

// ── crossValidate ─────────────────────────────────────

describe('crossValidate', () => {
  it('정합적인 nesting + IR → cross 이슈 없음', () => {
    const result = crossValidate(cleanNesting, buildMatchingIR());
    expect(result.nestingValid).toBe(true);
    expect(result.irValid).toBe(true);
    const crossIssues = result.issues.filter((i) => i.source === 'cross');
    expect(crossIssues).toHaveLength(0);
  });

  it('nesting scope에 대응 ModuleIR 없음 → scope-without-module', () => {
    const nesting: ScopeNesting = {
      nestingId: 't',
      scopes: [
        { scopeId: 'ghost-scope', provides: [{ contractId: 'x', type: 'state' }], consumes: [] },
      ],
    };
    const graph: IRGraph = { modules: [], data: [], pipes: [] };
    const result = crossValidate(nesting, graph);
    expect(result.issues.some((i) => i.rule === 'scope-without-module')).toBe(true);
  });

  it('scope provides 하지만 ModuleIR outputs에 없음 → provides-without-output', () => {
    const nesting: ScopeNesting = {
      nestingId: 't',
      scopes: [
        { scopeId: 'svc', provides: [{ contractId: 'secret-api', type: 'adapter' }], consumes: [] },
      ],
    };
    const mod = makeModule('svc'); // outputs 비어있음
    const result = crossValidate(nesting, { modules: [mod], data: [], pipes: [] });
    expect(result.issues.some((i) => i.rule === 'provides-without-output')).toBe(true);
  });

  it('scope consumes 하지만 ModuleIR inputs에 없음 → consumes-without-input', () => {
    const nesting: ScopeNesting = {
      nestingId: 't',
      scopes: [
        { scopeId: 'app', provides: [{ contractId: 'db', type: 'persist' }], consumes: [] },
        { scopeId: 'svc', provides: [], consumes: [{ contractId: 'db', type: 'persist' }] },
      ],
    };
    const app = makeModule('app', {
      relations: { parent: null, children: [{ moduleId: 'svc' }], internal: [], external: [] },
      meta: { level: 'group' },
    });
    const svc = makeModule('svc', {
      relations: { parent: { moduleId: 'app' }, children: [], internal: [], external: [] },
      // inputs 비어있음 — db를 소비하지 않음
    });
    const result = crossValidate(nesting, { modules: [app, svc], data: [], pipes: [] });
    expect(
      result.issues.some((i) => i.rule === 'consumes-without-input' && i.target.includes('db')),
    ).toBe(true);
  });

  it('group ModuleIR에 대응 nesting scope 없음 → module-without-scope', () => {
    const nesting: ScopeNesting = { nestingId: 't', scopes: [] };
    const mod = makeModule('orphan-group', {
      relations: { parent: null, children: [{ moduleId: 'c' }], internal: [], external: [] },
      meta: { level: 'group' },
    });
    const child = makeModule('c', {
      relations: { parent: { moduleId: 'orphan-group' }, children: [], internal: [], external: [] },
    });
    const result = crossValidate(nesting, { modules: [mod, child], data: [], pipes: [] });
    expect(result.issues.some((i) => i.rule === 'module-without-scope')).toBe(true);
  });
});

// ── nestingToModuleIRs ────────────────────────────────

describe('nestingToModuleIRs', () => {
  it('ScopeNesting → ModuleIR 계층 변환', () => {
    const modules = nestingToModuleIRs(cleanNesting);
    expect(modules).toHaveLength(3);

    expect(modules[0].id).toBe('app');
    expect(modules[0].meta.level).toBe('group');
    expect(modules[0].relations.parent).toBeNull();
    expect(modules[0].interface.outputs.map((o) => o.dataId)).toContain('db');

    expect(modules[1].id).toBe('order-service');
    expect(modules[1].meta.level).toBe('module');
    expect(modules[1].interface.inputs.map((i) => i.dataId)).toContain('db');

    expect(modules[2].id).toBe('order-handler');
    expect(modules[2].meta.level).toBe('leaf');
  });

  it('provides → outputs, consumes → inputs 매핑', () => {
    const modules = nestingToModuleIRs(cleanNesting);
    const svc = modules[1];
    expect(svc.interface.inputs.map((i) => i.dataId)).toEqual(['db', 'auth']);
    expect(svc.interface.outputs.map((o) => o.dataId)).toEqual(['order-api']);
  });
});
