// @def.boundary shared-utility-group
// @def.doc shared-utility-group

import { describe, it, expect, vi } from 'vitest';
import { createGateTracker } from './gate-tracker.js';
import { buildHarnessPlan } from './harness.js';
import type { DocNode, DocGraphPort } from './harness.js';
import type { GateLogger } from './gate-tracker.js';

function createMockGraph(): DocGraphPort {
  const docs: Record<string, DocNode> = {
    'my-unit': {
      id: 'my-unit',
      level: 'module',
      scope: 'flow',
      aspect: 'process_flow',
      depth: 'overview',
    },
    'my-contract': {
      id: 'my-contract',
      level: 'leaf',
      scope: 'interface',
      aspect: 'api_contract',
      depth: 'specification',
    },
    'my-constraint': {
      id: 'my-constraint',
      level: 'leaf',
      scope: 'constraint',
      aspect: 'tech_constraint',
      depth: 'specification',
    },
  };
  const children: Record<string, string[]> = {
    'my-unit': ['my-contract', 'my-constraint'],
  };
  return {
    get: (id) => docs[id],
    getChildren: (id) => (children[id] ?? []).map((cid) => docs[cid]).filter(Boolean),
    getConstraints: () => [],
    getDependencies: () => [],
    getOutgoingLinks: () => [],
  };
}

function createMockLogger(): GateLogger & { calls: Parameters<GateLogger['log']>[0][] } {
  const calls: Parameters<GateLogger['log']>[0][] = [];
  return {
    calls,
    log(params) {
      calls.push(params);
    },
  };
}

describe('createGateTracker', () => {
  const graph = createMockGraph();
  const plan = buildHarnessPlan('my-unit', graph);

  it('gate 전이 시 gate.execution 이벤트를 emit한다', () => {
    const logger = createMockLogger();
    const tracker = createGateTracker({ logger, plan });

    tracker.applyEvent(0, { type: 'schedule' });

    const gateEvents = logger.calls.filter((c) => c.event_key === 'gate.execution');
    expect(gateEvents).toHaveLength(1);
    expect(gateEvents[0].payload).toMatchObject({
      from_state: 'idle',
      to_state: 'ready',
    });
    expect(gateEvents[0].address_context?.gate_execution).toContain('gate_execution:v1:');
  });

  it('번들 상태 변경 시 bundle.observation 이벤트를 emit한다', () => {
    const logger = createMockLogger();
    const tracker = createGateTracker({ logger, plan });

    // idle → ready (bundle: pending → pending, 변경 없음)
    tracker.applyEvent(0, { type: 'schedule' });
    const bundleAfterSchedule = logger.calls.filter((c) => c.event_key === 'bundle.observation');
    expect(bundleAfterSchedule).toHaveLength(0); // 상태 변경 없음

    // ready → gathering (bundle: pending → gathering)
    tracker.applyEvent(0, { type: 'gather_start' });
    const bundleAfterGather = logger.calls.filter((c) => c.event_key === 'bundle.observation');
    expect(bundleAfterGather).toHaveLength(1);
    expect(bundleAfterGather[0].payload).toMatchObject({
      bundle_state: 'gathering',
    });
  });

  it('전체 게이트 통과 → bundle complete', () => {
    const logger = createMockLogger();
    const tracker = createGateTracker({ logger, plan });

    for (let i = 0; i < tracker.getInstance().gates.length; i++) {
      tracker.applyEvent(i, { type: 'schedule' });
      tracker.applyEvent(i, { type: 'gather_start' });
      tracker.applyEvent(i, { type: 'gather_done' });
      tracker.applyEvent(i, { type: 'exit', code: 0 });
    }

    expect(tracker.getBundleState()).toBe('complete');

    const bundleEvents = logger.calls.filter((c) => c.event_key === 'bundle.observation');
    const lastBundle = bundleEvents[bundleEvents.length - 1];
    expect(lastBundle.payload).toMatchObject({ bundle_state: 'complete' });
    expect(lastBundle.address_context?.bundle_observation).toBe('bundle_observation:v1:complete');
  });

  it('실패 시 degraded 상태를 emit한다', () => {
    const logger = createMockLogger();
    const tracker = createGateTracker({ logger, plan });

    // 첫 gate pass
    tracker.applyEvent(0, { type: 'schedule' });
    tracker.applyEvent(0, { type: 'gather_start' });
    tracker.applyEvent(0, { type: 'gather_done' });
    tracker.applyEvent(0, { type: 'exit', code: 0 });

    // 둘째 gate fail
    tracker.applyEvent(1, { type: 'schedule' });
    tracker.applyEvent(1, { type: 'gather_start' });
    tracker.applyEvent(1, { type: 'gather_done' });
    tracker.applyEvent(1, { type: 'exit', code: 1 });

    expect(tracker.getBundleState()).toBe('degraded');

    const gateEvents = logger.calls.filter((c) => c.event_key === 'gate.execution');
    const failEvent = gateEvents.find(
      (e) => (e.payload as Record<string, unknown>).to_state === 'failed',
    );
    expect(failEvent).toBeDefined();
    expect(failEvent!.payload).toMatchObject({ gate_kind: expect.any(String) });
  });

  it('무효 전이는 이벤트를 emit하지 않는다', () => {
    const logger = createMockLogger();
    const tracker = createGateTracker({ logger, plan });

    // idle에서 exit은 무효
    tracker.applyEvent(0, { type: 'exit', code: 0 });
    expect(logger.calls).toHaveLength(0);
  });

  it('getReadyGates()가 실행 가능한 인덱스를 반환한다', () => {
    const logger = createMockLogger();
    const tracker = createGateTracker({ logger, plan });

    const ready = tracker.getReadyGates();
    expect(ready.length).toBe(tracker.getInstance().gates.length);
  });
});
