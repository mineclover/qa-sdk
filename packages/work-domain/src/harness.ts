// @def.boundary shared-utility-group
// @def.doc shared-utility-group

/**
 * 하네스 상태 모델
 *
 * definition-catalog의 unit/module/leaf 문서가 좌표 anchor가 되고,
 * 하위 문서 그래프에서 계약 문서(interface, constraint)를 식별하여
 * 품질 게이트를 도출한다. 게이트 전체 통과 = anchor 완성도 검증.
 *
 * 6단계 프로세스: Define → Resolve → Gather → Execute → Judge → Route
 *
 * 이 모듈은 순수 함수만 포함한다.
 * definition-catalog/CLI 의존 없이, 인터페이스를 통해 문서 그래프를 주입받는다.
 */

import type { GateKindId, GateScope } from './gate-kind.js';

// ── Gate FSM + BundleState는 gate-fsm.ts에 분리. re-export로 하위 호환 유지. ──
import type { GateState, GateEvent, BundleState } from './gate-fsm.js';
import { transitionGate, deriveBundleState } from './gate-fsm.js';
export type { GateState, GateEvent, BundleState } from './gate-fsm.js';
export { transitionGate, deriveBundleState };

// ── 계약 문서 식별 + GateKind 도출은 contract-to-gates.ts에 분리. ──
import { isContractDoc, deriveGateKinds, GATE_KIND_SCOPE_MAP } from './contract-to-gates.js';
export { isContractDoc, deriveGateKinds, GATE_KIND_SCOPE_MAP };

// ─── 문서 그래프 인터페이스 ─────────────────────────────

/**
 * definition-catalog 문서 요약.
 * harness는 이 인터페이스만 사용한다 (definition-catalog 직접 의존 없음).
 */
export interface DocNode {
  /** 문서 ID (kebab-case) */
  readonly id: string;
  /** 분해 레벨 */
  readonly level: 'group' | 'module' | 'leaf';
  /** 대분류 */
  readonly scope: string;
  /** 세부 측면 */
  readonly aspect: string;
  /** 깊이 */
  readonly depth: string;
  /** 존재론적 계층 */
  readonly layer?: string;
  /** 생명주기 */
  readonly lifecycle?: string;
  /** 태그 */
  readonly tags?: readonly string[];
}

/** 문서 간 링크 */
export interface DocLink {
  readonly sourceId: string;
  readonly targetId: string;
  readonly linkType:
    | 'contains'
    | 'depends_on'
    | 'implements'
    | 'refines'
    | 'constrains'
    | 'traces_to';
}

/**
 * 문서 그래프 포트.
 * CLI 또는 definition-service가 구현하여 harness에 주입한다.
 */
export interface DocGraphPort {
  /** ID로 문서 조회 */
  get(id: string): DocNode | undefined;
  /** 하위 문서 (contains 링크) */
  getChildren(id: string): readonly DocNode[];
  /** 이 문서를 제약하는 문서 (constrains 링크) */
  getConstraints(id: string): readonly DocNode[];
  /** 이 문서가 의존하는 문서 (depends_on 링크) */
  getDependencies(id: string): readonly DocNode[];
  /** 나가는 링크 전체 */
  getOutgoingLinks(id: string): readonly DocLink[];
}

// ─── 하네스 계획 (Define + Resolve 단계) ────────────────

/** 도출된 게이트 요구사항 */
export interface GateRequirement {
  /** 근거가 된 계약 문서 ID */
  readonly contractDocId: string;
  /** 계약 문서의 scope */
  readonly contractScope: string;
  /** 계약 문서의 aspect */
  readonly contractAspect: string;
  /** 필요한 게이트 유형 */
  readonly gateKind: GateKindId;
  /** 게이트 유형의 검증 범위 */
  readonly gateScope: GateScope;
}

/** 하네스 계획 — anchor 문서에서 도출된 전체 gate 목록 */
export interface HarnessPlan {
  /** 좌표 anchor 문서 ID */
  readonly anchorId: string;
  /** anchor 레벨 */
  readonly anchorLevel: DocNode['level'];
  /** 수집된 하위 문서 수 */
  readonly totalDocs: number;
  /** 식별된 계약 문서 수 */
  readonly contractDocs: number;
  /** 도출된 게이트 요구사항 (비용 순 정렬) */
  readonly requirements: readonly GateRequirement[];
}

/** GateScope 비용 순서 (낮을수록 먼저 실행) */
const SCOPE_COST: Record<GateScope, number> = {
  static: 0,
  unit: 1,
  integration: 2,
  build: 3,
  audit: 4,
  system: 5,
  ai: 6,
};

