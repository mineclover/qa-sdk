// @def.boundary sim-reporting-api
// @def.doc domain-slice-architecture
//
// Phase 0 산출물 — reporting-api 슬라이스 registry.
//
// 소유권 규칙:
// - Phase 2 의 각 에이전트는 자기 슬라이스의 import 라인과 배열 entry 만 주석 해제한다.
// - 다른 라인 / 다른 슬라이스 영역은 절대 수정하지 않는다 (no-overlap 보장).
//
// 비고:
// - report, metric 은 src/reporting/ 하위
// - density 는 src/density/ (top-level) — 기존 레거시 위치를 유지하므로 import 가
//   상대 경로로 한 단계 위를 가리킨다. Phase 2 의 density 에이전트가 슬라이스
//   포팅 시 모듈 경로를 결정한다.
// - 모두 read-model 슬라이스로 재포지셔닝 (read-only)

import { ReportSliceModule } from './report/report.module.js';
import { MetricSliceModule } from './metric/metric.module.js';
// DensitySliceModule 은 dynamic 모듈이라 useFactory 가 필요해 본 정적 배열에
// 포함하지 않는다. 활성화는 app.module 의 `DensitySliceModule.register({...})`
// + `src/density-slices.registry.ts` 의 single-slot marker 가 담당.

/**
 * reporting 도메인의 슬라이스 모듈 목록. Phase 2 에이전트가 자기 슬라이스의
 * 배열 entry 만 주석 해제한다.
 */
export const REPORTING_SLICE_MODULES = [
  ReportSliceModule,
  MetricSliceModule,
  // DensitySliceModule 은 dynamic — REPORTING_SLICE_MODULES 에 포함되지 않음.
  // 활성화: app.module 의 DensitySliceModule.register({...}).
] as const;
