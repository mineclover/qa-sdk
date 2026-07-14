// @def.doc definition-catalog-spec

/**
 * 워크플로우 합성 (Workflow Synthesis)
 *
 * HyEvo Layer 4에 대응한다.
 * AssembledContract → 실행 가능한 step graph (DAG)로 컴파일한다.
 *
 * 핵심 설계:
 * - 각 step은 mode를 가진다: "code" (결정론적) 또는 "llm" (의미 해석 필요)
 * - step 간 I/O는 predecessor output → successor input으로 연결
 * - validator는 precondition/postcondition에서 자동 생성
 * - HyEvo의 reflect-then-generate를 위한 SpecContext 구조 포함
 *
 * compileWorkflow(contract)
 *   → WorkflowSpec { nodes, edges, validators, metadata }
 */

import type { ContractSection, AssembledContract, Reversibility } from './contract.js';
import type { ContractMarkerKind } from './taxonomy.js';

// ─── 타입: 워크플로우 노드 ──────────────────────────────

/** 실행 모드 — HyEvo의 LLM node / Code node 분리 */
export type StepMode = 'code' | 'llm';

/**
 * 워크플로우 노드.
 *
 * HyEvo의 node_type ∈ {LLMNode, CodeNode}에 대응.
 * code node는 `⟨csrc, Isig⟩` 형태로 정의되고,
 * I/O signature로 workflow graph 내 호환성을 보장한다.
 */
export interface WorkflowNode {
  /** 노드 고유 ID */
  readonly nodeId: string;
  /** 실행 모드 */
  readonly mode: StepMode;
  /** 수행할 연산 (마커에서 파생된 설명) */
  readonly operation: string;
  /** 원본 계약 마커 */
  readonly sourceMarker: ContractMarkerKind | 'guard' | 'verify';
  /** 원본 문서 ID */
  readonly sourceDocId: string;
  /** 입력 스키마 설명 (predecessor output에서 파생) */
  readonly inputSchema: string | null;
  /** 출력 스키마 설명 */
  readonly outputSchema: string | null;
  /** 원본 섹션 본문 (참조용) */
  readonly body: string;
  /**
   * 관측 가역성 — evidence 노드에만 해당.
   * reversible: 로그 + 로직 → 원본 복원 가능 (이벤트 소싱, raw event log)
   * irreversible: 집계/판정으로 정보 손실 (메트릭, verdict)
   * null: evidence 노드가 아니거나 미지정
   */
  readonly reversibility: Reversibility | null;
}

// ─── 타입: 워크플로우 엣지 ──────────────────────────────

/** 노드 간 연결 */
export interface WorkflowEdge {
  /** 출발 노드 ID */
  readonly from: string;
  /** 도착 노드 ID */
  readonly to: string;
  /** 엣지 유형 */
  readonly kind: 'sequence' | 'branch' | 'guard' | 'verify';
}

// ─── 타입: 검증 바인딩 ──────────────────────────────────

/**
 * 검증 바인딩.
 *
 * precondition/postcondition에서 자동 생성되어
 * 특정 노드에 부착된다.
 */
export interface ValidatorBinding {
  /** 검증 ID */
  readonly validatorId: string;
  /** 적용 대상 노드 ID 목록 */
  readonly appliesTo: readonly string[];
  /** 검증 규칙 설명 */
  readonly rule: string;
  /** 검증 시점 */
  readonly phase: 'pre' | 'post';
  /** 원본 문서 ID */
  readonly sourceDocId: string;
}

// ─── 타입: 워크플로우 스펙 ──────────────────────────────

/**
 * 워크플로우 메타데이터.
 *
 * HyEvo MAP-Elites의 behavior descriptor에 대응한다.
 * - complexity(총 node 수)와 reasoning density(LLM node 비율)가 archive 축.
 */
