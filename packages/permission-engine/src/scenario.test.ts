/**
 * scenario.test.ts — 실제 사용 시나리오 기반 실효성 검증.
 *
 * G-SHOP 플랫폼을 모델로, SDK 초기화 → 정책 정의 → 유저 권한 발급 →
 * 클라이언트 체크 → 직렬화/전송 → 복원의 전체 플로우를 검증한다.
 */

import { describe, it, expect } from "vitest";
import {
  PermissionCodec,
  type CodecDims,
  createServiceContext,
  createPermCodeFactory,
} from "./index.js";

// ═══════════════════════════════════════════════════════════════════════════
//  시나리오 1: G-SHOP API 게이트웨이 권한 체크
// ═══════════════════════════════════════════════════════════════════════════

describe("시나리오 1: API 게이트웨이", () => {
  // ── SDK 초기화 (앱 부트 시 1회) ──────────────────────────────────────

  const ctx = createServiceContext({
    namespace: "shop",
    name: "payment",
    env: "prod",
    region: "asia",
  });

  const perm = createPermCodeFactory(ctx);

  const DIMS: CodecDims = {
    services: ["shop/payment"],
    types: ["api"],
    resources: [
      "products",
      "orders",
      "payments",
      "payments/cancel",
      "payments/cancel/approve",
      "users",
      "config",
    ],
    actions: ["GET", "POST", "PUT", "DELETE"],
  };

  const codec = new PermissionCodec("v1", DIMS);

  // ── 역할별 정책 정의 (서버 부트 시) ──────────────────────────────────

  // admin: 전체 접근
  const adminMask = codec.createMask();
  for (const res of DIMS.resources) {
    for (const act of DIMS.actions) {
      codec.grantRaw(adminMask, "shop/payment", "api", res, act);
    }
  }

  // customer: 조회 + 취소 요청만
  const customerMask = codec.createMask();
  codec.grantRaw(customerMask, "shop/payment", "api", "products", "GET");
  codec.grantRaw(customerMask, "shop/payment", "api", "orders", "GET");
  codec.grantRaw(customerMask, "shop/payment", "api", "payments", "GET");
  codec.grantRaw(customerMask, "shop/payment", "api", "payments/cancel", "POST");

  // operator: 조회 + 취소 승인
  const operatorMask = codec.createMask();
  codec.grantRaw(operatorMask, "shop/payment", "api", "products", "GET");
  codec.grantRaw(operatorMask, "shop/payment", "api", "orders", "GET");
  codec.grantRaw(operatorMask, "shop/payment", "api", "payments", "GET");
  codec.grantRaw(operatorMask, "shop/payment", "api", "payments/cancel/approve", "POST");

  // ── 테스트 ──────────────────────────────────────────────────────────

  it("admin — 전체 접근", () => {
    expect(codec.countGrants(adminMask)).toBe(7 * 4); // 28
    expect(codec.checkRaw(adminMask, "shop/payment", "api", "config", "DELETE")).toBe(true);
    expect(codec.checkRaw(adminMask, "shop/payment", "api", "users", "PUT")).toBe(true);
  });

  it("customer — 조회 + 취소 요청만", () => {
    expect(codec.countGrants(customerMask)).toBe(4);

    // 허용
    expect(codec.checkRaw(customerMask, "shop/payment", "api", "products", "GET")).toBe(true);
    expect(codec.checkRaw(customerMask, "shop/payment", "api", "payments/cancel", "POST")).toBe(true);

    // 거부
    expect(codec.checkRaw(customerMask, "shop/payment", "api", "products", "DELETE")).toBe(false);
    expect(codec.checkRaw(customerMask, "shop/payment", "api", "users", "GET")).toBe(false);
    expect(codec.checkRaw(customerMask, "shop/payment", "api", "payments/cancel/approve", "POST")).toBe(false);
  });

  it("operator — 취소 승인 가능, 취소 요청 불가", () => {
    expect(codec.checkRaw(operatorMask, "shop/payment", "api", "payments/cancel/approve", "POST")).toBe(true);
    expect(codec.checkRaw(operatorMask, "shop/payment", "api", "payments/cancel", "POST")).toBe(false);
  });

  it("마스크 크기", () => {
    // 1 service × 1 type × 7 resources × 4 actions = 28 slots = 4 bytes
    expect(adminMask.length).toBe(4);
    expect(customerMask.length).toBe(4);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
//  시나리오 2: 클라이언트 SDK — JWT에서 마스크 수신 후 can() 체크
// ═══════════════════════════════════════════════════════════════════════════

describe("시나리오 2: 클라이언트 SDK (JWT mask)", () => {
  const DIMS: CodecDims = {
    services: ["shop/payment"],
    types: ["page"],
    resources: [
      "products",
      "orders",
      "payments",
      "payments/cancel",
      "users",
    ],
    actions: ["view", "edit", "create", "delete"],
  };

  const codec = new PermissionCodec("v1", DIMS);

  it("서버에서 마스크 생성 → 직렬화 → 클라이언트 복원 → 체크", () => {
    // ── 서버: 역할 기반으로 유저 마스크 생성 ──
    const userMask = codec.createMask();
    codec.grantTo(userMask, "shop/payment.page.products.view");
    codec.grantTo(userMask, "shop/payment.page.orders.view");
    codec.grantTo(userMask, "shop/payment.page.payments.view");
    codec.grantTo(userMask, "shop/payment.page.payments/cancel.create");

    // ── 서버 → 클라이언트: raw bytes 전송 (JWT claim 등) ──
    const bytes = new Uint8Array(userMask);
    // 실제로는 base64 인코딩해서 JWT에 담김
    expect(bytes.length).toBe(3); // 20 slots → 3 bytes

    // ── 클라이언트: 동일 codec 구성 후 마스크 복원 ──
    const clientMask = new Uint8Array(bytes);

    // ── 클라이언트: UI 렌더링 시 can() 체크 ──
    expect(codec.check(clientMask, "shop/payment.page.products.view")).toBe(true);
    expect(codec.check(clientMask, "shop/payment.page.payments/cancel.create")).toBe(true);
    expect(codec.check(clientMask, "shop/payment.page.users.view")).toBe(false);
    expect(codec.check(clientMask, "shop/payment.page.products.delete")).toBe(false);
  });

  it("빈 마스크 — 모든 권한 거부", () => {
    const emptyMask = codec.createMask();
    for (const res of DIMS.resources) {
      for (const act of DIMS.actions) {
        expect(codec.checkRaw(emptyMask, "shop/payment", "page", res, act)).toBe(false);
      }
    }
  });
});

// ═══════════════════════════════════════════════════════════════════════════
//  시나리오 3: 멀티서비스 — 여러 서비스의 권한을 하나의 코덱으로 관리
// ═══════════════════════════════════════════════════════════════════════════

describe("시나리오 3: 멀티서비스 통합 코덱", () => {
  const DIMS: CodecDims = {
    services: ["shop/payment", "shop/auth", "cms/portal"],
    types: ["api", "page"],
    resources: ["dashboard", "users", "settings"],
    actions: ["GET", "POST", "view", "edit"],
  };

  const codec = new PermissionCodec("v1", DIMS);

  it("서비스별 독립 권한", () => {
    const mask = codec.createMask();

    // shop/payment API만 허용
    codec.grantRaw(mask, "shop/payment", "api", "users", "GET");
    codec.grantRaw(mask, "shop/payment", "api", "users", "POST");

    // cms/portal page만 허용
    codec.grantRaw(mask, "cms/portal", "page", "dashboard", "view");

    // shop/payment API는 허용
    expect(codec.checkRaw(mask, "shop/payment", "api", "users", "GET")).toBe(true);

    // shop/auth API는 거부 (다른 서비스)
    expect(codec.checkRaw(mask, "shop/auth", "api", "users", "GET")).toBe(false);

    // cms/portal page는 허용
    expect(codec.checkRaw(mask, "cms/portal", "page", "dashboard", "view")).toBe(true);

    // cms/portal api는 거부 (다른 type)
    expect(codec.checkRaw(mask, "cms/portal", "api", "dashboard", "GET")).toBe(false);
  });

  it("전체 슬롯 크기", () => {
    // 3 services × 2 types × 3 resources × 4 actions = 72 slots = 9 bytes
    expect(codec.size).toBe(72);
    expect(codec.createMask().length).toBe(9);
  });

  it("listGrants — 부여된 권한만 추출", () => {
    const mask = codec.createMask();
    codec.grantTo(mask, "shop/payment.api.users.GET");
    codec.grantTo(mask, "cms/portal.page.settings.edit");

    const grants = codec.listGrants(mask);
    expect(grants).toHaveLength(2);
    expect(grants).toContain("shop/payment.api.users.GET");
    expect(grants).toContain("cms/portal.page.settings.edit");
  });

  it("서비스별 마스크 분리 발급 — 마이크로서비스 게이트웨이", () => {
    // 하나의 통합 코덱에서 서비스별로 다른 마스크 발급
    const paymentUser = codec.createMask();
    codec.grantRaw(paymentUser, "shop/payment", "api", "dashboard", "GET");
    codec.grantRaw(paymentUser, "shop/payment", "api", "users", "GET");

    const authAdmin = codec.createMask();
    codec.grantRaw(authAdmin, "shop/auth", "api", "users", "GET");
    codec.grantRaw(authAdmin, "shop/auth", "api", "users", "POST");
    codec.grantRaw(authAdmin, "shop/auth", "api", "settings", "GET");
    codec.grantRaw(authAdmin, "shop/auth", "api", "settings", "POST");

    // 각자의 서비스만 접근
    expect(codec.checkRaw(paymentUser, "shop/auth", "api", "users", "GET")).toBe(false);
    expect(codec.checkRaw(authAdmin, "shop/payment", "api", "dashboard", "GET")).toBe(false);

    // listGrantsDecoded로 서비스별 필터
    const authGrants = codec.listGrantsDecoded(authAdmin).filter(d => d.service === "shop/auth");
    expect(authGrants).toHaveLength(4);
    const payGrants = codec.listGrantsDecoded(authAdmin).filter(d => d.service === "shop/payment");
    expect(payGrants).toHaveLength(0);
  });

  it("cross-service 슈퍼어드민 — 전체 서비스 접근", () => {
    const superMask = codec.createMask();
    for (const svc of DIMS.services) {
      for (const type of DIMS.types) {
        for (const res of DIMS.resources) {
          for (const act of DIMS.actions) {
            codec.grantRaw(superMask, svc, type, res, act);
          }
        }
      }
    }
    expect(codec.countGrants(superMask)).toBe(72);

    // 모든 조합 허용
    expect(codec.checkRaw(superMask, "cms/portal", "page", "settings", "edit")).toBe(true);
    expect(codec.checkRaw(superMask, "shop/auth", "api", "dashboard", "POST")).toBe(true);
  });

  it("서비스 A 마스크 + 서비스 B 마스크 = 합집합 (유저에게 두 서비스 권한 동시 부여)", () => {
    const maskA = codec.createMask();
    codec.grantRaw(maskA, "shop/payment", "api", "dashboard", "GET");

    const maskB = codec.createMask();
    codec.grantRaw(maskB, "cms/portal", "page", "dashboard", "view");

    // OR 합성
    const combined = new Uint8Array(maskA.length);
    for (let i = 0; i < maskA.length; i++) combined[i] = maskA[i] | maskB[i];

    expect(codec.checkRaw(combined, "shop/payment", "api", "dashboard", "GET")).toBe(true);
    expect(codec.checkRaw(combined, "cms/portal", "page", "dashboard", "view")).toBe(true);
    expect(codec.countGrants(combined)).toBe(2);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
//  시나리오 4: 1D 주소 직렬화 — "perm:42" compact 전송
// ═══════════════════════════════════════════════════════════════════════════

describe("시나리오 4: 1D 주소 compact 전송", () => {
  const DIMS: CodecDims = {
    services: ["shop/payment"],
    types: ["api"],
    resources: ["products", "orders", "payments"],
    actions: ["GET", "POST"],
  };

  const codec = new PermissionCodec("v1", DIMS);

  it("text → 정수 → compact 직렬화 → 복원 → text", () => {
    const text = "shop/payment.api.orders.POST";

    // text → integer
    const addr = codec.encode(text);

    // integer → "perm:3" (버전 없이)
    const compact = `perm:${addr}`;

    // compact → integer
    const restored = codec.parse(compact);
    expect(restored).toBe(addr);

    // integer → text
    expect(codec.decodeToText(restored)).toBe(text);
  });

  it("개별 권한 이벤트 로그 — 정수 주소로 태깅", () => {
    // 로그에 text 대신 정수만 기록
    const addr = codec.encode("shop/payment.api.payments.GET");
    const logEntry = { ts: Date.now(), user: "u-42", perm: addr, ok: true };

    // 나중에 로그 조회 시 decode
    const decoded = codec.decode(logEntry.perm);
    expect(decoded.resource).toBe("payments");
    expect(decoded.action).toBe("GET");
  });

  it("전체 마스크 vs 개별 주소 크기 비교", () => {
    // 6 slots → 마스크 1 byte로 유저 전체 권한 표현
    expect(codec.createMask().length).toBe(1);

    // 개별 주소는 0~5 → 1 byte (varint)
    // 마스크 1장 = 개별 주소 6개 분량을 1 byte로 압축
    const mask = codec.createMask();
    codec.grantTo(mask, "shop/payment.api.products.GET");
    codec.grantTo(mask, "shop/payment.api.orders.GET");
    codec.grantTo(mask, "shop/payment.api.payments.GET");
    expect(codec.countGrants(mask)).toBe(3);
    expect(mask.length).toBe(1); // 3개 권한이 1 byte에 담김
  });
});

// ═══════════════════════════════════════════════════════════════════════════
//  시나리오 5: 역할 기반 정책 → 유저별 마스크 발급
// ═══════════════════════════════════════════════════════════════════════════

describe("시나리오 5: 역할 정책 → 유저 마스크 발급", () => {
  const DIMS: CodecDims = {
    services: ["shop/payment"],
    types: ["api", "page"],
    resources: ["products", "orders", "payments", "users", "config"],
    actions: ["GET", "POST", "view", "edit"],
  };

  const codec = new PermissionCodec("v1", DIMS);

  // 역할별 정책 (서버에서 관리)
  const rolePolicies: Record<string, string[]> = {
    admin: [
      "shop/payment.api.products.GET", "shop/payment.api.products.POST",
      "shop/payment.api.orders.GET", "shop/payment.api.orders.POST",
      "shop/payment.api.payments.GET", "shop/payment.api.payments.POST",
      "shop/payment.api.users.GET", "shop/payment.api.users.POST",
      "shop/payment.api.config.GET", "shop/payment.api.config.POST",
      "shop/payment.page.products.view", "shop/payment.page.products.edit",
      "shop/payment.page.orders.view",
      "shop/payment.page.users.view", "shop/payment.page.users.edit",
      "shop/payment.page.config.view", "shop/payment.page.config.edit",
    ],
    viewer: [
      "shop/payment.api.products.GET",
      "shop/payment.api.orders.GET",
      "shop/payment.page.products.view",
      "shop/payment.page.orders.view",
    ],
  };

  function issueMask(roles: string[]): Uint8Array {
    const mask = codec.createMask();
    for (const role of roles) {
      const perms = rolePolicies[role];
      if (perms) {
        for (const p of perms) codec.grantTo(mask, p);
      }
    }
    return mask;
  }

  it("admin 유저 — 전체 정책 적용", () => {
    const mask = issueMask(["admin"]);
    expect(codec.countGrants(mask)).toBe(17);
    expect(codec.check(mask, "shop/payment.api.config.POST")).toBe(true);
    expect(codec.check(mask, "shop/payment.page.users.edit")).toBe(true);
  });

  it("viewer 유저 — 조회만", () => {
    const mask = issueMask(["viewer"]);
    expect(codec.countGrants(mask)).toBe(4);
    expect(codec.check(mask, "shop/payment.api.products.GET")).toBe(true);
    expect(codec.check(mask, "shop/payment.api.products.POST")).toBe(false);
    expect(codec.check(mask, "shop/payment.page.config.view")).toBe(false);
  });

  it("복수 역할 — 합집합", () => {
    // viewer + admin = admin (admin이 viewer 권한 포함)
    const mask = issueMask(["viewer", "admin"]);
    expect(codec.countGrants(mask)).toBe(17);
  });

  it("마스크 크기 — 모든 역할 동일", () => {
    // 1 svc × 2 types × 5 res × 4 act = 40 slots = 5 bytes
    expect(issueMask(["admin"]).length).toBe(5);
    expect(issueMask(["viewer"]).length).toBe(5);
    expect(issueMask([]).length).toBe(5);
  });
});
