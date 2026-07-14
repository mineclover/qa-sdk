// @def.boundary sim-reporting-api
// @def.doc domain-slice-architecture
//
// Density 슬라이스 단일-슬롯 registry.
//
// 본 서비스의 정식 reporting 도메인 registry 는 `./reporting/reporting-slices.registry.ts`
// 이지만, density 슬라이스는 `src/density/` (top-level) 에 위치한다 — Phase 0 의
// 결정. validator 의 "domain slices must live under modules/<domain> or under
// <domain>/ with a sibling <domain>-slices.registry.ts" 규약을 만족시키기 위해
// density 의 sibling 위치 (= `src/`) 에 본 marker registry 를 둔다.
//
// 활성화 방식: app.module 에서 `DensitySliceModule.register({useFactory})` 형태로
// 직접 import. 본 파일은 dynamic 모듈을 정적 배열에 포함시키지 않는다.

import { DensitySliceModule } from './density/density.module.js';

/**
 * density 단일 슬라이스 marker 배열. dynamic 모듈은 app.module 의
 * .register() 호출에서 instantiation 된다 — 본 export 는 grouping marker
 * 역할.
 */
export const DENSITY_SLICE_MODULES = [DensitySliceModule] as const;