export interface WorkflowMetadata {
  /** 전체 노드 수 */
  readonly totalNodes: number;
  /** code mode 노드 수 */
  readonly codeNodes: number;
  /** llm mode 노드 수 */
  readonly llmNodes: number;
  /** 의미 밀도 (llm / total) — HyEvo의 reasoning density */
  readonly semanticDensity: number;
  /** 검증 밀도 (validator 수 / total nodes) */
  readonly validationDensity: number;
  /** 분기 수 */
  readonly branchingFactor: number;
  /** 계약 완성도 (원본 계약의 completeness) */
  readonly contractCompleteness: number;
}

/**
 * 컴파일된 워크플로우 스펙.
 *
 * HyEvo 논문의 DAG execution abstraction을 문서 컴파일 결과물로 만든 것.
 * topological order로 실행된다.
 */
export interface WorkflowSpec {
  /** 워크플로우 ID */
  readonly workflowId: string;
  /** 버전 */
  readonly version: number;
  /** 원본 계약 ID 목록 */
  readonly derivedFrom: readonly string[];
  /** 노드 목록 (topological order) */
  readonly nodes: readonly WorkflowNode[];
  /** 엣지 목록 */
  readonly edges: readonly WorkflowEdge[];
  /** 검증 바인딩 */
  readonly validators: readonly ValidatorBinding[];
  /** 메타데이터 (MAP-Elites archive 축) */
  readonly metadata: WorkflowMetadata;
}

// ─── 타입: HyEvo SpecContext (진화 루프) ────────────────

/**
 * SpecContext — HyEvo의 reflect-then-generate를 위한 컨텍스트.
 *
 * HyEvo 원문: Pctx = ⟨(Gparent, Lparent), Gtop, Gdiv⟩
 * 문서 시스템: SpecContext = ⟨(Sparent, Lparent), Stop, Sdiv, Dsource⟩
 */
export interface SpecContext {
  /** 현재 수정 대상 spec */
  readonly parent: WorkflowSpec;
  /** 실행 오류/검증 실패 로그 */
  readonly parentLog: readonly string[];
  /** 가장 잘 동작한 spec (있으면) */
  readonly top: WorkflowSpec | null;
  /** 구조가 다른 대안 spec (있으면) */
  readonly diverse: WorkflowSpec | null;
  /** 원본 문서 조각 */
  readonly documentSource: readonly string[];
}

/**
 * Reflection 결과.
 *
 * 실행 실패를 분류하여 어떤 레이어를 수정해야 하는지 결정한다.
 */
export interface ReflectionResult {
  /** 분류된 문제 레이어 */
  readonly issueLayer:
    | 'document' // 문서 의미 부족
    | 'contract' // 경계/입출력 정의 누락
    | 'topology' // step graph 구조 부적절
    | 'validator' // 검증 규칙 부족
    | 'evidence' // 증거 수집 부족
    | 'mode'; // code/llm 분류 오류
  /** 설명 */
  readonly description: string;
  /** 수정 제안 */
  readonly suggestion: string;
}

// ─── 컴파일 함수 ────────────────────────────────────────

/**
 * AssembledContract → WorkflowSpec 컴파일.
 *
 * 계약의 각 섹션을 DAG 노드로 변환하고,
 * precondition → steps → postcondition 순서로 연결한다.
 *
 * @param contract assembleContract()의 결과
 * @param version 워크플로우 버전 (기본: 1)
 */
