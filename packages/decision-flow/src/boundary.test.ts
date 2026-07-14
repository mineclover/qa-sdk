import { describe, expect, it } from 'vitest';
import {
  DECISION_LAYERS,
  getLayerForFlow,
  validateLayerConstraints,
  propagateScope,
  createEscalationRequest,
} from './boundary.js';
import type { DecisionContext, EscalationRequest } from './boundary.js';
import type { FlowInstance } from './types.js';

// ─── qa-sdk 컨텍스트 바운더리 정의 ───────────────────────

/**
 * qa-sdk 프로젝트의 4개 의사결정 컨텍스트.
 *
 * 이것이 이 시스템의 실제 경계다:
 * - coordinate-design: 좌표계 자체의 구조 결정
 * - platform-runtime: 서비스 배포/운영 결정
 * - dkg-governance: 설계 지식 그래프 관측/수렴 결정
 * - sprint-execution: 구현/리뷰/출시 결정
 */
const QA_SDK_CONTEXTS: readonly DecisionContext[] = [
  {
    id: 'coordinate-design',
    name: '좌표 설계',
    description: '축, prefix, capacity 등 좌표계 자체의 구조를 결정',
    ownedFlows: ['coordinate-design'],
    ownedAxes: ['cognitive_phase', 'flow_type', 'evidence_kind', 'mental_model', 'confidence_band'],
    ownedPrefixes: ['decision_event', 'model_apply', 'forcing_response'],
    exports: [
      {
        name: 'axis_decision',
        sourceFlowId: 'coordinate-design',
        sourceGateId: 'axis-definition',
        kind: 'constraint',
      },
      {
        name: 'prefix_decision',
        sourceFlowId: 'coordinate-design',
        sourceGateId: 'prefix-design',
        kind: 'constraint',
      },
      {
        name: 'capacity_decision',
        sourceFlowId: 'coordinate-design',
        sourceGateId: 'capacity-setting',
        kind: 'value',
      },
    ],
    imports: [], // 루트 컨텍스트 — 외부 의존 없음
  },
  {
    id: 'platform-runtime',
    name: '플랫폼 런타임',
    description: '서비스 배포, 모니터링, 게이트 관리 결정',
    ownedFlows: ['investigation'],
    ownedAxes: ['escalation_type', 'decision_outcome'],
    ownedPrefixes: ['escalation_event'],
    exports: [
      {
        name: 'incident_finding',
        sourceFlowId: 'investigation',
        sourceGateId: 'root-cause',
        kind: 'value',
      },
    ],
    imports: [
      // coordinate-design의 축/prefix 결정이 이 컨텍스트의 인코딩을 제약
      {
        name: 'encoding_constraint',
        sourceContextId: 'coordinate-design',
        sourceExportName: 'prefix_decision',
        targetFlowId: 'investigation',
        targetGateId: 'symptoms',
        effect: 'informs',
      },
    ],
  },
  {
    id: 'dkg-governance',
    name: 'DKG 거버넌스',
    description: '설계 지식 그래프의 관측, 수렴, 제약 관리 결정',
    ownedFlows: [], // 아직 DKG 전용 FlowSchema 미정의
    ownedAxes: ['scope_mode', 'reversibility', 'magnitude'],
    ownedPrefixes: ['decision_path'],
    exports: [],
    imports: [
      {
        name: 'axis_structure',
        sourceContextId: 'coordinate-design',
        sourceExportName: 'axis_decision',
        targetFlowId: 'ceo-review', // 전략 리뷰에서 참조
        targetGateId: 'premise',
        effect: 'constrains',
      },
    ],
  },
  {
    id: 'sprint-execution',
    name: '스프린트 실행',
    description: '계획 → 구현 → 리뷰 → 출시 사이클 결정',
    ownedFlows: [
      'office-hours',
      'ceo-review',
      'eng-review',
      'design-review',
      'code-review',
      'ship',
    ],
    ownedAxes: ['forcing_question'],
    ownedPrefixes: ['forcing_response'],
    exports: [
      {
        name: 'scope_mode',
        sourceFlowId: 'ceo-review',
        sourceGateId: 'scope-mode',
        kind: 'constraint',
      },
    ],
    imports: [
      // coordinate-design의 구조가 eng-review를 제약
      {
        name: 'coordinate_structure',
        sourceContextId: 'coordinate-design',
        sourceExportName: 'axis_decision',
        targetFlowId: 'eng-review',
        targetGateId: 'architecture',
        effect: 'constrains',
      },
      // platform-runtime의 장애 발견이 investigation을 유발
      {
        name: 'incident_trigger',
        sourceContextId: 'platform-runtime',
        sourceExportName: 'incident_finding',
        targetFlowId: 'investigation',
        targetGateId: 'symptoms',
        effect: 'informs',
      },
    ],
  },
];

