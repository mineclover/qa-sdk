/**
 * 자기참조 분석 — qa-sdk의 설계 결정을 decision-flow로 기록
 *
 * 이 파일은 두 가지 역할을 한다:
 * 1. qa-sdk 프로젝트의 실제 설계 결정을 FlowSchema + FlowInstance로 모델링
 * 2. decision-flow 시스템 자체의 유효성을 검증 (dog-fooding)
 *
 * "좌표계 시스템의 설계 과정 자체가 좌표로 추적된다"
 */

import { FlowSchemaBuilder } from "./schema.js";
import type { Evidence, FlowSchema } from "./types.js";
import { FlowEngine } from "./engine.js";
import {
  analyzeGateStructure,
  identifyCoreGates,
  extractCausalGraph,
  analyzeImpact,
  traceCorePath,
} from "./core-analysis.js";

// ─── qa-sdk 설계 결정 플로우 ─────────────────────────────

/**
 * qa-sdk의 핵심 설계 결정 플로우.
 *
 * 좌표계 시스템을 설계할 때 반드시 거치는 결정 순서:
 * 1. 축 정의 (어떤 차원이 존재하는가?)        ← CORE: 모든 것의 근본
 * 2. prefix 설계 (어떤 조합이 주소 공간인가?)  ← CORE: 인코딩 구조 결정
 * 3. capacity 설정 (얼마나 여유를 두는가?)     ← structural: stride에 영향
 * 4. version 관리 (언제 새 버전을 만드는가?)   ← structural: 호환성 결정
 * 5. merge/split 판정 (겹치는 축을 합치는가?)  ← CORE: 구조적 분기
 * 6. 서비스 바인딩 (어떤 서비스가 소유하는가?)  ← tactical
 */
export const COORDINATE_DESIGN_FLOW: FlowSchema = new FlowSchemaBuilder(
  "coordinate-design",
  "좌표계 설계 결정",
)
  .description("qa-sdk 좌표계 시스템의 핵심 설계 결정 흐름")
  .gate(
    "axis-definition",
    "축 정의 (5Q Checklist)",
    "decide",
    [
      { id: "new-axis", label: "새 축 생성 (5Q 통과)", description: "Q1~Q5를 모두 통과해 독립 axis로 승격한다." },
      { id: "reuse-existing", label: "기존 축 재사용", description: "의미적으로 대응하는 기존 axis를 찾아 재사용한다." },
      { id: "table-ref", label: "축이 아닌 table_ref로 처리 (5Q 미통과)", description: "값 공간이 무한하거나 불안정해 좌표 대신 참조형 필드로 다룬다." },
      { id: "defer", label: "결정 보류 — 데이터 더 필요", description: "근거가 부족하므로 추가 관측 전까지 구조 결정을 보류한다." },
    ],
    { requiredEvidence: ["data", "rule"] },
  )
  .gate(
    "prefix-design",
    "prefix 설계 (주소 공간 구성)",
    "decide",
    [
      { id: "new-prefix", label: "새 prefix 생성", description: "독립된 주소 공간이 필요하므로 새로운 prefix를 만든다." },
      { id: "extend-existing", label: "기존 prefix에 dim 추가", description: "기존 prefix를 유지한 채 차원만 확장한다." },
      { id: "split-prefix", label: "기존 prefix 분할", description: "서로 다른 의미 축을 분리해 별도 prefix들로 나눈다." },
    ],
    { requiredEvidence: ["data", "rule"] },
  )
  .gate(
    "capacity-setting",
    "capacity 설정 (headroom 관리)",
    "evaluate",
    [
      { id: "minimum", label: "nextPowerOf2(entries × 2) — 최소", description: "현재 entry 수의 2배를 만족하는 최소 power-of-two capacity를 택한다." },
      { id: "generous", label: "넉넉하게 (4× headroom)", description: "향후 확장을 위해 여유 capacity를 크게 확보한다." },
      { id: "exact", label: "정확히 맞춤 (headroom 0, 위험)", description: "추가 headroom 없이 현재 수요에만 맞춰 설정한다." },
    ],
  )
  .gate(
    "version-strategy",
    "버전 전략",
    "plan",
    [
      { id: "in-place", label: "현재 버전 수정 (개발 중)", description: "아직 소비자 호환성이 엄격하지 않으므로 현재 버전을 직접 수정한다." },
      { id: "new-version", label: "새 버전 생성 (릴리즈됨)", description: "기존 소비자를 보호하기 위해 새 버전을 발급한다." },
      { id: "migration", label: "마이그레이션 경로 구축", description: "버전 전환 비용을 줄이기 위해 이행 경로를 함께 설계한다." },
    ],
  )
  .gate(
    "merge-split",
    "merge/split 판정",
    "decide",
    [
      { id: "keep-separate", label: "분리 유지 (DEC-SEP)", description: "의미 경계가 다르므로 현재 구조를 유지한다." },
      { id: "merge", label: "병합 (DEC-MERGE)", description: "중복과 혼동을 줄이기 위해 두 구조를 하나로 합친다." },
      { id: "not-applicable", label: "해당 없음", description: "현재 대상에는 merge/split 판단이 적용되지 않는다." },
    ],
  )
  .gate(
    "service-binding",
    "서비스 바인딩",
    "plan",
    [
      { id: "single-owner", label: "단일 서비스 소유", description: "한 서비스가 명확한 오너십을 갖고 수명주기를 관리한다." },
      { id: "shared", label: "복수 서비스 공유", description: "둘 이상의 서비스가 공동 책임을 진다." },
      { id: "cross-cutting", label: "크로스커팅 (도메인 무관)", description: "특정 도메인에 귀속되지 않고 플랫폼 전반에서 사용된다." },
    ],
  )
  .build();

