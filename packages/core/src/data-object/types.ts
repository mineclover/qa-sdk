// @def.boundary qa-sdk-core-system
// @def.doc qa-sdk-core-system

// ── DataObject Binding — DataSchema ↔ prefix 바인딩 ───────────

export interface ColumnAxisMapping {
  dimLabel: string;
  segmentId?: string;
}

export interface DataObjectBinding {
  schemaId: string;
  schemaVersion: string;
  prefixId: string;
  prefixVersion: string;
  columnToAxis: Record<string, ColumnAxisMapping>;
}

export interface BindingValidation {
  schemaId: string;
  prefixId: string;
  errors: string[];
  warnings: string[];
}

export interface LineageChainValidation {
  bound: number;
  unbound: number;
  mismatched: number;
}

export type ChainIssueKind = "unbound" | "mismatched";

export interface ChainIssue {
  kind: ChainIssueKind;
  /** 문제가 있는 lineage의 target */
  target: { schemaId: string; column: string };
  /** 사유 */
  reason: string;
}

export interface DetailedChainValidation extends LineageChainValidation {
  issues: ChainIssue[];
}

export interface BoundDataObject<
  S extends string,
  P extends string,
> {
  readonly schemaId: S;
  readonly prefixId: P;
  readonly data: Record<string, unknown>;
  readonly address: number;
  readonly serialized: string;
}

// ── Facet-Code Mapping — 패싯 ↔ 소스 코드 연결 ───────

/** 소스 코드 위치 참조 */
export interface FacetCodeRef {
  /** 모노레포 루트 기준 상대 경로 */
  file: string;
  /** 함수/클래스/메서드명 */
  symbol?: string;
  /** 줄 범위 (선택) */
  lines?: [number, number];
}

/** 패싯 하나의 코드 매핑 */
export interface FacetCodeMapping {
  /** PipeStep.facet 값과 일치 */
  facet: string;
  /** 이 패싯을 구현하는 코드 위치 (1:N) */
  implementations: FacetCodeRef[];
  /** 이 패싯이 다루는 DataSchema ID (있으면 계보 체인에 연결) */
  schemaId?: string;
}
