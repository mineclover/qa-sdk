/**
 * schema-observation-bridge — 검증 결과를 DKG ObservationNode로 변환.
 *
 * coverage-audit.ts의 패턴: 분석 결과 → Observation 생성.
 * 순수 함수 — GraphRegistry에 직접 추가하지 않고 노드/엣지를 반환.
 *
 * @layer 기록 (Recording)
 */

import type { ObservationNode, ObservationSuggestion } from "./dkg.types.js";
import type { ValidationResult } from "spec-schema";
import type { ValidationErrorDetail } from "spec-schema";
import { mapValidationToCoordinates, type ValidationCoordinate } from "spec-schema";

// ═══════════════════════════════════════════════════════════════

export interface SchemaObservationResult {
  readonly observations: readonly ObservationNode[];
  readonly edges: readonly { readonly type: "observes"; readonly from: string; readonly to: string }[];
  readonly coordinates: readonly ValidationCoordinate[];
  readonly summary: string;
}

// ═══════════════════════════════════════════════════════════════

/**
 * 검증 결과 → ObservationNode 생성.
 * 에러가 있는 경우에만 observation을 생성한다 (정상은 silent).
 *
 * @param schemaId - 검증 대상 스키마 ID (예: "event.base")
 * @param result - SchemaValidator.validate() 결과
 * @param options.date - Observation 날짜 (기본: today)
 * @param options.prefixId - 연관 prefix ID (subjects에 포함)
 * @param options.schemaRef - svc_ref 좌표값
 */
export function bridgeValidationToObservation(
  schemaId: string,
  result: ValidationResult,
  options?: { date?: string; prefixId?: string; schemaRef?: number },
): SchemaObservationResult {
  const date = options?.date ?? new Date().toISOString().slice(0, 10);
  const coordinates = mapValidationToCoordinates(result.errors, { schemaRef: options?.schemaRef });

  if (result.valid) {
    return { observations: [], edges: [], coordinates, summary: `${schemaId}: 검증 통과` };
  }

  // 레이어별 에러 그룹핑
  const byLayer = groupByLayer(result.errors);
  const observations: ObservationNode[] = [];
  const edges: Array<{ type: "observes"; from: string; to: string }> = [];

  for (const [layer, errors] of byLayer) {
    const layerName = ["vocabulary", "structural", "constraint"][layer] ?? "unknown";
    // 결정적 ID: 스키마 + 레이어로 고유 (멱등 upsert 가능)
    const id = `OBS-SCHEMA-${schemaId}-L${layer}`;

    const subjects = [schemaId];
    if (options?.prefixId) subjects.push(options.prefixId);

    const rulesSummary = [...new Set(errors.map(e => e.rule))].join(", ");
    const finding = `${schemaId} L${layer}(${layerName}) 검증 실패 ${errors.length}건: ${rulesSummary}`;

    const suggestion: ObservationSuggestion | undefined =
      layer === 2
        ? { kind: "add-constraint", rule: `${schemaId} 구조 제약 위반 수정 필요 (${rulesSummary})` }
        : undefined;

    const obs: ObservationNode = {
      kind: "observation",
      id,
      date,
      source: "metric",
      subjects,
      finding,
      intent: "action-needed",
      ...(suggestion && { suggestion }),
    };

    observations.push(obs);

    for (const subject of subjects) {
      edges.push({ type: "observes", from: id, to: subject });
    }
  }

  const summary = `${schemaId}: ${result.errors.length}건 위반 (${observations.length}개 observation)`;

  return { observations, edges, coordinates, summary };
}

// ═══════════════════════════════════════════════════════════════

function groupByLayer(errors: readonly ValidationErrorDetail[]): Map<number, ValidationErrorDetail[]> {
  const map = new Map<number, ValidationErrorDetail[]>();
  for (const e of errors) {
    const arr = map.get(e.layer) ?? [];
    arr.push(e);
    map.set(e.layer, arr);
  }
  return map;
}