export function compileWorkflow(contract: AssembledContract, version: number = 1): WorkflowSpec {
  const nodes: WorkflowNode[] = [];
  const edges: WorkflowEdge[] = [];
  const validators: ValidatorBinding[] = [];

  let nodeCounter = 0;
  const nextId = () => `n${++nodeCounter}`;

  // ── 1단계: Guard 노드 (preconditions) ──
  const guardNodeIds: string[] = [];
  for (const section of contract.preconditions) {
    const nodeId = nextId();
    nodes.push(createNode(nodeId, 'code', section, 'guard', '사전 조건 검증 통과 여부'));
    guardNodeIds.push(nodeId);

    validators.push({
      validatorId: `v.pre.${nodeId}`,
      appliesTo: [nodeId],
      rule: extractFirstLine(section.body),
      phase: 'pre',
      sourceDocId: section.sourceId,
    });
  }

  // ── 2단계: Input 노드 (정규화) ──
  const inputNodeIds: string[] = [];
  for (const section of contract.inputs) {
    const nodeId = nextId();
    nodes.push(createNode(nodeId, 'code', section, 'inputs', '정규화된 입력'));
    inputNodeIds.push(nodeId);

    // guard → input
    for (const guardId of guardNodeIds) {
      edges.push({ from: guardId, to: nodeId, kind: 'guard' });
    }
  }

  // ── 3단계: Step 노드 (실행 단계) ──
  const stepNodeIds: string[] = [];
  for (const section of contract.steps) {
    // flow-steps 섹션에서 각 번호 항목을 개별 step으로 분할
    const stepItems = parseNumberedList(section.body);

    for (const item of stepItems) {
      const nodeId = nextId();
      nodes.push({
        nodeId,
        mode: classifyStepMode(item),
        operation: item,
        sourceMarker: 'flow-steps',
        sourceDocId: section.sourceId,
        inputSchema:
          stepNodeIds.length > 0
            ? `이전 단계 출력`
            : inputNodeIds.length > 0
              ? `정규화된 입력`
              : null,
        outputSchema: item,
        body: item,
        reversibility: null,
      });
      stepNodeIds.push(nodeId);
    }
  }

  // step 간 순차 연결
  for (let i = 1; i < stepNodeIds.length; i++) {
    edges.push({ from: stepNodeIds[i - 1], to: stepNodeIds[i], kind: 'sequence' });
  }

  // input → 첫 step
  if (inputNodeIds.length > 0 && stepNodeIds.length > 0) {
    for (const inputId of inputNodeIds) {
      edges.push({ from: inputId, to: stepNodeIds[0], kind: 'sequence' });
    }
  }
  // guard 직접 → 첫 step (input 없는 경우)
  if (inputNodeIds.length === 0 && guardNodeIds.length > 0 && stepNodeIds.length > 0) {
    for (const guardId of guardNodeIds) {
      edges.push({ from: guardId, to: stepNodeIds[0], kind: 'guard' });
    }
  }

  // ── 4단계: Decision Point 노드 (분기) ──
  const branchNodeIds: string[] = [];
  for (const section of contract.decisionPoints) {
    const branchItems = parseBulletList(section.body);
    for (const item of branchItems) {
      const nodeId = nextId();
      nodes.push({
        nodeId,
        mode: section.markerDef.modeHint,
        operation: item,
        sourceMarker: 'decision-point',
        sourceDocId: section.sourceId,
        inputSchema: '현재 단계 상태',
        outputSchema: '분기 결정',
        body: item,
        reversibility: null,
      });
      branchNodeIds.push(nodeId);
    }
  }

  // 분기 노드를 step 체인에 연결 (각 분기는 체인 중간에 삽입)
  for (const branchId of branchNodeIds) {
    // 분기는 마지막 step에서 나감 (간소화된 연결)
    if (stepNodeIds.length > 0) {
      edges.push({ from: stepNodeIds[stepNodeIds.length - 1], to: branchId, kind: 'branch' });
    }
  }

  // ── 5단계: Output 노드 ──
  const outputNodeIds: string[] = [];
  for (const section of contract.outputs) {
    const nodeId = nextId();
    nodes.push(createNode(nodeId, 'code', section, 'outputs', '최종 응답'));
    outputNodeIds.push(nodeId);

    // 마지막 step → output
    if (stepNodeIds.length > 0) {
      edges.push({ from: stepNodeIds[stepNodeIds.length - 1], to: nodeId, kind: 'sequence' });
    }
  }

  // ── 6단계: Postcondition validators ──
  const allStepAndOutputIds = [...stepNodeIds, ...outputNodeIds];
  for (const section of contract.postconditions) {
    const postcondItems = parseNumberedList(section.body);
    for (const item of postcondItems) {
      validators.push({
        validatorId: `v.post.${nextId()}`,
        appliesTo:
          allStepAndOutputIds.length > 0
            ? [allStepAndOutputIds[allStepAndOutputIds.length - 1]]
            : [],
        rule: item,
        phase: 'post',
        sourceDocId: section.sourceId,
      });
    }
  }

  // ── 7단계: Evidence 노드 (관측점, 가역성 포함) ──
  for (const evItem of contract.parsedEvidence) {
    const nodeId = nextId();
    const revLabel = evItem.reversibility ? ` [${evItem.reversibility}]` : '';
    nodes.push({
      nodeId,
      mode: 'code',
      operation: `증거 수집: ${evItem.description}`,
      sourceMarker: 'evidence',
      sourceDocId: evItem.sourceId,
      inputSchema: '실행 결과',
      outputSchema: `증거: ${evItem.description}${revLabel}`,
      body: evItem.raw,
      reversibility: evItem.reversibility,
    });

    // evidence는 마지막 output 이후에 연결
    if (outputNodeIds.length > 0) {
      edges.push({ from: outputNodeIds[outputNodeIds.length - 1], to: nodeId, kind: 'verify' });
    } else if (stepNodeIds.length > 0) {
      edges.push({ from: stepNodeIds[stepNodeIds.length - 1], to: nodeId, kind: 'verify' });
    }
  }

  // ── 8단계: Failure 노드 (에러 핸들러) ──
  for (const section of contract.failures) {
    const failureItems = parseBulletList(section.body);
    for (const item of failureItems) {
      const nodeId = nextId();
      nodes.push({
        nodeId,
        mode: 'code',
        operation: `실패 처리: ${item}`,
        sourceMarker: 'failure',
        sourceDocId: section.sourceId,
        inputSchema: '에러 상태',
        outputSchema: '에러 응답',
        body: item,
        reversibility: null,
      });
      // failure는 독립 노드 (step에서 분기 시 도달)
    }
  }

  // ── 메타데이터 ──
  const codeNodes = nodes.filter((n) => n.mode === 'code').length;
  const llmNodes = nodes.filter((n) => n.mode === 'llm').length;
  const total = nodes.length;

  const metadata: WorkflowMetadata = {
    totalNodes: total,
    codeNodes,
    llmNodes,
    semanticDensity: total > 0 ? llmNodes / total : 0,
    validationDensity: total > 0 ? validators.length / total : 0,
    branchingFactor: branchNodeIds.length,
    contractCompleteness: contract.stats.completeness,
  };

  return {
    workflowId: `wf.${contract.group.id}.v${version}`,
    version,
    derivedFrom: [contract.group.id, ...contract.memberIds],
    nodes,
    edges,
    validators,
    metadata,
  };
}

