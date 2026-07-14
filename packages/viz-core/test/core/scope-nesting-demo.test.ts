// @def.boundary qa-sdk-core-system
// @def.doc qa-sdk-core-system

/**
 * Scope Nesting 시각화 데모 — Mermaid 출력 확인용
 *
 * `pnpm --filter @qa-sdk/core test -- src/scope-nesting-demo` 로 실행하면
 * 콘솔에 3가지 Mermaid 다이어그램이 출력됩니다.
 */

import { describe, it, expect } from 'vitest';
import {
  validateScopeNesting,
  validateMountFlow,
  validateContractTiming,
  transition,
  isViolation,
  verifyInvariants,
  simulate,
  matchHappyPath,
  type ScopeNesting,
  type MountFlowBinding,
  type TimedMountFlowBinding,
  type PipeGraph,
  type PipeFlow,
} from '@qa-sdk/core';
import { nestingToMermaid, mountSnapshotToMermaid, timingToMermaid } from 'viz-core';

const step = (facet: string, eventKey?: string): PipeFlow => ({
  kind: 'step' as const,
  facet,
  ...(eventKey != null ? { eventKey } : {}),
});

// ── Fixture ──────────────────────────────────────────

const nesting: ScopeNesting = {
  nestingId: 'viteplus-playbook',
  scopes: [
    {
      scopeId: 'qa-bridge',
      provides: [{ contractId: 'logging-session', type: 'logging' }],
      consumes: [],
    },
    {
      scopeId: 'feature-context',
      provides: [
        { contractId: 'playbook-state', type: 'state', readyAfter: 'persist_load_complete' },
        { contractId: 'persist-adapter', type: 'persist' },
      ],
      consumes: [{ contractId: 'logging-session', type: 'logging' }],
    },
    {
      scopeId: 'handlers',
      provides: [{ contractId: 'submission-handlers', type: 'adapter' }],
      consumes: [
        { contractId: 'playbook-state', type: 'state' },
        { contractId: 'logging-session', type: 'logging' },
      ],
    },
    {
      scopeId: 'view',
      provides: [],
      consumes: [
        { contractId: 'playbook-state', type: 'state' },
        { contractId: 'submission-handlers', type: 'adapter' },
      ],
    },
  ],
};

const graph: PipeGraph = {
  graphId: 'canonical-review-handler',
  version: 'v1',
  entryPipeId: 'persist-loader',
  pipes: [
    {
      pipeId: 'persist-loader',
      version: 'v1',
      trigger: { eventKey: 'app_init' },
      flow: step('저장', 'persist_load_complete'),
      produces: ['persist_load_complete'],
    },
    {
      pipeId: 'validate-input',
      version: 'v1',
      trigger: { eventKey: 'persist_load_complete' },
      flow: { kind: 'sequence', steps: [step('소비', 'review_input'), step('관리')] },
      produces: ['validation_result'],
    },
    {
      pipeId: 'compute-result',
      version: 'v1',
      trigger: { eventKey: 'validation_result' },
      flow: { kind: 'sequence', steps: [step('소비'), step('생산', 'review_score')] },
      produces: ['review_complete'],
    },
    {
      pipeId: 'log-event',
      version: 'v1',
      trigger: { eventKey: 'review_complete' },
      flow: { kind: 'tap', observe: step('소비', 'review_logged'), step: step('소비') },
    },
  ],
  connections: [
    { from: 'persist-loader', to: 'validate-input', kind: 'event' },
    { from: 'validate-input', to: 'compute-result', kind: 'event' },
    { from: 'compute-result', to: 'log-event', kind: 'event' },
  ],
};

const binding: TimedMountFlowBinding = {
  nesting,
  graph,
  bindings: {
    'persist-loader': { scopeId: 'feature-context', scopeContracts: [] },
    'validate-input': { scopeId: 'handlers', scopeContracts: ['playbook-state'] },
    'compute-result': {
      scopeId: 'handlers',
      scopeContracts: ['playbook-state'],
      delegatesTo: [
        {
          contractId: 'playbook-state',
          completionEvent: 'review_complete',
          tolerateStale: true,
        },
      ],
    },
    'log-event': {
      scopeId: 'handlers',
      scopeContracts: [{ contractId: 'logging-session', required: false }],
    },
  },
};

