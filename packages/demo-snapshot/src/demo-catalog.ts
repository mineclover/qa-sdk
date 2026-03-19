/**
 * demo-catalog.ts — Prefix 기반 통합 버전 관리 카탈로그 (SSOT).
 *
 * 모든 축(axis)과 주소 공간(prefix)을 하나의 구조체에 통합 관리한다.
 * 다른 demo-* 파일은 이 카탈로그에서 파생(derive)해야 하며,
 * 이 파일은 다른 demo-* 파일을 import하지 않는다.
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
//  DEMO_CATALOG — 전체 데이터 SSOT
// ══════════════════════════════════════════════════════════════════════════════

export const DEMO_CATALOG = {
  axes: {
    // ── 쇼핑 플랫폼 축 (demo-snapshot 통합) ────────────────────────────────
    env: {
      id: "env", name: "환경",
      versions: {
        v1: {
          entries: ["dev", "stage", "prod", "test", "local"],
          ko: { dev: "개발", stage: "스테이지", prod: "운영", test: "테스트", local: "로컬" },
        },
      },
    },
    region: {
      id: "region", name: "리전",
      versions: {
        v1: {
          entries: ["asia", "usa"],
          ko: { asia: "아시아", usa: "미국" },
        },
      },
    },
    svc_name: {
      id: "svc_name", name: "서비스명",
      versions: {
        v1: {
          entries: ["shopping-web", "shopping-backend", "auth", "payment", "gateway"],
          ko: { "shopping-web": "쇼핑웹", "shopping-backend": "쇼핑BE", auth: "인증", payment: "결제", gateway: "GW" },
        },
      },
    },
    namespace: {
      id: "namespace", name: "네임스페이스",
      versions: {
        v1: {
          entries: ["shop", "cms"],
          ko: { shop: "쇼핑몰", cms: "CMS" },
        },
      },
    },
    role: {
      id: "role", name: "역할",
      versions: {
        v1: {
          entries: ["admin", "developer", "operator", "viewer", "readonly"],
          capacity: 5,
          ko: { admin: "관리자", developer: "개발자", operator: "운영자", viewer: "뷰어", readonly: "읽기전용" },
        },
        v2: {
          entries: ["admin", "developer", "operator", "viewer", "readonly", "customer"],
          capacity: 6,
          ko: { admin: "관리자", developer: "개발자", operator: "운영자", viewer: "뷰어", readonly: "읽기전용", customer: "고객" },
        },
        v3: {
          entries: ["admin", "developer", "operator", "viewer", "readonly", "customer"],
          capacity: 8,
          ko: { admin: "관리자", developer: "개발자", operator: "운영자", viewer: "뷰어", readonly: "읽기전용", customer: "고객" },
        },
        v4: {
          entries: ["admin", "developer", "operator", "viewer", "readonly", "customer", "auditor"],
          capacity: 8,
          ko: { admin: "관리자", developer: "개발자", operator: "운영자", viewer: "뷰어", readonly: "읽기전용", customer: "고객", auditor: "감사자" },
        },
      },
    },
    event_name: {
      id: "event_name", name: "이벤트명",
      versions: {
        v1: {
          entries: ["user.login", "user.logout", "order.created", "order.paid", "payment.failed", "session.expired", "config.changed"],
          capacity: 7,
          ko: { "user.login": "로그인", "user.logout": "로그아웃", "order.created": "주문생성", "order.paid": "주문결제", "payment.failed": "결제실패", "session.expired": "세션만료", "config.changed": "설정변경" },
        },
        v2: {
          entries: ["user.login", "user.logout", "order.created", "order.paid", "payment.failed", "session.expired", "config.changed", "payment.cancel_requested", "payment.cancel_approved"],
          capacity: 9,
          ko: { "user.login": "로그인", "user.logout": "로그아웃", "order.created": "주문생성", "order.paid": "주문결제", "payment.failed": "결제실패", "session.expired": "세션만료", "config.changed": "설정변경", "payment.cancel_requested": "취소요청", "payment.cancel_approved": "취소승인" },
        },
        v3: {
          entries: ["user.login", "user.logout", "order.created", "order.paid", "payment.failed", "session.expired", "config.changed", "payment.cancel_requested", "payment.cancel_approved"],
          capacity: 12,
          ko: { "user.login": "로그인", "user.logout": "로그아웃", "order.created": "주문생성", "order.paid": "주문결제", "payment.failed": "결제실패", "session.expired": "세션만료", "config.changed": "설정변경", "payment.cancel_requested": "취소요청", "payment.cancel_approved": "취소승인" },
        },
        v4: {
          entries: ["user.login", "user.logout", "order.created", "order.paid", "payment.failed", "session.expired", "config.changed", "payment.cancel_requested", "payment.cancel_approved", "payment.refunded"],
          capacity: 12,
          ko: { "user.login": "로그인", "user.logout": "로그아웃", "order.created": "주문생성", "order.paid": "주문결제", "payment.failed": "결제실패", "session.expired": "세션만료", "config.changed": "설정변경", "payment.cancel_requested": "취소요청", "payment.cancel_approved": "취소승인", "payment.refunded": "환불완료" },
        },
      },
    },
    initiator: {
      id: "initiator", name: "발생 채널",
      versions: {
        v1: {
          entries: ["web", "mobile"],
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
          capacity: 8,
          ko: { admin: "관리자", editor: "편집자", viewer: "조회자" },
        },
      },
    },
    action: {
      id: "action", name: "액션",
      versions: {
        v1: {
          entries: ["read", "write", "delete", "admin"],
          capacity: 4,
          ko: { read: "읽기", write: "쓰기", delete: "삭제", admin: "관리" },
        },
      },
    },
    resource: {
      id: "resource", name: "리소스",
      versions: {
        v1: {
          entries: ["dashboard", "reports", "settings", "users"],
          capacity: 16,
          ko: { dashboard: "대시보드", reports: "리포트", settings: "설정", users: "사용자" },
        },
      },
    },
    tag: {
      id: "tag", name: "태그",
      versions: {
        v1: {
          entries: ["frontend", "backend", "devops", "ai", "database"],
          capacity: 10,
          ko: { frontend: "프론트엔드", backend: "백엔드", devops: "데브옵스", ai: "AI", database: "데이터베이스" },
        },
      },
    },
    category: {
      id: "category", name: "카테고리",
      versions: {
        v1: {
          entries: ["tech", "design", "product", "culture"],
          ko: { tech: "기술", design: "디자인", product: "제품", culture: "문화" },
        },
      },
    },
    status: {
      id: "status", name: "상태",
      versions: {
        v1: {
          entries: ["draft", "published", "archived"],
          ko: { draft: "초안", published: "발행", archived: "보관" },
        },
      },
    },
    locale: {
      id: "locale", name: "로케일",
      versions: {
        v1: {
          entries: ["ko", "en", "ja"],
          ko: { ko: "한국어", en: "영어", ja: "일본어" },
        },
      },
    },
    channel: {
      id: "channel", name: "채널",
      versions: {
        v1: {
          entries: ["web", "mobile"],
          ko: { web: "웹", mobile: "모바일" },
        },
      },
    },
    trackAction: {
      id: "trackAction", name: "행동",
      versions: {
        v1: {
          entries: ["click", "view", "scroll", "submit"],
          ko: { click: "클릭", view: "조회", scroll: "스크롤", submit: "제출" },
        },
      },
    },
    page: {
      id: "page", name: "페이지",
      versions: {
        v1: {
          entries: ["home", "product", "cart", "checkout"],
          ko: { home: "홈", product: "상품", cart: "장바구니", checkout: "결제" },
        },
      },
    },
    userType: {
      id: "userType", name: "사용자 유형",
      versions: {
        v1: {
          entries: ["guest", "member", "premium"],
          ko: { guest: "게스트", member: "회원", premium: "프리미엄" },
        },
      },
    },
    subjectKind: {
      id: "subjectKind", name: "주체 종류",
      versions: {
        v1: {
          entries: ["_", "user", "role", "group"],
          capacity: 8,
          ko: { _: "예약", user: "사용자", role: "역할", group: "그룹" },
        },
      },
    },
    predicate: {
      id: "predicate", name: "술어",
      versions: {
        v1: {
          entries: ["_", "has", "can_access", "belongs_to"],
          capacity: 16,
          ko: { _: "예약", has: "보유", can_access: "접근가능", belongs_to: "소속" },
        },
      },
    },
    objectKind: {
      id: "objectKind", name: "객체 종류",
      versions: {
        v1: {
          entries: ["_", "role", "permission", "group", "resource"],
          capacity: 16,
          ko: { _: "예약", role: "역할", permission: "권한", group: "그룹", resource: "리소스" },
        },
      },
    },

    // ── 이벤트 action 축 (table_ref 증명용) ────────────────────────────────
    cart_action: {
      id: "cart_action", name: "장바구니 행위",
      versions: {
        v1: {
          entries: ["add", "remove", "checkout"],
          ko: { add: "추가", remove: "제거", checkout: "결제" },
        },
      },
    },
    auth_action: {
      id: "auth_action", name: "인증 행위",
      versions: {
        v1: {
          entries: ["login", "logout", "token_refresh"],
          ko: { login: "로그인", logout: "로그아웃", token_refresh: "토큰갱신" },
        },
      },
    },
    order_action: {
      id: "order_action", name: "주문 행위",
      versions: {
        v1: {
          entries: ["create", "cancel", "refund", "complete"],
          capacity: 8,
          ko: { create: "생성", cancel: "취소", refund: "환불", complete: "완료" },
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
        { version: "v1", axisVersions: { role: "v1" }, refEntries: { perm_svc: { values: [40, 41, 42, 43, 44, 45, 46, 47, 48, 49], refVersion: "v1" } } },
        { version: "v2", axisVersions: { role: "v2" }, refEntries: { perm_svc: { values: [40, 41, 42, 43, 44, 45, 46, 47, 48, 49], refVersion: "v1" } } },
        { version: "v3", axisVersions: { role: "v3" }, refEntries: { perm_svc: { values: [40, 41, 42, 43, 44, 45, 46, 47, 48, 49], refVersion: "v1" } } },
        { version: "v4", axisVersions: { role: "v4" }, refEntries: { perm_svc: { values: [40, 41, 42, 43, 44, 45, 46, 47, 48, 49], refVersion: "v1" } } },
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
        { version: "v1", axisVersions: { event_name: "v1", initiator: "v1" }, refEntries: { evt_svc: { values: [0, 2, 4, 6, 8, 40, 42, 44, 46, 48], refVersion: "v1" } } },
        { version: "v2", axisVersions: { event_name: "v2", initiator: "v1" }, refEntries: { evt_svc: { values: [0, 2, 4, 6, 8, 40, 42, 44, 46, 48], refVersion: "v1" } } },
        { version: "v3", axisVersions: { event_name: "v3", initiator: "v1" }, refEntries: { evt_svc: { values: [0, 2, 4, 6, 8, 40, 42, 44, 46, 48], refVersion: "v1" } } },
        { version: "v4", axisVersions: { event_name: "v4", initiator: "v1" }, refEntries: { evt_svc: { values: [0, 2, 4, 6, 8, 40, 42, 44, 46, 48], refVersion: "v1" } } },
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
        { version: "v1", axisVersions: { action: "v1" }, refEntries: { service_ctx: { values: [40, 42, 44, 46, 48], refVersion: "v1" } } },
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