// ─── 반영 함수 (Reflection) ─────────────────────────────

/**
 * 워크플로우 실행 결과를 반영하여 문제 레이어를 분류한다.
 *
 * HyEvo의 reflect-then-generate 중 reflect 단계에 대응.
 */
export function reflect(
  workflow: WorkflowSpec,
  failedNodeIds: readonly string[],
  errorMessages: readonly string[],
): readonly ReflectionResult[] {
  const results: ReflectionResult[] = [];
  const failedNodes = workflow.nodes.filter((n) => failedNodeIds.includes(n.nodeId));

  for (const node of failedNodes) {
    // mode 분류 오류 감지: code 노드가 의미 해석 에러를 냄
    const hasSemanticError = errorMessages.some(
      (msg) => msg.includes('ambiguous') || msg.includes('unclear') || msg.includes('해석'),
    );
    if (node.mode === 'code' && hasSemanticError) {
      results.push({
        issueLayer: 'mode',
        description: `노드 ${node.nodeId}(${node.operation})가 code 모드이지만 의미 해석 에러 발생`,
        suggestion: `mode를 "llm"으로 변경하거나 입력을 더 구조화`,
      });
      continue;
    }

    // validator 부족 감지: post-validation이 없는 노드에서 실패
    const hasPostValidator = workflow.validators.some(
      (v) => v.appliesTo.includes(node.nodeId) && v.phase === 'post',
    );
    if (!hasPostValidator) {
      results.push({
        issueLayer: 'validator',
        description: `노드 ${node.nodeId}(${node.operation})에 사후 검증이 없음`,
        suggestion: `postcondition을 추가하여 실패를 조기 감지`,
      });
      continue;
    }

    // topology 문제: 입력이 없는 노드에서 실패
    const hasInput = workflow.edges.some((e) => e.to === node.nodeId);
    if (!hasInput && node.sourceMarker !== 'guard') {
      results.push({
        issueLayer: 'topology',
        description: `노드 ${node.nodeId}(${node.operation})에 입력 엣지가 없음`,
        suggestion: `predecessor 노드를 추가하거나 입력 연결 수정`,
      });
      continue;
    }

    // evidence 부족: verify 노드가 없는 경우
    const hasEvidence = workflow.edges.some((e) => e.from === node.nodeId && e.kind === 'verify');
    if (!hasEvidence && (node.sourceMarker === 'flow-steps' || node.sourceMarker === 'outputs')) {
      results.push({
        issueLayer: 'evidence',
        description: `노드 ${node.nodeId}(${node.operation})에 증거 수집이 연결되지 않음`,
        suggestion: `evidence 마커를 추가하여 실행 결과를 관측`,
      });
      continue;
    }

    // 기본: contract 레이어 문제
    results.push({
      issueLayer: 'contract',
      description: `노드 ${node.nodeId}(${node.operation})에서 실패 — 계약 정의 검토 필요`,
      suggestion: `해당 문서(${node.sourceDocId})의 계약 섹션을 보강`,
    });
  }

  return results;
}

