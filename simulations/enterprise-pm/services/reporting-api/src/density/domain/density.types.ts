// @def.boundary sim-reporting-api
// @def.doc event-taxonomy-marginal-density

/**
 * Read-side density DTO — §5 §3.1 응답 schema 와 1:1 매칭.
 *
 * Density 슬라이스는 pure read-model 슬라이스 — entity / 도메인 예외 (NotFound 외)
 * / command / outbox 가 모두 없다. 본 파일은 read-only shape 만 선언.
 */
export interface MarginalDensityAxisReadModel {
  readonly axisName: string;
  readonly shapeCapacity: number;
  readonly observedDistinct: number;
  readonly marginalDensity: number;
  readonly unobservedEntries: readonly string[];
}

export interface MarginalDensityReadModel {
  readonly catalog: string;
  readonly prefix: string;
  readonly version: string;
  readonly axes: readonly MarginalDensityAxisReadModel[];
  readonly underutilizedAxes: readonly string[];
  readonly saturatedAxes: readonly string[];
}
