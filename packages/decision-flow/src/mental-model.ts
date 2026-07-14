// @def.boundary df-system
/**
 * 인지 프레임워크 (Mental Models)
 *
 * 의사결정에 적용할 인지적 도구를 정의한다.
 * gstack(garrytan/gstack)의 Cognitive Patterns에서 추출.
 *
 * 모든 분기점(Gate)은 하나 이상의 mental model을 참조할 수 있다.
 * 모델은 "어떻게 생각할 것인가"에 대한 가이드이며,
 * 자동 선택 정책의 근거 평가에도 사용된다.
 */

// ─── 가역성 분류 (Bezos Doors) ───────────────────────────

/**
 * Bezos의 one-way/two-way door 프레임워크.
 *
 * - one-way: 되돌리기 어려움 → 신중하게 (더 많은 근거, 더 높은 confidence 요구)
 * - two-way: 쉽게 되돌림 → 빠르게 (70% 정보면 충분)
 */
export type Reversibility = 'one-way' | 'two-way';

/**
 * 결정의 영향 범위.
 * reversibility × magnitude로 결정의 속도를 보정한다.
 *
 * one-way + critical → 매우 신중 (전체 팀 합의, 외부 검증)
 * two-way + minor → 즉시 실행 (자동 선택 가능)
 */
export type Magnitude = 'minor' | 'moderate' | 'major' | 'critical';

/** 가역성 × 영향 분류 */
export interface ReversibilityClassification {
  readonly reversibility: Reversibility;
  readonly magnitude: Magnitude;
  /** 왜 이 분류인지 한 줄 설명 */
  readonly rationale: string;
}

// ─── 3-Layer 지식 (Search Before Building) ───────────────

/**
 * gstack ETHOS.md의 3-Layer 지식 프레임워크.
 *
 * - L1: 검증된 것 (tried-and-true). 표준 패턴, 오래된 지혜.
 * - L2: 새롭고 인기 있는 것 (new-and-popular). 최근 블로그, 트렌드. 비판적으로.
 * - L3: 제1원리 (first-principles). 가장 가치 있다. 통념이 틀린 이유를 발견할 때 나옴.
 *
 * L3 > L1 > L2 순으로 신뢰.
 * L2만으로 결정하면 유행에 휩쓸림.
 * L1만 따르면 혁신이 없음.
 * L3가 L1을 뒤집을 때 = Eureka Moment.
 */
export type KnowledgeLayer = 'tried-and-true' | 'new-and-popular' | 'first-principles';

/** 지식 레이어 기반 근거 분석 */
export interface LayeredAnalysis {
  readonly layer: KnowledgeLayer;
  readonly finding: string;
  /** L3가 L1을 뒤집는 경우 */
  readonly eurekaInsight?: string;
}

// ─── 인지 모델 (Mental Model) ────────────────────────────

/**
 * 명명된 인지 프레임워크.
 * 각 모델은 특정 유형의 의사결정에 적용되는 사고 도구다.
 */
export type MentalModelId =
  | 'bezos-doors' // 가역성 분류: one-way vs two-way
  | 'munger-inversion' // 반전 사고: "무엇이 실패를 만드나?"
  | 'jobs-subtraction' // 초점 = 빼기: 350→10
  | 'speed-calibration' // 속도 보정: 빠름이 기본, 비가역+고영향만 느리게
  | 'proxy-skepticism' // 대리 회의: 지표가 아직 사용자를 섬기는가?
  | 'boil-the-lake' // 호수를 끓여라: AI가 완전 구현의 한계 비용을 제거
  | 'three-layer' // 3-Layer 지식: L1/L2/L3
  | 'narrative-coherence' // 서사 일관성: "왜"를 읽기 쉽게
  | 'temporal-depth' // 시간적 깊이: 5-10년 아크로 사고
  | 'founder-mode' // 파운더 모드: 깊은 관여 ≠ 마이크로매니지먼트
  | 'wartime-awareness' // 전시 인식: 평시 습관이 전시 기업을 죽인다
  | 'design-trust' // 신뢰를 위한 설계: 모든 UI 결정이 신뢰를 쌓거나 허문다
  | 'edge-paranoia'; // 엣지 케이스 편집증: 47글자 이름? 0개 결과? 네트워크 끊김?

