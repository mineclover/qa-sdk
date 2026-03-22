import { describe, it, expect } from "vitest";
import {
  DEMO_CATALOG,
  getPrefixStructure, getPrefixShape, getPrefixEntries,
  encodePrefix, decodePrefix, encodePrefixByValue,
  resolveAddress, decomposeAddress, verifyRoundTrip,
  type ColumnRef, type TableSchema,
} from "./index.js";

// ══════════════════════════════════════════════════════════════════════════════
//  이벤트 스키마 증명: prefix로 관계(이벤트)를 정의할 수 있는가?
// ══════════════════════════════════════════════════════════════════════════════

describe("이벤트 = 관계 정의 (3-slot: actor × action × target)", () => {

  // ── cart_event: svc_ref × table_ref(actor) × axis(action) × table_ref(target) ──

  describe("cart_event — 기본 이벤트 prefix", () => {
    it("구조: 4개 label, svc_ref(prefix_ref) + table_ref 2개 + axis 1개", () => {
      const s = getPrefixStructure(DEMO_CATALOG, "cart_event");
      expect(s.labels).toEqual(["svc_ref", "actor", "action", "target"]);
      expect(s.dims.svc_ref).toEqual({ kind: "prefix_ref", prefixId: "service" });
      expect(s.dims.actor).toEqual({ kind: "table_ref", table: "members" });
      expect(s.dims.action).toEqual({ kind: "axis", axisId: "cart_action" });
      expect(s.dims.target).toEqual({ kind: "table_ref", table: "items" });
    });

    it("shape: table_ref는 제외, axis만 인코딩 (SSOT 파생)", () => {
      const shape = getPrefixShape(DEMO_CATALOG, "cart_event", "v1");
      // cart_action capacity에서 파생
      const cartCap = DEMO_CATALOG.axes.cart_action.versions.v1.capacity ?? DEMO_CATALOG.axes.cart_action.versions.v1.entries.length;
      expect(shape.shape).toEqual([cartCap]);
      expect(shape.capacity).toBe(cartCap);
    });

    it("encode/decode: action만 좌표에 인코딩", () => {
      // "add" = position 0
      const addr = encodePrefix(DEMO_CATALOG, "cart_event", "v1", { action: 0 });
      expect(addr).toBe(0);

      // "checkout" = position 2
      const addr2 = encodePrefix(DEMO_CATALOG, "cart_event", "v1", { action: 2 });
      expect(addr2).toBe(2);

      // decode: 좌표에서 action만 복원
      const decoded = decodePrefix(DEMO_CATALOG, "cart_event", "v1", 1);
      expect(decoded.action.value).toBe("remove");
      // table_ref 차원(actor, target)은 decode 결과에 없음
      expect(decoded.actor).toBeUndefined();
      expect(decoded.target).toBeUndefined();
    });

    it("encodePrefixByValue: action 의미값으로 인코딩 → decode 라운드트립", () => {
      const addr = encodePrefixByValue(DEMO_CATALOG, "cart_event", "v1", { action: "checkout" });
      const decoded = decodePrefix(DEMO_CATALOG, "cart_event", "v1", addr);
      expect(decoded.action.value).toBe("checkout");
    });

    it("resolveAddress: action의 ko까지 해석", () => {
      const r = resolveAddress(DEMO_CATALOG, "cart_event", "v1", 0);
      expect(r.dims.action.value).toBe("add");
      expect(r.dims.action.ko).toBe("추가");
      // table_ref 차원은 resolve에 포함되지 않음
      expect(r.dims.actor).toBeUndefined();
      expect(r.dims.target).toBeUndefined();
    });

    it("라운드트립: 전 범위 정합", () => {
      const result = verifyRoundTrip(DEMO_CATALOG, "cart_event", "v1");
      expect(result.valid).toBe(true);
    });

    it("entries: axis만 반환, table_ref는 제외", () => {
      const e = getPrefixEntries(DEMO_CATALOG, "cart_event", "v1");
      expect(e.entries.action).toEqual(["add", "remove", "checkout"]);
      expect(e.ko.action).toBeDefined();
      // table_ref는 entries에 없음
      expect(e.entries.actor).toBeUndefined();
      expect(e.entries.target).toBeUndefined();
    });
  });

  // ── auth_event: 단항 이벤트 (actor만, target 없음) ────────────────────

  describe("auth_event — 단항 이벤트 (actor + action)", () => {
    it("shape: axis(auth_action) 만 (SSOT 파생)", () => {
      const shape = getPrefixShape(DEMO_CATALOG, "auth_event", "v1");
      const authCap = DEMO_CATALOG.axes.auth_action.versions.v1.capacity ?? DEMO_CATALOG.axes.auth_action.versions.v1.entries.length;
      expect(shape.shape).toEqual([authCap]);
    });

    it("encode/decode 라운드트립", () => {
      const addr = encodePrefixByValue(DEMO_CATALOG, "auth_event", "v1", { action: "logout" });
      const decoded = decodePrefix(DEMO_CATALOG, "auth_event", "v1", addr);
      expect(decoded.action.value).toBe("logout");
    });

    it("라운드트립 전 범위", () => {
      const result = verifyRoundTrip(DEMO_CATALOG, "auth_event", "v1");
      expect(result.valid).toBe(true);
    });
  });

  // ── order_event: 다항 + prefix_ref 컨텍스트 ──────────────────────────

  describe("order_event — 다항 이벤트 (prefix_ref + table_ref + axis)", () => {
    it("구조: service_ctx(prefix_ref) + actor(table_ref) + action(axis) + order(table_ref)", () => {
      const s = getPrefixStructure(DEMO_CATALOG, "order_event");
      expect(s.labels).toEqual(["service_ctx", "actor", "action", "order"]);
      expect(s.dims.service_ctx).toEqual({ kind: "prefix_ref", prefixId: "service" });
      expect(s.dims.actor).toEqual({ kind: "table_ref", table: "members" });
      expect(s.dims.action).toEqual({ kind: "axis", axisId: "order_action" });
      expect(s.dims.order).toEqual({ kind: "table_ref", table: "orders" });
    });

    it("shape: prefix_ref + axis만 인코딩, table_ref 제외 (SSOT 파생)", () => {
      const shape = getPrefixShape(DEMO_CATALOG, "order_event", "v1");
      expect(shape.shape.length).toBe(2); // service_ctx + action
      expect(shape.capacity).toBe(shape.shape.reduce((a: number, b: number) => a * b, 1));
    });

    it("encode/decode 라운드트립 (SSOT 파생)", () => {
      const addr = encodePrefix(DEMO_CATALOG, "order_event", "v1", { service_ctx: 0, action: 0 });
      expect(addr).toBe(0);

      // service_ctx pos=2, action pos=1 → SSOT에서 stride 파생
      const shape = getPrefixShape(DEMO_CATALOG, "order_event", "v1");
      const actionCap = shape.shape[1]; // action 차원의 capacity
      const addr2 = encodePrefix(DEMO_CATALOG, "order_event", "v1", { service_ctx: 2, action: 1 });
      expect(addr2).toBe(2 * actionCap + 1);

      const decoded = decodePrefix(DEMO_CATALOG, "order_event", "v1", addr2);
      expect(decoded.action.value).toBe("cancel");
      expect(decoded.actor).toBeUndefined();
    });

    it("resolveAddress: service_ctx 재귀 resolve (SSOT 파생)", () => {
      // 의미값으로 주소 파생
      const refValues = DEMO_CATALOG.prefixes.order_event.versions[0].refEntries!.service_ctx.values;
      const shape = getPrefixShape(DEMO_CATALOG, "order_event", "v1");
      const addr = encodePrefix(DEMO_CATALOG, "order_event", "v1", {
        service_ctx: 2, action: 1,
      });
      const r = resolveAddress(DEMO_CATALOG, "order_event", "v1", addr);
      expect(r.dims.action.value).toBe("cancel");
      expect(r.dims.action.ko).toBe("취소");
      expect(r.dims.service_ctx.ref).toBeDefined();
    });

    it("라운드트립 전 범위", () => {
      const result = verifyRoundTrip(DEMO_CATALOG, "order_event", "v1");
      expect(result.valid).toBe(true);
    });
  });
});

