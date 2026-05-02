// @def.boundary validation-layer-group
// @def.doc validation-layer-group

/**
 * e2e-check.test.ts — 실제 권한 체크 시나리오 E2E 검증.
 *
 * G-SHOP 플랫폼을 모델로 서버 부트 → 정책 정의 → 유저 마스크 발급 →
 * 클라이언트 체크 → API 미들웨어 → ternary 상속의 전체 플로우를 시뮬레이션한다.
 */

import { describe, it, expect, beforeAll } from "vitest";
import {
  PermissionCodec,
  TernaryMask,
  ALLOW,
  DENY,
  UNSET,
  createServiceContext,
  createPermCodeFactory,
  type CodecDims,
  type PermCodeFactory,
} from "permission-engine";
import { hasBit, popcount } from "weighted-index";

// ═══════════════════════════════════════════════════════════════════════════
//  공통 인프라: G-SHOP 플랫폼 권한 스키마
// ═══════════════════════════════════════════════════════════════════════════

const SERVICE = "shop/backend";

const DIMS: CodecDims = {
  services: [SERVICE],
  types: ["api", "page"],
  resources: [
    "products",
    "products/detail",
    "orders",
    "orders/detail",
    "payments",
    "payments/cancel",
    "payments/cancel/approve",
    "users",
    "users/roles",
    "config",
  ],
  actions: ["GET", "POST", "PUT", "DELETE", "view", "edit", "create"],
};

// 역할 정의 — 서버 메모리 (DB 또는 설정 파일에서 로드)
interface RolePolicy {
  perms: string[]; // text 형태 permission code 목록
}

const ROLE_POLICIES: Record<string, RolePolicy> = {
  admin: {
    perms: [
      // API 전체
      ...DIMS.resources.flatMap(r => ["GET", "POST", "PUT", "DELETE"].map(a => `${SERVICE}.api.${r}.${a}`)),
      // page 전체
      ...DIMS.resources.flatMap(r => ["view", "edit", "create"].map(a => `${SERVICE}.page.${r}.${a}`)),
    ],
  },
  operator: {
    perms: [
      `${SERVICE}.api.products.GET`,
      `${SERVICE}.api.orders.GET`, `${SERVICE}.api.orders/detail.GET`,
      `${SERVICE}.api.payments.GET`,
      `${SERVICE}.api.payments/cancel/approve.POST`,
      `${SERVICE}.api.users.GET`,
      `${SERVICE}.page.products.view`,
      `${SERVICE}.page.orders.view`, `${SERVICE}.page.orders/detail.view`,
      `${SERVICE}.page.payments.view`,
      `${SERVICE}.page.payments/cancel/approve.view`, `${SERVICE}.page.payments/cancel/approve.edit`,
      `${SERVICE}.page.users.view`,
    ],
  },
  customer: {
    perms: [
      `${SERVICE}.api.products.GET`, `${SERVICE}.api.products/detail.GET`,
      `${SERVICE}.api.orders.GET`, `${SERVICE}.api.orders/detail.GET`,
      `${SERVICE}.api.payments.GET`,
      `${SERVICE}.api.payments/cancel.POST`,
      `${SERVICE}.page.products.view`, `${SERVICE}.page.products/detail.view`,
      `${SERVICE}.page.orders.view`, `${SERVICE}.page.orders/detail.view`,
      `${SERVICE}.page.payments.view`,
      `${SERVICE}.page.payments/cancel.view`, `${SERVICE}.page.payments/cancel.create`,
    ],
  },
  viewer: {
    perms: [
      `${SERVICE}.api.products.GET`, `${SERVICE}.api.products/detail.GET`,
      `${SERVICE}.api.orders.GET`,
      `${SERVICE}.page.products.view`, `${SERVICE}.page.products/detail.view`,
      `${SERVICE}.page.orders.view`,
    ],
  },
};

// ═══════════════════════════════════════════════════════════════════════════
//  헬퍼: 서버 사이드 로직
// ═══════════════════════════════════════════════════════════════════════════

let codec: PermissionCodec;

/** 역할 목록 → binary mask 발급. 서버에서 로그인 시 호출. */
function issueMask(roles: string[]): Uint8Array {
  const mask = codec.createMask();
  for (const role of roles) {
    const policy = ROLE_POLICIES[role];
    if (!policy) continue;
    for (const p of policy.perms) {
      try { codec.grantTo(mask, p); } catch { /* skip unknown perms */ }
    }
  }
  return mask;
}

