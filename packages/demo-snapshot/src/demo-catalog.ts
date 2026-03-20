/**
 * demo-catalog.ts — Prefix 기반 통합 버전 관리 카탈로그 (SSOT).
 *
 * 모든 축(axis)과 주소 공간(prefix)을 하나의 구조체에 통합 관리한다.
 * 다른 demo-* 파일은 이 카탈로그에서 파생(derive)해야 하며,
 * 이 파일은 다른 demo-* 파일을 import하지 않는다.
 */

/**
 * refEntries 파생 — 의미가 원본, 정수는 파생.
 * 개발자는 정수를 보지 않는다. catalog-builder.ts의 *_MEANING이 SSOT.
 *
 * 빌드 순서: DEMO_CATALOG_BASE (refEntries 없이) → hydrate → DEMO_CATALOG
 */

// ── Layer 0: 축 (VersionedAxis) ──────────────────────────────────────────────

export interface AxisVersionSnapshot {
  readonly entries: readonly string[];
  readonly capacity?: number;
  readonly ko?: Record<string, string>;
}

export interface VersionedAxis {
  readonly id: string;
  readonly name: string;
  readonly versions: Record<string, AxisVersionSnapshot>;
}

// ── Layer 1: 차원 참조 (DimRef) ──────────────────────────────────────────────

export type DimRef =
  | { readonly kind: "axis"; readonly axisId: string }
  | { readonly kind: "prefix_ref"; readonly prefixId: string }
  | { readonly kind: "table_ref"; readonly table: string };

// ── Layer 2: Prefix ──────────────────────────────────────────────────────────

export interface PrefixVersionDef {
  readonly version: string;
  readonly axisVersions: Record<string, string>;
  readonly refEntries?: Record<string, { values: readonly number[]; refVersion: string }>;
}

export interface PrefixDef {
  readonly id: string;
  readonly name: string;
  readonly description?: string;
  readonly labels: readonly string[];
  readonly dims: Record<string, DimRef>;
  readonly versions: readonly PrefixVersionDef[];
}

// ── Layer 2.5: 테이블 스키마 (좌표 ↔ 관계형 양방향 연결) ─────────────────────

export type ColumnRef =
  | { readonly kind: "scalar"; readonly type: string }
  | { readonly kind: "prefix_ref"; readonly prefixId: string }
  | { readonly kind: "table_ref"; readonly table: string }
  | { readonly kind: "axis_ref"; readonly axisId: string };

export interface TableSchema {
  readonly table: string;
  readonly columns: Record<string, ColumnRef>;
}

// ── Layer 3: 카탈로그 ────────────────────────────────────────────────────────

export interface DemoCatalog {
  readonly axes: Record<string, VersionedAxis>;
  readonly prefixes: Record<string, PrefixDef>;
  readonly tables?: Record<string, TableSchema>;
}

// ── Legacy 타입 (하위 호환) ──────────────────────────────────────────────────

/** 1차원 축. 순서가 1-based position이 된다. */
export interface Axis<T extends string = string> {
  readonly id: string;
  readonly name: string;
  readonly entries: readonly T[];
  readonly capacity?: number;
  readonly ko: Record<string, string>;
}

/** 도메인 = 축의 명명된 조합. */
export interface Domain<A extends Record<string, Axis> = Record<string, Axis>> {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly axes: A;
}

// ══════════════════════════════════════════════════════════════════════════════
//  refEntries 자동 파생 — 의미가 원본, 정수는 여기서 계산됨
//  개발자는 아래 정수를 직접 다루지 않는다.
//  SSOT: catalog-builder.ts의 PERM_SVC_MEANING, EVT_SVC_MEANING, ORDER_SVC_MEANING
//
//  service prefix의 axes 정의를 먼저 선언하여 refEntries를 CATALOG 전에 파생한다.
//  이렇게 하면 capacity를 바꿔도 refEntries가 자동으로 따라간다.
// ══════════════════════════════════════════════════════════════════════════════

import {
  PERM_SVC_MEANING, EVT_SVC_MEANING, ORDER_SVC_MEANING, INFRA_SVC_MEANING,
} from "./catalog-builder.js";

/**
 * service prefix를 구성하는 4개 축의 정의 (SSOT).
 * 아래 DEMO_CATALOG.axes에서 이 값을 참조한다.
 * capacity를 바꾸면 여기만 바꾸면 된다 → refEntries 자동 재계산.
 */
const _axes = {
  env:       { entries: ["dev", "stage", "prod", "test", "local"] as const, capacity: 32 },
  region:    { entries: ["asia", "usa"] as const, capacity: 32 },
  svc_name:  { entries: ["shopping-web", "shopping-backend", "auth", "payment", "gateway"] as const, capacity: 32 },
  namespace: { entries: ["shop", "cms"] as const, capacity: 32 },
} as const;

/** service prefix shape — axes capacity에서 자동 파생 */
const _S = [_axes.env.capacity, _axes.region.capacity, _axes.svc_name.capacity, _axes.namespace.capacity];
const _sStrides = [_S[1] * _S[2] * _S[3], _S[2] * _S[3], _S[3], 1];

