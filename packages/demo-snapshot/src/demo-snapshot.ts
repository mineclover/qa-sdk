// @def.boundary platform-chain-system
/**
 * demo-snapshot.ts — 데모/샘플 데이터 스냅샷.
 *
 * platform-demo와 platform-demo-api가 공유하는 차원 메타데이터,
 * 한국어 라벨, 인코딩 상수의 단일 출처(SSOT).
 *
 * 모든 차원 데이터는 DEMO_CATALOG(demo-catalog.ts)에서 파생됨.
 *
 * @internal 데모 전용 — 라이브러리 공개 API가 아님.
 */

// ── DEMO_CATALOG 파생 상수/함수 ──────────────────────────────────────────────

export {
  // Dimension entries
  DEMO_ENVS, DEMO_REGIONS, DEMO_SVCS, DEMO_NSS,
  DEMO_ROLES_V1, DEMO_ROLES_V2, DEMO_ROLES_V3, DEMO_ROLES_V4,
  DEMO_EVENTS_V1, DEMO_EVENTS_V2, DEMO_EVENTS_V3, DEMO_EVENTS_V4,
  DEMO_ROLE_CAP, DEMO_EVENT_CAP,
  DEMO_INITIATORS, DEMO_KO,
  // Service encoding
  DEMO_SVC_SHAPE, DEMO_SVC_STRIDES,
  demoEncodeSvc, demoDecodeSvc,
  // Cross-index address constants
  DEMO_PERM_SVC_VALUES, DEMO_EVT_SVC_VALUES,
  // Permission / Event helpers
  demoRolesFor, demoRoleStride, demoEventsFor, demoEvtStride,
  demoCalcPermAddr, demoCalcEvtAddr,
  demoDecodePerm, demoDecodeEvt,
  // Types
  type DemoVer, type DemoPermDecoded, type DemoEvtDecoded,
} from "./demo-compat.js";

// ── 독립 데이터 (카탈로그 외) ────────────────────────────────────────────────

export type DemoLogLevel = "DEBUG" | "INFO" | "WARN" | "ERROR";

export interface DemoLogTemplate {
  level: DemoLogLevel;
  action: string;
  message: string;
}

export const DEMO_LOG_TEMPLATES: readonly DemoLogTemplate[] = [
  { level: "INFO",  action: "page.view",         message: "상품 상세 페이지 조회" },
  { level: "INFO",  action: "cart.add",           message: "장바구니 추가 — SKU-8823" },
  { level: "INFO",  action: "order.submit",       message: "주문 접수 완료 — KRW 32,000" },
  { level: "DEBUG", action: "cache.hit",          message: "Redis 캐시 히트 — key=product:42" },
  { level: "DEBUG", action: "db.query",           message: "SELECT COUNT(*) FROM orders WHERE status = 'pending'" },
  { level: "WARN",  action: "latency.spike",      message: "P99 레이턴시 200ms 초과 — 현재 312ms" },
  { level: "WARN",  action: "disk.usage",         message: "디스크 사용량 85% 도달 — /data 파티션" },
  { level: "ERROR", action: "payment.timeout",    message: "PG 응답 타임아웃 — 30s 초과" },
  { level: "ERROR", action: "db.connection.fail", message: "DB 커넥션 풀 소진 — max_connections=100" },
  { level: "INFO",  action: "user.signup",        message: "신규 회원 가입 — OAuth(Google)" },
  { level: "INFO",  action: "deploy.complete",    message: "배포 완료 — v2.5.0-rc1 (canary 100%)" },
  { level: "WARN",  action: "auth.suspicious",    message: "비정상 접근 패턴 — 다중 IP 로그인 시도" },
];