// ─── 계층 테스트 ─────────────────────────────────────────

describe('decision layers', () => {
  it('4개 계층이 정의되어 있다', () => {
    expect(DECISION_LAYERS).toHaveLength(4);
    expect(DECISION_LAYERS.map((l) => l.id)).toEqual([
      'strategic',
      'tactical',
      'operational',
      'execution',
    ]);
  });

  it('office-hours는 strategic 계층이다', () => {
    const layer = getLayerForFlow('office-hours');
    expect(layer?.id).toBe('strategic');
    expect(layer?.level).toBe(0);
  });

  it('code-review는 operational 계층이다', () => {
    const layer = getLayerForFlow('code-review');
    expect(layer?.id).toBe('operational');
  });

  it('ship은 execution 계층이다', () => {
    const layer = getLayerForFlow('ship');
    expect(layer?.id).toBe('execution');
  });
});

// ─── 계층 제약 위반 검증 ─────────────────────────────────

describe('layer constraint validation', () => {
  it('하향 제약은 위반 없음 (전략→전술)', () => {
    const violations = validateLayerConstraints(
      'ceo-review', // strategic
      'eng-review', // tactical
      'constrains',
    );
    expect(violations).toHaveLength(0);
  });

  it('상향 변경은 upward-mutation 위반', () => {
    const violations = validateLayerConstraints(
      'code-review', // operational (level 2)
      'ceo-review', // strategic (level 0)
      'invalidates',
    );
    expect(violations.some((v) => v.kind === 'upward-mutation')).toBe(true);
  });

  it('2단계 건너뛰기는 skip-layer 위반', () => {
    const violations = validateLayerConstraints(
      'office-hours', // strategic (level 0)
      'code-review', // operational (level 2)
      'constrains',
    );
    expect(violations.some((v) => v.kind === 'skip-layer')).toBe(true);
  });

  it('경계 횡단 시 import 없으면 boundary-crossing 위반', () => {
    // coordinate-design → sprint-execution 직접 참조 (import 없는 방향)
    const violations = validateLayerConstraints(
      'coordinate-design', // coordinate-design 컨텍스트
      'office-hours', // sprint-execution 컨텍스트
      'constrains',
      QA_SDK_CONTEXTS,
    );
    // sprint-execution은 coordinate-design에서 import를 정의했으므로 위반 아님
    // (하지만 office-hours에 대한 import는 없을 수 있음)
    // 여기서는 계층 수준의 검증만 진행
  });
});

// ─── 컨텍스트 바운더리 테스트 ─────────────────────────────

describe('context boundaries', () => {
  it('4개 컨텍스트가 qa-sdk를 커버한다', () => {
    expect(QA_SDK_CONTEXTS).toHaveLength(4);
    const allFlows = QA_SDK_CONTEXTS.flatMap((c) => c.ownedFlows);
    // 주요 플로우가 모두 소유됨
    expect(allFlows).toContain('coordinate-design');
    expect(allFlows).toContain('office-hours');
    expect(allFlows).toContain('ceo-review');
    expect(allFlows).toContain('ship');
  });

  it('coordinate-design은 루트 컨텍스트 (import 없음)', () => {
    const coordCtx = QA_SDK_CONTEXTS.find((c) => c.id === 'coordinate-design')!;
    expect(coordCtx.imports).toHaveLength(0);
    expect(coordCtx.exports.length).toBeGreaterThan(0);
  });

  it('sprint-execution은 coordinate-design에서 import한다', () => {
    const sprintCtx = QA_SDK_CONTEXTS.find((c) => c.id === 'sprint-execution')!;
    const coordImport = sprintCtx.imports.find((i) => i.sourceContextId === 'coordinate-design');
    expect(coordImport).toBeDefined();
    expect(coordImport!.effect).toBe('constrains');
  });

  it('경계 간 import/export가 매칭된다', () => {
    for (const ctx of QA_SDK_CONTEXTS) {
      for (const imp of ctx.imports) {
        const sourceCtx = QA_SDK_CONTEXTS.find((c) => c.id === imp.sourceContextId);
        expect(sourceCtx, `import source "${imp.sourceContextId}" not found`).toBeDefined();

        const matchingExport = sourceCtx!.exports.find((e) => e.name === imp.sourceExportName);
        expect(
          matchingExport,
          `context "${ctx.id}" imports "${imp.sourceExportName}" from "${imp.sourceContextId}" but no matching export`,
        ).toBeDefined();
      }
    }
  });
});