function _svcAddr(m: Record<string, string>): number {
  return (_axes.env.entries as readonly string[]).indexOf(m.env) * _sStrides[0]
    + (_axes.region.entries as readonly string[]).indexOf(m.region) * _sStrides[1]
    + (_axes.svc_name.entries as readonly string[]).indexOf(m.svc_name) * _sStrides[2]
    + (_axes.namespace.entries as readonly string[]).indexOf(m.namespace) * _sStrides[3];
}

const _PERM_SVC = PERM_SVC_MEANING.map(m => _svcAddr(m));
const _EVT_SVC = EVT_SVC_MEANING.map(m => _svcAddr(m));
const _ORDER_SVC = ORDER_SVC_MEANING.map(m => _svcAddr(m));
const _INFRA_SVC = INFRA_SVC_MEANING.map(m => _svcAddr(m));

// ══════════════════════════════════════════════════════════════════════════════
//  DEMO_CATALOG — 전체 데이터 SSOT
// ══════════════════════════════════════════════════════════════════════════════

export const DEMO_CATALOG = {
  axes: {
    // ── 쇼핑 플랫폼 축 (demo-snapshot 통합) ────────────────────────────────
    env: {
      id: "env", name: "환경",
      versions: {
        v1: {
          entries: _axes.env.entries,
          capacity: _axes.env.capacity,
          ko: { dev: "개발", stage: "스테이지", prod: "운영", test: "테스트", local: "로컬" },
        },
      },
    },
    region: {
      id: "region", name: "리전",
      versions: {
        v1: {
          entries: _axes.region.entries,
          capacity: _axes.region.capacity,
          ko: { asia: "아시아", usa: "미국" },
        },
      },
    },
    svc_name: {
      id: "svc_name", name: "서비스명",
      versions: {
        v1: {
          entries: _axes.svc_name.entries,
          capacity: _axes.svc_name.capacity,
          ko: { "shopping-web": "쇼핑웹", "shopping-backend": "쇼핑BE", auth: "인증", payment: "결제", gateway: "GW" },
        },
      },
    },
    namespace: {
      id: "namespace", name: "네임스페이스",
      versions: {
        v1: {
          entries: _axes.namespace.entries,
          capacity: _axes.namespace.capacity,
          ko: { shop: "쇼핑몰", cms: "CMS" },
        },
      },
    },
    role: {
      id: "role", name: "역할",
      versions: {
        v1: {
          entries: ["admin", "developer", "operator", "viewer", "readonly"],
          capacity: 32,
          ko: { admin: "관리자", developer: "개발자", operator: "운영자", viewer: "뷰어", readonly: "읽기전용" },
        },
        v2: {
          entries: ["admin", "developer", "operator", "viewer", "readonly", "customer"],
          capacity: 32,
          ko: { admin: "관리자", developer: "개발자", operator: "운영자", viewer: "뷰어", readonly: "읽기전용", customer: "고객" },
        },
        v3: {
          entries: ["admin", "developer", "operator", "viewer", "readonly", "customer"],
          capacity: 32,
          ko: { admin: "관리자", developer: "개발자", operator: "운영자", viewer: "뷰어", readonly: "읽기전용", customer: "고객" },
        },
        v4: {
          entries: ["admin", "developer", "operator", "viewer", "readonly", "customer", "auditor"],
          capacity: 32,
          ko: { admin: "관리자", developer: "개발자", operator: "운영자", viewer: "뷰어", readonly: "읽기전용", customer: "고객", auditor: "감사자" },
        },
      },
    },
    event_name: {
      id: "event_name", name: "이벤트명",
      versions: {
        v1: {
          entries: ["user.login", "user.logout", "order.created", "order.paid", "payment.failed", "session.expired", "config.changed"],
          capacity: 32,
          ko: { "user.login": "로그인", "user.logout": "로그아웃", "order.created": "주문생성", "order.paid": "주문결제", "payment.failed": "결제실패", "session.expired": "세션만료", "config.changed": "설정변경" },
        },
        v2: {
          entries: ["user.login", "user.logout", "order.created", "order.paid", "payment.failed", "session.expired", "config.changed", "payment.cancel_requested", "payment.cancel_approved"],
          capacity: 32,
          ko: { "user.login": "로그인", "user.logout": "로그아웃", "order.created": "주문생성", "order.paid": "주문결제", "payment.failed": "결제실패", "session.expired": "세션만료", "config.changed": "설정변경", "payment.cancel_requested": "취소요청", "payment.cancel_approved": "취소승인" },
        },
        v3: {
          entries: ["user.login", "user.logout", "order.created", "order.paid", "payment.failed", "session.expired", "config.changed", "payment.cancel_requested", "payment.cancel_approved"],
          capacity: 64,
          ko: { "user.login": "로그인", "user.logout": "로그아웃", "order.created": "주문생성", "order.paid": "주문결제", "payment.failed": "결제실패", "session.expired": "세션만료", "config.changed": "설정변경", "payment.cancel_requested": "취소요청", "payment.cancel_approved": "취소승인" },
        },
        v4: {
          entries: ["user.login", "user.logout", "order.created", "order.paid", "payment.failed", "session.expired", "config.changed", "payment.cancel_requested", "payment.cancel_approved", "payment.refunded"],
          capacity: 64,
          ko: { "user.login": "로그인", "user.logout": "로그아웃", "order.created": "주문생성", "order.paid": "주문결제", "payment.failed": "결제실패", "session.expired": "세션만료", "config.changed": "설정변경", "payment.cancel_requested": "취소요청", "payment.cancel_approved": "취소승인", "payment.refunded": "환불완료" },
        },
      },
    },
    initiator: {
      id: "initiator", name: "발생 채널",
      versions: {
        v1: {
          entries: ["web", "mobile"],
          capacity: 32,
          ko: { web: "웹", mobile: "모바일" },
        },
      },
    },

    // ── 도메인 모델 축 (demo-domains 통합) ──────────────────────────────────
    // NOTE: rbac_role ≠ role (쇼핑 플랫폼). compat에서 AXIS.role로 매핑.
    rbac_role: {
      id: "rbac_role", name: "역할",
      versions: {
        v1: {
          entries: ["admin", "editor", "viewer"],
          capacity: 32,
          ko: { admin: "관리자", editor: "편집자", viewer: "조회자" },
        },
      },
    },
    action: {
      id: "action", name: "액션",
      versions: {
        v1: {
          entries: ["read", "write", "delete", "admin"],
          capacity: 32,
          ko: { read: "읽기", write: "쓰기", delete: "삭제", admin: "관리" },
        },
      },
    },
    resource: {
      id: "resource", name: "리소스",
      versions: {
        v1: {
          entries: ["dashboard", "reports", "settings", "users"],
          capacity: 32,
          ko: { dashboard: "대시보드", reports: "리포트", settings: "설정", users: "사용자" },
        },
      },
    },
    tag: {
      id: "tag", name: "태그",
      versions: {
        v1: {
          entries: ["frontend", "backend", "devops", "ai", "database"],
          capacity: 32,
          ko: { frontend: "프론트엔드", backend: "백엔드", devops: "데브옵스", ai: "AI", database: "데이터베이스" },
        },
      },
    },
    category: {
      id: "category", name: "카테고리",
      versions: {
        v1: {
          entries: ["tech", "design", "product", "culture"],
          capacity: 32,
          ko: { tech: "기술", design: "디자인", product: "제품", culture: "문화" },
        },
      },
    },
    status: {
      id: "status", name: "상태",
      versions: {
        v1: {
          entries: ["draft", "published", "archived"],
          capacity: 32,
          ko: { draft: "초안", published: "발행", archived: "보관" },
        },
      },
    },
    locale: {
      id: "locale", name: "로케일",
      versions: {
        v1: {
          entries: ["ko", "en", "ja"],
          capacity: 32,
          ko: { ko: "한국어", en: "영어", ja: "일본어" },
        },
      },
    },
    channel: {
      id: "channel", name: "채널",
      versions: {
        v1: {
          entries: ["web", "mobile"],
          capacity: 32,
          ko: { web: "웹", mobile: "모바일" },
        },
      },
    },
    trackAction: {
      id: "trackAction", name: "행동",
      versions: {
        v1: {
          entries: ["click", "view", "scroll", "submit"],
          capacity: 32,
          ko: { click: "클릭", view: "조회", scroll: "스크롤", submit: "제출" },
        },
        v2: {
          entries: ["click", "view", "scroll", "submit", "navigate", "add_to_cart", "purchase", "close"],
          capacity: 32,
          ko: { click: "클릭", view: "조회", scroll: "스크롤", submit: "제출", navigate: "이동", add_to_cart: "장바구니담기", purchase: "구매", close: "닫기" },
        },
      },
    },
    page: {
      id: "page", name: "페이지",
      versions: {
        v1: {
          entries: ["home", "product", "cart", "checkout"],
          capacity: 32,
          ko: { home: "홈", product: "상품", cart: "장바구니", checkout: "결제" },
        },
        v2: {
          entries: ["home", "product_list", "product_detail", "cart", "checkout", "order_complete", "mypage", "login"],
          capacity: 32,
          ko: { home: "홈", product_list: "상품목록", product_detail: "상품상세", cart: "장바구니", checkout: "결제", order_complete: "주문완료", mypage: "마이페이지", login: "로그인" },
        },
      },
    },
    userType: {
      id: "userType", name: "사용자 유형",
      versions: {
        v1: {
          entries: ["guest", "member", "premium"],
          capacity: 32,
          ko: { guest: "게스트", member: "회원", premium: "프리미엄" },
        },
      },
    },
    subjectKind: {
      id: "subjectKind", name: "주체 종류",
      versions: {
        v1: {
          entries: ["_", "user", "role", "group"],
          capacity: 32,
          ko: { _: "예약", user: "사용자", role: "역할", group: "그룹" },
        },
        v2: {
          entries: ["_", "user", "role", "group", "service", "engine"],
          capacity: 32,
          ko: { _: "예약", user: "사용자", role: "역할", group: "그룹", service: "서비스", engine: "엔진" },
        },
      },
    },
    predicate: {
      id: "predicate", name: "술어",
      versions: {
        v1: {
          entries: ["_", "has", "can_access", "belongs_to"],
          capacity: 32,
          ko: { _: "예약", has: "보유", can_access: "접근가능", belongs_to: "소속" },
        },
        v2: {
          entries: ["_", "has", "can_access", "belongs_to", "has_capability", "evaluated", "migrated_to"],
          capacity: 32,
          ko: { _: "예약", has: "보유", can_access: "접근가능", belongs_to: "소속", has_capability: "기능보유", evaluated: "평가함", migrated_to: "마이그레이션" },
        },
      },
    },
    objectKind: {
      id: "objectKind", name: "객체 종류",
      versions: {
        v1: {
          entries: ["_", "role", "permission", "group", "resource"],
          capacity: 32,
          ko: { _: "예약", role: "역할", permission: "권한", group: "그룹", resource: "리소스" },
        },
        v2: {
          entries: ["_", "role", "permission", "group", "resource", "queue", "metric_store", "constraint", "prefix_version"],
          capacity: 32,
          ko: { _: "예약", role: "역할", permission: "권한", group: "그룹", resource: "리소스", queue: "큐", metric_store: "메트릭저장소", constraint: "제약", prefix_version: "프리픽스버전" },
        },
      },
    },

    // ── 이벤트 action 축 (table_ref 증명용) ────────────────────────────────
    cart_action: {
      id: "cart_action", name: "장바구니 행위",
      versions: {
        v1: {
          entries: ["add", "remove", "checkout"],
          capacity: 32,
          ko: { add: "추가", remove: "제거", checkout: "결제" },
        },
      },
    },
    auth_action: {
      id: "auth_action", name: "인증 행위",
      versions: {
        v1: {
          entries: ["login", "logout", "token_refresh"],
          capacity: 32,
          ko: { login: "로그인", logout: "로그아웃", token_refresh: "토큰갱신" },
        },
      },
    },
    order_action: {
      id: "order_action", name: "주문 행위",
      versions: {
        v1: {
          entries: ["create", "cancel", "refund", "complete"],
          capacity: 32,
          ko: { create: "생성", cancel: "취소", refund: "환불", complete: "완료" },
        },
      },
    },

    // ── 파이프라인 관측 축 (OD-005: 처리 경로) ────────────────
    pipeline_phase: {
      id: "pipeline_phase", name: "파이프라인 단계",
      versions: {
        v1: {
          entries: ["ingest", "reconstruct", "verdict", "aggregate", "propagate"],
          capacity: 32,
          ko: { ingest: "수집", reconstruct: "재구성", verdict: "판정", aggregate: "집계", propagate: "전파" },
        },
      },
    },
    validation_mode: {
      id: "validation_mode", name: "검증 모드",
      versions: {
        v1: {
          entries: ["strict", "warn", "off"],
          capacity: 32,
          ko: { strict: "엄격", warn: "경고", off: "미검증" },
        },
      },
    },
    verdict_result: {
      id: "verdict_result", name: "판정 결과",
      versions: {
        v1: {
          entries: ["pass", "fail", "warn", "degraded", "unknown"],
          capacity: 32,
          ko: { pass: "통과", fail: "실패", warn: "경고", degraded: "성능저하", unknown: "미정" },
        },
      },
    },
    mask_mode: {
      id: "mask_mode", name: "마스킹 모드",
      versions: {
        v1: {
          entries: ["raw", "mask", "drop", "hash"],
          capacity: 32,
          ko: { raw: "원본", mask: "마스킹", drop: "제거", hash: "해시" },
        },
      },
    },
    temporal_strategy: {
      id: "temporal_strategy", name: "시간 전략",
      versions: {
        v1: {
          entries: ["span_local", "global"],
          capacity: 32,
          ko: { span_local: "스팬로컬", global: "글로벌" },
        },
      },
    },

    // ── 인프라 계측 축 (OD-004: 배포/헬스) ────────────────────
    deploy_action: {
      id: "deploy_action", name: "배포 행위",
      versions: {
        v1: {
          entries: ["deploy", "rollback", "scale_up", "scale_down", "restart", "canary_start", "canary_promote"],
          capacity: 32,
          ko: { deploy: "배포", rollback: "롤백", scale_up: "스케일업", scale_down: "스케일다운", restart: "재시작", canary_start: "카나리시작", canary_promote: "카나리승격" },
        },
        v2: {
          entries: ["deploy", "rollback", "scale_up", "scale_down", "restart", "canary_start", "canary_promote", "migrate"],
          capacity: 32,
          ko: { deploy: "배포", rollback: "롤백", scale_up: "스케일업", scale_down: "스케일다운", restart: "재시작", canary_start: "카나리시작", canary_promote: "카나리승격", migrate: "마이그레이션" },
        },
      },
    },
    constraint_op: {
      id: "constraint_op", name: "제약 연산자",
      versions: {
        v1: {
          entries: ["eq", "neq", "exists", "gt", "lt", "contains", "masked"],
          capacity: 32,
          ko: { eq: "같음", neq: "다름", exists: "존재", gt: "초과", lt: "미만", contains: "포함", masked: "마스킹됨" },
        },
      },
    },
    migration_pattern: {
      id: "migration_pattern", name: "마이그레이션 패턴",
      versions: {
        v1: {
          entries: ["identity", "reorder", "append_dim", "remove_dim", "composite", "unknown"],
          capacity: 32,
          ko: { identity: "동일", reorder: "재정렬", append_dim: "차원추가", remove_dim: "차원제거", composite: "복합", unknown: "미정" },
        },
      },
    },
    health_status: {
      id: "health_status", name: "헬스 상태",
      versions: {
        v1: {
          entries: ["healthy", "degraded", "unhealthy", "maintenance"],
          capacity: 32,
          ko: { healthy: "정상", degraded: "성능저하", unhealthy: "장애", maintenance: "점검" },
        },
      },
    },

    // ── 관측 포인트 축 (OD-002: endpoint) ──────────────────────
    resource_type: {
      id: "resource_type", name: "리소스 유형",
      versions: {
        v1: {
          entries: ["api", "page", "webhook", "grpc"],
          capacity: 32,
          ko: { api: "API", page: "페이지", webhook: "웹훅", grpc: "gRPC" },
        },
      },
    },
    http_method: {
      id: "http_method", name: "HTTP 메서드",
      versions: {
        v1: {
          entries: ["GET", "POST", "PUT", "DELETE", "PATCH"],
          capacity: 32,
          ko: { GET: "조회", POST: "생성", PUT: "수정", DELETE: "삭제", PATCH: "부분수정" },
        },
      },
    },
    api_version: {
      id: "api_version", name: "API 버전",
      versions: {
        v1: {
          entries: ["v1", "v2"],
          capacity: 32,
          ko: { v1: "v1", v2: "v2" },
        },
      },
    },

    // ── 관측 포인트 축 (OD-003: 흐름) ─────────────────────────
    flow_name: {
      id: "flow_name", name: "흐름명",
      versions: {
        v1: {
          entries: ["checkout", "signup", "order_cancel", "refund", "login"],
          capacity: 64,
          ko: { checkout: "결제", signup: "가입", order_cancel: "주문취소", refund: "환불", login: "로그인" },
        },
        v2: {
          entries: ["checkout", "signup", "order_cancel", "refund", "login", "browse", "cart_manage", "payment"],
          capacity: 64,
          ko: { checkout: "결제", signup: "가입", order_cancel: "주문취소", refund: "환불", login: "로그인", browse: "탐색", cart_manage: "장바구니관리", payment: "결제처리" },
        },
      },
    },
    flow_step: {
      id: "flow_step", name: "흐름 단계",
      versions: {
        v1: {
          entries: ["entry", "processing", "branch", "success", "failure", "timeout"],
          capacity: 32,
          ko: { entry: "진입", processing: "처리중", branch: "분기", success: "성공", failure: "실패", timeout: "타임아웃" },
        },
        v2: {
          entries: ["entry", "processing", "branch", "success", "failure", "timeout", "payment", "complete", "exit"],
          capacity: 32,
          ko: { entry: "진입", processing: "처리중", branch: "분기", success: "성공", failure: "실패", timeout: "타임아웃", payment: "결제진행", complete: "완료", exit: "이탈" },
        },
      },
    },
    flow_variant: {
      id: "flow_variant", name: "흐름 변형",
      versions: {
        v1: {
          entries: ["default", "retry", "fallback", "manual"],
          capacity: 32,
          ko: { default: "기본", retry: "재시도", fallback: "대체", manual: "수동" },
        },
      },
    },
  },

  prefixes: {
    service: {
      id: "service", name: "서비스",
      description: "env × region × svc_name × namespace 4차원 서비스 주소 공간",
      labels: ["env", "region", "svc_name", "namespace"],
      dims: {
        env: { kind: "axis", axisId: "env" },
        region: { kind: "axis", axisId: "region" },
        svc_name: { kind: "axis", axisId: "svc_name" },
        namespace: { kind: "axis", axisId: "namespace" },
      },
      versions: [
        { version: "v1", axisVersions: { env: "v1", region: "v1", svc_name: "v1", namespace: "v1" } },
      ],
    },
    permission: {
      id: "permission", name: "권한",
      description: "perm_svc(서비스 참조) × role 2차원 권한 주소 공간",
      labels: ["perm_svc", "role"],
      dims: {
        perm_svc: { kind: "prefix_ref", prefixId: "service" },
        role: { kind: "axis", axisId: "role" },
      },
      versions: [
        { version: "v1", axisVersions: { role: "v1" }, refEntries: { perm_svc: { values: _PERM_SVC, refVersion: "v1" } } },
        { version: "v2", axisVersions: { role: "v2" }, refEntries: { perm_svc: { values: _PERM_SVC, refVersion: "v1" } } },
        { version: "v3", axisVersions: { role: "v3" }, refEntries: { perm_svc: { values: _PERM_SVC, refVersion: "v1" } } },
        { version: "v4", axisVersions: { role: "v4" }, refEntries: { perm_svc: { values: _PERM_SVC, refVersion: "v1" } } },
      ],
    },
    event: {
      id: "event", name: "이벤트",
      description: "evt_svc(서비스 참조) × event_name × initiator 3차원 이벤트 주소 공간",
      labels: ["evt_svc", "event_name", "initiator"],
      dims: {
        evt_svc: { kind: "prefix_ref", prefixId: "service" },
        event_name: { kind: "axis", axisId: "event_name" },
        initiator: { kind: "axis", axisId: "initiator" },
      },
      versions: [
        { version: "v1", axisVersions: { event_name: "v1", initiator: "v1" }, refEntries: { evt_svc: { values: _EVT_SVC, refVersion: "v1" } } },
        { version: "v2", axisVersions: { event_name: "v2", initiator: "v1" }, refEntries: { evt_svc: { values: _EVT_SVC, refVersion: "v1" } } },
        { version: "v3", axisVersions: { event_name: "v3", initiator: "v1" }, refEntries: { evt_svc: { values: _EVT_SVC, refVersion: "v1" } } },
        { version: "v4", axisVersions: { event_name: "v4", initiator: "v1" }, refEntries: { evt_svc: { values: _EVT_SVC, refVersion: "v1" } } },
      ],
    },
    rbac: {
      id: "rbac", name: "역할 기반 접근 제어",
      description: "role × action × resource 3차원 권한 모델",
      labels: ["role", "action", "resource"],
      dims: {
        role: { kind: "axis", axisId: "rbac_role" },
        action: { kind: "axis", axisId: "action" },
        resource: { kind: "axis", axisId: "resource" },
      },
      versions: [
        { version: "v1", axisVersions: { role: "v1", action: "v1", resource: "v1" } },
      ],
    },
    content: {
      id: "content", name: "콘텐츠 플랫폼",
      description: "tag × category × status × locale × channel 5차원 콘텐츠 모델",
      labels: ["tag", "category", "status", "locale", "channel"],
      dims: {
        tag: { kind: "axis", axisId: "tag" },
        category: { kind: "axis", axisId: "category" },
        status: { kind: "axis", axisId: "status" },
        locale: { kind: "axis", axisId: "locale" },
        channel: { kind: "axis", axisId: "channel" },
      },
      versions: [
        { version: "v1", axisVersions: { tag: "v1", category: "v1", status: "v1", locale: "v1", channel: "v1" } },
      ],
    },
    tracking: {
      id: "tracking", name: "사용자 행동 추적",
      description: "trackAction × page × userType 3차원 이벤트 추적",
      labels: ["trackAction", "page", "userType"],
      dims: {
        trackAction: { kind: "axis", axisId: "trackAction" },
        page: { kind: "axis", axisId: "page" },
        userType: { kind: "axis", axisId: "userType" },
      },
      versions: [
        { version: "v1", axisVersions: { trackAction: "v1", page: "v1", userType: "v1" } },
        { version: "v2", axisVersions: { trackAction: "v2", page: "v2", userType: "v1" } },
      ],
    },
    relational: {
      id: "relational", name: "관계 모델",
      description: "subjectKind × predicate × objectKind 관계 인덱스",
      labels: ["subjectKind", "predicate", "objectKind"],
      dims: {
        subjectKind: { kind: "axis", axisId: "subjectKind" },
        predicate: { kind: "axis", axisId: "predicate" },
        objectKind: { kind: "axis", axisId: "objectKind" },
      },
      versions: [
        { version: "v1", axisVersions: { subjectKind: "v1", predicate: "v1", objectKind: "v1" } },
        { version: "v2", axisVersions: { subjectKind: "v2", predicate: "v2", objectKind: "v2" } },
      ],
    },

    // ── 관측 포인트 prefix ──────────────────────────────────────────────
    page_view: {
      id: "page_view", name: "화면 관측",
      description: "svc_ref(서비스 참조) × page × locale × userType — 어떤 서비스에서 어떤 화면을 어떤 언어로 누가 보는가",
      labels: ["svc_ref", "page", "locale", "userType"],
      dims: {
        svc_ref: { kind: "prefix_ref", prefixId: "service" },
        page: { kind: "axis", axisId: "page" },
        locale: { kind: "axis", axisId: "locale" },
        userType: { kind: "axis", axisId: "userType" },
      },
      versions: [
        { version: "v1", axisVersions: { page: "v1", locale: "v1", userType: "v1" }, refEntries: { svc_ref: { values: _PERM_SVC, refVersion: "v1" } } },
        { version: "v2", axisVersions: { page: "v2", locale: "v1", userType: "v1" }, refEntries: { svc_ref: { values: _PERM_SVC, refVersion: "v1" } } },
      ],
    },
    endpoint: {
      id: "endpoint", name: "엔드포인트 관측",
      description: "svc_ref(서비스 참조) × resource_type × http_method × api_version — 서비스의 어떤 유형 엔드포인트에 어떻게 접근하는가. API 경로는 좌표 밖(payload.resource_path).",
      labels: ["svc_ref", "resource_type", "http_method", "api_version"],
      dims: {
        svc_ref: { kind: "prefix_ref", prefixId: "service" },
        resource_type: { kind: "axis", axisId: "resource_type" },
        http_method: { kind: "axis", axisId: "http_method" },
        api_version: { kind: "axis", axisId: "api_version" },
      },
      versions: [
        { version: "v1", axisVersions: { resource_type: "v1", http_method: "v1", api_version: "v1" }, refEntries: { svc_ref: { values: _PERM_SVC, refVersion: "v1" } } },
      ],
    },
    flow_point: {
      id: "flow_point", name: "흐름 관측 포인트",
      description: "svc_ref(서비스 참조) × flow_name × flow_step × flow_variant — 어떤 서비스에서 비즈니스 흐름의 어디에 있는가",
      labels: ["svc_ref", "flow_name", "flow_step", "flow_variant"],
      dims: {
        svc_ref: { kind: "prefix_ref", prefixId: "service" },
        flow_name: { kind: "axis", axisId: "flow_name" },
        flow_step: { kind: "axis", axisId: "flow_step" },
        flow_variant: { kind: "axis", axisId: "flow_variant" },
      },
      versions: [
        { version: "v1", axisVersions: { flow_name: "v1", flow_step: "v1", flow_variant: "v1" }, refEntries: { svc_ref: { values: _PERM_SVC, refVersion: "v1" } } },
        { version: "v2", axisVersions: { flow_name: "v2", flow_step: "v2", flow_variant: "v1" }, refEntries: { svc_ref: { values: _PERM_SVC, refVersion: "v1" } } },
      ],
    },

    // ── 엔진/스키마 이벤트 prefix ──────────────────────────────────────
    engine_event: {
      id: "engine_event", name: "엔진 평가 이벤트",
      description: "svc_ref(서비스 참조) × constraint_op × verdict_result — 엔진이 어떤 연산자로 평가하여 어떤 결과를 냈는가",
      labels: ["svc_ref", "constraint_op", "verdict_result"],
      dims: {
        svc_ref: { kind: "prefix_ref", prefixId: "service" },
        constraint_op: { kind: "axis", axisId: "constraint_op" },
        verdict_result: { kind: "axis", axisId: "verdict_result" },
      },
      versions: [
        { version: "v1", axisVersions: { constraint_op: "v1", verdict_result: "v1" }, refEntries: { svc_ref: { values: _PERM_SVC, refVersion: "v1" } } },
      ],
    },
    schema_event: {
      id: "schema_event", name: "스키마 마이그레이션 이벤트",
      description: "svc_ref(서비스 참조) × migration_pattern × deploy_action — 어떤 패턴으로 어떤 배포 행위가 스키마에 적용됐는가",
      labels: ["svc_ref", "migration_pattern", "deploy_action"],
      dims: {
        svc_ref: { kind: "prefix_ref", prefixId: "service" },
        migration_pattern: { kind: "axis", axisId: "migration_pattern" },
        deploy_action: { kind: "axis", axisId: "deploy_action" },
      },
      versions: [
        { version: "v1", axisVersions: { migration_pattern: "v1", deploy_action: "v2" }, refEntries: { svc_ref: { values: _INFRA_SVC, refVersion: "v1" } } },
      ],
    },

    // ── 파이프라인 관측 prefix ──────────────────────────────────────────
    pipeline_point: {
      id: "pipeline_point", name: "파이프라인 관측 포인트",
      description: "svc_ref(서비스 참조) × pipeline_phase × validation_mode × verdict_result × temporal_strategy — 수집 파이프라인의 어떤 단계에서 어떤 모드로 어떤 결과가 나왔는가",
      labels: ["svc_ref", "pipeline_phase", "validation_mode", "verdict_result", "temporal_strategy"],
      dims: {
        svc_ref: { kind: "prefix_ref", prefixId: "service" },
        pipeline_phase: { kind: "axis", axisId: "pipeline_phase" },
        validation_mode: { kind: "axis", axisId: "validation_mode" },
        verdict_result: { kind: "axis", axisId: "verdict_result" },
        temporal_strategy: { kind: "axis", axisId: "temporal_strategy" },
      },
      versions: [
        { version: "v1", axisVersions: { pipeline_phase: "v1", validation_mode: "v1", verdict_result: "v1", temporal_strategy: "v1" }, refEntries: { svc_ref: { values: _PERM_SVC, refVersion: "v1" } } },
      ],
    },
    data_policy: {
      id: "data_policy", name: "데이터 정책 관측",
      description: "svc_ref(서비스 참조) × mask_mode — 어떤 서비스에서 어떤 마스킹 정책이 적용되는가",
      labels: ["svc_ref", "mask_mode"],
      dims: {
        svc_ref: { kind: "prefix_ref", prefixId: "service" },
        mask_mode: { kind: "axis", axisId: "mask_mode" },
      },
      versions: [
        { version: "v1", axisVersions: { mask_mode: "v1" }, refEntries: { svc_ref: { values: _PERM_SVC, refVersion: "v1" } } },
      ],
    },

    // ── 인프라 이벤트 prefix ────────────────────────────────────────────
    deploy_event: {
      id: "deploy_event", name: "배포 이벤트",
      description: "svc_ref(서비스 참조) × deploy_action × actor(배포자) — 어떤 서비스에 누가 어떤 배포 행위를 했는가",
      labels: ["svc_ref", "deploy_action", "actor"],
      dims: {
        svc_ref:       { kind: "prefix_ref", prefixId: "service" },
        deploy_action: { kind: "axis", axisId: "deploy_action" },
        actor:         { kind: "table_ref", table: "members" },
      },
      versions: [
        { version: "v1", axisVersions: { deploy_action: "v1" }, refEntries: { svc_ref: { values: _INFRA_SVC, refVersion: "v1" } } },
      ],
    },
    health_event: {
      id: "health_event", name: "헬스 이벤트",
      description: "svc_ref(서비스 참조) × health_status — 어떤 서비스가 어떤 상태가 되었는가",
      labels: ["svc_ref", "health_status"],
      dims: {
        svc_ref:       { kind: "prefix_ref", prefixId: "service" },
        health_status: { kind: "axis", axisId: "health_status" },
      },
      versions: [
        { version: "v1", axisVersions: { health_status: "v1" }, refEntries: { svc_ref: { values: _INFRA_SVC, refVersion: "v1" } } },
      ],
    },

    // ── 이벤트 prefix (table_ref 포함) ──────────────────────────────────
    cart_event: {
      id: "cart_event", name: "장바구니 이벤트",
      description: "actor(member) × action × target(item) — 이벤트 관계 정의",
      labels: ["actor", "action", "target"],
      dims: {
        actor:  { kind: "table_ref", table: "members" },
        action: { kind: "axis", axisId: "cart_action" },
        target: { kind: "table_ref", table: "items" },
      },
      versions: [
        { version: "v1", axisVersions: { action: "v1" } },
      ],
    },
    auth_event: {
      id: "auth_event", name: "인증 이벤트",
      description: "actor(member) × action — 단항 이벤트",
      labels: ["actor", "action"],
      dims: {
        actor:  { kind: "table_ref", table: "members" },
        action: { kind: "axis", axisId: "auth_action" },
      },
      versions: [
        { version: "v1", axisVersions: { action: "v1" } },
      ],
    },
    order_event: {
      id: "order_event", name: "주문 이벤트",
      description: "actor(member) × action × order(table) × service_ctx(prefix_ref) — 다항 + 컨텍스트",
      labels: ["service_ctx", "actor", "action", "order"],
      dims: {
        service_ctx: { kind: "prefix_ref", prefixId: "service" },
        actor:       { kind: "table_ref", table: "members" },
        action:      { kind: "axis", axisId: "order_action" },
        order:       { kind: "table_ref", table: "orders" },
      },
      versions: [
        { version: "v1", axisVersions: { action: "v1" }, refEntries: { service_ctx: { values: _ORDER_SVC, refVersion: "v1" } } },
      ],
    },
  },

  // ══════════════════════════════════════════════════════════════════════════
  //  테이블 스키마 — 좌표 세계 ↔ 관계형 세계 양방향 연결
  // ══════════════════════════════════════════════════════════════════════════
  tables: {
    members: {
      table: "members",
      columns: {
        id:       { kind: "scalar", type: "integer" },
        name:     { kind: "scalar", type: "string" },
        role:     { kind: "axis_ref", axisId: "role" },
        org_id:   { kind: "table_ref", table: "orgs" },
      },
    },
    orgs: {
      table: "orgs",
      columns: {
        id:          { kind: "scalar", type: "integer" },
        name:        { kind: "scalar", type: "string" },
        region_addr: { kind: "prefix_ref", prefixId: "service" },
      },
    },
    items: {
      table: "items",
      columns: {
        id:             { kind: "scalar", type: "integer" },
        name:           { kind: "scalar", type: "string" },
        category:       { kind: "axis_ref", axisId: "category" },
        warehouse_addr: { kind: "prefix_ref", prefixId: "service" },
      },
    },
    orders: {
      table: "orders",
      columns: {
        id:           { kind: "scalar", type: "integer" },
        member_id:    { kind: "table_ref", table: "members" },
        service_addr: { kind: "prefix_ref", prefixId: "service" },
        status:       { kind: "axis_ref", axisId: "order_action" },
        amount:       { kind: "scalar", type: "number" },
      },
    },
    carts: {
      table: "carts",
      columns: {
        id:        { kind: "scalar", type: "integer" },
        member_id: { kind: "table_ref", table: "members" },
      },
    },
    cart_items: {
      table: "cart_items",
      columns: {
        cart_id: { kind: "table_ref", table: "carts" },
        item_id: { kind: "table_ref", table: "items" },
        qty:     { kind: "scalar", type: "integer" },
      },
    },
  },
} as const satisfies DemoCatalog;
