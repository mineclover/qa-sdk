// @def.boundary sim-test-fixtures
// @def.doc 02-canary-topology

/**
 * v1/v2 차이를 시나리오별 fixture로 표현하는 공용 타입.
 *
 * spec 02-canary-topology.md §4.3.
 *
 * - `v1Tag` / `v2Tag` — Dockerfile build arg `SERVICE_VERSION` 값.
 * - `v2Patch` — v2 빌드 시점에 적용할 source code 변환 함수 맵.
 *   key: 파일 경로 (repo-root 기준), value: (src) → 변환된 src.
 *   본 patch는 docker-compose에 별도 SERVICE_VERSION 빌드와 *함께*
 *   build context overlay로 적용된다 (단계 9·10에서 활성화).
 * - `expectedAssertions` — 시나리오 종료 시 단언할 메트릭/이벤트 조건.
 *   key: 측정점 (controller/gateway/ingest-server.<metric_name>),
 *   value: { gte | lte | eq | lt | gt: 숫자 } 매트릭.
 */
export interface ScenarioFixture {
  readonly id: string;
  readonly v1Tag: string;
  readonly v2Tag: string;
  readonly v2Patch?: Record<string, (src: string) => string>;
  readonly expectedAssertions: Record<string, ScenarioAssertion>;
}

export type ScenarioAssertion =
  | { readonly gte: number }
  | { readonly lte: number }
  | { readonly eq: number | string }
  | { readonly lt: number }
  | { readonly gt: number };