// ─── 내부 헬퍼 ──────────────────────────────────────────

function createNode(
  nodeId: string,
  mode: StepMode,
  section: ContractSection,
  sourceMarker: WorkflowNode['sourceMarker'],
  outputDesc: string,
): WorkflowNode {
  return {
    nodeId,
    mode,
    operation: extractFirstLine(section.body),
    sourceMarker,
    sourceDocId: section.sourceId,
    inputSchema: null,
    outputSchema: outputDesc,
    body: section.body,
    reversibility: null,
  };
}

/** 번호 목록 파싱 (1. xxx, 2. xxx) */
function parseNumberedList(body: string): string[] {
  const items: string[] = [];
  for (const line of body.split('\n')) {
    const match = line.match(/^\s*\d+\.\s+(.+)/);
    if (match) items.push(match[1].trim());
  }
  return items.length > 0 ? items : [body.trim()];
}

/** 불릿 목록 파싱 (- xxx) */
function parseBulletList(body: string): string[] {
  const items: string[] = [];
  for (const line of body.split('\n')) {
    const match = line.match(/^\s*[-*]\s+(.+)/);
    if (match) items.push(match[1].trim());
  }
  return items.length > 0 ? items : [body.trim()];
}

/** 본문의 첫 줄 추출 */
function extractFirstLine(body: string): string {
  const line = body.split('\n').find((l) => l.trim().length > 0);
  return line?.trim() ?? body.trim();
}

/**
 * step 텍스트에서 mode를 분류한다.
 *
 * HyEvo 핵심: deterministic → code, semantic → llm.
 * 키워드 기반 휴리스틱: 판단/해석/분류/추론/생성/요약 → llm
 */
function classifyStepMode(stepText: string): StepMode {
  const llmKeywords = [
    '판단',
    '해석',
    '분류',
    '추론',
    '생성',
    '요약',
    '평가',
    'analyze',
    'classify',
    'interpret',
    'generate',
    'summarize',
    'judge',
  ];
  const lower = stepText.toLowerCase();
  return llmKeywords.some((kw) => lower.includes(kw)) ? 'llm' : 'code';
}