// weight와 affects를 별도로 정의 (빌더로 표현하기 어려운 구조적 메타데이터)
const GATE_WEIGHTS: Record<string, { weight: "core" | "structural" | "tactical"; affects?: Array<{ gateId: string; kind: "constrains" | "enables" | "invalidates" }> }> = {
  "axis-definition": {
    weight: "core",
    affects: [
      { gateId: "prefix-design", kind: "constrains" },
      { gateId: "capacity-setting", kind: "enables" },
      { gateId: "merge-split", kind: "constrains" },
    ],
  },
  "prefix-design": {
    weight: "core",
    affects: [
      { gateId: "capacity-setting", kind: "enables" },
      { gateId: "version-strategy", kind: "constrains" },
      { gateId: "service-binding", kind: "constrains" },
    ],
  },
  "capacity-setting": {
    weight: "structural",
    affects: [
      { gateId: "version-strategy", kind: "constrains" },
    ],
  },
  "version-strategy": {
    weight: "structural",
    affects: [],
  },
  "merge-split": {
    weight: "core",
    affects: [
      { gateId: "prefix-design", kind: "invalidates" },
      { gateId: "capacity-setting", kind: "invalidates" },
    ],
  },
  "service-binding": {
    weight: "tactical",
    affects: [],
  },
};

/**
 * weight와 affects가 주입된 완전한 스키마를 반환한다.
 * (FlowSchemaBuilder는 weight/affects를 지원하지 않으므로 후처리)
 */
export function getAnnotatedDesignFlow(): FlowSchema {
  return {
    ...COORDINATE_DESIGN_FLOW,
    gates: COORDINATE_DESIGN_FLOW.gates.map((gate) => {
      const meta = GATE_WEIGHTS[gate.id];
      if (!meta) return gate;
      return Object.assign({}, gate, { weight: meta.weight, affects: meta.affects });
    }),
  };
}

// ─── qa-sdk 실제 설계 결정 기록 ──────────────────────────

function _now(): string { return new Date().toISOString(); }

function ev(kind: Evidence["kind"], source: string, content: string, weight: number): Evidence {
  return { kind, source, content, weight };
}

/**
 * qa-sdk의 실제 설계 결정 3건을 FlowInstance로 기록한다.
 *
 * 이것은 시스템을 자기 자신에게 적용하는 dog-fooding이다.
 */