/**
 * anchor 문서에서 하네스 계획을 생성한다.
 *
 * 1. anchor의 contains 링크를 탐색하여 하위 문서 수집
 * 2. 계약 문서(interface, constraint) 식별
 * 3. 각 계약 문서에서 필요한 GateKind 도출
 * 4. 비용 순 정렬 (static → unit → integration → system)
 */
export function buildHarnessPlan(anchorId: string, graph: DocGraphPort): HarnessPlan {
  const anchor = graph.get(anchorId);
  if (!anchor) {
    return { anchorId, anchorLevel: 'leaf', totalDocs: 0, contractDocs: 0, requirements: [] };
  }

  // 하위 문서 수집 (재귀적 contains 탐색)
  const allDocs: DocNode[] = [];
  const visited = new Set<string>();

  function collectChildren(id: string): void {
    if (visited.has(id)) return;
    visited.add(id);
    const children = graph.getChildren(id);
    for (const child of children) {
      allDocs.push(child);
      collectChildren(child.id);
    }
    // constrains 링크의 문서도 수집
    const constraints = graph.getConstraints(id);
    for (const c of constraints) {
      if (!visited.has(c.id)) {
        allDocs.push(c);
        visited.add(c.id);
      }
    }
  }

  collectChildren(anchorId);

  // 계약 문서 식별
  const contracts = allDocs.filter(isContractDoc);

  // 게이트 요구사항 도출
  const requirements: GateRequirement[] = [];
  const seen = new Set<string>(); // contractDocId:gateKind 중복 방지

  for (const doc of contracts) {
    const kinds = deriveGateKinds(doc);
    for (const kind of kinds) {
      const key = `${doc.id}:${kind}`;
      if (seen.has(key)) continue;
      seen.add(key);

      const scope = GATE_KIND_SCOPE_MAP[kind] ?? 'unit';
      requirements.push({
        contractDocId: doc.id,
        contractScope: doc.scope,
        contractAspect: doc.aspect,
        gateKind: kind,
        gateScope: scope,
      });
    }
  }

  // 비용 순 정렬
  requirements.sort((a, b) => SCOPE_COST[a.gateScope] - SCOPE_COST[b.gateScope]);

  return {
    anchorId,
    anchorLevel: anchor.level,
    totalDocs: allDocs.length,
    contractDocs: contracts.length,
    requirements,
  };
}

// ─── 하네스 런타임 상태 ────────────────────────────────

/** 단일 게이트 런타임 상태 */
export interface GateInstance {
  /** 게이트 요구사항 (plan에서 도출) */
  readonly requirement: GateRequirement;
  /** 현재 상태 */
  state: GateState;
  /** 마지막 실행 exit code */
  lastExitCode?: number;
  /** 마지막 상태 전이 시각 (ISO-8601) */
  lastTransitionAt?: string;
}

/** 하네스 전체 런타임 상태 */
export interface HarnessInstance {
  /** 계획 */
  readonly plan: HarnessPlan;
  /** 게이트 인스턴스 목록 */
  readonly gates: readonly GateInstance[];
  /** 번들 상태 (gates에서 파생) */
  readonly bundleState: BundleState;
}

/** HarnessPlan에서 초기 HarnessInstance를 생성한다. */
export function createHarnessInstance(plan: HarnessPlan): HarnessInstance {
  const gates: GateInstance[] = plan.requirements.map((req) => ({
    requirement: req,
    state: 'idle' as GateState,
  }));

  return {
    plan,
    gates,
    bundleState: deriveBundleState(gates.map((g) => g.state)),
  };
}

/** 특정 gate에 이벤트를 적용하고 번들 상태를 재계산한다. */
export function applyGateEvent(
  harness: HarnessInstance,
  gateIndex: number,
  event: GateEvent,
): HarnessInstance {
  const gates = harness.gates.map((g, i) => {
    if (i !== gateIndex) return g;
    const newState = transitionGate(g.state, event);
    return {
      ...g,
      state: newState,
      lastExitCode: event.type === 'exit' ? event.code : g.lastExitCode,
      lastTransitionAt: new Date().toISOString(),
    };
  });

  return {
    ...harness,
    gates,
    bundleState: deriveBundleState(gates.map((g) => g.state)),
  };
}

/** 실행 가능한 다음 gate 인덱스를 비용 순으로 반환한다. */
export function nextReadyGates(harness: HarnessInstance): number[] {
  return harness.gates
    .map((g, i) => ({ gate: g, index: i }))
    .filter(({ gate }) => gate.state === 'idle' || gate.state === 'ready')
    .map(({ index }) => index);
}
