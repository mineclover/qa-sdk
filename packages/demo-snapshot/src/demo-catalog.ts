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

/** prefix 자기 기술 메타데이터 */
export interface PrefixMeta {
  readonly category?: "entity" | "event" | "relation" | "state" | "policy" | "observation";
  readonly layer?: 0 | 1 | 2 | 3;
  readonly visualShape?: "cube" | "thin-bar" | "flat-tile" | "column" | "sphere";
  readonly heightRatio?: number;
  readonly detailKind?: "schema" | "permission" | "event-def" | "endpoint" | "flow-step" | "config" | "metric" | "generic";
  readonly source?: { readonly module?: string; readonly file?: string };
}

export interface PrefixDef {
  readonly id: string;
  readonly name: string;
  readonly description?: string;
  readonly labels: readonly string[];
  readonly dims: Record<string, DimRef>;
  readonly versions: readonly PrefixVersionDef[];
  readonly meta?: PrefixMeta;
  /** 주소 모델 (미선언 시 "product" 기본값) */
  readonly addressModel?: "product" | "sum";
}

// ── Layer 2.5: 테이블 스키마 (좌표 ↔ 관계형 양방향 연결) ─────────────────────

export type ColumnRef =
  | { readonly kind: "scalar"; readonly type: string }
  | { readonly kind: "prefix_ref"; readonly prefixId: string }
  | { readonly kind: "table_ref"; readonly table: string }
  | { readonly kind: "axis_ref"; readonly axisId: string };

export interface TableRefSource {
  readonly prefixId: string;
  readonly dimLabel: string;
}

export interface TableSchema {
  readonly table: string;
  readonly columns: Record<string, ColumnRef>;
  readonly referencedBy?: readonly TableRefSource[];
}

// ── Layer 3: 카탈로그 ────────────────────────────────────────────────────────

