// @def.boundary spec-engine-system
// @def.doc spec-engine-system

/**
 * schema-validation-codec — 스키마 검증 결과를 prefix 좌표로 인코딩.
 *
 * permission-engine의 PermissionCodec과 동일한 "prefix 소비자" 패턴:
 * 검증 결과 → prefix 좌표(정수) → DKG 관측으로 기록.
 *
 * 경량 매퍼 — full WeightedIndex 불필요 (설계/CI 시점 검증).
 * 순수 TypeScript — 서비스 의존 없음.
 *
 * @layer 인코딩 (Encoding)
 */

import type { ValidationErrorDetail } from "./shared/errors.js";

// ═══════════════════════════════════════════════════════════════
//  축 어휘 — DEMO_CATALOG.axes와 동기화
// ═══════════════════════════════════════════════════════════════

/** validation_layer 축 entries (L0/L1/L2) */
const VALIDATION_LAYERS = ["vocabulary", "structural", "constraint"] as const;

/** constraint_rule 축 entries */
const CONSTRAINT_RULES = [
  "required", "maxCount", "minCount", "requiredIf",
  "exclusive", "type", "multi", "unknownAxis",
] as const;

/** verdict_result 축 entries (기존 축 재사용) */
const VERDICT_RESULTS = ["pass", "fail", "warn", "degraded", "unknown"] as const;

// ═══════════════════════════════════════════════════════════════
//  좌표 타입
// ═══════════════════════════════════════════════════════════════

/** 검증 결과 1건의 좌표 표현 */
export interface ValidationCoordinate {
  /** service prefix 주소 (schema_validation의 svc_ref 차원) */
  readonly schemaRef: number;
  /** validation_layer 축 인덱스 */
  readonly validationLayer: number;
  /** constraint_rule 축 인덱스 */
  readonly constraintRule: number;
  /** verdict_result 축 인덱스 */
  readonly verdictResult: number;
}

// ═══════════════════════════════════════════════════════════════
//  인코딩 함수
// ═══════════════════════════════════════════════════════════════

/** layer 번호 (0/1/2) → validation_layer entry 이름 */
function _layerToEntry(layer: 0 | 1 | 2): string {
  return VALIDATION_LAYERS[layer];
}

/** rule 문자열 → constraint_rule 축 인덱스 (0-based) */
function ruleToIndex(rule: string): number {
  const idx = (CONSTRAINT_RULES as readonly string[]).indexOf(rule);
  return idx >= 0 ? idx : (CONSTRAINT_RULES as readonly string[]).indexOf("unknownAxis");
}

/** verdict 문자열 → verdict_result 축 인덱스 */
function verdictToIndex(verdict: string): number {
  const idx = (VERDICT_RESULTS as readonly string[]).indexOf(verdict);
  return idx >= 0 ? idx : (VERDICT_RESULTS as readonly string[]).indexOf("unknown");
}

/**
 * 검증 에러 1건을 prefix 좌표로 매핑한다.
 */
export function mapErrorToCoordinate(
  error: ValidationErrorDetail,
  options?: { schemaRef?: number },
): ValidationCoordinate {
  return {
    schemaRef: options?.schemaRef ?? 0,
    validationLayer: error.layer,
    constraintRule: ruleToIndex(error.rule),
    verdictResult: verdictToIndex("fail"),
  };
}

/**
 * 검증 결과 전체를 좌표 배열로 매핑한다.
 * 에러가 없으면 pass 좌표 1건을 반환한다.
 */
export function mapValidationToCoordinates(
  errors: readonly ValidationErrorDetail[],
  options?: { schemaRef?: number },
): ValidationCoordinate[] {
  if (errors.length === 0) {
    return [{
      schemaRef: options?.schemaRef ?? 0,
      validationLayer: 0,
      constraintRule: 0,
      verdictResult: verdictToIndex("pass"),
    }];
  }

  return errors.map(e => mapErrorToCoordinate(e, options));
}

/**
 * 좌표를 사람이 읽을 수 있는 문자열로 디코딩한다.
 */
export function decodeCoordinate(coord: ValidationCoordinate): {
  layer: string;
  rule: string;
  verdict: string;
} {
  return {
    layer: VALIDATION_LAYERS[coord.validationLayer] ?? "unknown",
    rule: CONSTRAINT_RULES[coord.constraintRule] ?? "unknown",
    verdict: VERDICT_RESULTS[coord.verdictResult] ?? "unknown",
  };
}

/** 축 entries를 외부에 노출 (테스트/bridge에서 사용) */
export const AXIS_ENTRIES = {
  validationLayer: VALIDATION_LAYERS,
  constraintRule: CONSTRAINT_RULES,
  verdictResult: VERDICT_RESULTS,
} as const;
