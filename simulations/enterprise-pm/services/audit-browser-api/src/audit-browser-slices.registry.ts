// @def.boundary sim-audit-browser-api
// @def.doc domain-slice-architecture
//
// Phase 0 산출물 — audit-browser-api 슬라이스 registry.
//
// 소유권 규칙:
// - Phase 2 의 각 에이전트는 자기 슬라이스의 import 라인과 배열 entry 만 주석 해제한다.
// - 다른 라인 / 다른 슬라이스 영역은 절대 수정하지 않는다 (no-overlap 보장).
//
// 비고:
// - audit-browser-api 는 다른 서비스와 달리 도메인 wrapper 디렉터리(src/<domain>/) 가
//   없다. 슬라이스가 src/audit-explorer/, src/graph-explorer/ 로 직접 위치한다.
//   따라서 본 registry 도 src/ top-level 에 둔다 (자연스러운 위치 규칙).
// - 두 슬라이스 모두 BFF 슬라이스로 재포지셔닝 예정.

import { AuditExplorerSliceModule } from "./audit-explorer/audit-explorer.module.js";
import { GraphExplorerSliceModule } from "./graph-explorer/graph-explorer.module.js";

/**
 * audit-browser 도메인의 슬라이스 모듈 목록. Phase 2 에이전트가 자기 슬라이스의
 * 배열 entry 만 주석 해제한다.
 */
export const AUDIT_BROWSER_SLICE_MODULES = [
  AuditExplorerSliceModule,
  GraphExplorerSliceModule,
] as const;
