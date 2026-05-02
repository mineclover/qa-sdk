// @def.boundary qa-sdk-core-system
// @def.doc qa-sdk-core-system

/**
 * Meta-Semantic Extraction — 검증 단위 식별 + 분기 경로 계산
 *
 * LLM 기반 코드 추출 파이프라인의 순수 로직 부분.
 * LLM 의존 부분은 ExtractionPort 추상 인터페이스로 분리.
 */

// ── 핵심 타입 ─────────────────────────────────────────

/** 분기점 — 실행 흐름에서 경우의 수가 갈라지는 지점 */
export interface BranchPoint {
  /** 분기점 ID (함수명:줄번호) */
  id: string;
  /** 의미 있는 분기 수 (LLM이 판단) */
  branches: number;
  /** 이 분기점에서 도달 가능한 다음 분기점 */
  reachable: BranchPointRef[];
  /** 분기 라벨 (각 경우의 이름) */
  labels: string[];
}

export interface BranchPointRef {
  /** 대상 BranchPoint.id */
  targetId: string;
  /** 이 경로의 조건 설명 */
  condition?: string;
}

/** 실행 단위 — 독립 검증 가능한 함수/메서드 */
export interface ExecutionUnit {
  /** 함수/메서드 식별자 */
  functionId: string;
  /** 파일 경로 */
  filePath: string;
  /** 이 실행 단위의 진입 분기점 */
  entryPoint: BranchPoint | null;
  /** 분기 경로 그래프 — DAG */
  branchGraph: BranchPoint[];
  /** 총 경로 수 = Σ(경로별 분기 수의 곱) */
  totalPaths: number;
  /** LLM 판정 메타데이터 */
  meta: ExecutionUnitMeta;
}

export interface ExecutionUnitMeta {
  /** 독립 테스트 가능 여부 (LLM 판단) */
  testable: boolean;
  /** 부수효과 식별 (LLM 판단) */
  sideEffects: string[];
  /** 입력 타입 (파서 추출) */
  inputTypes: string[];
  /** 출력 타입 (파서 추출) */
  outputType: string;
  /** 신뢰도 (0~1) */
  confidence: number;
  /** 마커 힌트 (^intent, ^contract, ^branches) */
  markers: MarkerHint[];
}

// ── 마커 힌트 ─────────────────────────────────────────

export interface MarkerHint {
  marker: "intent" | "contract" | "branches" | "def.doc";
  content: string;
}

/**
 * 코드 주석에서 마커 힌트를 추출한다.
 * ^intent, ^contract, ^branches, @def.doc 패턴을 인식한다.
 */
export function extractMarkerHints(comment: string): MarkerHint[] {
  const hints: MarkerHint[] = [];
  const lines = comment.split("\n");

  for (const line of lines) {
    const trimmed = line.replace(/^\s*(?:\/\/\s*|\*?\s*)/, "").trim();

    const intentMatch = trimmed.match(/^\^intent\s+(.+)/);
    if (intentMatch) {
      hints.push({ marker: "intent", content: intentMatch[1].trim() });
      continue;
    }

    const contractMatch = trimmed.match(/^\^contract\s+(.+)/);
    if (contractMatch) {
      hints.push({ marker: "contract", content: contractMatch[1].trim() });
      continue;
    }

    const branchesMatch = trimmed.match(/^\^branches\s+(.+)/);
    if (branchesMatch) {
      hints.push({ marker: "branches", content: branchesMatch[1].trim() });
      continue;
    }

    const defDocMatch = trimmed.match(/^@def\.doc\s+(.+)/);
    if (defDocMatch) {
      hints.push({ marker: "def.doc", content: defDocMatch[1].trim() });
      continue;
    }
  }

  return hints;
}

// ── 경로 수 계산 (sum 모델) ──────────────────────────

/**
 * BranchPoint DAG에서 총 경로 수를 계산한다.
 *
 * sum 모델: 전곱(모든 조합)이 아닌, 도달 가능한 경로만 합산.
 * 각 분기점에서 reachable로 이어지는 하위 경로 수를 곱하고,
 * 독립 경로들을 합산한다.
 */
