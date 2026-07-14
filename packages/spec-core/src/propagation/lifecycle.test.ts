// @def.boundary spec-engine-system
// @def.doc spec-engine-system

/**
 * 종단 라이프사이클 시나리오 테스트.
 *
 * 양방향 흐름 증명:
 *   방향 1 (닫기): 기능 정의 → 이벤트 필요 → prefix spec → 좌표 고정 → SSOT
 *   방향 2 (열기): 관측 → 수렴 발견 → spec 수정 → 재고정
 *
 * 결과: 같은 의미가 수렴하고, 타입이 공유되어,
 *       이미 있는 것이 닫힌 조합의 숫자가 된다.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { DEMO_CATALOG } from 'demo-snapshot';
import {
  GraphRegistry,
  deriveFromCatalog,
  analyzeImpact,
  inferMigrator,
  versionEventFromDiff,
  scaffoldDecision,
} from 'dkg';
import { InMemoryRegistry } from './registry-port.js';
import { publishSpec } from './publish.js';
import { seal, activateAndPropagate } from './lifecycle.js';
import type { PrefixSpec } from '../spec/prefix-spec.types.js';
import type { DomainNode, ConsumerNode, ObservationNode } from 'dkg';

let graph: GraphRegistry;
let registry: InMemoryRegistry;

beforeEach(() => {
  graph = deriveFromCatalog(DEMO_CATALOG);
  registry = new InMemoryRegistry();
});

// ═══════════════════════════════════════════════════════════════
//  방향 1: 기능 정의 → 이벤트 필요 → prefix spec → 좌표 고정
// ═══════════════════════════════════════════════════════════════

describe('방향 1: 닫기 — 기능에서 좌표까지', () => {
  it('시나리오: 결제 취소 기능 → order_event에 cancel_requested 추가 → 전체 라이프사이클', async () => {
    // ── 1. 기능 정의: "결제 취소" 기능이 필요하다 ────────────
    //    필요한 이벤트: payment.cancel_requested
    //    분기점: 취소 요청 → 승인/거절
    //    → order_action axis에 이미 "cancel" entry가 있다 (v1)
    //    → event_name axis v2에 "payment.cancel_requested" 가 있다
    //    이미 닫혀 있는 좌표가 이 기능을 표현할 수 있다

    // ── 2. 영향 분석: 기존 좌표로 충분한가? ─────────────────
    const orderEventNode = graph.getNode('order_event');
    expect(orderEventNode).toBeDefined();
    expect(orderEventNode!.kind).toBe('prefix');

    // order_event는 order_action axis를 사용
    const composesEdges = graph.edgesFrom('order_event', 'composes');
    const actionEdge = composesEdges.find(
      (e) => e.to === 'order_action' && e.meta?.dimKind === 'axis',
    );
    expect(actionEdge).toBeDefined();
    // → order_action v1에 "cancel"이 있으므로 기존 좌표로 표현 가능

    // ── 3. 새 기능이 기존 축에 이미 있는 경우 → entry 추가 불필요 ─
    const impact = analyzeImpact(graph, {
      type: 'entry-added',
      target: { axis: 'order_action' },
      detail: 'cancel은 이미 존재',
    });
    expect(impact.strideBreak).toBe(false);
    expect(impact.migrationRequired).toBe(false);
    // → "이미 있는 것이 닫힌 조합의 숫자가 된다"
  });

  it('시나리오: 새 tracking prefix 정의 → publish → seal → activate → 전파', async () => {
    // ── 1. 기능 정의: "사용자 행동 추적" 기능 ────────────────
    //    필요한 이벤트: click, view, scroll, submit
    //    분기점: page × userType
    //    → 새 prefix가 필요하다

    const trackingSpec: PrefixSpec = {
      id: 'tracking',
      version: 'v1',
      dims: {
        trackAction: { kind: 'axis', axisId: 'trackAction' },
        page: { kind: 'axis', axisId: 'page' },
        userType: { kind: 'axis', axisId: 'userType' },
      },
      export: {
        dims: ['trackAction', 'page', 'userType'],
        pattern: '{trackAction}.{page}.{userType}',
      },
    };

    // ── 2. publish: spec → registry draft ────────────────────
    const published = await publishSpec(registry, {
      spec: trackingSpec,
      owner: 'tracking-team',
      mode: 'new',
    });

    expect(published.prefix).toBe('tracking');
    expect(published.versionId).toBe('v1');
    expect(published.status).toBe('draft');

    // registry에 등록 확인
    expect(await registry.hasPrefix('tracking')).toBe(true);
    const status = await registry.getVersionStatus('tracking', 'v1');
    expect(status).toBe('draft');

    // ── 3. 영향 분석: 새 prefix이므로 기존에 영향 없음 ──────
    const impact = analyzeImpact(graph, {
      type: 'new-prefix',
      target: { prefix: 'tracking' },
    });
    expect(impact.strideBreak).toBe(false);
    expect(impact.constraintViolations).toHaveLength(0);

    // ── 4. Decision 기록 ──────────────────────────────────────
    const decision = scaffoldDecision({
      type: 'new-prefix',
      id: 'DEC-TRACK-001',
      date: '2026-03-20',
      title: 'tracking prefix 추가',
      params: { prefixId: 'tracking', dims: ['trackAction', 'page', 'userType'] },
      rationale: '사용자 행동 추적 기능에 필요한 이벤트 좌표 공간',
    });
    expect(decision.lifecycle).toBe('active');
    graph.addNode(decision);

    // ── 5. seal (lock → release) ─────────────────────────────
    await seal(registry, { prefix: 'tracking', versionId: 'v1' });
    const sealedStatus = await registry.getVersionStatus('tracking', 'v1');
    expect(sealedStatus).toBe('released');

    // ── 6. activate + 전파 ───────────────────────────────────
    // DKG에 domain + consumer 등록 (수동)
    const domain: DomainNode = {
      kind: 'domain',
      id: 'tracking-domain',
      name: '행동 추적',
      prefixes: ['tracking'],
      sharedAxes: [],
      boundary: { exports: ['tracking'], internal: [] },
    };
    const consumer: ConsumerNode = {
      kind: 'consumer',
      id: 'analytics-dashboard',
      type: 'client',
      intendedPrefixes: ['tracking'],
    };
    graph.addNode(domain);
    graph.addNode(consumer);
    graph.addEdge('contains', 'tracking-domain', 'tracking');
    graph.addEdge('consumes', 'analytics-dashboard', 'tracking-domain');

    // PrefixNode 등록 (publish 단계에서 DKG에도 추가)
    graph.addNode({
      kind: 'prefix',
      id: 'tracking',
      name: '행동 추적',
      dimLabels: ['trackAction', 'page', 'userType'],
    });
    graph.addEdge('composes', 'tracking', 'trackAction', { dimKind: 'axis' });
    graph.addEdge('composes', 'tracking', 'page', { dimKind: 'axis' });
    graph.addEdge('composes', 'tracking', 'userType', { dimKind: 'axis' });

    const result = await activateAndPropagate(registry, graph, {
      prefix: 'tracking',
      versionId: 'v1',
      date: '2026-03-20',
    });

    expect(result.previousVersion).toBeNull(); // 첫 버전
    expect(result.notification.event).toBe('activated');
    expect(result.notification.affectedConsumers).toHaveLength(1);
    expect(result.notification.affectedConsumers[0].id).toBe('analytics-dashboard');
    expect(result.notification.affectedConsumers[0].action).toBe('no-action');

    // registry 최종 상태 확인
    const finalStatus = await registry.getVersionStatus('tracking', 'v1');
    expect(finalStatus).toBe('active');
  });
});

// ═══════════════════════════════════════════════════════════════
//  방향 2: 관측 → 수렴 발견 → spec 수정 → 재고정
// ═══════════════════════════════════════════════════════════════

describe('방향 2: 열기 — 관측에서 수렴으로', () => {
  it('시나리오: 운영 관측 → role capacity 부족 → 확장 → 재고정', async () => {
    // ── 1. 관측: "role capacity 8 중 7개 사용, 1개 여유" ─────
    const observation: ObservationNode = {
      kind: 'observation',
      id: 'OBS-ROLE-001',
      date: '2026-03-20',
      source: 'metric',
      subjects: ['role'],
      finding:
        'role axis capacity 8 중 7개 사용. headroom 1. 다음 역할 추가 시 capacity 확장 필요.',
      suggestion: {
        kind: 'revise-decision',
        decisionId: 'DEC-001',
        reason: 'capacity 확장 필요',
      },
    };
    graph.addNode(observation);
    graph.addEdge('observes', 'OBS-ROLE-001', 'role');

    // ── 2. Observation이 Decision을 유발 ─────────────────────
    const decision = scaffoldDecision({
      type: 'capacity',
      id: 'DEC-ROLE-EXPAND',
      date: '2026-03-20',
      title: 'role capacity 8→16 확장',
      params: { axis: 'role', currentUsed: 7, currentCapacity: 8, proposedCapacity: 16 },
      rationale: '8번째 역할(auditor) 추가 예정. bitmask 정렬 유지를 위해 16으로 확장.',
    });
    graph.addNode(decision);
    graph.addEdge('prompts', 'OBS-ROLE-001', 'DEC-ROLE-EXPAND');
    graph.addEdge('justifies', 'DEC-ROLE-EXPAND', 'role');

    expect(decision.alternatives!.length).toBeGreaterThanOrEqual(3);
    expect(decision.context).toContain('88%'); // Math.round(7/8*100) = 88

    // ── 3. 영향 분석: capacity 변경의 cascade ────────────────
    const impact = analyzeImpact(graph, {
      type: 'capacity-changed',
      target: { axis: 'role', fromVersion: 'v4', toVersion: 'v5' },
    });

    expect(impact.strideBreak).toBe(true);
    expect(impact.migrationRequired).toBe(true);
    expect(impact.affectedPrefixes.map((p) => p.id)).toContain('permission');

    // ── 4. migrator 추론 ─────────────────────────────────────
    const migrator = inferMigrator({
      fromLabels: ['role', 'action'],
      toLabels: ['role', 'action'],
      changedLabels: [{ label: 'role', fromMax: 8, toMax: 16 }],
    });

    expect(migrator.pattern).toBe('identity');
    expect(migrator.migrator).toBeDefined();
    expect(migrator.migrator!([3, 2])).toEqual([3, 2]); // 좌표 보존

    // ── 5. VersionEvent 생성 ─────────────────────────────────
    const ve = versionEventFromDiff(
      {
        prefix: 'permission',
        from: 'pv4',
        to: 'pv5',
        changedLabels: [
          {
            label: 'role',
            fromLabelVersion: 'v4',
            fromMax: 8,
            toLabelVersion: 'v5',
            toMax: 16,
          },
        ],
      },
      { date: '2026-03-20' },
    );

    expect(ve.id).toBe('VE-permission-pv4-pv5');
    expect(ve.changes[0].kind).toBe('capacity-changed');
    expect(ve.impact).toContain('size 변경');

    graph.addNode(ve);
    graph.addEdge('justifies', 'DEC-ROLE-EXPAND', ve.id);

    // ── 6. 전체 추적 경로 검증 ───────────────────────────────
    //    관측 → 결정 → 축 → prefix → VersionEvent
    const obsEdges = graph.edgesFrom('OBS-ROLE-001');
    expect(obsEdges.some((e) => e.type === 'prompts' && e.to === 'DEC-ROLE-EXPAND')).toBe(true);
    expect(obsEdges.some((e) => e.type === 'observes' && e.to === 'role')).toBe(true);

    const decEdges = graph.edgesFrom('DEC-ROLE-EXPAND');
    expect(decEdges.some((e) => e.type === 'justifies' && e.to === 'role')).toBe(true);
    expect(decEdges.some((e) => e.type === 'justifies' && e.to === ve.id)).toBe(true);
  });

  it('시나리오: 수렴 발견 — 두 서비스가 같은 축을 공유', async () => {
    // ── 1. 관측: auth-service와 payment-service가 둘 다 role axis를 사용
    //    → 같은 의미가 수렴한다 → 타입이 공유된다 ────────────
    const domain: DomainNode = {
      kind: 'domain',
      id: 'shopping-domain',
      name: '쇼핑',
      prefixes: ['permission', 'event', 'service'],
      sharedAxes: ['env', 'region', 'svc_name', 'namespace'],
      boundary: { exports: ['permission', 'event'], internal: ['service'] },
    };
    const auth: ConsumerNode = {
      kind: 'consumer',
      id: 'auth-service',
      type: 'service',
      intendedPrefixes: ['permission', 'service'],
    };
    const payment: ConsumerNode = {
      kind: 'consumer',
      id: 'payment-service',
      type: 'service',
      intendedPrefixes: ['permission', 'service', 'event'],
    };
    graph.addNode(domain);
    graph.addNode(auth);
    graph.addNode(payment);
    graph.addEdge('contains', 'shopping-domain', 'permission');
    graph.addEdge('contains', 'shopping-domain', 'event');
    graph.addEdge('contains', 'shopping-domain', 'service');
    graph.addEdge('consumes', 'auth-service', 'shopping-domain');
    graph.addEdge('consumes', 'payment-service', 'shopping-domain');

    // ── 2. 수렴 확인: permission과 event가 같은 service를 참조 ─
    const permRefs = graph.neighbors('permission', 'references');
    const eventRefs = graph.neighbors('event', 'references');
    expect(permRefs).toContain('service');
    expect(eventRefs).toContain('service');
    // → 두 prefix가 같은 service 좌표를 공유 = 타입 수렴

    // ── 3. cascade: role 변경이 두 서비스 모두에 전파 ─────────
    const cascade = graph.cascadeFromAxis('role');
    const prefixIds = cascade.map((c) => c.id);
    expect(prefixIds).toContain('permission');

    const { consumers } = graph.cascadeFromPrefix('permission');
    const consumerIds = consumers.map((c) => c.id);
    expect(consumerIds).toContain('auth-service');
    expect(consumerIds).toContain('payment-service');
    // → 같은 축을 공유하므로, 변경이 양쪽에 동시 전파
    //    이것이 "타입이 공유되어 닫힌 조합의 숫자가 나오는" 지점
  });
});

// ═══════════════════════════════════════════════════════════════
//  양방향 통합: 전체 나선 한 회전
// ═══════════════════════════════════════════════════════════════

describe('양방향 통합: 나선 한 회전', () => {
  it('회전 1 → 운영 → 관측 → 회전 2로의 전이', async () => {
    // ── 회전 1: 핵심 인프라 (이미 DEMO_CATALOG에 있음) ───────
    //    service, permission, event prefix가 고정되어 있다
    const axisCount = graph.getNodesByKind('axis').length;
    const prefixCount = graph.getNodesByKind('prefix').length;
    expect(axisCount).toBeGreaterThan(10);
    expect(prefixCount).toBeGreaterThan(5);

    // ── 운영: qa-sdk가 좌표를 사용하여 기능 실행 ──────────────
    //    (시뮬레이션) encode/decode, 권한 체크, 이벤트 추적

    // ── 관측: "사용자 행동 추적이 필요하다" ───────────────────
    const obs: ObservationNode = {
      kind: 'observation',
      id: 'OBS-TRACK',
      date: '2026-03-20',
      source: 'manual',
      subjects: [],
      finding:
        '사용자 행동(click, view, scroll)을 좌표로 추적하는 기능이 필요하다. 현재 event prefix로는 부족하다.',
      suggestion: { kind: 'add-constraint', rule: 'tracking 전용 prefix 필요' },
    };
    graph.addNode(obs);

    // ── 회전 2: 관측에서 새 기능 정의 ─────────────────────────
    const decision = scaffoldDecision({
      type: 'new-prefix',
      id: 'DEC-TRACK',
      date: '2026-03-20',
      title: 'tracking prefix 신설',
      params: { prefixId: 'tracking', dims: ['trackAction', 'page', 'userType'] },
      rationale: '사용자 행동 추적 전용 좌표 공간 필요',
    });
    graph.addNode(decision);
    graph.addEdge('prompts', 'OBS-TRACK', 'DEC-TRACK');

    // ── publish → seal → activate ─────────────────────────────
    const trackingSpec: PrefixSpec = {
      id: 'tracking',
      version: 'v1',
      dims: {
        trackAction: { kind: 'axis', axisId: 'trackAction' },
        page: { kind: 'axis', axisId: 'page' },
        userType: { kind: 'axis', axisId: 'userType' },
      },
      export: {
        dims: ['trackAction', 'page', 'userType'],
        pattern: '{trackAction}.{page}.{userType}',
      },
    };

    await publishSpec(registry, { spec: trackingSpec, owner: 'team', mode: 'new' });
    await seal(registry, { prefix: 'tracking', versionId: 'v1' });

    // DKG에 tracking prefix 추가
    graph.addNode({
      kind: 'prefix',
      id: 'tracking',
      name: '행동 추적',
      dimLabels: ['trackAction', 'page', 'userType'],
    });
    graph.addEdge('composes', 'tracking', 'trackAction', { dimKind: 'axis' });
    graph.addEdge('composes', 'tracking', 'page', { dimKind: 'axis' });
    graph.addEdge('composes', 'tracking', 'userType', { dimKind: 'axis' });
    graph.addEdge('justifies', 'DEC-TRACK', 'tracking');

    const result = await activateAndPropagate(registry, graph, {
      prefix: 'tracking',
      versionId: 'v1',
      date: '2026-03-20',
    });

    expect(result.notification.event).toBe('activated');

    // ── 회전 2 완료: 검증 ──────────────────────────────────────
    //    이제 tracking prefix가 닫힌 세계에 합류했다
    //    (DEMO_CATALOG에 tracking이 이미 있으므로 노드 덮어쓰기)
    const trackingNode = graph.getNode('tracking');
    expect(trackingNode).toBeDefined();
    expect(trackingNode!.kind).toBe('prefix');

    //    추적 경로: 관측 → 결정 → prefix
    const trackPath = graph.edgesFrom('OBS-TRACK', 'prompts');
    expect(trackPath[0].to).toBe('DEC-TRACK');

    const decPath = graph.edgesFrom('DEC-TRACK', 'justifies');
    expect(decPath[0].to).toBe('tracking');

    //    "이미 있는 것이 닫힌 조합의 숫자가 된다"
    //    trackAction(4) × page(4) × userType(3) = 48개 조합
    //    각 조합은 0~47의 정수 주소를 가진다
    const finalStatus = await registry.getVersionStatus('tracking', 'v1');
    expect(finalStatus).toBe('active');
  });
});
