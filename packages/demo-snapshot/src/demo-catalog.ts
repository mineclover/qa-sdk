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
          capacity: 8,
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
          capacity: 32,
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
          capacity: 8,
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
          capacity: 16,
          ko: { claim: "선점", release: "해제", decide: "결정", observe: "관측", resolve: "해소", link: "연결", refresh: "재부트", "self-check": "자기진단", converge: "수렴", trace: "추적", promote: "승격" },
        },
      },
    },
    dkg_target_kind: {
      id: "dkg_target_kind", name: "DKG 대상 종류",
      versions: {
        v1: {
          entries: [
            "axis", "prefix", "domain", "dsl-bundle", "decision",
            "observation", "constraint", "skill", "intent-link", "system",
          ],
          capacity: 16,
          ko: { axis: "축", prefix: "프리픽스", domain: "도메인", "dsl-bundle": "DSL번들", decision: "결정", observation: "관측", constraint: "제약", skill: "스킬", "intent-link": "의도링크", system: "시스템" },
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
          capacity: 16,
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
          entries: ["dkg-graph", "dkg-skill", "convergence", "spec", "coordinate", "registry", "catalog", "self-ref", "system"],
          capacity: 16,
          ko: { "dkg-graph": "그래프", "dkg-skill": "스킬", convergence: "수렴분석", spec: "스펙", coordinate: "좌표", registry: "레지스트리", catalog: "카탈로그", "self-ref": "자기참조", system: "시스템" },
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
          ],
          capacity: 32,
          ko: { axis: "축", prefix: "프리픽스", domain: "도메인", "dsl-bundle": "DSL번들", decision: "결정", observation: "관측", constraint: "제약", skill: "스킬", "intent-link": "의도링크", system: "시스템", version: "버전", spec: "스펙", schema: "스키마", catalog: "카탈로그" },
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
          capacity: 8,
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
          capacity: 8,
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
  },

  prefixes: {
    service: {
      id: "service", name: "서비스",
      description: "env × region × svc_name × namespace 4차원 서비스 주소 공간",
      labels: ["env", "region", "svc_name", "namespace"],
      meta: { category: "entity", layer: 2, visualShape: "cube", heightRatio: 1, detailKind: "config", source: { module: "demo-snapshot", file: "demo-catalog.ts" } },
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
      meta: { category: "policy", layer: 1, visualShape: "thin-bar", heightRatio: 0.3, detailKind: "permission", source: { module: "permission-engine", file: "permission-set.ts" } },
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
      meta: { category: "event", layer: 1, visualShape: "cube", heightRatio: 0.8, detailKind: "generic", source: { module: "ingest-server" } },
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
      meta: { category: "policy", layer: 1, visualShape: "thin-bar", heightRatio: 0.3, detailKind: "permission", source: { module: "permission-engine", file: "permission-set.ts" } },
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
      meta: { category: "entity", layer: 1, visualShape: "cube", heightRatio: 1, detailKind: "generic" },
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
      meta: { category: "entity", layer: 0, visualShape: "cube", heightRatio: 1, detailKind: "generic", source: { module: "browser-sdk", file: "auto-capture.ts" } },
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
      meta: { category: "relation", layer: 1, visualShape: "sphere", heightRatio: 1, detailKind: "generic", source: { module: "spec-core", file: "dkg/dkg.types.ts" } },
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
      meta: { category: "observation", layer: 0, visualShape: "cube", heightRatio: 1, detailKind: "generic", source: { module: "demo-snapshot", file: "demo-catalog.ts" } },
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
      meta: { category: "observation", layer: 1, visualShape: "cube", heightRatio: 1, detailKind: "endpoint", source: { module: "ingest-server", file: "routes/ingest.ts" } },
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
      meta: { category: "observation", layer: 1, visualShape: "cube", heightRatio: 1, detailKind: "flow-step", source: { module: "spec-core", file: "dkg/flow-definition.ts" } },
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
      meta: { category: "event", layer: 1, visualShape: "flat-tile", heightRatio: 0.5, detailKind: "metric", source: { module: "engine", file: "matching/constraint-evaluator.ts" } },
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
      meta: { category: "event", layer: 2, visualShape: "flat-tile", heightRatio: 0.5, detailKind: "config", source: { module: "spec-core", file: "dkg/skills/infer-migrator.ts" } },
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
      meta: { category: "observation", layer: 2, visualShape: "cube", heightRatio: 1, detailKind: "metric", source: { module: "spec-core", file: "schema/schema-validation-codec.ts" } },
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
      meta: { category: "observation", layer: 2, visualShape: "cube", heightRatio: 1, detailKind: "metric", source: { module: "ingest-server", file: "lib/phase-two-worker.ts" } },
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
      meta: { category: "observation", layer: 2, visualShape: "flat-tile", heightRatio: 0.5, detailKind: "config", source: { module: "sdk", file: "masking.ts" } },
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
      meta: { category: "event", layer: 2, visualShape: "flat-tile", heightRatio: 0.5, detailKind: "event-def", source: { module: "spec-core", file: "dkg/bootstrap.ts" } },
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
      meta: { category: "event", layer: 2, visualShape: "flat-tile", heightRatio: 0.5, detailKind: "config", source: { module: "ingest-server" } },
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
      meta: { category: "event", layer: 1, visualShape: "flat-tile", heightRatio: 0.5, detailKind: "event-def", source: { module: "demo-snapshot", file: "demo-catalog.ts" } },
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
      meta: { category: "event", layer: 1, visualShape: "flat-tile", heightRatio: 0.5, detailKind: "event-def", source: { module: "demo-snapshot" } },
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
      meta: { category: "event", layer: 1, visualShape: "flat-tile", heightRatio: 0.5, detailKind: "event-def", source: { module: "demo-snapshot" } },
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
      meta: { category: "event", layer: 2, visualShape: "flat-tile", heightRatio: 0.5, detailKind: "metric" },
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
      meta: { category: "event", layer: 2, visualShape: "flat-tile", heightRatio: 0.5, detailKind: "metric" },
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
    },

    // ── 이벤트 패턴 분류 prefix (ADR-006) ────────────────────
    pattern_match: {
      id: "pattern_match", name: "패턴 매칭 결과",
      description: "svc_ref × identification_mode × behavior_pattern × pattern_confidence — 세션 패턴 분류 좌표",
      labels: ["svc_ref", "identification_mode", "behavior_pattern", "pattern_confidence"],
      meta: { category: "observation", layer: 2, visualShape: "cube", heightRatio: 1, detailKind: "metric", source: { module: "spec-core", file: "convergence/pattern-classifier.ts" } },
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
      meta: { category: "observation", layer: 2, visualShape: "sphere", heightRatio: 1.2, detailKind: "metric", source: { module: "spec-core", file: "convergence/pattern-anomaly.ts" } },
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
      meta: { category: "observation", layer: 2, visualShape: "flat-tile", heightRatio: 0.6, detailKind: "generic" },
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
      meta: { category: "observation", layer: 2, visualShape: "flat-tile", heightRatio: 0.6, detailKind: "generic" },
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
      meta: { category: "event", layer: 2, visualShape: "thin-bar", heightRatio: 0.8, detailKind: "event-def" },
      dims: {
        observation_intent: { kind: "axis", axisId: "observation_intent" },
        dkg_target_kind:    { kind: "axis", axisId: "dkg_target_kind" },
      },
      versions: [
        { version: "v1", axisVersions: { observation_intent: "v1", dkg_target_kind: "v1" } },
      ],
    },
    execution_context: {
      id: "execution_context", name: "실행 컨텍스트",
      description: "svc_ref × execution_mode — 어떤 서비스가 어떤 실행 모드에 있는가",
      labels: ["svc_ref", "execution_mode"],
      meta: { category: "entity", layer: 1, visualShape: "cube", heightRatio: 1, detailKind: "config" },
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
      meta: { category: "observation", layer: 1, visualShape: "column", heightRatio: 0.8, detailKind: "generic" },
      dims: {
        svc_ref:      { kind: "prefix_ref", prefixId: "service" },
        record_type:  { kind: "axis", axisId: "record_type" },
      },
      versions: [
        { version: "v1", axisVersions: { record_type: "v1" }, refEntries: { svc_ref: { values: _PERM_SVC, refVersion: "v1" } } },
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
