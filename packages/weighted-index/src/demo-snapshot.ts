/**
 * demo-snapshot.ts — 데모/샘플 데이터 스냅샷.
 *
 * platform-demo와 platform-demo-api가 공유하는 차원 메타데이터,
 * 한국어 라벨, 인코딩 상수의 단일 출처(SSOT).
 *
 * @internal 데모 전용 — 라이브러리 공개 API가 아님.
 */

// ── Dimension entries ───────────────────────────────────────────────────────

export const DEMO_ENVS       = ["dev", "stage", "prod", "test", "local"] as const;
export const DEMO_REGIONS    = ["asia", "usa"] as const;
export const DEMO_SVCS       = ["shopping-web", "shopping-backend", "auth", "payment", "gateway"] as const;
export const DEMO_NSS        = ["shop", "cms"] as const;

export const DEMO_ROLES_V1   = ["admin", "developer", "operator", "viewer", "readonly"] as const;
export const DEMO_ROLES_V2   = ["admin", "developer", "operator", "customer", "viewer", "readonly"] as const;

export const DEMO_EVENTS_V1  = [
  "user.login", "user.logout", "order.created", "order.paid",
  "payment.failed", "session.expired", "config.changed",
] as const;
export const DEMO_EVENTS_V2  = [
  ...DEMO_EVENTS_V1,
  "payment.cancel_requested", "payment.cancel_approved",
] as const;

export const DEMO_INITIATORS = ["web", "mobile"] as const;

// ── Korean labels ───────────────────────────────────────────────────────────

export const DEMO_KO = {
  env: { dev: "개발", stage: "스테이지", prod: "운영", test: "테스트", local: "로컬" } as Record<string, string>,
  region: { asia: "아시아", usa: "미국" } as Record<string, string>,
  svc: {
    "shopping-web": "쇼핑웹", "shopping-backend": "쇼핑BE",
    auth: "인증", payment: "결제", gateway: "GW",
  } as Record<string, string>,
  ns: { shop: "쇼핑몰", cms: "CMS" } as Record<string, string>,
  role: {
    admin: "관리자", developer: "개발자", operator: "운영자",
    customer: "고객", viewer: "뷰어", readonly: "읽기전용",
  } as Record<string, string>,
  event: {
    "user.login": "로그인", "user.logout": "로그아웃",
    "order.created": "주문생성", "order.paid": "주문결제",
    "payment.failed": "결제실패", "session.expired": "세션만료",
    "config.changed": "설정변경",
    "payment.cancel_requested": "취소요청", "payment.cancel_approved": "취소승인",
  } as Record<string, string>,
  initiator: { web: "웹", mobile: "모바일" } as Record<string, string>,
} as const;

// ── Service encoding ────────────────────────────────────────────────────────

/** SVC shape [5, 2, 5, 2] → strides [20, 10, 2, 1] */
export const DEMO_SVC_SHAPE   = [5, 2, 5, 2] as const;
export const DEMO_SVC_STRIDES = [20, 10, 2, 1] as const;

export function demoEncodeSvc(coords: readonly number[]): number {
  let v = 0;
  for (let i = 0; i < coords.length; i++) v += (coords[i] - 1) * DEMO_SVC_STRIDES[i];
  return v;
}

export function demoDecodeSvc(v: number): number[] {
  const coords: number[] = [];
  let rest = v;
  for (const s of DEMO_SVC_STRIDES) {
    coords.push(Math.floor(rest / s) + 1);
    rest %= s;
  }
  return coords;
}

// ── Cross-index address constants ───────────────────────────────────────────

/** perm_svc entries (prod/asia 서비스 주소 40–49) */
export const DEMO_PERM_SVC_VALUES = [40, 41, 42, 43, 44, 45, 46, 47, 48, 49] as const;
/** event_svc entries (dev+prod/asia/shop 서비스 주소) */
export const DEMO_EVT_SVC_VALUES  = [0, 2, 4, 6, 8, 40, 42, 44, 46, 48] as const;

// ── Permission / Event helpers ──────────────────────────────────────────────

export type DemoVer = "v1" | "v2";

export function demoRolesFor(v: DemoVer) { return v === "v1" ? DEMO_ROLES_V1 : DEMO_ROLES_V2; }
export function demoRoleStride(v: DemoVer) { return v === "v1" ? 5 : 6; }
export function demoEventsFor(v: DemoVer) { return v === "v1" ? DEMO_EVENTS_V1 : DEMO_EVENTS_V2; }
export function demoEvtStride(v: DemoVer) { return v === "v1" ? 14 : 18; }

export interface DemoPermDecoded {
  svcIdx: number; svcId: string; svcKo: string;
  nsId: string; nsKo: string;
  roleId: string; roleKo: string;
}

export function demoDecodePerm(addr: number, v: DemoVer): DemoPermDecoded | null {
  const rs = demoRoleStride(v);
  const svcPos = Math.floor(addr / rs);
  const roleIdx = addr % rs;
  const roles = demoRolesFor(v);
  if (svcPos >= 10 || roleIdx >= roles.length) return null;
  const svcI = Math.floor(svcPos / 2);
  const nsI  = svcPos % 2;
  return {
    svcIdx: svcPos, svcId: DEMO_SVCS[svcI], svcKo: DEMO_KO.svc[DEMO_SVCS[svcI]],
    nsId: DEMO_NSS[nsI], nsKo: DEMO_KO.ns[DEMO_NSS[nsI]],
    roleId: roles[roleIdx], roleKo: DEMO_KO.role[roles[roleIdx]],
  };
}

export interface DemoEvtDecoded {
  svcIdx: number; svcId: string; svcKo: string;
  nsId: string; nsKo: string;
  eventId: string; eventKo: string;
  initiatorId: string; initiatorKo: string;
}

export function demoDecodeEvt(addr: number, v: DemoVer): DemoEvtDecoded | null {
  const es = demoEvtStride(v);
  const svcPos = Math.floor(addr / es);
  const rem = addr % es;
  const events = demoEventsFor(v);
  const evtIdx = Math.floor(rem / 2);
  const initIdx = rem % 2;
  if (svcPos >= 10 || evtIdx >= events.length || initIdx >= 2) return null;
  const svcI = Math.floor(svcPos / 2);
  const nsI  = svcPos % 2;
  return {
    svcIdx: svcPos, svcId: DEMO_SVCS[svcI], svcKo: DEMO_KO.svc[DEMO_SVCS[svcI]],
    nsId: DEMO_NSS[nsI], nsKo: DEMO_KO.ns[DEMO_NSS[nsI]],
    eventId: events[evtIdx], eventKo: DEMO_KO.event[events[evtIdx]],
    initiatorId: DEMO_INITIATORS[initIdx], initiatorKo: DEMO_KO.initiator[DEMO_INITIATORS[initIdx]],
  };
}

// ── Sample log templates ────────────────────────────────────────────────────

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