export function recordQaSdkDesignDecisions(): {
  instances: ReturnType<FlowEngine["getInstance"]>[];
  engine: FlowEngine;
} {
  const engine = new FlowEngine();
  const schema = getAnnotatedDesignFlow();
  engine.registerSchema(schema);

  const instances = [];

  // ── 결정 1: cognitive_phase 축 정의 (이번 대화에서 실제로 한 결정) ──

  const d1 = engine.startFlow("coordinate-design", {
    subject: "cognitive_phase 축 정의",
    date: "2026-03-23",
    project: "decision-flow",
  });

  engine.selectBranch(d1.id, "new-axis", [
    ev("rule", "5Q-checklist", "Q1 유한(7개 고정)✓ Q2 의사결정(단계별 처리)✓ Q3 공유(전 prefix)✓ Q4 안정(인지과학)✓ Q5 capacity(16)✓", 0.95),
    ev("data", "gstack-analysis", "gstack의 7단계 인지 모델이 OODA 루프 확장과 일치", 0.8),
  ]);

  engine.selectBranch(d1.id, "new-prefix", [
    ev("rule", "prefix-as-decision-unit", "의사결정 이벤트는 기존 쇼핑 prefix와 독립된 주소 공간 필요", 0.9),
  ]);

  engine.selectBranch(d1.id, "minimum", [
    ev("rule", "capacity-minimum", "nextPowerOf2(7 × 2) = 16. 최소 기준 충족", 0.95),
  ]);

  engine.selectBranch(d1.id, "in-place", [
    ev("data", "development-stage", "아직 개발 중. 릴리즈 전이므로 v1 자유 수정", 0.9),
  ]);

  engine.selectBranch(d1.id, "not-applicable", [
    ev("data", "first-axis", "신규 도메인이므로 merge/split 대상 없음", 1.0),
  ]);

  engine.selectBranch(d1.id, "cross-cutting", [
    ev("rule", "domain-independence", "인지 단계는 모든 의사결정 플로우에 공통", 0.9),
  ]);

  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion -- instance just created above
  instances.push(engine.getInstance(d1.id)!);

  // ── 결정 2: mental_model 축 정의 ──

  const d2 = engine.startFlow("coordinate-design", {
    subject: "mental_model 축 정의",
    date: "2026-03-23",
    project: "decision-flow",
  });

  engine.selectBranch(d2.id, "new-axis", [
    ev("rule", "5Q-checklist", "Q1 유한(13개)✓ Q2 의사결정(인지 도구 선택)✓ Q3 공유(△ model_apply)✓ Q4 안정(인지과학 기반)✓ Q5 capacity(32)✓", 0.85),
    ev("external", "gstack-ethos", "garrytan/gstack의 Cognitive Patterns 18개에서 의사결정 관련 13개 추출", 0.8),
    ev("precedent", "qa-sdk-pattern", "기존 behavior_pattern 축과 동일 패턴: 분류 어휘 → 축 → 좌표 차원", 0.75),
  ]);

  engine.selectBranch(d2.id, "new-prefix", [
    ev("rule", "prefix-as-decision-unit", "model_apply prefix: 어떤 인지 모델을 언제 적용했는가 추적", 0.85),
  ]);

  engine.selectBranch(d2.id, "generous", [
    ev("data", "headroom-analysis", "13 entries → minimum 32. 새 모델 추가 여지 19개. 인지과학 발전 대비", 0.8),
  ]);

  engine.selectBranch(d2.id, "in-place");
  engine.selectBranch(d2.id, "not-applicable");
  engine.selectBranch(d2.id, "cross-cutting");

  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion -- instance just created above
  instances.push(engine.getInstance(d2.id)!);

  // ── 결정 3: scope_mode 축 — 이건 논쟁적인 결정이었다 ──

  const d3 = engine.startFlow("coordinate-design", {
    subject: "scope_mode 축 정의 (논쟁적)",
    date: "2026-03-23",
    project: "decision-flow",
  });

  engine.selectBranch(d3.id, "new-axis", [
    ev("rule", "5Q-checklist", "Q1 유한(4개)✓ Q2 의사결정(핵심 분기)✓ Q3 공유(△ ceo_review 관련만)△ Q4 안정✓ Q5 capacity(8)✓", 0.7),
    ev("intuition", "design-judgment", "Q3 공유가 약하다 — ceo_review의 decision_path에서만 사용. 독립 축이 맞는가?", 0.5),
    ev("precedent", "gstack-ceo-review", "gstack에서 scope mode가 전체 리뷰의 방향을 결정하는 핵심 분기", 0.85),
  ], { confidence: 0.7 });

  engine.selectBranch(d3.id, "extend-existing", [
    ev("rule", "prefix-as-decision-unit", "decision_path prefix의 dim으로 추가. 별도 prefix 불필요", 0.9),
  ]);

  engine.selectBranch(d3.id, "minimum", [
    ev("rule", "capacity-minimum", "4 entries → nextPowerOf2(8) = 8", 0.95),
  ]);

  engine.selectBranch(d3.id, "in-place");
  engine.selectBranch(d3.id, "not-applicable");

  engine.selectBranch(d3.id, "single-owner", [
    ev("data", "usage-analysis", "scope_mode는 ceo_review 플로우에서만 의미. 크로스커팅이 아님", 0.85),
  ]);

  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion -- instance just created above
  instances.push(engine.getInstance(d3.id)!);

  return { instances, engine };
}

/**
 * 기록된 결정들을 분석하여 코어 결정 추적 결과를 반환한다.
 *
 * 이 함수가 답하는 질문:
 * - 어떤 결정이 코어였는가?
 * - 그 결정이 무엇을 결정했는가?
 * - 변경하면 무엇이 무효화되는가?
 */
export function analyzeRecordedDecisions(): {
  gateProfiles: ReturnType<typeof analyzeGateStructure>;
  coreGates: ReturnType<typeof identifyCoreGates>;
  causalGraph: ReturnType<typeof extractCausalGraph>;
  axisMergeImpact: ReturnType<typeof analyzeImpact>;
  traces: ReturnType<typeof traceCorePath>[];
} {
  const schema = getAnnotatedDesignFlow();
  const { instances } = recordQaSdkDesignDecisions();

  const gateProfiles = analyzeGateStructure(schema);
  const coreGates = identifyCoreGates(gateProfiles);
  const causalGraph = extractCausalGraph(schema);

  // "merge-split을 변경하면 무엇이 무효화되는가?" — 가장 위험한 시나리오
  const axisMergeImpact = analyzeImpact(schema, "merge-split");

  // 각 인스턴스의 코어 결정 추적
  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion -- instances are all valid from recordQaSdkDesignDecisions
  const traces = instances.map((inst) => traceCorePath(schema, inst!));

  return { gateProfiles, coreGates, causalGraph, axisMergeImpact, traces };
}