/** 인지 모델 정의 */
export interface MentalModel {
  readonly id: MentalModelId;
  readonly name: string;
  readonly question: string; // 이 모델을 적용할 때 물어볼 핵심 질문
  readonly antiPattern: string; // 이 모델 없이 빠지기 쉬운 함정
}

/** 전체 인지 모델 레지스트리 */
export const MENTAL_MODELS: Record<MentalModelId, MentalModel> = {
  'bezos-doors': {
    id: 'bezos-doors',
    name: '가역성 분류',
    question: '이 결정은 되돌릴 수 있는가? 되돌리는 비용은?',
    antiPattern: '모든 결정을 one-way door처럼 신중하게 → 속도 저하',
  },
  'munger-inversion': {
    id: 'munger-inversion',
    name: '반전 사고',
    question: '어떻게 이기나? + 무엇이 실패를 만드나?',
    antiPattern: '성공 경로만 설계 → 실패 모드 무시',
  },
  'jobs-subtraction': {
    id: 'jobs-subtraction',
    name: '초점 = 빼기',
    question: '이것을 빼면 핵심이 더 강해지는가?',
    antiPattern: '기능 추가가 진보라는 착각 → feature bloat',
  },
  'speed-calibration': {
    id: 'speed-calibration',
    name: '속도 보정',
    question: '70% 정보로 결정하면 어떤 위험이 있는가? (없으면 지금 결정)',
    antiPattern: '100% 확신을 기다림 → 기회 상실',
  },
  'proxy-skepticism': {
    id: 'proxy-skepticism',
    name: '대리 회의',
    question: '이 지표가 아직 사용자 가치를 대변하는가?',
    antiPattern: '지표 자체가 목적이 됨 → Day 2',
  },
  'boil-the-lake': {
    id: 'boil-the-lake',
    name: '호수를 끓여라',
    question: '90% 구현과 100% 구현의 추가 비용은? (AI가 0에 가깝게 만들었는가?)',
    antiPattern: '습관적으로 90%에서 멈춤 → 레거시 사고',
  },
  'three-layer': {
    id: 'three-layer',
    name: '3-Layer 지식',
    question: 'L1(검증), L2(트렌드), L3(제1원리) 중 어디서 판단하는가?',
    antiPattern: 'L2(블로그)만으로 결정 → 유행에 휩쓸림',
  },
  'narrative-coherence': {
    id: 'narrative-coherence',
    name: '서사 일관성',
    question: "이 결정의 '왜'를 한 문장으로 설명할 수 있는가?",
    antiPattern: '모두를 만족시키려 → 서사 없는 타협',
  },
  'temporal-depth': {
    id: 'temporal-depth',
    name: '시간적 깊이',
    question: '12개월 뒤 이 결정을 어떻게 평가할 것인가?',
    antiPattern: '오늘의 문제만 해결 → 다음 분기의 악몽 생성',
  },
  'founder-mode': {
    id: 'founder-mode',
    name: '파운더 모드',
    question: '깊이 관여하면 팀의 사고를 확장하는가, 제약하는가?',
    antiPattern: '위임 = 모든 것을 내려놓기 → 비전 표류',
  },
  'wartime-awareness': {
    id: 'wartime-awareness',
    name: '전시 인식',
    question: '지금은 평시인가 전시인가? 어떤 모드로 작동해야 하는가?',
    antiPattern: '전시에 평시 프로세스 고수 → 사망',
  },
  'design-trust': {
    id: 'design-trust',
    name: '신뢰를 위한 설계',
    question: '이 인터페이스 결정이 사용자 신뢰를 쌓는가 허무는가?',
    antiPattern: '기능에만 집중 → 사용자가 불안해하는 UX',
  },
  'edge-paranoia': {
    id: 'edge-paranoia',
    name: '엣지 케이스 편집증',
    question: '이름이 47글자면? 결과가 0개면? 네트워크가 끊기면?',
    antiPattern: '해피 패스만 설계 → 프로덕션에서 폭발',
  },
};