// ══════════════════════════════════════════════════════════════════════════════
//  인코딩 분리 증명: 고정 차원만 좌표, table_ref는 별도 refs
// ══════════════════════════════════════════════════════════════════════════════

describe("인코딩 분리: 같은 좌표 + 다른 refs = 같은 종류의 이벤트, 다른 대상", () => {
  it("cart_event addr=0(add)는 모든 member×item 조합에서 동일", () => {
    // addr=0 = "add" action. 누가(member) 무엇을(item) 넣었는지는 좌표 밖.
    const addr = encodePrefixByValue(DEMO_CATALOG, "cart_event", "v1", { action: "add" });

    // EventInstance 형태 (런타임)
    const event1 = { event_type: "cart_event", address: addr, refs: { actor: 42, target: 1 }, timestamp: Date.now() };
    const event2 = { event_type: "cart_event", address: addr, refs: { actor: 43, target: 2 }, timestamp: Date.now() };

    // 같은 좌표 주소
    expect(event1.address).toBe(event2.address);
    expect(event1.address).toBe(0);

    // 다른 대상
    expect(event1.refs.actor).not.toBe(event2.refs.actor);

    // 좌표 decode는 동일
    const d1 = decodePrefix(DEMO_CATALOG, "cart_event", "v1", event1.address);
    const d2 = decodePrefix(DEMO_CATALOG, "cart_event", "v1", event2.address);
    expect(d1.action.value).toBe(d2.action.value);
    expect(d1.action.value).toBe("add");
  });
});