export function countExecutionPaths(unit: ExecutionUnit): number {
  if (!unit.entryPoint || unit.branchGraph.length === 0) return 1;

  const graphMap = new Map(unit.branchGraph.map(bp => [bp.id, bp]));
  const memo = new Map<string, number>();

  return countFromPoint(unit.entryPoint.id, graphMap, memo);
}

function countFromPoint(
  pointId: string,
  graphMap: Map<string, BranchPoint>,
  memo: Map<string, number>,
): number {
  if (memo.has(pointId)) return memo.get(pointId)!;

  const point = graphMap.get(pointId);
  if (!point) return 1;

  if (point.reachable.length === 0) {
    // 말단 분기점: 자체 분기 수만
    memo.set(pointId, point.branches);
    return point.branches;
  }

  // 각 reachable 하위 경로의 경로 수를 합산
  let totalFromReachable = 0;
  for (const ref of point.reachable) {
    totalFromReachable += countFromPoint(ref.targetId, graphMap, memo);
  }

  // 현재 분기 수 × 하위 경로 합
  const result = point.branches * totalFromReachable;
  memo.set(pointId, result);
  return result;
}

// ── LLM 추상 포트 ────────────────────────────────────

/** LLM 판단 요청 */
export interface LlmJudgmentRequest {
  /** 판단 종류 */
  kind: "testability" | "branch-significance" | "side-effects" | "dependency-importance";
  /** 판단 대상 코드 조각 */
  codeSnippet: string;
  /** 추가 컨텍스트 (마커 힌트 등) */
  context?: Record<string, unknown>;
}

/** LLM 판단 응답 */
export interface LlmJudgmentResponse {
  /** 판단 결과 */
  verdict: boolean;
  /** 신뢰도 (0~1) */
  confidence: number;
  /** 판단 근거 */
  reasoning: string;
  /** 구조화된 추출 데이터 (분기 라벨, 부수효과 목록 등) */
  extracted?: Record<string, unknown>;
}

/**
 * LLM 추상 포트 — 실제 LLM 연동은 구현체에서.
 * 테스트 시 mock 교체 가능.
 */
export interface ExtractionPort {
  /** LLM에 판단을 요청한다 */
  judge(request: LlmJudgmentRequest): Promise<LlmJudgmentResponse>;
}

// ── 추출 결과 ─────────────────────────────────────────

export interface ExtractionResult {
  /** 식별된 실행 단위 목록 */
  units: ExecutionUnit[];
  /** 총 경로 수 합계 */
  totalPaths: number;
  /** 평균 신뢰도 */
  averageConfidence: number;
  /** 추출 통계 */
  stats: {
    filesScanned: number;
    functionsFound: number;
    unitsIdentified: number;
    branchPointsFound: number;
  };
}

/**
 * ExtractionResult의 신뢰도를 검증한다.
 * confidence < threshold인 unit을 경고 목록으로 반환한다.
 */
export function validateExtraction(
  result: ExtractionResult,
  threshold = 0.3,
): { valid: boolean; warnings: Array<{ functionId: string; confidence: number }> } {
  const warnings = result.units
    .filter(u => u.meta.confidence < threshold)
    .map(u => ({ functionId: u.functionId, confidence: u.meta.confidence }));

  return {
    valid: warnings.length === 0,
    warnings,
  };
}

/**
 * ExecutionUnit 목록에서 ExtractionResult 요약을 생성한다.
 */
export function summarizeExtraction(
  units: ExecutionUnit[],
  filesScanned: number,
  functionsFound: number,
): ExtractionResult {
  const totalPaths = units.reduce((sum, u) => sum + u.totalPaths, 0);
  const totalConfidence = units.reduce((sum, u) => sum + u.meta.confidence, 0);
  const branchPointsFound = units.reduce((sum, u) => sum + u.branchGraph.length, 0);

  return {
    units,
    totalPaths,
    averageConfidence: units.length > 0 ? totalConfidence / units.length : 0,
    stats: {
      filesScanned,
      functionsFound,
      unitsIdentified: units.length,
      branchPointsFound,
    },
  };
}