/** API 미들웨어: 요청의 resource + action을 마스크로 검증. */
function apiMiddleware(
  userMask: Uint8Array,
  resource: string,
  action: string,
): { allowed: boolean; address: number; text: string } {
  const text = `${SERVICE}.api.${resource}.${action}`;
  const address = codec.encode(text);
  return {
    allowed: hasBit(userMask, address),
    address,
    text,
  };
}

/** 클라이언트 사이드: page 권한 체크. role 모름, mask만 사용. */
function canViewPage(userMask: Uint8Array, resource: string): boolean {
  return codec.checkRaw(userMask, SERVICE, "page", resource, "view");
}
function canEditPage(userMask: Uint8Array, resource: string): boolean {
  return codec.checkRaw(userMask, SERVICE, "page", resource, "edit");
}
function canCreatePage(userMask: Uint8Array, resource: string): boolean {
  return codec.checkRaw(userMask, SERVICE, "page", resource, "create");
}

// ═══════════════════════════════════════════════════════════════════════════
//  E2E 테스트
// ═══════════════════════════════════════════════════════════════════════════

describe("E2E: G-SHOP 권한 체크 플로우", () => {
  beforeAll(() => {
    codec = new PermissionCodec("v1", DIMS);
  });

  // ── 1. 마스크 발급 ──────────────────────────────────────────────────────

  describe("1. 유저 마스크 발급", () => {
    it("admin — 전체 권한", () => {
      const mask = issueMask(["admin"]);
      // 10 resources × (4 api + 3 page) = 70 but only valid combos counted
      expect(codec.countGrants(mask)).toBe(DIMS.resources.length * (4 + 3));
    });

    it("viewer — 조회 6개", () => {
      const mask = issueMask(["viewer"]);
      expect(codec.countGrants(mask)).toBe(6);
    });

    it("customer — 조회 + 취소 요청", () => {
      const mask = issueMask(["customer"]);
      expect(codec.countGrants(mask)).toBe(13);
    });

    it("역할 없는 유저 — 전체 거부", () => {
      const mask = issueMask([]);
      expect(codec.countGrants(mask)).toBe(0);
    });

    it("복수 역할 (viewer + customer) — 합집합", () => {
      const mask = issueMask(["viewer", "customer"]);
      // customer가 viewer 포함 + 추가 권한
      expect(codec.countGrants(mask)).toBe(13); // customer 13 ⊃ viewer 6
    });

    it("마스크 크기 — 모든 유저 동일", () => {
      const size = codec.createMask().length;
      // 1 svc × 2 types × 10 res × 7 actions = 140 slots → 18 bytes
      expect(size).toBe(18);
      expect(issueMask(["admin"]).length).toBe(size);
      expect(issueMask([]).length).toBe(size);
    });
  });

  // ── 2. API 미들웨어 ─────────────────────────────────────────────────────

  describe("2. API 미들웨어 시뮬레이션", () => {
    it("customer: 상품 조회 ✓, 상품 삭제 ✗", () => {
      const mask = issueMask(["customer"]);

      const r1 = apiMiddleware(mask, "products", "GET");
      expect(r1.allowed).toBe(true);

      const r2 = apiMiddleware(mask, "products", "DELETE");
      expect(r2.allowed).toBe(false);
    });

    it("customer: 취소 요청 ✓, 취소 승인 ✗", () => {
      const mask = issueMask(["customer"]);

      expect(apiMiddleware(mask, "payments/cancel", "POST").allowed).toBe(true);
      expect(apiMiddleware(mask, "payments/cancel/approve", "POST").allowed).toBe(false);
    });

    it("operator: 취소 승인 ✓, 취소 요청 ✗", () => {
      const mask = issueMask(["operator"]);

      expect(apiMiddleware(mask, "payments/cancel/approve", "POST").allowed).toBe(true);
      expect(apiMiddleware(mask, "payments/cancel", "POST").allowed).toBe(false);
    });

    it("admin: 설정 변경 ✓, config DELETE ✓", () => {
      const mask = issueMask(["admin"]);
      expect(apiMiddleware(mask, "config", "PUT").allowed).toBe(true);
      expect(apiMiddleware(mask, "config", "DELETE").allowed).toBe(true);
    });

    it("viewer: 사용자 관리 ✗, 역할 변경 ✗", () => {
      const mask = issueMask(["viewer"]);
      expect(apiMiddleware(mask, "users", "POST").allowed).toBe(false);
      expect(apiMiddleware(mask, "users/roles", "PUT").allowed).toBe(false);
    });

    it("미들웨어 결과에 address 포함 → 로그 태깅", () => {
      const mask = issueMask(["customer"]);
      const r = apiMiddleware(mask, "payments", "GET");

      // 정수 주소로 로그 기록
      const log = { perm: r.address, ok: r.allowed };
      expect(typeof log.perm).toBe("number");

      // 나중에 디코딩
      const decoded = codec.decode(log.perm);
      expect(decoded.resource).toBe("payments");
      expect(decoded.action).toBe("GET");
    });
  });

  // ── 3. 클라이언트 페이지 렌더링 ─────────────────────────────────────────

  describe("3. 클라이언트 페이지 렌더링 (role 모름)", () => {
    it("customer 마스크 → 메뉴 표시/숨김 결정", () => {
      const mask = issueMask(["customer"]);

      // 네비게이션 메뉴 렌더링
      const menu = [
        { label: "상품 목록", resource: "products", show: canViewPage(mask, "products") },
        { label: "주문 내역", resource: "orders", show: canViewPage(mask, "orders") },
        { label: "결제 내역", resource: "payments", show: canViewPage(mask, "payments") },
        { label: "취소 요청", resource: "payments/cancel", show: canViewPage(mask, "payments/cancel") },
        { label: "취소 승인", resource: "payments/cancel/approve", show: canViewPage(mask, "payments/cancel/approve") },
        { label: "사용자 관리", resource: "users", show: canViewPage(mask, "users") },
        { label: "설정", resource: "config", show: canViewPage(mask, "config") },
      ];

      const visible = menu.filter(m => m.show).map(m => m.label);
      expect(visible).toEqual([
        "상품 목록", "주문 내역", "결제 내역", "취소 요청",
      ]);

      // 취소 승인, 사용자 관리, 설정 숨김
      expect(menu.find(m => m.label === "취소 승인")!.show).toBe(false);
      expect(menu.find(m => m.label === "사용자 관리")!.show).toBe(false);
      expect(menu.find(m => m.label === "설정")!.show).toBe(false);
    });

    it("customer 마스크 → 버튼 활성/비활성", () => {
      const mask = issueMask(["customer"]);

      // 결제 상세 페이지의 버튼들
      const buttons = {
        cancelBtn: canCreatePage(mask, "payments/cancel"),     // 취소 요청 버튼
        approveBtn: canEditPage(mask, "payments/cancel/approve"), // 취소 승인 버튼
        editOrder: canEditPage(mask, "orders"),                  // 주문 수정 버튼
      };

      expect(buttons.cancelBtn).toBe(true);   // customer는 취소 요청 가능
      expect(buttons.approveBtn).toBe(false);  // 승인은 operator만
      expect(buttons.editOrder).toBe(false);   // 수정 권한 없음
    });

    it("operator 마스크 → 승인 버튼만 활성", () => {
      const mask = issueMask(["operator"]);

      expect(canViewPage(mask, "payments/cancel/approve")).toBe(true);
      expect(canEditPage(mask, "payments/cancel/approve")).toBe(true);
      expect(canCreatePage(mask, "payments/cancel")).toBe(false); // 요청은 customer만
    });

    it("빈 마스크 → 모든 페이지 숨김", () => {
      const mask = issueMask([]);
      for (const res of DIMS.resources) {
        expect(canViewPage(mask, res)).toBe(false);
      }
    });
  });

  // ── 4. 마스크 직렬화 + 전송 ─────────────────────────────────────────────

  describe("4. 마스크 직렬화 전송 사이클", () => {
    it("서버 발급 → base64 → 클라이언트 복원 → 동일 결과", () => {
      // 서버
      const serverMask = issueMask(["customer"]);
      const b64 = Buffer.from(serverMask).toString("base64");

      // 전송 (JWT claim, cookie, etc.)
      expect(typeof b64).toBe("string");
      expect(b64.length).toBeLessThan(30); // 18 bytes → ~24 chars base64

      // 클라이언트 복원
      const clientMask = new Uint8Array(Buffer.from(b64, "base64"));

      // 동일 결과 검증
      expect(codec.countGrants(clientMask)).toBe(codec.countGrants(serverMask));
      expect(codec.check(clientMask, `${SERVICE}.api.products.GET`)).toBe(true);
      expect(codec.check(clientMask, `${SERVICE}.api.users.POST`)).toBe(false);

      // byte-level 동일성
      expect(clientMask).toEqual(serverMask);
    });

    it("1D 주소 → perm:N 형태 전송 (개별 권한 이벤트)", () => {
      const addr = codec.encode(`${SERVICE}.api.payments/cancel.POST`);
      const serialized = `perm:${addr}`;

      // 수신 측 복원
      const restored = codec.parse(serialized);
      expect(codec.decodeToText(restored)).toBe(`${SERVICE}.api.payments/cancel.POST`);
    });
  });

  // ── 5. 권한 변경 감지 ───────────────────────────────────────────────────

  describe("5. 동적 권한 변경", () => {
    it("역할 승격: viewer → customer 전환 시 마스크 재발급", () => {
      const beforeMask = issueMask(["viewer"]);
      expect(codec.check(beforeMask, `${SERVICE}.api.payments/cancel.POST`)).toBe(false);

      // 역할 변경 → 재발급
      const afterMask = issueMask(["customer"]);
      expect(codec.check(afterMask, `${SERVICE}.api.payments/cancel.POST`)).toBe(true);

      // 신규 권한 목록 diff
      const before = new Set(codec.listGrants(beforeMask));
      const after = new Set(codec.listGrants(afterMask));
      const gained = [...after].filter(p => !before.has(p));
      const lost = [...before].filter(p => !after.has(p));

      expect(gained.length).toBeGreaterThan(0);
      expect(gained).toContain(`${SERVICE}.api.payments/cancel.POST`);
      expect(lost.length).toBe(0); // customer ⊃ viewer
    });

    it("임시 권한 부여: 기본 mask에 개별 grant 추가", () => {
      const mask = issueMask(["viewer"]);
      expect(codec.check(mask, `${SERVICE}.api.config.GET`)).toBe(false);

      // 임시 config 조회 권한 추가
      codec.grantTo(mask, `${SERVICE}.api.config.GET`);
      expect(codec.check(mask, `${SERVICE}.api.config.GET`)).toBe(true);

      // 다른 config 권한은 여전히 없음
      expect(codec.check(mask, `${SERVICE}.api.config.POST`)).toBe(false);
    });

    it("권한 회수: 특정 권한만 제거", () => {
      const mask = issueMask(["admin"]);
      expect(codec.check(mask, `${SERVICE}.api.config.DELETE`)).toBe(true);

      // config DELETE만 회수
      codec.revokeFrom(mask, `${SERVICE}.api.config.DELETE`);
      expect(codec.check(mask, `${SERVICE}.api.config.DELETE`)).toBe(false);
      expect(codec.check(mask, `${SERVICE}.api.config.GET`)).toBe(true); // 다른 건 유지
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════════
//  E2E: Ternary 마스크 조직 계층 상속
// ═══════════════════════════════════════════════════════════════════════════

describe("E2E: 조직 계층 권한 상속 (Ternary)", () => {
  let ternaryCodec: PermissionCodec;

  const TERNARY_DIMS: CodecDims = {
    services: ["saas/app"],
    types: ["api"],
    resources: ["billing", "reports", "admin/settings", "admin/users", "support/tickets"],
    actions: ["GET", "POST", "PUT", "DELETE"],
  };

  beforeAll(() => {
    ternaryCodec = new PermissionCodec("v1", TERNARY_DIMS);
  });

  function addr(resource: string, action: string): number {
    return ternaryCodec.encodeRaw("saas/app", "api", resource, action);
  }

  it("org default-allow + team deny + user override", () => {
    // ── Org 정책: 기본 전부 허용, admin/settings DELETE만 거부 ──
    const org = new TernaryMask(ternaryCodec.size);
    for (let i = 0; i < ternaryCodec.size; i++) org.allow(i);
    org.deny(addr("admin/settings", "DELETE"));

    // ── Engineering 팀: billing 접근 거부 ──
    const team = new TernaryMask(ternaryCodec.size);
    team.deny(addr("billing", "GET"));
    team.deny(addr("billing", "POST"));
    team.deny(addr("billing", "PUT"));
    team.deny(addr("billing", "DELETE"));

    // ── 개발자 Alice: support/tickets POST 추가 거부 ──
    const alice = new TernaryMask(ternaryCodec.size);
    alice.deny(addr("support/tickets", "POST"));

    // ── 계층 merge ──
    const teamResolved = TernaryMask.inherit(org, team);
    const aliceResolved = TernaryMask.inherit(teamResolved, alice);

    // ── 최종 binary mask 발급 ──
    const aliceMask = aliceResolved.toBinaryMask("deny");

    // Alice 권한 체크
    expect(hasBit(aliceMask, addr("reports", "GET"))).toBe(true);       // org allow 상속
    expect(hasBit(aliceMask, addr("reports", "POST"))).toBe(true);      // org allow 상속
    expect(hasBit(aliceMask, addr("billing", "GET"))).toBe(false);      // team deny
    expect(hasBit(aliceMask, addr("admin/settings", "DELETE"))).toBe(false); // org deny
    expect(hasBit(aliceMask, addr("admin/settings", "GET"))).toBe(true);     // org allow
    expect(hasBit(aliceMask, addr("support/tickets", "POST"))).toBe(false);  // alice deny
    expect(hasBit(aliceMask, addr("support/tickets", "GET"))).toBe(true);    // org allow 상속

    // 최종 크기
    expect(aliceMask.length).toBe(Math.ceil(ternaryCodec.size / 8));
  });

  it("Sales 팀 Bob — billing 접근 가능, admin 접근 불가", () => {
    const org = new TernaryMask(ternaryCodec.size);
    for (let i = 0; i < ternaryCodec.size; i++) org.allow(i);
    org.deny(addr("admin/settings", "DELETE"));

    // Sales 팀: admin 전체 거부
    const salesTeam = new TernaryMask(ternaryCodec.size);
    salesTeam.deny(addr("admin/settings", "GET"));
    salesTeam.deny(addr("admin/settings", "POST"));
    salesTeam.deny(addr("admin/settings", "PUT"));
    salesTeam.deny(addr("admin/settings", "DELETE"));
    salesTeam.deny(addr("admin/users", "GET"));
    salesTeam.deny(addr("admin/users", "POST"));
    salesTeam.deny(addr("admin/users", "PUT"));
    salesTeam.deny(addr("admin/users", "DELETE"));

    const bob = new TernaryMask(ternaryCodec.size); // UNSET → 팀 상속

    const bobResolved = TernaryMask.inherit(
      TernaryMask.inherit(org, salesTeam),
      bob,
    );
    const bobMask = bobResolved.toBinaryMask("deny");

    // Bob: billing ✓, admin ✗
    expect(hasBit(bobMask, addr("billing", "GET"))).toBe(true);
    expect(hasBit(bobMask, addr("billing", "POST"))).toBe(true);
    expect(hasBit(bobMask, addr("admin/settings", "GET"))).toBe(false);
    expect(hasBit(bobMask, addr("admin/users", "POST"))).toBe(false);
    expect(hasBit(bobMask, addr("reports", "GET"))).toBe(true);
  });

  it("ternary → binary 전송 크기 비교", () => {
    const ternary = new TernaryMask(ternaryCodec.size);
    // ternary: allow mask + deny mask = 2 × ceil(20/8) = 2 × 3 = 6 bytes
    expect(ternary.allowMask.length + ternary.denyMask.length).toBe(6);

    // binary: ceil(20/8) = 3 bytes
    const binary = ternary.toBinaryMask();
    expect(binary.length).toBe(3);

    // 서버에서는 ternary(6B), 클라이언트에는 binary(3B)만 전송
  });

  it("default-deny 패턴: 최소 권한 원칙", () => {
    // org: 아무것도 안 줌 (전부 UNSET)
    const org = new TernaryMask(ternaryCodec.size);

    // team: reports GET만 허용
    const team = new TernaryMask(ternaryCodec.size);
    team.allow(addr("reports", "GET"));

    // user: 추가 없음
    const user = new TernaryMask(ternaryCodec.size);

    const resolved = TernaryMask.inherit(
      TernaryMask.inherit(org, team),
      user,
    );
    const mask = resolved.toBinaryMask("deny"); // default-deny

    // reports GET만 허용, 나머지 전부 거부
    expect(hasBit(mask, addr("reports", "GET"))).toBe(true);
    expect(popcount(mask)).toBe(1);
  });
});
