/**
 * core/ 배럴 — 순수 도메인 로직
 *
 * import 제약:
 *   core/ → definition-catalog (라이브러리) 허용
 *   core/ → stores/ 금지 (interfaces.ts만 정의)
 *   core/ → http/routes/ 금지
 */

// 타입
export type {
  DocRecord,
  DocHistoryRecord,
  SliceIntentRecord,
  ConsumptionSnapshot,
} from "./types.js";

// 인터페이스 (저장소 포트)
export type { DocStore, IntentStore, ConsumptionStore } from "./interfaces.js";

// 문서 버전 관리
export { decideVersion, markersMatch, isMarkerOnlyChange } from "./doc-versioner.js";
export type { VersionDecision } from "./doc-versioner.js";

// 의도 해석
export { parseDimsParam, resolveMatchingIntents } from "./intent-resolver.js";

// 소비율 진단
export { snapshotToConsumption, diagnoseSnapshot, computeRate } from "./consumption-diagnostics.js";

// 동기화 엔진
export { hashBody, extractMarkers, extractBody, buildDocRecord } from "./sync-engine.js";
