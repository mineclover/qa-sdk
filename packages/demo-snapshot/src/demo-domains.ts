// @def.boundary platform-chain-system
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
 *
 * 모든 축/도메인 데이터는 DEMO_CATALOG(demo-catalog.ts)에서 파생됨.
 */

// ── DEMO_CATALOG 파생 축/도메인 ──────────────────────────────────────────────

export {
  // 축 타입 + 카탈로그
  AXIS,
  type AxisId,
  // 도메인 인스턴스
  DEMO_RBAC, DEMO_CONTENT, DEMO_TRACKING, DEMO_RELATIONAL,
  DEMO_DOMAINS, type DemoDomainId,
  // SchemaSnapshot
  buildDemoSchemaSnapshot,
  type AxisSnapshot, type DomainSnapshot, type SchemaSnapshot,
} from "./demo-compat.js";

// 타입 re-export (demo-catalog.ts에서 정의)
export type { Axis, Domain } from "./demo-catalog.js";

// ── 독립 데이터 (카탈로그 외) ────────────────────────────────────────────────

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

export const RELATIONAL_RESERVED = {
  NULL: "_",
  OTHER: "~",
} as const;

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