// ── 데모 ─────────────────────────────────────────────

describe('scope-nesting 데모', () => {
  it('1. Scope 계층 + 계약 하향 다이어그램', () => {
    const v = validateScopeNesting(nesting);
    const diagram = nestingToMermaid(nesting, v);

    console.log('\n=== 1. Scope Nesting Diagram ===\n');
    console.log(diagram);
    console.log(`\nvalid: ${v.valid}, issues: ${v.issues.length}, paths: ${v.descentPaths.length}`);

    expect(v.valid).toBe(true);
  });

  it('2. Mount Flow 타임라인', () => {
    const mount = validateMountFlow(binding);
    const diagram = mountSnapshotToMermaid(mount.snapshots);

    console.log('\n=== 2. Mount Flow Timeline ===\n');
    console.log(diagram);
    console.log(`\nvalid: ${mount.valid}, issues: ${mount.issues.length}`);

    expect(mount.valid).toBe(true);
  });

  it('3. Contract Timing + Delegation Gap', () => {
    const sim = simulate({ graph, initialEvent: { eventKey: 'app_init' } });
    const timing = validateContractTiming(binding, sim);
    const diagram = timingToMermaid(timing, sim.totalSteps);

    console.log('\n=== 3. Contract Timing Diagram ===\n');
    console.log(diagram);
    console.log(`\nvalid: ${timing.valid}`);
    console.log(
      `readiness: ${timing.readinessTimeline.map((r) => `${r.contractId}@step${r.readyAtStep}`).join(', ')}`,
    );
    console.log(`gaps: ${timing.delegationGaps.length}`);
    if (timing.delegationGaps.length > 0) {
      for (const g of timing.delegationGaps) {
        console.log(
          `  ${g.contractId}: step ${g.gapStartStep}→${g.gapEndStep}, stale: [${g.staleConsumers}]`,
        );
      }
    }
    console.log(`\nsimulation: ${sim.status}, ${sim.totalSteps} steps`);
    console.log(`pipeTrace: ${sim.pipeTrace.join(' → ')}`);
    console.log(`facetTrace: ${sim.facetTrace.join(' → ')}`);

    expect(sim.status).toBe('complete');
  });

  it('4. L0→L3 전체 시퀀스 요약', () => {
    const guards = {}; // fail-open

    // L0+L1
    const l1 = validateScopeNesting(nesting, guards);
    // L1.5
    const l15 = validateMountFlow(binding, guards);
    // L2
    const t = transition('editing', 'valid-submit');
    const inv = verifyInvariants();
    // L3
    const sim = simulate({ graph, initialEvent: { eventKey: 'app_init' } });
    const happy = matchHappyPath(sim, {
      expectedPipeTrace: ['persist-loader', 'validate-input', 'compute-result', 'log-event'],
    });
    // L1.5↔L3
    const timing = validateContractTiming(binding, sim);

    console.log('\n=== 4. Full L0→L3 Sequence ===\n');
    console.log(
      `L1  구조:     valid=${l1.valid}, issues=${l1.issues.length}, paths=${l1.descentPaths.length}`,
    );
    console.log(
      `L1.5 마운트:  valid=${l15.valid}, issues=${l15.issues.length}, snapshots=${l15.snapshots.length}`,
    );
    console.log(
      `L2  전이:     editing→valid-submit = ${!isViolation(t) ? (t as any).next : 'VIOLATION'}, invariants=${inv.valid ? 'OK' : 'FAIL'}`,
    );
    console.log(
      `L3  시뮬:     status=${sim.status}, steps=${sim.totalSteps}, happy=${happy.match}`,
    );
    console.log(`L1.5↔L3:     timing valid=${timing.valid}, gaps=${timing.delegationGaps.length}`);

    expect(l1.valid).toBe(true);
    expect(l15.valid).toBe(true);
    expect(!isViolation(t)).toBe(true);
    expect(inv.valid).toBe(true);
    expect(sim.status).toBe('complete');
    expect(happy.match).toBe(true);
    expect(timing.valid).toBe(true);
  });
});
