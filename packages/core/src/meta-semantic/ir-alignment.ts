// @def.boundary qa-sdk-core-system
// @def.doc qa-sdk-core-system

/**
 * Meta-Semantic Alignment Engine — 의도와 구현의 괴리(Drift) 분석.
 *
 * 설계 평면(Intent)의 약속과 구현 평면(Execution)의 사실을 대조하여
 * 아키텍처 정합성을 증명하고 스코어링한다.
 */

import type { DefinitionEntry } from "definition-catalog";
import type { ModuleIR } from "./ir-types.js";

// ── 핵심 타입 ─────────────────────────────────────────

/** 드리프트 종류 */
export type AlignmentDriftType =
  | "broken-promise"      // 의도에는 있으나 구현에서 누락
  | "shadow-implementation" // 의도에는 없으나 구현에만 존재
  | "hierarchy-mismatch"   // 코어/보조 위계 불일치
  | "facet-drift";         // 패싯 단계(Ingress/Egress 등) 불일치

/** 정렬 이슈 */
export interface AlignmentIssue {
  readonly type: AlignmentDriftType;
  readonly severity: "error" | "warning";
  readonly message: string;
  readonly intentId: string;
  readonly executionId?: string;
}

/** 정렬 분석 결과 */
export interface AlignmentResult {
  /** 일치율 (0~100) */
  readonly score: number;
  /** 감지된 이슈 목록 */
  readonly issues: readonly AlignmentIssue[];
  /** 분석 요약 */
  readonly summary: {
    readonly matchedUnits: number;
    readonly brokenPromises: number;
    readonly shadowsFound: number;
  };
}

// ── 분석 엔진 ─────────────────────────────────────────

/**
 * 단일 문서(의도)와 추출된 IR(실행)을 대조하여 정렬 상태를 분석한다.
 */
export function compareIntentWithExecution(
  intent: DefinitionEntry,
  executionUnits: ModuleIR[],
): AlignmentResult {
  const issues: AlignmentIssue[] = [];
  
  // 1. 매칭: @def.doc 또는 id 기반
  const matched = executionUnits.filter(u => u.meta.defDocRef === intent.id || u.id === intent.id);
  
  if (matched.length === 0) {
    // 구현이 아예 식별되지 않은 경우 (Broken Promise)
    return {
      score: 0,
      issues: [{
        type: "broken-promise",
        severity: "error",
        intentId: intent.id,
        message: `설계 의도 "${intent.id}"에 대응하는 실제 코드 구현을 찾을 수 없습니다.`,
      }],
      summary: { matchedUnits: 0, brokenPromises: 1, shadowsFound: 0 },
    };
  }

  let matchedScore = 0;
  let shadowCount = 0;
  let scoredUnits = 0;

  for (const unit of matched) {
    let unitScore = 100;

    // 2. 의도 위계(Core/Auxiliary) 대조
    if (intent.intent_hierarchy && unit.meta.intentHierarchy) {
      if (intent.intent_hierarchy === "core" && unit.meta.intentHierarchy === "auxiliary") {
        // 코어 의도에 보조 구현이 매칭된 경우: 페널티 없이 사이드카로 간주
        shadowCount++; // 사이드카 발견으로 카운트
        continue; 
      }
      
      if (intent.intent_hierarchy !== unit.meta.intentHierarchy) {
        issues.push({
          type: "hierarchy-mismatch",
          severity: "warning",
          intentId: intent.id,
          executionId: unit.id,
          message: `의도 위계 불일치: 설계는 "${intent.intent_hierarchy}"이나 코드는 "${unit.meta.intentHierarchy}"로 추출됨.`,
        });
        unitScore -= 30;
      }
    }

    // 3. 투영 평면 교차 검증
    if (unit.meta.projectionPlane !== "execution") {
      issues.push({
        type: "facet-drift",
        severity: "warning",
        intentId: intent.id,
        executionId: unit.id,
        message: `구현 평면 오류: 코드에서 추출된 노드가 "execution" 평면으로 마킹되지 않음.`,
      });
      unitScore -= 10;
    }

    matchedScore += unitScore;
    scoredUnits++;
  }

  const averageScore = scoredUnits > 0 
    ? Math.max(0, Math.min(100, matchedScore / scoredUnits))
    : 0;

  return {
    score: averageScore,
    issues,
    summary: {
      matchedUnits: matched.length,
      brokenPromises: 0,
      shadowsFound: shadowCount,
    },
  };
}

/**
 * 전체 그래프 수준에서 Shadow Implementation(의도 없는 구현)을 찾아낸다.
 */
export function auditShadowImplementation(
  intents: DefinitionEntry[],
  executions: ModuleIR[],
): AlignmentIssue[] {
  const issues: AlignmentIssue[] = [];
  const intentIds = new Set(intents.map(i => i.id));
  
  for (const unit of executions) {
    // 코어 로직인데 연결된 문서가 없는 경우
    if (unit.meta.intentHierarchy === "core" && !unit.meta.defDocRef && !intentIds.has(unit.id)) {
      issues.push({
        type: "shadow-implementation",
        severity: "warning",
        intentId: "unknown",
        executionId: unit.id,
        message: `은밀한 구현(Shadow): 코어 비즈니스 로직 "${unit.id}"이(가) 설계 문서에 정의되지 않은 채 구현되어 있습니다.`,
      });
    }
  }
  
  return issues;
}