// ══════════════════════════════════════════════════════════════════════════════
//  기존 prefix와의 공존 증명: table_ref 추가가 기존 prefix를 깨지 않음
// ══════════════════════════════════════════════════════════════════════════════

describe("기존 prefix 공존: table_ref가 기존 axis/prefix_ref prefix에 영향 없음", () => {
  it("permission prefix: encode/decode 라운드트립 (SSOT 파생)", () => {
    const refValues = DEMO_CATALOG.prefixes.permission.versions[0].refEntries!.perm_svc.values;
    const addr = encodePrefixByValue(DEMO_CATALOG, "permission", "v1", { perm_svc: refValues[2], role: "viewer" });
    const decoded = decodePrefix(DEMO_CATALOG, "permission", "v1", addr);
    expect(decoded.role.value).toBe("viewer");

    const result = verifyRoundTrip(DEMO_CATALOG, "permission", "v1");
    expect(result.valid).toBe(true);
  });

  it("service prefix: encode/decode 라운드트립 (SSOT 파생)", () => {
    const result = verifyRoundTrip(DEMO_CATALOG, "service", "v1");
    expect(result.valid).toBe(true);
  });
});

// ══════════════════════════════════════════════════════════════════════════════
//  양방향 연결 증명: 좌표 세계 ↔ 관계형 세계 탐색
// ══════════════════════════════════════════════════════════════════════════════

