// @def.boundary qa-sdk-core-system
// @def.doc qa-sdk-core-system

/**
 * Extraction Pipeline — 4단계 오케스트레이션.
 *
 * 1. Folding     → 파서로 파일 구조 추출
 * 2. 검증 단위   → LLM으로 testability 판정
 * 3. 분기점 추출  → LLM으로 branch-significance 판정
 * 4. 경로 계산   → 순수 함수로 경로 수 + 좌표 할당
 *
 * ParserPort + ExtractionPort를 조합. mock으로 ���스트 가능.
 */

import type {
  ParserPort,
  FileStructure,
  FunctionInfo,
  ConditionalInfo,
} from './extraction-parser.js';
import type {
  ExtractionPort,
  ExecutionUnit,
  ExecutionUnitMeta,
  BranchPoint,
  ExtractionResult,
  MarkerHint,
} from './extraction.js';
import { extractMarkerHints, countExecutionPaths, summarizeExtraction } from './extraction.js';

// ── 파이프라인 옵션 ───────────────────────────────────

export interface PipelineOptions {
  /** confidence 임계값 — 이 이하면 경고 */
  readonly confidenceThreshold?: number;
  /** 최대 처리 파일 수 */
  readonly maxFiles?: number;
}

// ── 파이프라인 ────────────────────────────────────────

/**
 * 소스 파일 목록 → ExtractionResult.
 *
 * 4단계 파이프라인:
 *   파서(구조) → LLM(testability) → LLM(branch-significance) → 순수(경로 계산)
 */
export async function runExtractionPipeline(
  files: readonly { filePath: string; source: string }[],
  parser: ParserPort,
  llm: ExtractionPort,
  options: PipelineOptions = {},
): Promise<ExtractionResult> {
  const maxFiles = options.maxFiles ?? files.length;
  const units: ExecutionUnit[] = [];
  let totalFunctions = 0;

  // ── Stage 1: Folding (파서) ─────────────────────────
  const structures: FileStructure[] = [];
  for (const file of files.slice(0, maxFiles)) {
    structures.push(parser.parseFile(file.filePath, file.source));
  }

  // ── Stage 2: 검증 단위 판정 (LLM) ��─────────────────
  for (const structure of structures) {
    totalFunctions += structure.functions.length;

    for (const func of structure.functions) {
      const markers = extractMarkerHints(func.leadingComment);
      const testable = await judgeTestability(llm, func, markers);
      if (!testable.verdict) continue;

      // ── Stage 3: 분기점 추출 (LLM + 파서) ──────────
      const branchPoints = await extractBranchPoints(
        llm,
        func,
        structure.conditionals.filter((c) => c.functionId === func.id),
        structure.types,
      );

      // ── Stage 4: 경로 계산 (순수 함수) ─────────────
      const unit = buildExecutionUnit(func, branchPoints, testable, markers);
      units.push(unit);
    }
  }

  return summarizeExtraction(units, structures.length, totalFunctions);
}

// ── Stage 2: testability 판정 ─────────────────────────

async function judgeTestability(
  llm: ExtractionPort,
  func: FunctionInfo,
  markers: MarkerHint[],
): Promise<{ verdict: boolean; confidence: number; sideEffects: string[] }> {
  const response = await llm.judge({
    kind: 'testability',
    codeSnippet: `${func.leadingComment}\nfunction ${func.id}(${func.params.map((p) => `${p.name}: ${p.type}`).join(', ')}): ${func.returnType} {\n${func.body}\n}`,
    context: {
      markers: markers.map((m) => `${m.marker}: ${m.content}`),
      paramCount: func.params.length,
      hasReturn: func.returnType !== 'void',
    },
  });

  const sideEffects = Array.isArray(response.extracted?.sideEffects)
    ? (response.extracted.sideEffects as string[])
    : [];

  return { verdict: response.verdict, confidence: response.confidence, sideEffects };
}

// ── Stage 3: 분기점 추출 ──────────────────────────────

async function extractBranchPoints(
  llm: ExtractionPort,
  func: FunctionInfo,
  conditionals: readonly ConditionalInfo[],
  types: readonly { name: string; memberCount: number; members: readonly string[] }[],
): Promise<BranchPoint[]> {
  // LLM 판단을 병렬로 실행
  const responses = await Promise.all(
    conditionals.map((cond) =>
      llm.judge({
        kind: 'branch-significance',
        codeSnippet: `// ${cond.kind} at line ${cond.line}\n// condition: ${cond.conditionText}\n// branches: ${cond.branchCount}`,
        context: {
          functionId: func.id,
          kind: cond.kind,
          branchCount: cond.branchCount,
          branchLabels: cond.branchLabels,
        },
      }),
    ),
  );

  const branchPoints: BranchPoint[] = [];

  for (let idx = 0; idx < conditionals.length; idx++) {
    const cond = conditionals[idx];
    const response = responses[idx];

    if (!response.verdict) continue;

    // 타입 정보로 분기 수 보정
    let branches = cond.branchCount;
    let labels = [...cond.branchLabels];

    // switch의 조건이 enum/union이면 멤버 수로 보정
    if (cond.kind === 'switch') {
      const typeInfo = types.find((t) => cond.conditionText.includes(t.name));
      if (typeInfo) {
        branches = typeInfo.memberCount;
        labels = [...typeInfo.members];
      }
    }

    branchPoints.push({
      id: `${func.id}:${cond.line}`,
      branches,
      reachable: [],
      labels,
    });
  }

  // reachable 연결: 순서대로 체인 (간이 — 실제로는 CFG 분석 필요)
  for (let i = 0; i < branchPoints.length - 1; i++) {
    branchPoints[i] = {
      ...branchPoints[i],
      reachable: [{ targetId: branchPoints[i + 1].id }],
    };
  }

  return branchPoints;
}

// ── Stage 4: ExecutionUnit 구축 ────────��──────────────

function buildExecutionUnit(
  func: FunctionInfo,
  branchPoints: BranchPoint[],
  testability: { verdict: boolean; confidence: number; sideEffects: string[] },
  markers: MarkerHint[],
): ExecutionUnit {
  const meta: ExecutionUnitMeta = {
    testable: testability.verdict,
    sideEffects: testability.sideEffects,
    inputTypes: func.params.map((p) => p.type),
    outputType: func.returnType,
    confidence: testability.confidence,
    markers,
  };

  const unit: ExecutionUnit = {
    functionId: func.id,
    filePath: func.filePath,
    entryPoint: branchPoints[0] ?? null,
    branchGraph: branchPoints,
    totalPaths: 0,
    meta,
  };

  // 경로 수 계산
  const totalPaths = countExecutionPaths(unit);

  return { ...unit, totalPaths };
}
