// @def.boundary spec-engine-system
// @def.doc spec-engine-system

import type { ExportSurface } from "../export-surface/export-surface.types.js";
import type { SchemaCategory } from "spec-schema";
import type { SpecId } from "./spec.types.js";

/**
 * DimRef: prefix 내부의 차원 참조.
 *
 * indexing 레이어의 DimRef와 호환되는 구조.
 * spec-core에서는 이 타입을 "prefix의 내부 구조"로 사용한다.
 */
export type DimRef =
  | { kind: "axis"; axisId: string }
  | { kind: "prefix_ref"; prefixId: string }
  | { kind: "table_ref"; table: string };

/**
 * prefix의 완전한 명세.
 *
 * export surface + schema + 설계 근거를 하나로 묶는 최상위 타입.
 * indexing 레이어의 PrefixDef에 대응하되, 구조 정의 관심사를 추가.
 */
export interface PrefixSpec {
  /** prefix 식별자 */
  id: string;

  /** 버전 */
  version: string;

  /** 전체 차원 (내부 + 외부) */
  dims: Record<string, DimRef>;

  /** export surface — 모듈의 공개 인터페이스 */
  export: ExportSurface;

  /** 다른 prefix 참조 (모듈 imports) */
  imports?: Record<string, string>;

  /** 스키마 바인딩 */
  schema?: {
    category: SchemaCategory;
    schemaRef?: string;
  };

  /** 설계 근거 */
  rationale?: string;

  /** 스펙 문서 참조 */
  specRef?: SpecId;
}
