/**
 * ralph-tui-integration — ralph-tui 전용 adapter + 완료 감지 유틸.
 *
 * `.ralph-tui/` 세션 파일 경로 하드코딩, flat-root JSON PRD 포맷 파싱,
 * ralph-tui 특화 completed-record 감지는 모두 본 패키지 내부에 격리된다.
 * `doc-envelope`은 ralph-tui를 알지 못한다.
 */

// @def.boundary deterministic-label-architecture
// @def.doc ralph-tui-integration

// ─── ralph-session adapter ──────────────────────────────
export { createRalphSessionAdapter, RALPH_SESSION_ADAPTER_ID } from './ralph-session.js';

export type { RalphSessionAdapterOptions } from './ralph-session.js';

// ─── ralph-prd-json adapter ─────────────────────────────
export {
  buildRalphPrdJsonEnvelopeFromContent,
  createRalphPrdJsonAdapter,
  readRalphPrdJsonSummary,
  RALPH_PRD_JSON_ADAPTER_ID,
} from './ralph-prd-json.js';

export type { RalphPrdJsonAdapterOptions, RalphPrdJsonSummary } from './ralph-prd-json.js';

// ─── ralph PRD completion detection ─────────────────────
export { detectCompletedRalphPrdRecords } from './completed-ralph-prd.js';

export type { CompletedRalphPrdDetectionOptions } from './completed-ralph-prd.js';
