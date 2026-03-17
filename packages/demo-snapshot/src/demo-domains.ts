/**
 * demo-domains.ts — 1차원 축(Axis) 기반 데이터 카탈로그.
 *
 * 모든 데이터의 기본 단위는 1차원 축(Axis)이다.
 * 각 축은 독립적인 엔트리 집합이며, 도메인은 축의 조합이다.
 *
 *   Axis("role") × Axis("action") × Axis("resource") → Domain("rbac")
 *
 * 개별 패키지는 필요한 축만 가져가서 자유롭게 조합할 수 있다.
 *
 *   import { AXIS } from "demo-snapshot";
 *   const myIndex = new WeightedIndex([
 *     AXIS.role.entries.length,
 *     AXIS.action.entries.length,
 *   ]);
 */

// ── 축(Axis) 타입 ───────────────────────────────────────────────────────────

/** 1차원 축. 순서가 1-based position이 된다. */
export interface Axis<T extends string = string> {
  /** 축 식별자. */
  readonly id: string;
  /** 한국어 축 이름. */
  readonly name: string;
  /** 엔트리 배열. 인덱스+1 = position. */
  readonly entries: readonly T[];
  /** 사전 할당 용량. 미지정 시 entries.length. */
  readonly capacity?: number;
  /** 엔트리별 한국어 라벨. */
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
//  개별 축 정의
// ══════════════════════════════════════════════════════════════════════════════

// ── RBAC 축 ──────────────────────────────────────────────────────────────────

const role: Axis = {
  id: "role", name: "역할",
  entries: ["admin", "editor", "viewer"],
  capacity: 8,
  ko: { admin: "관리자", editor: "편집자", viewer: "조회자" },
};

const action: Axis = {
  id: "action", name: "액션",
  entries: ["read", "write", "delete", "admin"],
  capacity: 4,
  ko: { read: "읽기", write: "쓰기", delete: "삭제", admin: "관리" },
};

const resource: Axis = {
  id: "resource", name: "리소스",
  entries: ["dashboard", "reports", "settings", "users"],
  capacity: 16,
  ko: { dashboard: "대시보드", reports: "리포트", settings: "설정", users: "사용자" },
};

// ── Content 축 ───────────────────────────────────────────────────────────────

const tag: Axis = {
  id: "tag", name: "태그",
  entries: ["frontend", "backend", "devops", "ai", "database"],
  capacity: 10,
  ko: { frontend: "프론트엔드", backend: "백엔드", devops: "데브옵스", ai: "AI", database: "데이터베이스" },
};

const category: Axis = {
  id: "category", name: "카테고리",
  entries: ["tech", "design", "product", "culture"],
  ko: { tech: "기술", design: "디자인", product: "제품", culture: "문화" },
};

const status: Axis = {
  id: "status", name: "상태",
  entries: ["draft", "published", "archived"],
  ko: { draft: "초안", published: "발행", archived: "보관" },
};

const locale: Axis = {
  id: "locale", name: "로케일",
  entries: ["ko", "en", "ja"],
  ko: { ko: "한국어", en: "영어", ja: "일본어" },
};

const channel: Axis = {
  id: "channel", name: "채널",
  entries: ["web", "mobile"],
  ko: { web: "웹", mobile: "모바일" },
};

// ── Tracking 축 ──────────────────────────────────────────────────────────────

const trackAction: Axis = {
  id: "trackAction", name: "행동",
  entries: ["click", "view", "scroll", "submit"],
  ko: { click: "클릭", view: "조회", scroll: "스크롤", submit: "제출" },
};

const page: Axis = {
  id: "page", name: "페이지",
  entries: ["home", "product", "cart", "checkout"],
  ko: { home: "홈", product: "상품", cart: "장바구니", checkout: "결제" },
};

const userType: Axis = {
  id: "userType", name: "사용자 유형",
  entries: ["guest", "member", "premium"],
  ko: { guest: "게스트", member: "회원", premium: "프리미엄" },
};

// ── Relational 축 ────────────────────────────────────────────────────────────

const subjectKind: Axis = {
  id: "subjectKind", name: "주체 종류",
  entries: ["_", "user", "role", "group"],
  capacity: 8,
  ko: { _: "예약", user: "사용자", role: "역할", group: "그룹" },
};

const predicate: Axis = {
  id: "predicate", name: "술어",
  entries: ["_", "has", "can_access", "belongs_to"],
  capacity: 16,
  ko: { _: "예약", has: "보유", can_access: "접근가능", belongs_to: "소속" },
};

const objectKind: Axis = {
  id: "objectKind", name: "객체 종류",
  entries: ["_", "role", "permission", "group", "resource"],
  capacity: 16,
  ko: { _: "예약", role: "역할", permission: "권한", group: "그룹", resource: "리소스" },
};

// ══════════════════════════════════════════════════════════════════════════════
//  축 카탈로그 — 개별 축을 바로 가져갈 수 있는 단일 객체
// ══════════════════════════════════════════════════════════════════════════════

/**
 * 전체 축 카탈로그.
 *
 * @example
 * ```ts
 * import { AXIS } from "demo-snapshot";
 *
 * AXIS.role.entries  // ["admin", "editor", "viewer"]
 * AXIS.tag.capacity  // 10
 *
 * // WeightedIndex와 조합
 * const wi = new WeightedIndex([
 *   AXIS.role.entries.length,
 *   AXIS.action.entries.length,
 * ]);
 * ```
 */
export const AXIS = {
  // RBAC
  role, action, resource,
  // Content
  tag, category, status, locale, channel,
  // Tracking
  trackAction, page, userType,
  // Relational
  subjectKind, predicate, objectKind,
} as const;

export type AxisId = keyof typeof AXIS;

// ══════════════════════════════════════════════════════════════════════════════
//  도메인 = 축의 조합
// ══════════════════════════════════════════════════════════════════════════════

export const DEMO_RBAC: Domain<{ role: Axis; action: Axis; resource: Axis }> = {
  id: "rbac",
  name: "역할 기반 접근 제어",
  description: "role × action × resource 3차원 권한 모델.",
  axes: { role, action, resource },
};

export const DEMO_CONTENT: Domain<{ tag: Axis; category: Axis; status: Axis; locale: Axis; channel: Axis }> = {
  id: "content",
  name: "콘텐츠 플랫폼",
  description: "tag(1D) + article(category × status × locale) + feed(article_ref × channel).",
  axes: { tag, category, status, locale, channel },
};

export const DEMO_TRACKING: Domain<{ trackAction: Axis; page: Axis; userType: Axis }> = {
  id: "tracking",
  name: "사용자 행동 추적",
  description: "action × page × userType 3차원 이벤트 추적.",
  axes: { trackAction, page, userType },
};

export const DEMO_RELATIONAL: Domain<{ subjectKind: Axis; predicate: Axis; objectKind: Axis }> = {
  id: "relational",
  name: "관계 모델",
  description: "subject_kind × predicate × object_kind 관계 인덱스.",
  axes: { subjectKind, predicate, objectKind },
};

// ── 정책 규칙 ────────────────────────────────────────────────────────────────

export interface RbacPolicyRule {
  readonly pattern: readonly (string | null)[];
  readonly value: "allow" | "deny";
  readonly priority: number;
}

export const DEMO_RBAC_POLICIES: readonly RbacPolicyRule[] = [
  { pattern: [null, null, null],  value: "deny",  priority: 1 },
  { pattern: ["1", null, null],   value: "allow", priority: 10 },
  { pattern: [null, "1", null],   value: "allow", priority: 5 },
];

// ── 관계 예약 토큰 ───────────────────────────────────────────────────────────

export const RELATIONAL_RESERVED = {
  NULL: "_",
  OTHER: "~",
} as const;

// ── 쇼핑 서비스 컨텍스트 ─────────────────────────────────────────────────────

export interface ShoppingServiceContext {
  readonly id: string;
  readonly name: string;
  readonly resources: readonly string[];
  readonly actions: readonly string[];
}

export const DEMO_SHOPPING_SERVICES: readonly ShoppingServiceContext[] = [
  {
    id: "shop/payment", name: "결제 서비스",
    resources: ["products", "orders", "payments", "payments/cancel", "payments/cancel/approve", "users", "config"],
    actions: ["GET", "POST", "PUT", "DELETE"],
  },
  {
    id: "shop/backend", name: "쇼핑 백엔드",
    resources: ["products", "products/detail", "orders", "orders/detail", "payments", "users", "config"],
    actions: ["GET", "POST", "PUT", "DELETE", "view", "edit", "create"],
  },
  {
    id: "cms/auth", name: "인증 서비스",
    resources: ["admin/teams", "admin/users", "billing/invoices"],
    actions: ["GET", "POST", "PUT", "DELETE"],
  },
];

// ── 도메인 카탈로그 ──────────────────────────────────────────────────────────

export const DEMO_DOMAINS = {
  rbac: DEMO_RBAC,
  content: DEMO_CONTENT,
  tracking: DEMO_TRACKING,
  relational: DEMO_RELATIONAL,
} as const;

export type DemoDomainId = keyof typeof DEMO_DOMAINS;