// ─── Escalation 기준 ─────────────────────────────────────

/**
 * 자동 선택이 멈추고 인간에게 에스컬레이션해야 하는 기준.
 * gstack autoplan의 6 auto-decision principles에서 추출.
 *
 * 규칙: 아래 5가지에 해당하지 않으면 → 인간에게 에스컬레이션 ("taste decision")
 */
export type AutoDecisionPrinciple =
  | 'standard-pattern' // 확립된 패턴이면 자동 채택
  | 'completeness' // 완전 구현이 한계 비용 낮으면 완전 구현
  | 'test-coverage' // 테스트 추가는 항상 자동 승인
  | 'observability' // 로깅/메트릭/트레이스 추가는 자동 승인
  | 'security' // 보안 강화는 자동 승인
  | 'taste'; // 위 5개에 해당 안 됨 → 인간 결정 필요

/**
 * 에스컬레이션 판정.
 * isTasteDecision이 true면 자동 선택을 중단하고 인간에게 물어야 한다.
 */
export interface EscalationJudgment {
  readonly principle: AutoDecisionPrinciple;
  readonly isTasteDecision: boolean;
  readonly rationale: string;
}

/**
 * 주어진 결정이 자동 처리 가능한지 판단한다.
 *
 * gstack autoplan 원칙:
 * - 표준 패턴 → 자동
 * - 완전 구현 (boil the lake) → 자동
 * - 테스트/관측/보안 추가 → 자동
 * - 위 어디에도 안 맞으면 → taste decision → 인간
 */
export function classifyEscalation(tags: readonly AutoDecisionPrinciple[]): EscalationJudgment {
  // 5가지 자동 원칙 중 하나라도 해당하면 자동 처리 가능
  const autoTags = new Set<AutoDecisionPrinciple>([
    'standard-pattern',
    'completeness',
    'test-coverage',
    'observability',
    'security',
  ]);

  const matchedPrinciple = tags.find((t) => autoTags.has(t));

  if (matchedPrinciple) {
    return {
      principle: matchedPrinciple,
      isTasteDecision: false,
      rationale: `자동 처리 가능: ${matchedPrinciple}`,
    };
  }

  return {
    principle: 'taste',
    isTasteDecision: true,
    rationale: '표준 5원칙에 해당하지 않음 — 인간 판단 필요',
  };
}

// ─── mentalModel 답변 검증 ────────────────────────────────

/**
 * gate에 연결된 mentalModel의 핵심 질문에 답변했는지 검증한다.
 *
 * 강제하지 않는다 (fail-open). 경고만 반환.
 * "이 mentalModel을 의식하고 결정했는가"를 사후 검증.
 *
 * 답변 여부 판단: evidence 중 하나라도 mentalModel의 id를 source나 content에 포함하면 답변한 것으로 간주.
 */
export interface ModelAnswerCheck {
  readonly modelId: MentalModelId;
  readonly modelName: string;
  readonly question: string;
  readonly answered: boolean;
  /** 답변한 evidence (있으면) */
  readonly matchedEvidence?: string;
}

export interface GateModelValidation {
  readonly gateId: string;
  readonly checks: readonly ModelAnswerCheck[];
  readonly allAnswered: boolean;
  readonly unansweredCount: number;
}

/**
 * 특정 gate에서 mentalModel 질문에 답변했는지 검증한다.
 */