export interface DemoCatalog {
  readonly id: string;
  readonly name: string;
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
  svc_name:  { entries: ["shopping-web", "shopping-backend", "auth", "payment", "gateway", "registry-service", "ingest-server", "platform-demo", "content-service", "infra-controller", "gate-service", "query-service", "decode-service", "platform-demo-api", "roleplay-web", "viteplus-sdk-smoke"] as const, capacity: 32 },
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
  id: "demo",
  name: "쇼핑 데모",
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
          ko: { "shopping-web": "쇼핑웹", "shopping-backend": "쇼핑BE", auth: "인증", payment: "결제", gateway: "GW", "registry-service": "레지스트리", "ingest-server": "수집서버", "platform-demo": "데모", "content-service": "콘텐츠", "infra-controller": "인프라", "gate-service": "게이트", "query-service": "질의", "decode-service": "디코드", "platform-demo-api": "데모API", "roleplay-web": "롤플레이웹", "viteplus-sdk-smoke": "Vite+스모크" },
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
          entries: ["pass", "fail", "warn", "degraded", "unknown", "skipped"],
          capacity: 32,
          ko: { pass: "통과", fail: "실패", warn: "경고", degraded: "성능저하", unknown: "미정", skipped: "건너뜀" },
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
    validation_layer: {
      id: "validation_layer", name: "검증 레이어",
      versions: {
        v1: {
          entries: ["vocabulary", "structural", "constraint"],
          capacity: 8,
          ko: { vocabulary: "L0 어휘", structural: "L1 구조", constraint: "L2 제약" },
        },
      },
    },
    constraint_rule: {
      id: "constraint_rule", name: "제약 규칙 종류",
      versions: {
        v1: {
          entries: ["required", "maxCount", "minCount", "requiredIf", "exclusive", "type", "multi", "unknownAxis"],
          capacity: 32,
          ko: { required: "필수", maxCount: "최대개수", minCount: "최소개수", requiredIf: "조건부필수", exclusive: "배타", type: "타입", multi: "복수값", unknownAxis: "미정의축" },
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

    // ── 이벤트 패턴 분류 축 (ADR-006) ─────────────────────────
    identification_mode: {
      id: "identification_mode", name: "식별 모드",
      versions: {
        v1: {
          entries: ["anonymous", "identified", "pseudonymized", "service"],
          capacity: 8,
          ko: { anonymous: "비식별", identified: "식별", pseudonymized: "가명", service: "서비스" },
        },
      },
    },
    behavior_pattern: {
      id: "behavior_pattern", name: "행동 패턴",
      versions: {
        v1: {
          entries: [
            "purchase_complete", "browse_only", "cart_abandon", "checkout_fail",
            "error_recovery", "return_visit", "anonymous_browse", "anonymous_cart",
            "api_integration", "bot_crawl", "health_check", "unclassified",
          ],
          capacity: 32,
          ko: { purchase_complete: "구매완료", browse_only: "탐색만", cart_abandon: "장바구니포기", checkout_fail: "결제실패", error_recovery: "에러복구", return_visit: "재방문", anonymous_browse: "비회원탐색", anonymous_cart: "비회원장바구니", api_integration: "API연동", bot_crawl: "봇크롤링", health_check: "헬스체크", unclassified: "미분류" },
        },
      },
    },
    pattern_confidence: {
      id: "pattern_confidence", name: "패턴 신뢰도",
      versions: {
        v1: {
          entries: ["exact", "high", "medium", "low", "unknown"],
          capacity: 16,
          ko: { exact: "확정", high: "높음", medium: "보통", low: "낮음", unknown: "미정" },
        },
      },
    },
    anomaly_kind: {
      id: "anomaly_kind", name: "이상 유형",
      versions: {
        v1: {
          entries: ["unclassified", "ratio_shift", "volume_spike", "new_sequence", "abnormal_speed", "abnormal_duration"],
          capacity: 16,
          ko: { unclassified: "미분류", ratio_shift: "비율급변", volume_spike: "볼륨급증", new_sequence: "신규시퀀스", abnormal_speed: "비정상속도", abnormal_duration: "비정상시간" },
        },
      },
    },
    anomaly_severity: {
      id: "anomaly_severity", name: "이상 심각도",
      versions: {
        v1: {
          entries: ["info", "warning", "critical"],
          capacity: 8,
          ko: { info: "정보", warning: "경고", critical: "심각" },
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

    // ── 자기참조 축 (qa-sdk 자체 모니터링) ──────────────────────
    qa_pkg: {
      id: "qa_pkg", name: "패키지",
      versions: {
        v1: {
          entries: [
            "spec-core", "cli", "sdk", "demo-snapshot", "weighted-index",
            "bit-index", "permission-engine", "index-meta", "platform-demo",
            "ingest-server", "registry-service", "e2e",
          ],
          capacity: 32,
          ko: { "spec-core": "스펙코어", cli: "CLI", sdk: "SDK", "demo-snapshot": "데모카탈로그", "weighted-index": "가중인덱스", "bit-index": "비트인덱스", "permission-engine": "권한엔진", "index-meta": "인덱스메타", "platform-demo": "플랫폼데모", "ingest-server": "수집서버", "registry-service": "레지스트리", e2e: "E2E테스트" },
        },
        v2: {
          entries: [
            "spec-core", "cli", "sdk", "demo-snapshot", "weighted-index",
            "bit-index", "permission-engine", "index-meta", "platform-demo",
            "ingest-server", "registry-service", "e2e",
            "core", "engine", "store",
            "gate-service", "query-service", "decode-service",
            "registry-server", "registry-client",
            "apm", "browser-sdk", "event-catalog", "pino",
            "viz-3d", "viz-web", "demo-tests", "weighted-wasm",
          ],
          capacity: 64,
          ko: { "spec-core": "스펙코어", cli: "CLI", sdk: "SDK", "demo-snapshot": "데모카탈로그", "weighted-index": "가중인덱스", "bit-index": "비트인덱스", "permission-engine": "권한엔진", "index-meta": "인덱스메타", "platform-demo": "플랫폼데모", "ingest-server": "수집서버", "registry-service": "레지스트리", e2e: "E2E테스트", core: "코어", engine: "엔진", store: "스토어", "gate-service": "게이트서비스", "query-service": "쿼리서비스", "decode-service": "디코드서비스", "registry-server": "레지스트리서버", "registry-client": "레지스트리클라이언트", apm: "APM", "browser-sdk": "브라우저SDK", "event-catalog": "이벤트카탈로그", pino: "로거", "viz-3d": "3D시각화", "viz-web": "웹시각화", "demo-tests": "데모테스트", "weighted-wasm": "WASM" },
        },
      },
    },
    qa_module: {
      id: "qa_module", name: "모듈",
      versions: {
        v1: {
          entries: [
            "shared", "schema", "export-surface", "spec", "loader", "codegen",
            "dkg", "dkg-skills", "convergence", "propagation", "store", "visualization",
          ],
          capacity: 32,
          ko: { shared: "공유", schema: "스키마", "export-surface": "내보내기", spec: "스펙", loader: "로더", codegen: "코드생성", dkg: "설계그래프", "dkg-skills": "DKG스킬", convergence: "수렴분석", propagation: "전파", store: "저장소", visualization: "시각화" },
        },
        v2: {
          entries: [
            // 코어 모듈
            "shared", "schema", "export-surface", "spec", "loader", "codegen",
            "dkg", "dkg-skills", "convergence", "propagation", "store", "visualization",
            // E2E 시나리오
            "shopping-flow", "event-pipeline", "iframe-integration", "scenario-selector", "shop-ingest-integration",
            "anonymous-browse", "cart-abandon", "multi-product-purchase",
            // 패키지 전체 (모듈 미구분 시)
            "_all",
          ],
          capacity: 64,
          ko: { shared: "공유", schema: "스키마", "export-surface": "내보내기", spec: "스펙", loader: "로더", codegen: "코드생성", dkg: "설계그래프", "dkg-skills": "DKG스킬", convergence: "수렴분석", propagation: "전파", store: "저장소", visualization: "시각화", "shopping-flow": "쇼핑흐름", "event-pipeline": "이벤트파이프라인", "iframe-integration": "iframe통합", "scenario-selector": "시나리오선택", "shop-ingest-integration": "쇼핑수집통합", "anonymous-browse": "익명탐색", "cart-abandon": "장바구니이탈", "multi-product-purchase": "다중상품구매", "_all": "전체" },
        },
      },
    },
    build_result: {
      id: "build_result", name: "빌드결과",
      versions: {
        v1: {
          entries: ["success", "failure", "type-error", "skipped"],
          capacity: 8,
          ko: { success: "성공", failure: "실패", "type-error": "타입오류", skipped: "건너뜀" },
        },
      },
    },
    test_result: {
      id: "test_result", name: "테스트결과",
      versions: {
        v1: {
          entries: ["passed", "failed", "error", "skipped", "timeout"],
          capacity: 16,
          ko: { passed: "통과", failed: "실패", error: "오류", skipped: "건너뜀", timeout: "시간초과" },
        },
      },
    },
    dkg_op: {
      id: "dkg_op", name: "DKG 운영",
      versions: {
        v1: {
          entries: [
            "claim", "release", "decide", "observe", "resolve", "link",
            "refresh", "self-check", "converge", "trace", "promote",
          ],
          capacity: 32,
          ko: { claim: "선점", release: "해제", decide: "결정", observe: "관측", resolve: "해소", link: "연결", refresh: "재부트", "self-check": "자기진단", converge: "수렴", trace: "추적", promote: "승격" },
        },
      },
    },
    dkg_target_kind: {
      id: "dkg_target_kind", name: "DKG 대상 종류",
      versions: {
        v1: {
          entries: [
            "axis", "prefix", "spec", "schema", "decision",
            "version-event", "constraint", "observation", "domain", "consumer",
            "intent-link", "dsl-bundle", "skill", "transition-spec", "table",
            "flow-schema", "system",
          ],
          capacity: 32,
          ko: {
            axis: "축",
            prefix: "프리픽스",
            spec: "스펙",
            schema: "스키마",
            decision: "결정",
            "version-event": "버전이벤트",
            constraint: "제약",
            observation: "관측",
            domain: "도메인",
            consumer: "소비자",
            "intent-link": "의도링크",
            "dsl-bundle": "DSL번들",
            skill: "스킬",
            "transition-spec": "전이스펙",
            table: "테이블",
            "flow-schema": "플로우스키마",
            system: "시스템",
          },
        },
      },
    },
    api_surface: {
      id: "api_surface", name: "인터페이스 영역",
      versions: {
        v1: {
          entries: [
            "encode-decode",
            "stride-calc",
            "bitmask-ops",
            "dim-extract",
            "perm-grant",
            "protocol-codec",
            "state-lifecycle",
            "query-resolve",
            "schema-validate",
            "convergence-analysis",
            "dkg-graph",
            "integration",
          ],
          capacity: 32,
          ko: { "encode-decode": "인코딩/디코딩", "stride-calc": "스트라이드계산", "bitmask-ops": "비트연산", "dim-extract": "차원추출", "perm-grant": "권한부여", "protocol-codec": "프로토콜변환", "state-lifecycle": "상태관리", "query-resolve": "조회/해석", "schema-validate": "스키마검증", "convergence-analysis": "수렴분석", "dkg-graph": "그래프연산", integration: "통합테스트" },
        },
      },
    },

    // ── CLI 완전 관측 축 ──────────────────────────────────
    cli_intent: {
      id: "cli_intent", name: "CLI 의도",
      versions: {
        v1: {
          entries: ["query", "analyze", "mutate", "publish", "lifecycle", "init", "backup"],
          capacity: 16,
          ko: { query: "조회", analyze: "분석", mutate: "변경", publish: "발행", lifecycle: "생명주기", init: "초기화", backup: "백업" },
        },
      },
    },
    cli_domain: {
      id: "cli_domain", name: "CLI 도메인",
      versions: {
        v1: {
          entries: ["dkg-graph", "dkg-skill", "convergence", "spec", "coordinate", "registry", "catalog", "self-ref", "system", "ingest"],
          capacity: 16,
          ko: { "dkg-graph": "그래프", "dkg-skill": "스킬", convergence: "수렴분석", spec: "스펙", coordinate: "좌표", registry: "레지스트리", catalog: "카탈로그", "self-ref": "자기참조", system: "시스템", ingest: "수집" },
        },
      },
    },
    cli_subject: {
      id: "cli_subject", name: "CLI 대상",
      versions: {
        v1: {
          entries: [
            "axis", "prefix", "domain", "dsl-bundle", "decision", "observation",
            "constraint", "skill", "intent-link", "system", "version", "spec", "schema", "catalog",
            "service", "table",
          ],
          capacity: 32,
          ko: { axis: "축", prefix: "프리픽스", domain: "도메인", "dsl-bundle": "DSL번들", decision: "결정", observation: "관측", constraint: "제약", skill: "스킬", "intent-link": "의도링크", system: "시스템", version: "버전", spec: "스펙", schema: "스키마", catalog: "카탈로그", service: "서비스", table: "테이블" },
        },
      },
    },

    // ── 좌표 승격 축 (dkg promote scan으로 발견) ────────────
    obs_source: {
      id: "obs_source", name: "관측 원천",
      versions: {
        v1: {
          entries: ["manual", "metric", "runtime", "review"],
          capacity: 8,
          ko: { manual: "수동", metric: "자동측정", runtime: "런타임", review: "리뷰" },
        },
      },
    },
    node_source: {
      id: "node_source", name: "노드 원천",
      versions: {
        v1: {
          entries: ["bootstrap", "manual", "auto"],
          capacity: 8,
          ko: { bootstrap: "부트스트랩", manual: "수동", auto: "자동" },
        },
      },
    },
    spec_type: {
      id: "spec_type", name: "스펙 유형",
      versions: {
        v1: {
          entries: ["req", "feat", "uc", "evt", "ls", "adr"],
          capacity: 16,
          ko: { req: "요구사항", feat: "기능", uc: "유스케이스", evt: "이벤트", ls: "리빙스펙", adr: "결정기록" },
        },
      },
    },
    lifecycle_state: {
      id: "lifecycle_state", name: "생명주기 상태",
      versions: {
        v1: {
          entries: ["draft", "active", "deprecated", "archived", "superseded", "reversed"],
          capacity: 16,
          ko: { draft: "초안", active: "활성", deprecated: "폐기예정", archived: "보관", superseded: "대체됨", reversed: "번복" },
        },
      },
    },
    edge_type: {
      id: "edge_type", name: "관계 유형",
      versions: {
        v1: {
          entries: [
            "satisfies", "implements", "tests", "traces-to", "depends-on",
            "composes", "references", "governs", "justifies", "constrains",
            "contains", "bridges", "consumes", "binds",
            "observes", "prompts", "evolves-from", "supersedes",
          ],
          capacity: 32,
          ko: { satisfies: "충족", implements: "구현", tests: "검증", "traces-to": "추적", "depends-on": "의존", composes: "구성", references: "참조", governs: "관장", justifies: "근거", constrains: "제약", contains: "포함", bridges: "연결", consumes: "소비", binds: "바인딩", observes: "관측", prompts: "촉발", "evolves-from": "진화원본", supersedes: "대체" },
        },
      },
    },
    decision_type: {
      id: "decision_type", name: "의사결정 유형",
      versions: {
        v1: {
          entries: ["capacity", "new-axis", "new-prefix", "dim-add", "merge", "deprecate", "separation"],
          capacity: 16,
          ko: { capacity: "용량확장", "new-axis": "새축", "new-prefix": "새프리픽스", "dim-add": "차원추가", merge: "병합", deprecate: "폐기", separation: "분리유지" },
        },
      },
    },

    // ── Skill 관리 축 ────────────────────────────────────────────────
    skill_id: {
      id: "skill_id", name: "스킬 ID",
      versions: {
        v1: {
          entries: [
            "skill-trace", "skill-explore-service", "skill-explore-prefix", "skill-explore-dsl", "skill-system-overview",
            "skill-record-decision", "skill-record-observation", "skill-claim", "skill-release", "skill-lifecycle-transition",
            "skill-checkout-flow-verify", "skill-commerce-skew-audit", "skill-observation-coverage", "skill-infra-impact-verify",
            "skill-pipeline-phase-verify", "skill-event-action-check", "skill-svc-binding-check", "skill-safe-entry-add",
            "skill-decision-scaffold", "skill-analyze-impact", "skill-infer-migrator", "skill-domain-health",
            "skill-pattern-analysis", "skill-schema-health-audit",
            "skill-entry-add-chain", "skill-system-health-chain", "skill-converge-chain",
            "skill-self-check-analyze", "skill-cli-coverage", "skill-promote-scan",
            "skill-spec-manage", "skill-registry-publish",
            "skill-flow-trace", "skill-table-impact",
            "skill-prefix-capacity-audit", "skill-policy-rule-verify", "skill-gate-refentries-check",
          ],
          capacity: 64,
        },
      },
    },
    skill_category: {
      id: "skill_category", name: "스킬 카테고리",
      versions: {
        v1: {
          entries: ["read", "write", "analysis", "chain"],
          capacity: 8,
          ko: { read: "조회", write: "변경", analysis: "분석", chain: "체인" },
        },
      },
    },
    skill_outcome: {
      id: "skill_outcome", name: "스킬 실행 결과",
      versions: {
        v1: {
          entries: ["ok", "warning", "error", "blocked", "skipped"],
          capacity: 16,
          ko: { ok: "정상", warning: "경고", error: "오류", blocked: "차단", skipped: "건너뜀" },
        },
      },
    },

    // ── 내부 로직 추출 축 ────────────────────────────────────────────

    version_lifecycle: {
      id: "version_lifecycle", name: "버전 생명주기",
      versions: {
        v1: {
          entries: ["draft", "locked", "released", "active", "deprecated"],
          capacity: 16,
          ko: { draft: "초안", locked: "잠금", released: "릴리스", active: "활성", deprecated: "폐기" },
        },
      },
    },
    address_state: {
      id: "address_state", name: "주소 상태",
      versions: {
        v1: {
          entries: ["active", "reserved", "inactive", "open"],
          capacity: 8,
          ko: { active: "활성", reserved: "예약", inactive: "비활성", open: "열림" },
        },
      },
    },
    resource_location: {
      id: "resource_location", name: "자원 위치",
      versions: {
        v1: {
          entries: ["origin", "cache", "queue", "external"],
          capacity: 8,
          ko: { origin: "원본", cache: "캐시", queue: "큐", external: "외부" },
        },
      },
    },
    observation_intent: {
      id: "observation_intent", name: "관측 의도",
      versions: {
        v1: {
          entries: ["action_needed", "monitoring", "completed"],
          capacity: 8,
          ko: { action_needed: "조치필요", monitoring: "모니터링", completed: "완료" },
        },
      },
    },
    execution_mode: {
      id: "execution_mode", name: "실행 모드",
      versions: {
        v1: {
          entries: ["live", "test", "synthetic", "replay"],
          capacity: 8,
          ko: { live: "실제", test: "테스트", synthetic: "합성", replay: "재생" },
        },
      },
    },
    record_type: {
      id: "record_type", name: "레코드 유형",
      versions: {
        v1: {
          entries: ["log", "span", "metric"],
          capacity: 8,
          ko: { log: "로그", span: "스팬", metric: "메트릭" },
        },
      },
    },

    // ── 이벤트 분류 축 (코드베이스 상수 좌표화) ────────────────
    event_category: {
      id: "event_category", name: "이벤트 카테고리",
      versions: {
        v1: {
          entries: ["user_action", "system_action", "network_action", "data_action", "agent_action", "sdk_action", "error", "state_change"],
          capacity: 16,
          ko: { user_action: "사용자행위", system_action: "시스템행위", network_action: "네트워크행위", data_action: "데이터행위", agent_action: "에이전트행위", sdk_action: "SDK행위", error: "오류", state_change: "상태변경" },
        },
      },
    },
    event_lifecycle_stage: {
      id: "event_lifecycle_stage", name: "이벤트 생명주기 단계",
      versions: {
        v1: {
          entries: ["interaction", "request", "processing", "result", "side_effect", "completion"],
          capacity: 16,
          ko: { interaction: "상호작용", request: "요청", processing: "처리", result: "결과", side_effect: "부수효과", completion: "완료" },
        },
      },
    },
    metric_type: {
      id: "metric_type", name: "메트릭 유형",
      versions: {
        v1: {
          entries: ["counter", "gauge", "histogram", "summary"],
          capacity: 8,
          ko: { counter: "카운터", gauge: "게이지", histogram: "히스토그램", summary: "서머리" },
        },
      },
    },

    // ── 의사결정 도메인 축 (decision-flow) ─────────────────────────────────
    cognitive_phase: {
      id: "cognitive_phase", name: "인지 단계",
      versions: {
        v1: {
          entries: ["perceive", "interpret", "evaluate", "decide", "plan", "execute", "reflect"],
          capacity: 16,
          ko: { perceive: "인지", interpret: "해석", evaluate: "평가", decide: "결정", plan: "계획", execute: "실행", reflect: "성찰" },
        },
      },
    },
    flow_type: {
      id: "flow_type", name: "플로우 유형",
      versions: {
        v1: {
          entries: ["office_hours", "ceo_review", "eng_review", "design_review", "code_review", "investigation", "ship", "custom"],
          capacity: 16,
          ko: { office_hours: "오피스아워", ceo_review: "전략리뷰", eng_review: "기술리뷰", design_review: "설계리뷰", code_review: "코드리뷰", investigation: "조사", ship: "출시", custom: "커스텀" },
        },
      },
    },
    evidence_kind: {
      id: "evidence_kind", name: "근거 유형",
      versions: {
        v1: {
          entries: ["data", "rule", "precedent", "intuition", "external"],
          capacity: 16,
          ko: { data: "정량데이터", rule: "규칙", precedent: "선례", intuition: "직관", external: "외부입력" },
        },
      },
    },
    mental_model: {
      id: "mental_model", name: "인지 모델",
      versions: {
        v1: {
          entries: ["bezos_doors", "munger_inversion", "jobs_subtraction", "speed_calibration", "proxy_skepticism", "boil_the_lake", "three_layer", "narrative_coherence", "temporal_depth", "founder_mode", "wartime_awareness", "design_trust", "edge_paranoia"],
          capacity: 32,
          ko: { bezos_doors: "가역성분류", munger_inversion: "반전사고", jobs_subtraction: "초점빼기", speed_calibration: "속도보정", proxy_skepticism: "대리회의", boil_the_lake: "호수끓이기", three_layer: "3층지식", narrative_coherence: "서사일관", temporal_depth: "시간깊이", founder_mode: "파운더모드", wartime_awareness: "전시인식", design_trust: "신뢰설계", edge_paranoia: "엣지편집증" },
        },
      },
    },
    escalation_type: {
      id: "escalation_type", name: "에스컬레이션 유형",
      versions: {
        v1: {
          entries: ["standard_pattern", "completeness", "test_coverage", "observability", "security", "taste"],
          capacity: 16,
          ko: { standard_pattern: "표준패턴", completeness: "완전구현", test_coverage: "테스트", observability: "관측성", security: "보안", taste: "미감결정" },
        },
      },
    },
    decision_outcome: {
      id: "decision_outcome", name: "결정 결과",
      versions: {
        v1: {
          entries: ["completed", "abandoned", "blocked", "auto_resolved", "escalated"],
          capacity: 16,
          ko: { completed: "완료", abandoned: "포기", blocked: "차단", auto_resolved: "자동해결", escalated: "에스컬레이션" },
        },
      },
    },
    scope_mode: {
      id: "scope_mode", name: "스코프 모드",
      versions: {
        v1: {
          entries: ["expansion", "selective", "hold", "reduction"],
          capacity: 8,
          ko: { expansion: "확장", selective: "선택적확장", hold: "유지", reduction: "축소" },
        },
      },
    },
    reversibility: {
      id: "reversibility", name: "가역성",
      versions: {
        v1: {
          entries: ["one_way", "two_way"],
          capacity: 4,
          ko: { one_way: "비가역", two_way: "가역" },
        },
      },
    },
    magnitude: {
      id: "magnitude", name: "영향 범위",
      versions: {
        v1: {
          entries: ["minor", "moderate", "major", "critical"],
          capacity: 8,
          ko: { minor: "경미", moderate: "보통", major: "중대", critical: "치명" },
        },
      },
    },
    confidence_band: {
      id: "confidence_band", name: "확신 수준",
      versions: {
        v1: {
          entries: ["low", "medium", "high", "exact"],
          capacity: 8,
          ko: { low: "낮음", medium: "보통", high: "높음", exact: "정확" },
        },
      },
    },
    forcing_question: {
      id: "forcing_question", name: "강제 질문",
      versions: {
        v1: {
          entries: ["demand_reality", "status_quo", "desperate_specificity", "narrowest_wedge", "observation", "future_fit"],
          capacity: 16,
          ko: { demand_reality: "수요현실", status_quo: "현재상태", desperate_specificity: "절박한구체성", narrowest_wedge: "최소쐐기", observation: "관찰", future_fit: "미래적합성" },
        },
      },
    },

    // ── 하네스 상태 모델 축 ────────────────────────────────────────────────────
    harness_machine: {
      id: "harness_machine", name: "상태 머신",
      versions: {
        v1: {
          entries: ["doc-lifecycle", "spec-impl", "convention-compliance", "db-sync", "address-state", "version-lifecycle", "decision-flow", "service-status", "event-status", "metric-health", "policy-candidate"],
          capacity: 16,
          ko: { "doc-lifecycle": "문서생명주기", "spec-impl": "스펙구현", "convention-compliance": "컨벤션준수", "db-sync": "DB동기화", "address-state": "주소상태", "version-lifecycle": "버전생명주기", "decision-flow": "의사결정흐름", "service-status": "서비스상태", "event-status": "이벤트상태", "metric-health": "메트릭건강도", "policy-candidate": "정책후보" },
        },
      },
    },
    harness_state: {
      id: "harness_state", name: "엔티티 상태",
      versions: {
        v1: {
          entries: ["draft", "review", "approved", "deprecated", "archived", "active", "inactive", "open", "reserved", "released", "pending", "completed", "abandoned", "blocked", "retired", "ok", "warning", "critical", "designed", "implementing", "implemented", "verified", "source-referenced", "unverified", "partial", "compliant", "violated", "out-of-sync", "syncing", "synced", "drift-detected", "candidate", "rejected", "modified"],
          capacity: 64,
          ko: { draft: "초안", review: "검토중", approved: "승인", deprecated: "폐기예정", archived: "보관", active: "활성", inactive: "비활성", open: "개방", reserved: "예약", released: "확정", pending: "대기", completed: "완료", abandoned: "포기", blocked: "차단", retired: "종료", ok: "정상", warning: "경고", critical: "위험", designed: "설계완료", implementing: "구현중", implemented: "구현완료", verified: "검증완료", "source-referenced": "소스참조", unverified: "미검증", partial: "부분검증", compliant: "준수", violated: "위반", "out-of-sync": "미동기화", syncing: "동기화중", synced: "동기화완료", "drift-detected": "drift감지", candidate: "후보", rejected: "거부", modified: "수정승인" },
        },
      },
    },
    harness_trigger: {
      id: "harness_trigger", name: "전이 트리거",
      versions: {
        v1: {
          entries: ["user_action", "system_auto", "cascade", "guard_pass", "guard", "notify", "timeout", "error", "schedule", "api_call"],
          capacity: 16,
          ko: { user_action: "사용자액션", system_auto: "시스템자동", cascade: "연쇄전이", guard_pass: "가드통과", guard: "가드검증", notify: "알림전파", timeout: "시간초과", error: "에러", schedule: "스케줄", api_call: "API호출" },
        },
      },
    },
    harness_verdict: {
      id: "harness_verdict", name: "검증 결과",
      versions: {
        v1: {
          entries: ["pass", "fail"],
          capacity: 4,
          ko: { pass: "통과", fail: "실패" },
        },
      },
    },
    harness_process: {
      id: "harness_process", name: "하네스 프로세스",
      versions: {
        v1: {
          entries: ["prefix-release", "doc-approval", "service-deprecation"],
          capacity: 8,
          ko: { "prefix-release": "프리픽스릴리스", "doc-approval": "문서승인", "service-deprecation": "서비스폐기" },
        },
      },
    },

    // ── 품질 관측 축 ──────────────────────────────────────────────────────────
    quality_severity: {
      id: "quality_severity", name: "품질 심각도",
      versions: {
        v1: {
          entries: ["error", "warning", "info"],
          capacity: 8,
          ko: { error: "오류", warning: "경고", info: "정보" },
        },
      },
    },
    quality_kind: {
      id: "quality_kind", name: "품질 유형",
      versions: {
        v1: {
          entries: ["error", "assertion", "mask", "field_check", "policy_violation", "unexpected"],
          capacity: 8,
          ko: { error: "오류", assertion: "검증", mask: "마스킹", field_check: "필드점검", policy_violation: "정책위반", unexpected: "예상외" },
        },
      },
    },

    // ── 실행 관측 축 ──────────────────────────────────────────────────────────
    task_type: {
      id: "task_type", name: "작업 유형",
      versions: {
        v1: {
          entries: ["task", "job", "cron", "pipeline"],
          capacity: 8,
          ko: { task: "태스크", job: "잡", cron: "크론", pipeline: "파이프라인" },
        },
      },
    },
    task_phase: {
      id: "task_phase", name: "작업 단계",
      versions: {
        v1: {
          entries: ["start", "finish", "retry", "timeout", "cancel"],
          capacity: 8,
          ko: { start: "시작", finish: "종료", retry: "재시도", timeout: "시간초과", cancel: "취소" },
        },
      },
    },

    // ── SDK 생명주기 축 ───────────────────────────────────────────────────────
    sdk_action: {
      id: "sdk_action", name: "SDK 동작",
      versions: {
        v1: {
          entries: ["init", "flush", "error", "reconnect"],
          capacity: 8,
          ko: { init: "초기화", flush: "전송", error: "오류", reconnect: "재연결" },
        },
      },
    },
    sdk_channel: {
      id: "sdk_channel", name: "SDK 채널",
      versions: {
        v1: {
          entries: ["browser", "node", "mobile", "agent"],
          capacity: 8,
          ko: { browser: "브라우저", node: "노드", mobile: "모바일", agent: "에이전트" },
        },
      },
    },

    // ── RPC/WebSocket 관측 축 ─────────────────────────────────────────────────
    rpc_protocol: {
      id: "rpc_protocol", name: "RPC 프로토콜",
      versions: {
        v1: {
          entries: ["grpc", "websocket", "http2"],
          capacity: 8,
          ko: { grpc: "gRPC", websocket: "웹소켓", http2: "HTTP/2" },
        },
      },
    },
    rpc_phase: {
      id: "rpc_phase", name: "RPC 단계",
      versions: {
        v1: {
          entries: ["open", "message", "close", "request", "response", "error"],
          capacity: 8,
          ko: { open: "연결", message: "메시지", close: "종료", request: "요청", response: "응답", error: "오류" },
        },
      },
    },

    // ── 게이트 런타임 축 ──────────────────────────────────────────────────────
    gate_kind: {
      id: "gate_kind", name: "게이트 유형",
      versions: {
        v1: {
          entries: ["typecheck", "lint", "static-analysis", "unit-test", "snapshot-test", "integration-test", "transaction-test", "api-contract", "e2e-test", "visual-check", "perf-benchmark", "build", "build-affected", "security-audit", "a11y-check", "doc-build", "license-check", "eval-benchmark", "cost-track"],
          capacity: 32,
          ko: { typecheck: "타입검사", lint: "린트", "static-analysis": "정적분석", "unit-test": "단위테스트", "snapshot-test": "스냅샷테스트", "integration-test": "통합테스트", "transaction-test": "트랜잭션테스트", "api-contract": "API계약", "e2e-test": "E2E테스트", "visual-check": "시각검증", "perf-benchmark": "성능벤치마크", build: "빌드", "build-affected": "영향빌드", "security-audit": "보안감사", "a11y-check": "접근성검증", "doc-build": "문서빌드", "license-check": "라이선스검증", "eval-benchmark": "AI평가", "cost-track": "비용추적" },
        },
      },
    },
    gate_scope: {
      id: "gate_scope", name: "게이트 범위",
      versions: {
        v1: {
          entries: ["static", "unit", "integration", "system", "build", "audit", "ai"],
          capacity: 16,
          ko: { static: "정적", unit: "단위", integration: "통합", system: "시스템", build: "빌드", audit: "감사", ai: "AI" },
        },
      },
    },
    gate_state: {
      id: "gate_state", name: "게이트 상태",
      versions: {
        v1: {
          entries: ["idle", "blocked", "ready", "gathering", "running", "passed", "failed", "stale", "skipped"],
          capacity: 16,
          ko: { idle: "대기", blocked: "차단", ready: "준비", gathering: "수집중", running: "실행중", passed: "통과", failed: "실패", stale: "무효", skipped: "건너뜀" },
        },
      },
    },
    // ── 문서 그래프 관측 축 ──────────────────────────────────────────────────
    def_level: {
      id: "def_level", name: "문서 역할",
      versions: {
        v1: {
          entries: ["group", "module", "leaf"],
          capacity: 8,
          ko: { group: "그룹", module: "모듈", leaf: "리프" },
        },
      },
    },
    def_layer: {
      id: "def_layer", name: "문서 계층",
      versions: {
        v1: {
          entries: ["domain", "operation", "mediation", "experience"],
          capacity: 8,
          ko: { domain: "도메인", operation: "운영", mediation: "중재", experience: "경험" },
        },
      },
    },
    graph_action: {
      id: "graph_action", name: "그래프 액션",
      versions: {
        v1: {
          entries: ["link_add", "link_remove", "promote", "demote", "split", "merge"],
          capacity: 8,
          ko: { link_add: "링크추가", link_remove: "링크제거", promote: "승격", demote: "강등", split: "분할", merge: "병합" },
        },
      },
    },
    link_type: {
      id: "link_type", name: "관계 유형",
      versions: {
        v1: {
          entries: ["depends_on", "implements", "refines", "constrains", "traces_to", "contains", "evolves_from", "supersedes"],
          capacity: 16,
          ko: { depends_on: "의존", implements: "구현", refines: "구체화", constrains: "제약", traces_to: "추적", contains: "포함", evolves_from: "진화", supersedes: "대체" },
        },
      },
    },

    bundle_state: {
      id: "bundle_state", name: "번들 상태",
      versions: {
        v1: {
          entries: ["empty", "pending", "gathering", "partial", "complete", "degraded"],
          capacity: 8,
          ko: { empty: "비어있음", pending: "대기", gathering: "수집중", partial: "부분완료", complete: "완료", degraded: "열화" },
        },
      },
    },

    // ── 전이 엔진 축 ──────────────────────────────────────────────────────────
    effect_kind: {
      id: "effect_kind", name: "전이 효과 유형",
      versions: {
        v1: {
          entries: ["create", "update", "move", "consume", "open", "close"],
          capacity: 8,
          ko: { create: "생성", update: "변경", move: "이동", consume: "소비", open: "개방", close: "닫기" },
        },
      },
    },
    match_mode: {
      id: "match_mode", name: "매칭 모드",
      versions: {
        v1: {
          entries: ["single", "ordered", "unordered", "windowed"],
          capacity: 8,
          ko: { single: "단일", ordered: "순차", unordered: "비순차", windowed: "시간창" },
        },
      },
    },

    // ── 수렴 파이프라인 축 ────────────────────────────────────────────────────
    convergence_phase: {
      id: "convergence_phase", name: "수렴 단계",
      versions: {
        v1: {
          entries: ["buffer", "flush", "aggregate", "classify", "metrics", "observations", "persist"],
          capacity: 16,
          ko: { buffer: "버퍼", flush: "플러시", aggregate: "집계", classify: "분류", metrics: "메트릭", observations: "관측", persist: "저장" },
        },
      },
    },
    convergence_result: {
      id: "convergence_result", name: "수렴 결과",
      versions: {
        v1: {
          entries: ["ok", "partial", "empty", "error"],
          capacity: 8,
          ko: { ok: "정상", partial: "부분", empty: "빈결과", error: "오류" },
        },
      },
    },

    // ── 테스트 시나리오 축 ────────────────────────────────────────────────────
    test_kind: {
      id: "test_kind", name: "테스트 유형",
      versions: {
        v1: {
          entries: [
            "unit",
            "ui-logic",
            "ui",
            "db-transaction",
            "data-exchange",
            "auth-flow",
            "e2e",
            "simulation",
          ],
          capacity: 16,
          ko: { unit: "단위", "ui-logic": "UI로직", ui: "UI", "db-transaction": "DB트랜잭션", "data-exchange": "데이터교환", "auth-flow": "인증흐름", e2e: "E2E", simulation: "시뮬레이션" },
        },
      },
    },
    test_scope: {
      id: "test_scope", name: "테스트 범위",
      versions: {
        v1: {
          entries: ["single", "pair", "multi", "system"],
          capacity: 8,
          ko: { single: "단일", pair: "쌍", multi: "다중", system: "시스템" },
        },
      },
    },
    test_phase: {
      id: "test_phase", name: "테스트 단계",
      versions: {
        v1: {
          entries: [
            "precondition",
            "fixture",
            "arrange",
            "act",
            "observe",
            "assert-primary",
            "assert-side",
            "assert-negative",
            "snapshot",
            "teardown",
            "report",
          ],
          capacity: 32,
          ko: {
            precondition: "전제조건", fixture: "데이터준비", arrange: "상태설정",
            act: "동작실행", observe: "관측", "assert-primary": "주검증",
            "assert-side": "부수효과검증", "assert-negative": "부정검증",
            snapshot: "스냅샷", teardown: "정리", report: "결과보고",
          },
        },
      },
    },
    // ── Meta-Semantic IR 축 ─────────────────────────────────────────────
    ir_certainty: {
      id: "ir_certainty", name: "타입 확신도",
      versions: {
        v1: {
          entries: ["strict", "flexible"],
          capacity: 4,
          ko: { strict: "엄격", flexible: "유연" },
        },
      },
    },
    ir_transaction_scope: {
      id: "ir_transaction_scope", name: "트랜잭션 범위",
      versions: {
        v1: {
          entries: ["local", "distributed"],
          capacity: 4,
          ko: { local: "로컬", distributed: "분산" },
        },
      },
    },
    ir_pipe_state: {
      id: "ir_pipe_state", name: "파이프 트랜잭션 상태",
      versions: {
        v1: {
          entries: ["pending", "committed", "rolledBack"],
          capacity: 4,
          ko: { pending: "대기", committed: "확정", rolledBack: "롤백" },
        },
      },
    },
    ir_call_kind: {
      id: "ir_call_kind", name: "호출 종류",
      versions: {
        v1: {
          entries: ["method-call", "event-emit", "http-request", "db-query"],
          capacity: 8,
          ko: { "method-call": "메서드호출", "event-emit": "이벤트발행", "http-request": "HTTP요청", "db-query": "DB쿼리" },
        },
      },
    },
    ir_retention: {
      id: "ir_retention", name: "데이터 보존",
      versions: {
        v1: {
          entries: ["ephemeral", "session", "persistent"],
          capacity: 4,
          ko: { ephemeral: "일시", session: "세션", persistent: "영구" },
        },
      },
    },
    ir_storage_type: {
      id: "ir_storage_type", name: "저장 유형",
      versions: {
        v1: {
          entries: ["memory", "db", "event-stream"],
          capacity: 4,
          ko: { memory: "메모리", db: "DB", "event-stream": "이벤트스트림" },
        },
      },
    },
  },

  prefixes: {
    service: {
      id: "service", name: "서비스",
      description: "env × region × svc_name × namespace 4차원 서비스 주소 공간",
      labels: ["env", "region", "svc_name", "namespace"],
      meta: { category: "entity", visualShape: "cube", heightRatio: 1, detailKind: "config", source: { module: "demo-snapshot", file: "demo-catalog.ts" } },
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
      meta: { category: "policy", visualShape: "thin-bar", heightRatio: 0.3, detailKind: "permission", source: { module: "permission-engine", file: "permission-set.ts" } },
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
      meta: { category: "event", visualShape: "cube", heightRatio: 0.8, detailKind: "generic", source: { module: "ingest-server" } },
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
      meta: { category: "policy", visualShape: "thin-bar", heightRatio: 0.3, detailKind: "permission", source: { module: "permission-engine", file: "permission-set.ts" } },
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
      meta: { category: "entity", visualShape: "cube", heightRatio: 1, detailKind: "generic" },
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
      description: "svc_ref × trackAction × page × userType — 서비스 바인딩 포함 행동 추적",
      labels: ["svc_ref", "trackAction", "page", "userType"],
      meta: { category: "entity", visualShape: "cube", heightRatio: 1, detailKind: "generic", source: { module: "browser-sdk", file: "auto-capture.ts" } },
      dims: {
        svc_ref: { kind: "prefix_ref", prefixId: "service" },
        trackAction: { kind: "axis", axisId: "trackAction" },
        page: { kind: "axis", axisId: "page" },
        userType: { kind: "axis", axisId: "userType" },
      },
      versions: [
        { version: "v1", axisVersions: { trackAction: "v1", page: "v1", userType: "v1" }, refEntries: { svc_ref: { values: _EVT_SVC, refVersion: "v1" } } },
        { version: "v2", axisVersions: { trackAction: "v2", page: "v2", userType: "v1" }, refEntries: { svc_ref: { values: _EVT_SVC, refVersion: "v1" } } },
        { version: "v3", axisVersions: { trackAction: "v2", page: "v2", userType: "v1" }, refEntries: { svc_ref: { values: _EVT_SVC, refVersion: "v1" } } },
      ],
    },
    relational: {
      id: "relational", name: "관계 모델",
      description: "subjectKind × predicate × objectKind 관계 인덱스",
      labels: ["subjectKind", "predicate", "objectKind"],
      meta: { category: "relation", visualShape: "sphere", heightRatio: 1, detailKind: "generic", source: { module: "spec-core", file: "dkg/dkg.types.ts" } },
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
      meta: { category: "observation", visualShape: "cube", heightRatio: 1, detailKind: "generic", source: { module: "demo-snapshot", file: "demo-catalog.ts" } },
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
      meta: { category: "observation", visualShape: "cube", heightRatio: 1, detailKind: "endpoint", source: { module: "ingest-server", file: "routes/ingest.ts" } },
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
      meta: { category: "observation", visualShape: "cube", heightRatio: 1, detailKind: "flow-step", source: { module: "spec-core", file: "dkg/flow-definition.ts" } },
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
      meta: { category: "event", visualShape: "flat-tile", heightRatio: 0.5, detailKind: "metric", source: { module: "engine", file: "matching/constraint-evaluator.ts" } },
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
      meta: { category: "event", visualShape: "flat-tile", heightRatio: 0.5, detailKind: "config", source: { module: "spec-core", file: "dkg/skills/infer-migrator.ts" } },
      dims: {
        svc_ref: { kind: "prefix_ref", prefixId: "service" },
        migration_pattern: { kind: "axis", axisId: "migration_pattern" },
        deploy_action: { kind: "axis", axisId: "deploy_action" },
      },
      versions: [
        { version: "v1", axisVersions: { migration_pattern: "v1", deploy_action: "v2" }, refEntries: { svc_ref: { values: _INFRA_SVC, refVersion: "v1" } } },
      ],
    },

    schema_validation: {
      id: "schema_validation", name: "스키마 검증 이벤트",
      description: "svc_ref(서비스 참조) × validation_layer × constraint_rule × verdict_result — 어떤 스키마의 어떤 레이어에서 어떤 규칙으로 어떤 결과가 나왔는가",
      labels: ["svc_ref", "validation_layer", "constraint_rule", "verdict_result"],
      meta: { category: "observation", visualShape: "cube", heightRatio: 1, detailKind: "metric", source: { module: "spec-core", file: "schema/schema-validation-codec.ts" } },
      dims: {
        svc_ref: { kind: "prefix_ref", prefixId: "service" },
        validation_layer: { kind: "axis", axisId: "validation_layer" },
        constraint_rule: { kind: "axis", axisId: "constraint_rule" },
        verdict_result: { kind: "axis", axisId: "verdict_result" },
      },
      versions: [
        { version: "v1", axisVersions: { validation_layer: "v1", constraint_rule: "v1", verdict_result: "v1" }, refEntries: { svc_ref: { values: _PERM_SVC, refVersion: "v1" } } },
      ],
    },

    // ── 파이프라인 관측 prefix ──────────────────────────────────────────
    pipeline_point: {
      id: "pipeline_point", name: "파이프라인 관측 포인트",
      description: "svc_ref(서비스 참조) × pipeline_phase × validation_mode × verdict_result × temporal_strategy — 수집 파이프라인의 어떤 단계에서 어떤 모드로 어떤 결과가 나왔는가",
      labels: ["svc_ref", "pipeline_phase", "validation_mode", "verdict_result", "temporal_strategy"],
      meta: { category: "observation", visualShape: "cube", heightRatio: 1, detailKind: "metric", source: { module: "ingest-server", file: "lib/phase-two-worker.ts" } },
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
      meta: { category: "observation", visualShape: "flat-tile", heightRatio: 0.5, detailKind: "config", source: { module: "sdk", file: "masking.ts" } },
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
      meta: { category: "event", visualShape: "flat-tile", heightRatio: 0.5, detailKind: "event-def", source: { module: "spec-core", file: "dkg/bootstrap.ts" } },
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
      meta: { category: "event", visualShape: "flat-tile", heightRatio: 0.5, detailKind: "config", source: { module: "ingest-server" } },
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
      description: "svc_ref × actor(member) × action × target(item) — 서비스 바인딩 포함 이벤트",
      labels: ["svc_ref", "actor", "action", "target"],
      meta: { category: "event", visualShape: "flat-tile", heightRatio: 0.5, detailKind: "event-def", source: { module: "demo-snapshot", file: "demo-catalog.ts" } },
      dims: {
        svc_ref: { kind: "prefix_ref", prefixId: "service" },
        actor:  { kind: "table_ref", table: "members" },
        action: { kind: "axis", axisId: "cart_action" },
        target: { kind: "table_ref", table: "items" },
      },
      versions: [
        { version: "v1", axisVersions: { action: "v1" }, refEntries: { svc_ref: { values: _EVT_SVC, refVersion: "v1" } } },
        { version: "v2", axisVersions: { action: "v1" }, refEntries: { svc_ref: { values: _EVT_SVC, refVersion: "v1" } } },
      ],
    },
    auth_event: {
      id: "auth_event", name: "인증 이벤트",
      description: "svc_ref × actor(member) × action — 서비스 바인딩 포함 인증 이벤트",
      labels: ["svc_ref", "actor", "action"],
      meta: { category: "event", visualShape: "flat-tile", heightRatio: 0.5, detailKind: "event-def", source: { module: "demo-snapshot" } },
      dims: {
        svc_ref: { kind: "prefix_ref", prefixId: "service" },
        actor:  { kind: "table_ref", table: "members" },
        action: { kind: "axis", axisId: "auth_action" },
      },
      versions: [
        { version: "v1", axisVersions: { action: "v1" }, refEntries: { svc_ref: { values: _EVT_SVC, refVersion: "v1" } } },
        { version: "v2", axisVersions: { action: "v1" }, refEntries: { svc_ref: { values: _EVT_SVC, refVersion: "v1" } } },
      ],
    },
    order_event: {
      id: "order_event", name: "주문 이벤트",
      description: "actor(member) × action × order(table) × service_ctx(prefix_ref) — 다항 + 컨텍스트",
      labels: ["service_ctx", "actor", "action", "order"],
      meta: { category: "event", visualShape: "flat-tile", heightRatio: 0.5, detailKind: "event-def", source: { module: "demo-snapshot" } },
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

    // ── 자기참조 prefix (qa-sdk 자체 모니터링) ──────────────────
    build_event: {
      id: "build_event", name: "빌드 이벤트",
      description: "qa_pkg × qa_module × build_result — 어떤 패키지의 어떤 모듈이 어떤 빌드 결과를 냈는가",
      labels: ["qa_pkg", "qa_module", "build_result"],
      meta: { category: "event", visualShape: "flat-tile", heightRatio: 0.5, detailKind: "metric" },
      dims: {
        qa_pkg:       { kind: "axis", axisId: "qa_pkg" },
        qa_module:    { kind: "axis", axisId: "qa_module" },
        build_result: { kind: "axis", axisId: "build_result" },
      },
      versions: [
        { version: "v1", axisVersions: { qa_pkg: "v1", build_result: "v1" } },
        { version: "v2", axisVersions: { qa_pkg: "v1", qa_module: "v2", build_result: "v1" } },
      ],
    },
    test_event: {
      id: "test_event", name: "테스트 이벤트",
      description: "qa_pkg × qa_module × test_result — 어떤 패키지의 어떤 모듈/시나리오가 어떤 테스트 결과를 냈는가",
      labels: ["qa_pkg", "qa_module", "test_result"],
      meta: { category: "event", visualShape: "flat-tile", heightRatio: 0.5, detailKind: "metric" },
      dims: {
        qa_pkg:      { kind: "axis", axisId: "qa_pkg" },
        qa_module:   { kind: "axis", axisId: "qa_module" },
        test_result: { kind: "axis", axisId: "test_result" },
      },
      versions: [
        { version: "v1", axisVersions: { qa_pkg: "v1", test_result: "v1" } },
        { version: "v2", axisVersions: { qa_pkg: "v1", qa_module: "v2", test_result: "v1" } },
      ],
    },

    dkg_event: {
      id: "dkg_event", name: "DKG 운영 이벤트",
      description: "dkg_op × dkg_target_kind — 어떤 운영 작업이 어떤 종류의 대상에 수행됐는가",
      labels: ["dkg_op", "dkg_target_kind"],
      dims: {
        dkg_op:          { kind: "axis", axisId: "dkg_op" },
        dkg_target_kind: { kind: "axis", axisId: "dkg_target_kind" },
      },
      versions: [
        { version: "v1", axisVersions: { dkg_op: "v1", dkg_target_kind: "v1" } },
      ],
      meta: { category: "event" as const },
    },
    dkg_decision_event: {
      id: "dkg_decision_event", name: "의사결정 이벤트",
      description: "decision_type × dkg_target_kind × node_source — 어떤 유형의 결정이 어떤 대상에 어떤 원천으로 생성됐는가",
      labels: ["decision_type", "dkg_target_kind", "node_source"],
      dims: {
        decision_type:   { kind: "axis", axisId: "decision_type" },
        dkg_target_kind: { kind: "axis", axisId: "dkg_target_kind" },
        node_source:     { kind: "axis", axisId: "node_source" },
      },
      versions: [
        { version: "v1", axisVersions: { decision_type: "v1", dkg_target_kind: "v1", node_source: "v1" } },
      ],
      meta: { category: "event" as const },
    },
    dkg_observation_event: {
      id: "dkg_observation_event", name: "관측 이벤트",
      description: "obs_source × dkg_target_kind × lifecycle_state — 어떤 원천의 관측이 어떤 대상에 어떤 상태로 존재하는가",
      labels: ["obs_source", "dkg_target_kind", "lifecycle_state"],
      dims: {
        obs_source:      { kind: "axis", axisId: "obs_source" },
        dkg_target_kind: { kind: "axis", axisId: "dkg_target_kind" },
        lifecycle_state: { kind: "axis", axisId: "lifecycle_state" },
      },
      versions: [
        { version: "v1", axisVersions: { obs_source: "v1", dkg_target_kind: "v1", lifecycle_state: "v1" } },
      ],
      meta: { category: "event" as const },
    },
    skill_execution: {
      id: "skill_execution", name: "스킬 실행 이벤트",
      description: "skill_id × skill_category × skill_outcome — 어떤 스킬이 어떤 카테고리로 어떤 결과를 냈는가",
      labels: ["skill_id", "skill_category", "skill_outcome"],
      dims: {
        skill_id:       { kind: "axis", axisId: "skill_id" },
        skill_category: { kind: "axis", axisId: "skill_category" },
        skill_outcome:  { kind: "axis", axisId: "skill_outcome" },
      },
      versions: [
        { version: "v1", axisVersions: { skill_id: "v1", skill_category: "v1", skill_outcome: "v1" } },
      ],
      meta: { category: "event" as const },
    },
    cli_event: {
      id: "cli_event", name: "CLI 활동 이벤트",
      description: "cli_intent × cli_domain × cli_subject — 모든 CLI 명령 실행을 의도 기반으로 기록. 명령어 이름이 아닌 의도가 좌표.",
      labels: ["cli_intent", "cli_domain", "cli_subject"],
      dims: {
        cli_intent:  { kind: "axis", axisId: "cli_intent" },
        cli_domain:  { kind: "axis", axisId: "cli_domain" },
        cli_subject: { kind: "axis", axisId: "cli_subject" },
      },
      versions: [
        { version: "v1", axisVersions: { cli_intent: "v1", cli_domain: "v1", cli_subject: "v1" } },
      ],
      meta: { category: "event" as const },
    },
    contract_check: {
      id: "contract_check", name: "인터페이스 계약 검증",
      description: "qa_pkg × api_surface × test_result — 어떤 패키지의 어떤 인터페이스 영역이 어떤 결과를 냈는가",
      labels: ["qa_pkg", "api_surface", "test_result"],
      dims: {
        qa_pkg:      { kind: "axis", axisId: "qa_pkg" },
        api_surface: { kind: "axis", axisId: "api_surface" },
        test_result: { kind: "axis", axisId: "test_result" },
      },
      versions: [
        { version: "v1", axisVersions: { qa_pkg: "v2", api_surface: "v1", test_result: "v1" } },
      ],
      meta: { category: "entity" as const },
    },

    // ── 이벤트 패턴 분류 prefix (ADR-006) ────────────────────
    pattern_match: {
      id: "pattern_match", name: "패턴 매칭 결과",
      description: "svc_ref × identification_mode × behavior_pattern × pattern_confidence — 세션 패턴 분류 좌표",
      labels: ["svc_ref", "identification_mode", "behavior_pattern", "pattern_confidence"],
      meta: { category: "observation", visualShape: "cube", heightRatio: 1, detailKind: "metric", source: { module: "spec-core", file: "convergence/pattern-classifier.ts" } },
      dims: {
        svc_ref:              { kind: "prefix_ref", prefixId: "service" },
        identification_mode:  { kind: "axis", axisId: "identification_mode" },
        behavior_pattern:     { kind: "axis", axisId: "behavior_pattern" },
        pattern_confidence:   { kind: "axis", axisId: "pattern_confidence" },
      },
      versions: [
        { version: "v1", axisVersions: { identification_mode: "v1", behavior_pattern: "v1", pattern_confidence: "v1" }, refEntries: { svc_ref: { values: _PERM_SVC, refVersion: "v1" } } },
      ],
    },
    pattern_anomaly: {
      id: "pattern_anomaly", name: "이상 패턴 감지",
      description: "svc_ref × anomaly_kind × behavior_pattern × anomaly_severity — 이상 패턴 발생 좌표",
      labels: ["svc_ref", "anomaly_kind", "behavior_pattern", "anomaly_severity"],
      meta: { category: "observation", visualShape: "sphere", heightRatio: 1.2, detailKind: "metric", source: { module: "spec-core", file: "convergence/pattern-anomaly.ts" } },
      dims: {
        svc_ref:            { kind: "prefix_ref", prefixId: "service" },
        anomaly_kind:       { kind: "axis", axisId: "anomaly_kind" },
        behavior_pattern:   { kind: "axis", axisId: "behavior_pattern" },
        anomaly_severity:   { kind: "axis", axisId: "anomaly_severity" },
      },
      versions: [
        { version: "v1", axisVersions: { behavior_pattern: "v1" }, refEntries: { svc_ref: { values: _PERM_SVC, refVersion: "v1" } } },
        { version: "v2", axisVersions: { anomaly_kind: "v1", behavior_pattern: "v1", anomaly_severity: "v1" }, refEntries: { svc_ref: { values: _PERM_SVC, refVersion: "v1" } } },
      ],
    },

    // ── 내부 로직 추출 prefix ────────────────────────────────────

    version_point: {
      id: "version_point", name: "버전 생명주기 관측",
      description: "svc_ref × version_lifecycle — 어떤 서비스의 prefix 버전이 어떤 상태에 있는가",
      labels: ["svc_ref", "version_lifecycle"],
      meta: { category: "observation", visualShape: "flat-tile", heightRatio: 0.6, detailKind: "generic" },
      dims: {
        svc_ref:            { kind: "prefix_ref", prefixId: "service" },
        version_lifecycle:  { kind: "axis", axisId: "version_lifecycle" },
      },
      versions: [
        { version: "v1", axisVersions: { version_lifecycle: "v1" }, refEntries: { svc_ref: { values: _PERM_SVC, refVersion: "v1" } } },
      ],
    },
    gate_point: {
      id: "gate_point", name: "주소 상태 관측",
      description: "svc_ref × address_state — 어떤 서비스에서 주소가 어떤 상태에 있는가",
      labels: ["svc_ref", "address_state"],
      meta: { category: "observation", visualShape: "flat-tile", heightRatio: 0.6, detailKind: "generic" },
      dims: {
        svc_ref:        { kind: "prefix_ref", prefixId: "service" },
        address_state:  { kind: "axis", axisId: "address_state" },
      },
      versions: [
        { version: "v1", axisVersions: { address_state: "v1" }, refEntries: { svc_ref: { values: _PERM_SVC, refVersion: "v1" } } },
      ],
    },
    observation_event: {
      id: "observation_event", name: "관측 의도 이벤트",
      description: "observation_intent × dkg_target_kind — 어떤 의도의 관측이 어떤 대상에 생성됐는가",
      labels: ["observation_intent", "dkg_target_kind"],
      meta: { category: "event", visualShape: "thin-bar", heightRatio: 0.8, detailKind: "event-def" },
      dims: {
        observation_intent: { kind: "axis", axisId: "observation_intent" },
        dkg_target_kind:    { kind: "axis", axisId: "dkg_target_kind" },
      },
      versions: [
        { version: "v1", axisVersions: { observation_intent: "v1", dkg_target_kind: "v1" } },
      ],
    },
    spec_event: {
      id: "spec_event", name: "스펙 문서 이벤트",
      description: "spec_type × lifecycle_state — 어떤 유형의 스펙이 어떤 상태로 변경됐는가",
      labels: ["spec_type", "lifecycle_state"],
      meta: { category: "event", visualShape: "thin-bar", heightRatio: 0.8, detailKind: "event-def" },
      dims: {
        spec_type:       { kind: "axis", axisId: "spec_type" },
        lifecycle_state: { kind: "axis", axisId: "lifecycle_state" },
      },
      versions: [
        { version: "v1", axisVersions: { spec_type: "v1", lifecycle_state: "v1" } },
      ],
    },
    edge_activity: {
      id: "edge_activity", name: "관계 활동 이벤트",
      description: "edge_type × dkg_target_kind — 어떤 관계가 어떤 대상에 생성됐는가",
      labels: ["edge_type", "dkg_target_kind"],
      meta: { category: "event", visualShape: "thin-bar", heightRatio: 0.8, detailKind: "event-def" },
      dims: {
        edge_type:       { kind: "axis", axisId: "edge_type" },
        dkg_target_kind: { kind: "axis", axisId: "dkg_target_kind" },
      },
      versions: [
        { version: "v1", axisVersions: { edge_type: "v1", dkg_target_kind: "v1" } },
      ],
    },
    execution_context: {
      id: "execution_context", name: "실행 컨텍스트",
      description: "svc_ref × execution_mode — 어떤 서비스가 어떤 실행 모드에 있는가",
      labels: ["svc_ref", "execution_mode"],
      meta: { category: "entity", visualShape: "cube", heightRatio: 1, detailKind: "config" },
      dims: {
        svc_ref:         { kind: "prefix_ref", prefixId: "service" },
        execution_mode:  { kind: "axis", axisId: "execution_mode" },
      },
      versions: [
        { version: "v1", axisVersions: { execution_mode: "v1" }, refEntries: { svc_ref: { values: _PERM_SVC, refVersion: "v1" } } },
      ],
    },
    ingest_record: {
      id: "ingest_record", name: "수집 레코드",
      description: "svc_ref × record_type — 어떤 서비스에서 어떤 유형의 레코드가 수집됐는가",
      labels: ["svc_ref", "record_type"],
      meta: { category: "observation", visualShape: "column", heightRatio: 0.8, detailKind: "generic" },
      dims: {
        svc_ref:      { kind: "prefix_ref", prefixId: "service" },
        record_type:  { kind: "axis", axisId: "record_type" },
      },
      versions: [
        { version: "v1", axisVersions: { record_type: "v1" }, refEntries: { svc_ref: { values: _PERM_SVC, refVersion: "v1" } } },
      ],
    },

    // ── 이벤트 분류 prefix (코드베이스 상수 좌표화) ────────────
    event_classification: {
      id: "event_classification", name: "이벤트 분류",
      description: "svc_ref × event_category × event_lifecycle_stage — 이벤트의 카테고리와 생명주기 단계를 좌표화",
      labels: ["svc_ref", "event_category", "event_lifecycle_stage"],
      meta: { category: "observation" as const, visualShape: "cube", heightRatio: 0.8, detailKind: "generic" },
      dims: {
        svc_ref:                { kind: "prefix_ref" as const, prefixId: "service" },
        event_category:         { kind: "axis" as const, axisId: "event_category" },
        event_lifecycle_stage:  { kind: "axis" as const, axisId: "event_lifecycle_stage" },
      },
      versions: [
        { version: "v1", axisVersions: { event_category: "v1", event_lifecycle_stage: "v1" }, refEntries: { svc_ref: { values: _PERM_SVC, refVersion: "v1" } } },
      ],
    },
    metric_point: {
      id: "metric_point", name: "메트릭 수집 포인트",
      description: "svc_ref × metric_type × record_type — 어떤 서비스에서 어떤 유형의 메트릭이 어떤 레코드로 수집됐는가",
      labels: ["svc_ref", "metric_type", "record_type"],
      meta: { category: "observation" as const, visualShape: "column", heightRatio: 0.6, detailKind: "metric" },
      dims: {
        svc_ref:      { kind: "prefix_ref" as const, prefixId: "service" },
        metric_type:  { kind: "axis" as const, axisId: "metric_type" },
        record_type:  { kind: "axis" as const, axisId: "record_type" },
      },
      versions: [
        { version: "v1", axisVersions: { metric_type: "v1", record_type: "v1" }, refEntries: { svc_ref: { values: _PERM_SVC, refVersion: "v1" } } },
      ],
    },

    // ── 크로스커팅 관측 prefix (기존 축의 새 조합) ────────────────

    version_state: {
      id: "version_state", name: "버전 롤아웃 상태",
      description: "svc_ref × version_lifecycle × address_state — 서비스별 버전이 어떤 생명주기/주소 상태에 있는가",
      labels: ["svc_ref", "version_lifecycle", "address_state"],
      meta: { category: "observation" as const, visualShape: "flat-tile", heightRatio: 0.6, detailKind: "config" },
      dims: {
        svc_ref:           { kind: "prefix_ref" as const, prefixId: "service" },
        version_lifecycle: { kind: "axis" as const, axisId: "version_lifecycle" },
        address_state:     { kind: "axis" as const, axisId: "address_state" },
      },
      versions: [
        { version: "v1", axisVersions: { version_lifecycle: "v1", address_state: "v1" }, refEntries: { svc_ref: { values: _PERM_SVC, refVersion: "v1" } } },
      ],
    },
    metric_aggregate: {
      id: "metric_aggregate", name: "다차원 메트릭 집계",
      description: "svc_ref × metric_type × execution_mode × health_status — 서비스별 메트릭 유형/실행 모드/건강 상태 교차 관측",
      labels: ["svc_ref", "metric_type", "execution_mode", "health_status"],
      meta: { category: "observation" as const, visualShape: "cube", heightRatio: 0.8, detailKind: "metric" },
      dims: {
        svc_ref:        { kind: "prefix_ref" as const, prefixId: "service" },
        metric_type:    { kind: "axis" as const, axisId: "metric_type" },
        execution_mode: { kind: "axis" as const, axisId: "execution_mode" },
        health_status:  { kind: "axis" as const, axisId: "health_status" },
      },
      versions: [
        { version: "v1", axisVersions: { metric_type: "v1", execution_mode: "v1", health_status: "v1" }, refEntries: { svc_ref: { values: _PERM_SVC, refVersion: "v1" } } },
      ],
    },
    validation_event: {
      id: "validation_event", name: "검증 연산 이벤트",
      description: "svc_ref × validation_layer × constraint_op × verdict_result — 어떤 레이어에서 어떤 연산자로 검증하여 어떤 결과가 나왔는가",
      labels: ["svc_ref", "validation_layer", "constraint_op", "verdict_result"],
      meta: { category: "event" as const, visualShape: "flat-tile", heightRatio: 0.5, detailKind: "metric" },
      dims: {
        svc_ref:          { kind: "prefix_ref" as const, prefixId: "service" },
        validation_layer: { kind: "axis" as const, axisId: "validation_layer" },
        constraint_op:    { kind: "axis" as const, axisId: "constraint_op" },
        verdict_result:   { kind: "axis" as const, axisId: "verdict_result" },
      },
      versions: [
        { version: "v1", axisVersions: { validation_layer: "v1", constraint_op: "v1", verdict_result: "v1" }, refEntries: { svc_ref: { values: _PERM_SVC, refVersion: "v1" } } },
      ],
    },
    resource_lifecycle: {
      id: "resource_lifecycle", name: "리소스 수명 추적",
      description: "svc_ref × resource_type × lifecycle_state × resource_location — 리소스가 어떤 유형/상태/위치에 있는가",
      labels: ["svc_ref", "resource_type", "lifecycle_state", "resource_location"],
      meta: { category: "observation" as const, visualShape: "cube", heightRatio: 1, detailKind: "generic" },
      dims: {
        svc_ref:           { kind: "prefix_ref" as const, prefixId: "service" },
        resource_type:     { kind: "axis" as const, axisId: "resource_type" },
        lifecycle_state:   { kind: "axis" as const, axisId: "lifecycle_state" },
        resource_location: { kind: "axis" as const, axisId: "resource_location" },
      },
      versions: [
        { version: "v1", axisVersions: { resource_type: "v1", lifecycle_state: "v1", resource_location: "v1" }, refEntries: { svc_ref: { values: _PERM_SVC, refVersion: "v1" } } },
      ],
    },
    test_coverage: {
      id: "test_coverage", name: "테스트 커버리지 매트릭스",
      description: "qa_pkg × qa_module × test_result × flow_variant — 패키지/모듈별 테스트 결과와 흐름 변형 교차",
      labels: ["qa_pkg", "qa_module", "test_result", "flow_variant"],
      meta: { category: "observation" as const, visualShape: "cube", heightRatio: 0.8, detailKind: "metric" },
      dims: {
        qa_pkg:       { kind: "axis" as const, axisId: "qa_pkg" },
        qa_module:    { kind: "axis" as const, axisId: "qa_module" },
        test_result:  { kind: "axis" as const, axisId: "test_result" },
        flow_variant: { kind: "axis" as const, axisId: "flow_variant" },
      },
      versions: [
        { version: "v1", axisVersions: { qa_pkg: "v2", qa_module: "v2", test_result: "v1", flow_variant: "v1" } },
      ],
    },
    cli_tracking: {
      id: "cli_tracking", name: "CLI 실행 결과 추적",
      description: "cli_intent × cli_domain × cli_subject × skill_outcome — CLI 명령 실행 결과 4차원 추적",
      labels: ["cli_intent", "cli_domain", "cli_subject", "skill_outcome"],
      meta: { category: "observation" as const, visualShape: "cube", heightRatio: 0.8, detailKind: "metric" },
      dims: {
        cli_intent:    { kind: "axis" as const, axisId: "cli_intent" },
        cli_domain:    { kind: "axis" as const, axisId: "cli_domain" },
        cli_subject:   { kind: "axis" as const, axisId: "cli_subject" },
        skill_outcome: { kind: "axis" as const, axisId: "skill_outcome" },
      },
      versions: [
        { version: "v1", axisVersions: { cli_intent: "v1", cli_domain: "v1", cli_subject: "v1", skill_outcome: "v1" } },
      ],
    },
    tag_lifecycle: {
      id: "tag_lifecycle", name: "태그 수명 추적",
      description: "svc_ref × tag × resource_type × lifecycle_state — 리소스 태그가 어떤 유형/상태를 거치는가",
      labels: ["svc_ref", "tag", "resource_type", "lifecycle_state"],
      meta: { category: "observation" as const, visualShape: "cube", heightRatio: 0.8, detailKind: "generic" },
      dims: {
        svc_ref:         { kind: "prefix_ref" as const, prefixId: "service" },
        tag:             { kind: "axis" as const, axisId: "tag" },
        resource_type:   { kind: "axis" as const, axisId: "resource_type" },
        lifecycle_state: { kind: "axis" as const, axisId: "lifecycle_state" },
      },
      versions: [
        { version: "v1", axisVersions: { tag: "v1", resource_type: "v1", lifecycle_state: "v1" }, refEntries: { svc_ref: { values: _PERM_SVC, refVersion: "v1" } } },
      ],
    },

    // ── 의사결정 도메인 prefix (decision-flow) ──────────────────────────────
    decision_event: {
      id: "decision_event", name: "분기 선택 이벤트",
      description: "flow_type × cognitive_phase × evidence_kind × confidence_band — 개별 분기 선택",
      labels: ["flow_type", "cognitive_phase", "evidence_kind", "confidence_band"],
      meta: { category: "event" as const, layer: 1 as const, visualShape: "flat-tile" as const, detailKind: "event-def" as const },
      dims: {
        flow_type:       { kind: "axis" as const, axisId: "flow_type" },
        cognitive_phase: { kind: "axis" as const, axisId: "cognitive_phase" },
        evidence_kind:   { kind: "axis" as const, axisId: "evidence_kind" },
        confidence_band: { kind: "axis" as const, axisId: "confidence_band" },
      },
      versions: [
        { version: "v1", axisVersions: { flow_type: "v1", cognitive_phase: "v1", evidence_kind: "v1", confidence_band: "v1" } },
      ],
    },
    decision_path: {
      id: "decision_path", name: "의사결정 경로",
      description: "flow_type × decision_outcome × scope_mode — 플로우 완료 시 전체 경로 요약",
      labels: ["flow_type", "decision_outcome", "scope_mode"],
      meta: { category: "observation" as const, layer: 1 as const, visualShape: "cube" as const, detailKind: "flow-step" as const },
      dims: {
        flow_type:        { kind: "axis" as const, axisId: "flow_type" },
        decision_outcome: { kind: "axis" as const, axisId: "decision_outcome" },
        scope_mode:       { kind: "axis" as const, axisId: "scope_mode" },
      },
      versions: [
        { version: "v1", axisVersions: { flow_type: "v1", decision_outcome: "v1", scope_mode: "v1" } },
      ],
    },
    escalation_event: {
      id: "escalation_event", name: "에스컬레이션 이벤트",
      description: "flow_type × escalation_type × cognitive_phase — 자동 판정 실패 → 인간 결정 요청",
      labels: ["flow_type", "escalation_type", "cognitive_phase"],
      meta: { category: "event" as const, layer: 2 as const, visualShape: "flat-tile" as const, detailKind: "event-def" as const },
      dims: {
        flow_type:       { kind: "axis" as const, axisId: "flow_type" },
        escalation_type: { kind: "axis" as const, axisId: "escalation_type" },
        cognitive_phase: { kind: "axis" as const, axisId: "cognitive_phase" },
      },
      versions: [
        { version: "v1", axisVersions: { flow_type: "v1", escalation_type: "v1", cognitive_phase: "v1" } },
      ],
    },
    model_apply: {
      id: "model_apply", name: "인지 모델 적용",
      description: "mental_model × reversibility × magnitude — 인지 프레임워크 적용 기록",
      labels: ["mental_model", "reversibility", "magnitude"],
      meta: { category: "observation" as const, layer: 1 as const, visualShape: "cube" as const, detailKind: "generic" as const },
      dims: {
        mental_model:  { kind: "axis" as const, axisId: "mental_model" },
        reversibility: { kind: "axis" as const, axisId: "reversibility" },
        magnitude:     { kind: "axis" as const, axisId: "magnitude" },
      },
      versions: [
        { version: "v1", axisVersions: { mental_model: "v1", reversibility: "v1", magnitude: "v1" } },
      ],
    },
    forcing_response: {
      id: "forcing_response", name: "강제 질문 응답",
      description: "forcing_question × evidence_kind × confidence_band — Forcing Question 응답 기록",
      labels: ["forcing_question", "evidence_kind", "confidence_band"],
      meta: { category: "event" as const, layer: 1 as const, visualShape: "flat-tile" as const, detailKind: "event-def" as const },
      dims: {
        forcing_question: { kind: "axis" as const, axisId: "forcing_question" },
        evidence_kind:    { kind: "axis" as const, axisId: "evidence_kind" },
        confidence_band:  { kind: "axis" as const, axisId: "confidence_band" },
      },
      versions: [
        { version: "v1", axisVersions: { forcing_question: "v1", evidence_kind: "v1", confidence_band: "v1" } },
      ],
    },

    // ── 하네스 상태 모델 prefix ──────────────────────────────────────────────
    harness_transition: {
      id: "harness_transition", name: "하네스 상태 전이",
      description: "svc_ref × harness_machine × harness_state × harness_trigger — 상태 머신 전이 추적",
      labels: ["svc_ref", "harness_machine", "harness_state", "harness_trigger"],
      meta: { category: "observation" as const, visualShape: "flat-tile" as const, heightRatio: 0.5, detailKind: "metric" as const },
      dims: {
        svc_ref:          { kind: "prefix_ref" as const, prefixId: "service" },
        harness_machine:  { kind: "axis" as const, axisId: "harness_machine" },
        harness_state:    { kind: "axis" as const, axisId: "harness_state" },
        harness_trigger:  { kind: "axis" as const, axisId: "harness_trigger" },
      },
      versions: [
        { version: "v1", axisVersions: { harness_machine: "v1", harness_state: "v1", harness_trigger: "v1" }, refEntries: { svc_ref: { values: _INFRA_SVC, refVersion: "v1" } } },
      ],
    },
    harness_guard: {
      id: "harness_guard", name: "하네스 가드 검증",
      description: "svc_ref × harness_machine × harness_state × harness_verdict — 머신 간 가드 의존성 검증 이력",
      labels: ["svc_ref", "harness_machine", "harness_state", "harness_verdict"],
      meta: { category: "observation" as const, visualShape: "flat-tile" as const, heightRatio: 0.5, detailKind: "metric" as const },
      dims: {
        svc_ref:          { kind: "prefix_ref" as const, prefixId: "service" },
        harness_machine:  { kind: "axis" as const, axisId: "harness_machine" },
        harness_state:    { kind: "axis" as const, axisId: "harness_state" },
        harness_verdict:  { kind: "axis" as const, axisId: "harness_verdict" },
      },
      versions: [
        { version: "v1", axisVersions: { harness_machine: "v1", harness_state: "v1", harness_verdict: "v1" }, refEntries: { svc_ref: { values: _INFRA_SVC, refVersion: "v1" } } },
      ],
    },
    harness_process_step: {
      id: "harness_process_step", name: "하네스 프로세스 스텝",
      description: "svc_ref × harness_process × harness_machine × harness_verdict — 명명된 프로세스 스텝 실행 이력",
      labels: ["svc_ref", "harness_process", "harness_machine", "harness_verdict"],
      meta: { category: "observation" as const, visualShape: "flat-tile" as const, heightRatio: 0.5, detailKind: "metric" as const },
      dims: {
        svc_ref:          { kind: "prefix_ref" as const, prefixId: "service" },
        harness_process:  { kind: "axis" as const, axisId: "harness_process" },
        harness_machine:  { kind: "axis" as const, axisId: "harness_machine" },
        harness_verdict:  { kind: "axis" as const, axisId: "harness_verdict" },
      },
      versions: [
        { version: "v1", axisVersions: { harness_process: "v1", harness_machine: "v1", harness_verdict: "v1" }, refEntries: { svc_ref: { values: _INFRA_SVC, refVersion: "v1" } } },
      ],
    },

    // ── 품질 관측 prefix ──────────────────────────────────────────────────────
    quality_event: {
      id: "quality_event", name: "품질 이벤트",
      description: "svc_ref × quality_severity × quality_kind — 오류/경고/정책위반 등 품질 관측",
      labels: ["svc_ref", "quality_severity", "quality_kind"],
      meta: { category: "observation" as const, visualShape: "flat-tile" as const, heightRatio: 0.5, detailKind: "metric" as const },
      dims: {
        svc_ref:          { kind: "prefix_ref" as const, prefixId: "service" },
        quality_severity: { kind: "axis" as const, axisId: "quality_severity" },
        quality_kind:     { kind: "axis" as const, axisId: "quality_kind" },
      },
      versions: [
        { version: "v1", axisVersions: { quality_severity: "v1", quality_kind: "v1" }, refEntries: { svc_ref: { values: _INFRA_SVC, refVersion: "v1" } } },
      ],
    },

    // ── 실행 관측 prefix ──────────────────────────────────────────────────────
    task_event: {
      id: "task_event", name: "작업 이벤트",
      description: "svc_ref × task_type × task_phase — 태스크/잡/크론 실행 생명주기 추적",
      labels: ["svc_ref", "task_type", "task_phase"],
      meta: { category: "observation" as const, visualShape: "flat-tile" as const, heightRatio: 0.5, detailKind: "metric" as const },
      dims: {
        svc_ref:    { kind: "prefix_ref" as const, prefixId: "service" },
        task_type:  { kind: "axis" as const, axisId: "task_type" },
        task_phase: { kind: "axis" as const, axisId: "task_phase" },
      },
      versions: [
        { version: "v1", axisVersions: { task_type: "v1", task_phase: "v1" }, refEntries: { svc_ref: { values: _INFRA_SVC, refVersion: "v1" } } },
      ],
    },

    // ── SDK 생명주기 prefix ───────────────────────────────────────────────────
    sdk_lifecycle: {
      id: "sdk_lifecycle", name: "SDK 생명주기",
      description: "svc_ref × sdk_action × sdk_channel — SDK 초기화/전송/재연결 추적",
      labels: ["svc_ref", "sdk_action", "sdk_channel"],
      meta: { category: "observation" as const, visualShape: "flat-tile" as const, heightRatio: 0.5, detailKind: "metric" as const },
      dims: {
        svc_ref:     { kind: "prefix_ref" as const, prefixId: "service" },
        sdk_action:  { kind: "axis" as const, axisId: "sdk_action" },
        sdk_channel: { kind: "axis" as const, axisId: "sdk_channel" },
      },
      versions: [
        { version: "v1", axisVersions: { sdk_action: "v1", sdk_channel: "v1" }, refEntries: { svc_ref: { values: _INFRA_SVC, refVersion: "v1" } } },
      ],
    },

    // ── RPC/WebSocket 관측 prefix ─────────────────────────────────────────────
    rpc_event: {
      id: "rpc_event", name: "RPC 이벤트",
      description: "svc_ref × rpc_protocol × rpc_phase — gRPC/WebSocket/HTTP2 통신 관측",
      labels: ["svc_ref", "rpc_protocol", "rpc_phase"],
      meta: { category: "observation" as const, visualShape: "flat-tile" as const, heightRatio: 0.5, detailKind: "metric" as const },
      dims: {
        svc_ref:      { kind: "prefix_ref" as const, prefixId: "service" },
        rpc_protocol: { kind: "axis" as const, axisId: "rpc_protocol" },
        rpc_phase:    { kind: "axis" as const, axisId: "rpc_phase" },
      },
      versions: [
        { version: "v1", axisVersions: { rpc_protocol: "v1", rpc_phase: "v1" }, refEntries: { svc_ref: { values: _INFRA_SVC, refVersion: "v1" } } },
      ],
    },

    // ── 게이트 런타임 prefix ──────────────────────────────────────────────────
    gate_execution: {
      id: "gate_execution", name: "게이트 실행",
      description: "svc_ref × gate_kind × gate_scope × gate_state — 품질 게이트 실행 상태 추적",
      labels: ["svc_ref", "gate_kind", "gate_scope", "gate_state"],
      meta: { category: "observation" as const, visualShape: "flat-tile" as const, heightRatio: 0.5, detailKind: "metric" as const },
      dims: {
        svc_ref:    { kind: "prefix_ref" as const, prefixId: "service" },
        gate_kind:  { kind: "axis" as const, axisId: "gate_kind" },
        gate_scope: { kind: "axis" as const, axisId: "gate_scope" },
        gate_state: { kind: "axis" as const, axisId: "gate_state" },
      },
      versions: [
        { version: "v1", axisVersions: { gate_kind: "v1", gate_scope: "v1", gate_state: "v1" }, refEntries: { svc_ref: { values: _INFRA_SVC, refVersion: "v1" } } },
      ],
    },
    bundle_observation: {
      id: "bundle_observation", name: "번들 관측",
      description: "svc_ref × bundle_state — anchor 문서의 번들 완성도 추적",
      labels: ["svc_ref", "bundle_state"],
      meta: { category: "observation" as const, visualShape: "flat-tile" as const, heightRatio: 0.5, detailKind: "metric" as const },
      dims: {
        svc_ref:      { kind: "prefix_ref" as const, prefixId: "service" },
        bundle_state: { kind: "axis" as const, axisId: "bundle_state" },
      },
      versions: [
        { version: "v1", axisVersions: { bundle_state: "v1" }, refEntries: { svc_ref: { values: _INFRA_SVC, refVersion: "v1" } } },
      ],
    },

    // ── 전이 엔진 prefix ──────────────────────────────────────────────────────
    transition_event: {
      id: "transition_event", name: "전이 이벤트",
      description: "svc_ref × effect_kind × match_mode — 좌표 전이 엔진 실행 추적",
      labels: ["svc_ref", "effect_kind", "match_mode"],
      meta: { category: "observation" as const, visualShape: "flat-tile" as const, heightRatio: 0.5, detailKind: "metric" as const },
      dims: {
        svc_ref:     { kind: "prefix_ref" as const, prefixId: "service" },
        effect_kind: { kind: "axis" as const, axisId: "effect_kind" },
        match_mode:  { kind: "axis" as const, axisId: "match_mode" },
      },
      versions: [
        { version: "v1", axisVersions: { effect_kind: "v1", match_mode: "v1" }, refEntries: { svc_ref: { values: _INFRA_SVC, refVersion: "v1" } } },
      ],
    },

    // ── 수렴 파이프라인 prefix ────────────────────────────────────────────────
    convergence_event: {
      id: "convergence_event", name: "수렴 파이프라인 이벤트",
      description: "svc_ref × convergence_phase × convergence_result — 수렴 분석 단계별 추적",
      labels: ["svc_ref", "convergence_phase", "convergence_result"],
      meta: { category: "observation" as const, visualShape: "flat-tile" as const, heightRatio: 0.5, detailKind: "metric" as const },
      dims: {
        svc_ref:             { kind: "prefix_ref" as const, prefixId: "service" },
        convergence_phase:   { kind: "axis" as const, axisId: "convergence_phase" },
        convergence_result:  { kind: "axis" as const, axisId: "convergence_result" },
      },
      versions: [
        { version: "v1", axisVersions: { convergence_phase: "v1", convergence_result: "v1" }, refEntries: { svc_ref: { values: _INFRA_SVC, refVersion: "v1" } } },
      ],
    },

    // ── 문서 그래프 관측 prefix ────────────────────────────────────────────────
    graph_event: {
      id: "graph_event", name: "그래프 이벤트",
      description: "svc_ref × def_level × graph_action × link_type — 문서 그래프 구조 변경 관측",
      labels: ["svc_ref", "def_level", "graph_action", "link_type"],
      meta: { category: "observation" as const, visualShape: "flat-tile" as const, heightRatio: 0.5, detailKind: "metric" as const },
      dims: {
        svc_ref:      { kind: "prefix_ref" as const, prefixId: "service" },
        def_level:    { kind: "axis" as const, axisId: "def_level" },
        graph_action: { kind: "axis" as const, axisId: "graph_action" },
        link_type:    { kind: "axis" as const, axisId: "link_type" },
      },
      versions: [
        { version: "v1", axisVersions: { def_level: "v1", graph_action: "v1", link_type: "v1" }, refEntries: { svc_ref: { values: _INFRA_SVC, refVersion: "v1" } } },
      ],
    },

    // ── 테스트 시나리오 prefix ─────────────────────────────────────────────────
    test_scenario: {
      id: "test_scenario", name: "테스트 시나리오",
      description: "스펙 의도와 연결된 테스트 시나리오 좌표",
      labels: ["test_kind", "test_scope", "test_phase"],
      meta: { category: "state" as const, layer: 2 as const, detailKind: "generic" as const },
      dims: {
        test_kind:  { kind: "axis" as const, axisId: "test_kind" },
        test_scope: { kind: "axis" as const, axisId: "test_scope" },
        test_phase:   { kind: "axis" as const, axisId: "test_phase" },
      },
      versions: [
        {
          version: "v1",
          axisVersions: {
            test_kind:  "v1",
            test_scope: "v1",
            test_phase:   "v1",
          },
        },
      ],
      addressModel: "product" as const,
    },

    // ── Meta-Semantic IR prefix ─────────────────────────────────────────

    ir_module: {
      id: "ir_module", name: "모듈 정의 관측",
      description: "def_level × def_layer × ir_certainty — 모듈 구조 + 타입 확신도",
      labels: ["def_level", "def_layer", "ir_certainty"],
      meta: { category: "observation" as const, visualShape: "cube" as const, heightRatio: 0.8, detailKind: "metric" as const },
      dims: {
        def_level:    { kind: "axis" as const, axisId: "def_level" },
        def_layer:    { kind: "axis" as const, axisId: "def_layer" },
        ir_certainty: { kind: "axis" as const, axisId: "ir_certainty" },
      },
      versions: [
        { version: "v1", axisVersions: { def_level: "v1", def_layer: "v1", ir_certainty: "v1" } },
      ],
    },
    ir_data: {
      id: "ir_data", name: "데이터 수명 관측",
      description: "ir_certainty × ir_transaction_scope × ir_retention × ir_storage_type — 데이터 4패싯",
      labels: ["ir_certainty", "ir_transaction_scope", "ir_retention", "ir_storage_type"],
      meta: { category: "state" as const, visualShape: "cube" as const, heightRatio: 0.8, detailKind: "metric" as const },
      dims: {
        ir_certainty:         { kind: "axis" as const, axisId: "ir_certainty" },
        ir_transaction_scope: { kind: "axis" as const, axisId: "ir_transaction_scope" },
        ir_retention:         { kind: "axis" as const, axisId: "ir_retention" },
        ir_storage_type:      { kind: "axis" as const, axisId: "ir_storage_type" },
      },
      versions: [
        { version: "v1", axisVersions: { ir_certainty: "v1", ir_transaction_scope: "v1", ir_retention: "v1", ir_storage_type: "v1" } },
      ],
    },
    ir_pipe: {
      id: "ir_pipe", name: "파이프 트랜잭션 관측",
      description: "svc_ref × ir_pipe_state × ir_call_kind — 서비스별 파이프 실행 상태",
      labels: ["svc_ref", "ir_pipe_state", "ir_call_kind"],
      meta: { category: "event" as const, visualShape: "flat-tile" as const, heightRatio: 0.6, detailKind: "event-def" as const },
      dims: {
        svc_ref:       { kind: "prefix_ref" as const, prefixId: "service" },
        ir_pipe_state: { kind: "axis" as const, axisId: "ir_pipe_state" },
        ir_call_kind:  { kind: "axis" as const, axisId: "ir_call_kind" },
      },
      versions: [
        { version: "v1", axisVersions: { ir_pipe_state: "v1", ir_call_kind: "v1" }, refEntries: { svc_ref: { values: _PERM_SVC, refVersion: "v1" } } },
      ],
    },
    ir_intent_path: {
      id: "ir_intent_path", name: "시공간 경로 관측",
      description: "svc_ref × ir_call_kind × ir_pipe_state — 경로별 실행 이력 (addressModel: sum)",
      labels: ["svc_ref", "ir_call_kind", "ir_pipe_state"],
      meta: { category: "observation" as const, visualShape: "flat-tile" as const, heightRatio: 0.6, detailKind: "generic" as const },
      dims: {
        svc_ref:       { kind: "prefix_ref" as const, prefixId: "service" },
        ir_call_kind:  { kind: "axis" as const, axisId: "ir_call_kind" },
        ir_pipe_state: { kind: "axis" as const, axisId: "ir_pipe_state" },
      },
      versions: [
        { version: "v1", axisVersions: { ir_call_kind: "v1", ir_pipe_state: "v1" }, refEntries: { svc_ref: { values: _PERM_SVC, refVersion: "v1" } } },
      ],
      addressModel: "sum" as const,
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
      referencedBy: [
        { prefixId: "deploy_event", dimLabel: "actor" },
        { prefixId: "cart_event", dimLabel: "actor" },
        { prefixId: "auth_event", dimLabel: "actor" },
        { prefixId: "order_event", dimLabel: "actor" },
      ],
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
      referencedBy: [
        { prefixId: "cart_event", dimLabel: "target" },
      ],
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
      referencedBy: [
        { prefixId: "order_event", dimLabel: "order" },
      ],
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

    // ── 수집 파이프라인 (PostgreSQL — @qa-sdk/store) ──────────────────────
    event_records: {
      table: "event_records",
      columns: {
        log_id:          { kind: "scalar", type: "string" },
        trace_id:        { kind: "table_ref", table: "traces" },
        record_kind:     { kind: "axis_ref", axisId: "record_type" },
        event_key:       { kind: "scalar", type: "string" },
        event_version:   { kind: "scalar", type: "string" },
        status_code:     { kind: "scalar", type: "string" },
        payload_format:  { kind: "scalar", type: "string" },
        address_context: { kind: "scalar", type: "json" },
        qa_session_id:   { kind: "scalar", type: "string" },
        actor_id:        { kind: "scalar", type: "string" },
      },
    },
    traces: {
      table: "traces",
      columns: {
        trace_id:      { kind: "scalar", type: "string" },
        session_id:    { kind: "table_ref", table: "qa_sessions" },
        service_name:  { kind: "axis_ref", axisId: "svc_name" },
        actor_id:      { kind: "scalar", type: "string" },
        record_count:  { kind: "scalar", type: "integer" },
        reconstructed: { kind: "scalar", type: "boolean" },
      },
    },
    qa_sessions: {
      table: "qa_sessions",
      columns: {
        session_id:  { kind: "scalar", type: "string" },
        scenario_id: { kind: "scalar", type: "string" },
        actor_id:    { kind: "scalar", type: "string" },
      },
    },
    transmissions: {
      table: "transmissions",
      columns: {
        transmission_id: { kind: "scalar", type: "string" },
        owner_type:      { kind: "scalar", type: "string" },
        owner_id:        { kind: "scalar", type: "string" },
        service_name:    { kind: "axis_ref", axisId: "svc_name" },
        env:             { kind: "axis_ref", axisId: "env" },
        record_count:    { kind: "scalar", type: "integer" },
      },
    },
    verdict_reports: {
      table: "verdict_reports",
      columns: {
        id:              { kind: "scalar", type: "string" },
        scenario_id:     { kind: "scalar", type: "string" },
        trace_id:        { kind: "table_ref", table: "traces" },
        qa_session_id:   { kind: "scalar", type: "string" },
        overall_verdict: { kind: "axis_ref", axisId: "verdict_result" },
        loop_detected:   { kind: "scalar", type: "boolean" },
        terminal_reason: { kind: "scalar", type: "string" },
      },
    },

    // ── 좌표 인프라 (SQLite — index-meta) ───────────────────────────────
    tbl_version_lifecycle: {
      table: "version_lifecycle",
      columns: {
        prefix:            { kind: "scalar", type: "string" },
        version_id:        { kind: "scalar", type: "string" },
        status:            { kind: "axis_ref", axisId: "version_lifecycle" },
        base_version_id:   { kind: "scalar", type: "string" },
        capacity:          { kind: "scalar", type: "integer" },
        deactivation_mode: { kind: "scalar", type: "string" },
      },
    },
    entry: {
      table: "entry",
      columns: {
        prefix:     { kind: "scalar", type: "string" },
        version_id: { kind: "scalar", type: "string" },
        position:   { kind: "scalar", type: "integer" },
        value:      { kind: "scalar", type: "string" },
      },
    },

    // ── DKG 자기참조 (SQLite — spec-core/store) ─────────────────────────
    dkg_nodes: {
      table: "dkg_nodes",
      columns: {
        id:     { kind: "scalar", type: "string" },
        kind:   { kind: "axis_ref", axisId: "dkg_target_kind" },
        source: { kind: "axis_ref", axisId: "node_source" },
        data:   { kind: "scalar", type: "json" },
      },
    },
    dkg_edges: {
      table: "dkg_edges",
      columns: {
        id:      { kind: "scalar", type: "integer" },
        type:    { kind: "axis_ref", axisId: "edge_type" },
        from_id: { kind: "scalar", type: "string" },
        to_id:   { kind: "scalar", type: "string" },
        source:  { kind: "axis_ref", axisId: "node_source" },
        meta:    { kind: "scalar", type: "json" },
      },
    },
    usage_snapshots: {
      table: "usage_snapshots",
      columns: {
        id:            { kind: "scalar", type: "integer" },
        total_records: { kind: "scalar", type: "integer" },
        data:          { kind: "scalar", type: "json" },
      },
    },
    version_usages: {
      table: "version_usages",
      columns: {
        id:          { kind: "scalar", type: "integer" },
        snapshot_id: { kind: "table_ref", table: "usage_snapshots" },
        prefix:      { kind: "scalar", type: "string" },
        version:     { kind: "scalar", type: "string" },
        count:       { kind: "scalar", type: "integer" },
        last_seen:   { kind: "scalar", type: "string" },
        sessions:    { kind: "scalar", type: "json" },
      },
    },
    transition_state: {
      table: "transition_state",
      columns: {
        context_id:  { kind: "scalar", type: "string" },
        resource_id: { kind: "scalar", type: "string" },
        axis:        { kind: "scalar", type: "string" },
        value:       { kind: "scalar", type: "string" },
      },
    },

    // ── 질의 서비스 (SQLite — query-service) ────────────────────────────
    policy_rule: {
      table: "policy_rule",
      columns: {
        id:           { kind: "scalar", type: "string" },
        index_id:     { kind: "scalar", type: "string" },
        version_id:   { kind: "scalar", type: "string" },
        pattern_json: { kind: "scalar", type: "json" },
        value_json:   { kind: "scalar", type: "json" },
        priority:     { kind: "scalar", type: "integer" },
        rule_set_id:  { kind: "scalar", type: "string" },
      },
    },
  },
} as const satisfies DemoCatalog;

/** 런타임 변경 방어 — API 경유 업데이트만 허용 */
function deepFreeze<T extends object>(obj: T): T {
  Object.freeze(obj);
  for (const val of Object.values(obj)) {
    if (val && typeof val === "object" && !Object.isFrozen(val)) {
      deepFreeze(val as object);
    }
  }
  return obj;
}
deepFreeze(DEMO_CATALOG as unknown as object);

// ── DEMO_CATALOG 파생 리터럴 타입 ───────────────────────────────────────────

/** DEMO_CATALOG의 prefix 이름 리터럴 유니온 (34개) */
export type DemoPrefixId = keyof typeof DEMO_CATALOG.prefixes & string;

/** DEMO_CATALOG의 axis 이름 리터럴 유니온 (67개) */
export type DemoAxisId = keyof typeof DEMO_CATALOG.axes & string;

/** DEMO_CATALOG의 table 이름 리터럴 유니온 */
export type DemoTableId = keyof NonNullable<typeof DEMO_CATALOG.tables> & string;