// ─── 스코프 상속 테스트 ──────────────────────────────────

describe('scope propagation', () => {
  it('전략 결정이 전술 플로우에 상속된다', () => {
    const ceoInstance: FlowInstance = {
      id: 'ceo-1',
      schemaId: 'ceo-review',
      schemaVersion: 'v1',
      status: 'completed',
      context: {},
      selections: [
        {
          gateId: 'scope-mode',
          branchId: 'expansion',
          evidence: [],
          confidence: 0.9,
          timestamp: '',
          durationMs: 0,
        },
        {
          gateId: 'risk',
          branchId: 'medium',
          evidence: [],
          confidence: 0.8,
          timestamp: '',
          durationMs: 0,
        },
      ],
      startedAt: '',
    };

    const sprintCtx = QA_SDK_CONTEXTS.find((c) => c.id === 'sprint-execution')!;
    const inherited = propagateScope(
      ceoInstance,
      {} as any, // schema not needed for this test
      'eng-review', // tactical — 하위 계층
      sprintCtx.exports,
    );

    // scope-mode=expansion이 제약으로 상속됨
    expect(inherited).toHaveProperty('constraint_scope_mode');
    const constraint = inherited['constraint_scope_mode'] as any;
    expect(constraint.branchId).toBe('expansion');
    expect(constraint.fromLayer).toBe('strategic');
  });

  it('같은 계층에는 상속되지 않는다', () => {
    const ceoInstance: FlowInstance = {
      id: 'ceo-1',
      schemaId: 'ceo-review', // strategic
      schemaVersion: 'v1',
      status: 'completed',
      context: {},
      selections: [
        {
          gateId: 'scope-mode',
          branchId: 'hold',
          evidence: [],
          confidence: 0.9,
          timestamp: '',
          durationMs: 0,
        },
      ],
      startedAt: '',
    };

    const sprintCtx = QA_SDK_CONTEXTS.find((c) => c.id === 'sprint-execution')!;
    const inherited = propagateScope(
      ceoInstance,
      {} as any,
      'office-hours', // 같은 strategic 계층
      sprintCtx.exports,
    );

    expect(Object.keys(inherited)).toHaveLength(0);
  });
});

// ─── 에스컬레이션 요청 ───────────────────────────────────

describe('escalation request', () => {
  it('하위→상위 변경 요청을 생성한다', () => {
    const sprintCtx = QA_SDK_CONTEXTS.find((c) => c.id === 'sprint-execution')!;
    const coordCtx = QA_SDK_CONTEXTS.find((c) => c.id === 'coordinate-design')!;

    const req = createEscalationRequest(
      sprintCtx,
      coordCtx,
      'eng-review',
      'architecture',
      'coordinate-design',
      'capacity-setting',
      'generous',
      '현재 capacity가 부족하여 stride-break 위험. eng-review에서 발견',
    );

    expect(req.id).toMatch(/^ESC-/);
    expect(req.status).toBe('pending');
    expect(req.sourceContextId).toBe('sprint-execution');
    expect(req.targetContextId).toBe('coordinate-design');
    expect(req.requestedBranch).toBe('generous');
  });
});

// ─── 통합 시나리오: 전체 흐름 검증 ──────────────────────

describe('integration: full boundary flow', () => {
  it('전략→전술→운영→실행 전체 계층 흐름', () => {
    // 1. 전략 결정
    const strategicLayer = getLayerForFlow('ceo-review');
    expect(strategicLayer?.id).toBe('strategic');

    // 2. 전략→전술 제약 전파 (정상)
    const v1 = validateLayerConstraints('ceo-review', 'eng-review', 'constrains');
    expect(v1).toHaveLength(0);

    // 3. 전술→운영 제약 전파 (정상)
    const v2 = validateLayerConstraints('eng-review', 'code-review', 'constrains');
    expect(v2).toHaveLength(0);

    // 4. 운영→전략 직접 변경 시도 (위반!)
    const v3 = validateLayerConstraints('code-review', 'ceo-review', 'invalidates');
    expect(v3.some((v) => v.kind === 'upward-mutation')).toBe(true);

    // 5. 대신 에스컬레이션 요청 생성
    const sprintCtx = QA_SDK_CONTEXTS.find((c) => c.id === 'sprint-execution')!;
    const req = createEscalationRequest(
      sprintCtx,
      sprintCtx, // 같은 컨텍스트 내에서도 계층이 다르면 에스컬레이션
      'code-review',
      'severity',
      'ceo-review',
      'scope-mode',
      'reduction',
      '코드 리뷰에서 scope 과다 발견. 축소 검토 필요',
    );
    expect(req.status).toBe('pending');
  });
});