export function validateMentalModelAnswers(
  gateId: string,
  mentalModelIds: readonly string[],
  evidenceList: readonly { kind: string; source: string; content: string }[],
): GateModelValidation {
  const checks: ModelAnswerCheck[] = mentalModelIds.map((modelId) => {
    const model = MENTAL_MODELS[modelId as MentalModelId];
    if (!model) {
      return {
        modelId: modelId as MentalModelId,
        modelName: modelId,
        question: '(알 수 없는 모델)',
        answered: false,
      };
    }

    // evidence에서 모델 참조 검색
    const matched = evidenceList.find((ev) => {
      const haystack = `${ev.source} ${ev.content}`.toLowerCase();
      // 모델 ID 또는 모델 이름 포함 여부
      return (
        haystack.includes(modelId.replace(/-/g, '')) ||
        haystack.includes(modelId) ||
        haystack.includes(model.name)
      );
    });

    return {
      modelId: modelId as MentalModelId,
      modelName: model.name,
      question: model.question,
      answered: matched !== undefined,
      matchedEvidence: matched?.content,
    };
  });

  const unansweredCount = checks.filter((c) => !c.answered).length;

  return {
    gateId,
    checks,
    allAnswered: unansweredCount === 0,
    unansweredCount,
  };
}

/**
 * FlowInstance 전체에서 mentalModel 답변 현황을 검증한다.
 */
export function validateInstanceModelCoverage(
  instance: {
    selections: readonly {
      gateId: string;
      evidence: readonly { kind: string; source: string; content: string }[];
    }[];
  },
  schema: { gates: readonly { id: string; mentalModels?: readonly string[] }[] },
): readonly GateModelValidation[] {
  const results: GateModelValidation[] = [];

  for (const gate of schema.gates) {
    if (!gate.mentalModels || gate.mentalModels.length === 0) continue;

    const selection = instance.selections.find((s) => s.gateId === gate.id);
    const evidence = selection?.evidence ?? [];

    results.push(validateMentalModelAnswers(gate.id, gate.mentalModels, evidence));
  }

  return results;
}

// ─── Forcing Question (Office Hours) ─────────────────────

/**
 * gstack office-hours의 6 Forcing Questions.
 * 제품/기능의 근본적 타당성을 검증하는 질문.
 * 각 질문은 하나의 gate에서 수집해야 할 근거를 정의한다.
 */
export interface ForcingQuestion {
  readonly id: string;
  readonly name: string;
  readonly question: string;
  readonly pushBackOn: string; // 표면적 답변일 때 재질문 방향
}

export const FORCING_QUESTIONS: readonly ForcingQuestion[] = [
  {
    id: 'demand-reality',
    name: '수요 현실',
    question: '이것이 사라지면 진심으로 화가 날 사람의 가장 강력한 증거는?',
    pushBackOn: "'관심 있다'나 '대기자 명단'이 아닌, 실제 행동 증거를 요구",
  },
  {
    id: 'status-quo',
    name: '현재 상태',
    question: '사용자가 지금 이 문제를 어떻게 해결하고 있는가? (나쁘게라도)',
    pushBackOn: '대안이 없다는 답변 → 정말 문제인지 의심',
  },
  {
    id: 'desperate-specificity',
    name: '절박한 구체성',
    question: '이것이 가장 필요한 실제 사람의 이름, 직함, 일상은?',
    pushBackOn: '추상적 페르소나가 아닌 실제 관찰을 요구',
  },
  {
    id: 'narrowest-wedge',
    name: '최소 쐐기',
    question: '이번 주에 돈을 받을 수 있는 가장 작은 버전은?',
    pushBackOn: '플랫폼을 만들고 싶은 욕구 → 최소 유료 단위로 회귀',
  },
  {
    id: 'observation',
    name: '관찰',
    question: '실제로 누군가가 이것을 사용하는 걸 도움 없이 지켜본 적 있는가? 놀란 점은?',
    pushBackOn: "'아직 안 해봤다' → 가장 중요한 다음 행동",
  },
  {
    id: 'future-fit',
    name: '미래 적합성',
    question: '3년 뒤 세상이 달라지면 이 제품은 더 필수적이 되는가, 덜?',
    pushBackOn: '현재 트렌드 의존 → 구조적 변화에 취약',
  },
];