describe("테이블 스키마: 좌표 ↔ 관계형 양방향 연결", () => {
  const C = DEMO_CATALOG;
  const tables = C.tables!;

  it("테이블 스키마가 존재한다", () => {
    expect(tables).toBeDefined();
    expect(Object.keys(tables)).toEqual(
      expect.arrayContaining(["members", "orgs", "items", "orders", "carts", "cart_items"]),
    );
  });

  it("ColumnRef 4종류가 모두 사용된다", () => {
    // scalar
    expect(tables.orders.columns.amount).toEqual({ kind: "scalar", type: "number" });
    // prefix_ref
    expect(tables.orders.columns.service_addr).toEqual({ kind: "prefix_ref", prefixId: "service" });
    // table_ref
    expect(tables.orders.columns.member_id).toEqual({ kind: "table_ref", table: "members" });
    // axis_ref
    expect(tables.orders.columns.status).toEqual({ kind: "axis_ref", axisId: "order_action" });
  });

  describe("경로 탐색: cart_event → members → orgs → service prefix", () => {
    it("1단계: cart_event의 actor는 members 테이블 타입", () => {
      const cartEvent = C.prefixes.cart_event;
      expect(cartEvent.dims.actor).toEqual({ kind: "table_ref", table: "members" });
    });

    it("2단계: members 테이블의 org_id는 orgs 테이블 참조", () => {
      const membersCols = tables.members.columns;
      expect(membersCols.org_id).toEqual({ kind: "table_ref", table: "orgs" });
    });

    it("3단계: orgs 테이블의 region_addr는 service prefix 참조", () => {
      const orgsCols = tables.orgs.columns;
      expect(orgsCols.region_addr).toEqual({ kind: "prefix_ref", prefixId: "service" });
    });

    it("4단계: service prefix 주소를 decode하면 좌표 세계로 돌아온다", () => {
      // SSOT에서 service 주소 파생
      const serviceAddr = encodePrefixByValue(DEMO_CATALOG, "service", "v1", {
        env: "prod", region: "asia", svc_name: "shopping-web", namespace: "shop",
      });
      const resolved = resolveAddress(DEMO_CATALOG, "service", "v1", serviceAddr);
      expect(resolved.dims.env.value).toBe("prod");
      expect(resolved.dims.region.value).toBe("asia");
      expect(resolved.dims.svc_name.value).toBe("shopping-web");
      expect(resolved.dims.namespace.value).toBe("shop");
    });

    it("전체 경로: event → table → table → prefix → decode", () => {
      // cart_event(add) 발생, actor=member:42
      const eventAddr = encodePrefixByValue(DEMO_CATALOG, "cart_event", "v1", { action: "add" });

      // 시뮬레이션: 런타임 데이터
      const member42 = { id: 42, name: "홍길동", role: "admin", org_id: 7 };
      const svcAddr = encodePrefixByValue(DEMO_CATALOG, "service", "v1", {
        env: "prod", region: "asia", svc_name: "shopping-web", namespace: "shop",
      });
      const org7 = { id: 7, name: "쇼핑몰A", region_addr: svcAddr };

      // 경로 추적
      // 1) event → action decode
      const eventDecoded = decodePrefix(DEMO_CATALOG, "cart_event", "v1", eventAddr);
      expect(eventDecoded.action.value).toBe("add");

      // 2) actor → members[42] → role은 axis_ref
      const memberRole = member42.role;
      const roleAxis = C.axes.role;
      const rolePos = roleAxis.versions.v1.entries.indexOf(memberRole);
      expect(rolePos).toBe(0); // "admin" = position 0

      // 3) members[42].org_id → orgs[7]
      expect(member42.org_id).toBe(org7.id);

      // 4) orgs[7].region_addr → service prefix decode
      const serviceResolved = resolveAddress(DEMO_CATALOG, "service", "v1", org7.region_addr);
      expect(serviceResolved.dims.env.value).toBe("prod");
      expect(serviceResolved.dims.svc_name.value).toBe("shopping-web");

      // 전체 경로 요약:
      // cart_event(add) → member:42(role=admin) → org:7 → service:40(prod/asia/shopping-web/shop)
    });
  });

  describe("경로 탐색: items → warehouse_addr → service prefix", () => {
    it("items의 warehouse_addr가 service prefix를 참조", () => {
      expect(tables.items.columns.warehouse_addr).toEqual({ kind: "prefix_ref", prefixId: "service" });
    });

    it("items의 category가 axis_ref", () => {
      expect(tables.items.columns.category).toEqual({ kind: "axis_ref", axisId: "category" });

      // axis_ref를 통해 축 값 검증
      const categoryAxis = C.axes.category;
      expect(categoryAxis.versions.v1.entries).toContain("tech");
    });
  });

  describe("순환 연결: prefix → table → table → prefix (그래프 구조)", () => {
    it("order_event prefix → orders table → members table → orgs table → service prefix", () => {
      // prefix → table
      expect(C.prefixes.order_event.dims.order).toEqual({ kind: "table_ref", table: "orders" });
      // table → table
      expect(tables.orders.columns.member_id).toEqual({ kind: "table_ref", table: "members" });
      expect(tables.members.columns.org_id).toEqual({ kind: "table_ref", table: "orgs" });
      // table → prefix
      expect(tables.orgs.columns.region_addr).toEqual({ kind: "prefix_ref", prefixId: "service" });
      // prefix → prefix (service는 독립)
      const svcShape = getPrefixShape(DEMO_CATALOG, "service", "v1");
      expect(svcShape.shape.length).toBe(4); // env × region × svc_name × namespace
    });
  });
});
