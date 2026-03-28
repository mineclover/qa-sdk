/**
 * Spec Analyzer 핵심 타입.
 */

export type SymbolKind = "function" | "type" | "endpoint" | "class";

/** 문서에서 추출한 선언 1건 */
export interface DeclaredSymbol {
  readonly name: string;
  readonly kind: SymbolKind;
  readonly marker?: string;
  readonly specId: string;
  readonly line?: number;
}

/** 코드에서 발견된 구현 1건 */
export interface ImplementedSymbol {
  readonly name: string;
  readonly kind: SymbolKind;
  readonly filePath: string;
  readonly line?: number;
  readonly exported: boolean;
}

/** spec 1건의 drift 분석 결과 */
export interface DriftReport {
  readonly specId: string;
  readonly svc: string;
  readonly declared: readonly DeclaredSymbol[];
  readonly implemented: readonly ImplementedSymbol[];
  readonly missing: readonly DeclaredSymbol[];
  readonly undocumented: readonly ImplementedSymbol[];
  readonly coverage: number;
}

/** 전체 분석 결과 */
export interface AnalysisSummary {
  readonly reports: readonly DriftReport[];
  readonly totalSpecs: number;
  readonly totalDeclared: number;
  readonly totalMissing: number;
  readonly overallCoverage: number;
  readonly generatedAt: string;
}
