/**
 * table-ref-guide.test.ts — table_ref 차원을 사용하는 동적 데이터 참조 가이드.
 *
 * ## 핵심 개념
 *
 * prefix의 차원은 3종류:
 *   1. axis      — 유한 enum (인코딩됨 → 1D 주소의 일부)
 *   2. prefix_ref — 다른 prefix 주소 참조 (인코딩됨)
 *   3. table_ref  — DB 테이블 행 참조 (인코딩 안 됨 → 좌표 밖)
 *
 * table_ref가 좌표에 포함되지 않는 이유:
 *   - 테이블 행은 무한히 증가 (member가 100만명일 수 있음)
 *   - 5Q 체크리스트의 "유한성" 미충족
 *   - 같은 "장바구니 담기"(좌표)를 다른 사용자(refs)가 수행 → 좌표 동일, refs만 다름
 *
 * ## 사용 패턴
 *
 * cart_event prefix:
 *   - svc_ref  : prefix_ref → service (인코딩됨: 어느 서비스에서 발생)
 *   - actor    : table_ref  → members (인코딩 안 됨: 누가)
 *   - action   : axis       → cart_action (인코딩됨: 무슨 행위)
 *   - target   : table_ref  → items (인코딩 안 됨: 무엇을)
 *
 * 런타임 이벤트 구조:
 *   {
 *     address: 5,                    // 좌표 (svc_ref + action만 인코딩)
 *     address_context: { cart_event: "cart_event:v2:5" },
 *     refs: { actor: 42, target: 7 } // 테이블 참조 (좌표 밖)
 *   }
 */

import { describe, it, expect } from "vitest";
import { DEMO_CATALOG } from "./demo-catalog.js";
import {
  getPrefixStructure,
  getPrefixShape,
  encodePrefixByValue,
  decodePrefix,
  resolveAddress,
  verifyRoundTrip,
  latestPrefixVersion,
} from "@qa-sdk/core";

// ═══════════════════════════════════════════════════════════════
//  1. 구조 확인 — axis vs table_ref vs prefix_ref
// ═══════════════════════════════════════════════════════════════

describe("table_ref 구조 이해", () => {
  it("cart_event: 4개 label 중 axis 1개 + prefix_ref 1개만 인코딩, table_ref 2개는 좌표 밖", () => {
    const s = getPrefixStructure(DEMO_CATALOG, "cart_event");
    expect(s.labels).toEqual(["svc_ref", "actor", "action", "target"]);

    // 인코딩되는 차원
    expect(s.dims.svc_ref.kind).toBe("prefix_ref"); // → service prefix 주소
    expect(s.dims.action.kind).toBe("axis");         // → cart_action entries

    // 인코딩되지 않는 차원 (DB 행 참조)
    expect(s.dims.actor.kind).toBe("table_ref");     // → members 테이블
    expect((s.dims.actor as any).table).toBe("members");
    expect(s.dims.target.kind).toBe("table_ref");    // → items 테이블
    expect((s.dims.target as any).table).toBe("items");
  });

  it("shape에는 table_ref가 제외됨 — axis + prefix_ref만 포함", () => {
    const ver = latestPrefixVersion(DEMO_CATALOG, "cart_event");
    const shape = getPrefixShape(DEMO_CATALOG, "cart_event", ver);

    // shape는 [svc_ref_capacity, cart_action_capacity] 2D
    expect(shape.shape.length).toBe(2);
  });

  it("order_event: prefix_ref(service_ctx) + table_ref(actor, order) + axis(action)", () => {
    const s = getPrefixStructure(DEMO_CATALOG, "order_event");

    // 인코딩됨
    expect(s.dims.service_ctx.kind).toBe("prefix_ref");
    expect(s.dims.action.kind).toBe("axis");

    // 좌표 밖
    expect(s.dims.actor.kind).toBe("table_ref");
    expect((s.dims.actor as any).table).toBe("members");
    expect(s.dims.order.kind).toBe("table_ref");
    expect((s.dims.order as any).table).toBe("orders");
  });
});

// ═══════════════════════════════════════════════════════════════
//  2. 인코딩/디코딩 — table_ref는 주소에 영향 없음
// ═══════════════════════════════════════════════════════════════

describe("table_ref와 인코딩 분리", () => {
  it("같은 action → 같은 주소 (actor/target이 달라도)", () => {
    const ver = latestPrefixVersion(DEMO_CATALOG, "cart_event");
    const svcRef = DEMO_CATALOG.prefixes.cart_event.versions[0].refEntries!.svc_ref.values[0];

    const addr = encodePrefixByValue(DEMO_CATALOG, "cart_event", ver, { svc_ref: svcRef, action: "add" });

    // 런타임 이벤트 1: member 42가 item 7을 담음
    const event1 = { address: addr, refs: { actor: 42, target: 7 } };
    // 런타임 이벤트 2: member 99가 item 3을 담음
    const event2 = { address: addr, refs: { actor: 99, target: 3 } };

    // 좌표(address)는 동일 — "add" 행위 자체는 같으니까
    expect(event1.address).toBe(event2.address);

    // refs는 다름 — 누가/무엇을은 좌표 밖
    expect(event1.refs.actor).not.toBe(event2.refs.actor);
    expect(event1.refs.target).not.toBe(event2.refs.target);
  });

  it("decode 결과에 table_ref 차원은 없음", () => {
    const ver = latestPrefixVersion(DEMO_CATALOG, "cart_event");
    const decoded = decodePrefix(DEMO_CATALOG, "cart_event", ver, 0);

    // axis 차원만 decode됨
    expect(decoded.action).toBeDefined();
    expect(decoded.action.value).toBe("add");

    // svc_ref (prefix_ref)도 decode됨
    expect(decoded.svc_ref).toBeDefined();

    // table_ref 차원은 decode 결과에 없음
    expect(decoded.actor).toBeUndefined();
    expect(decoded.target).toBeUndefined();
  });

  it("resolveAddress에서도 table_ref는 제외", () => {
    const ver = latestPrefixVersion(DEMO_CATALOG, "cart_event");
    const r = resolveAddress(DEMO_CATALOG, "cart_event", ver, 0);

    expect(r.dims.action).toBeDefined();
    expect(r.dims.action.ko).toBe("추가");
    expect(r.dims.actor).toBeUndefined();
    expect(r.dims.target).toBeUndefined();
  });

  it("roundtrip: table_ref가 있어도 인코딩 정합성 유지", () => {
    for (const pid of ["cart_event", "auth_event", "order_event", "deploy_event"]) {
      const ver = latestPrefixVersion(DEMO_CATALOG, pid);
      const result = verifyRoundTrip(DEMO_CATALOG, pid, ver);
      expect(result.valid).toBe(true);
    }
  });
});

// ═══════════════════════════════════════════════════════════════
//  3. 테이블 스키마 — 좌표 ↔ 관계형 양방향 경로
// ═══════════════════════════════════════════════════════════════

describe("테이블 스키마 참조 경로", () => {
  const tables = DEMO_CATALOG.tables!;

  it("members 테이블: role은 axis_ref, org_id는 FK(table_ref)", () => {
    const members = tables.members;
    expect(members.columns.role.kind).toBe("axis_ref");
    expect((members.columns.role as any).axisId).toBe("role");
    expect(members.columns.org_id.kind).toBe("table_ref");
    expect((members.columns.org_id as any).table).toBe("orgs");
  });

  it("orgs 테이블: region_addr는 service prefix 참조", () => {
    const orgs = tables.orgs;
    expect(orgs.columns.region_addr.kind).toBe("prefix_ref");
    expect((orgs.columns.region_addr as any).prefixId).toBe("service");
  });

  it("cart_items 테이블: cart_id → carts FK, item_id → items FK", () => {
    const cartItems = tables.cart_items;
    expect(cartItems.columns.cart_id.kind).toBe("table_ref");
    expect((cartItems.columns.cart_id as any).table).toBe("carts");
    expect(cartItems.columns.item_id.kind).toBe("table_ref");
    expect((cartItems.columns.item_id as any).table).toBe("items");
  });

  it("경로 탐색: cart_event → members → orgs → service prefix → 좌표 세계", () => {
    // 1단계: cart_event.actor → members 테이블
    const cartDims = DEMO_CATALOG.prefixes.cart_event.dims;
    expect((cartDims.actor as any).table).toBe("members");

    // 2단계: members.org_id → orgs 테이블
    expect((tables.members.columns.org_id as any).table).toBe("orgs");

    // 3단계: orgs.region_addr → service prefix (좌표 세계 재진입)
    expect((tables.orgs.columns.region_addr as any).prefixId).toBe("service");

    // 4단계: service prefix 주소 decode → env, region, svc_name, namespace
    const svcAddr = encodePrefixByValue(DEMO_CATALOG, "service", "v1", {
      env: "prod", region: "asia", svc_name: "shopping-web", namespace: "shop",
    });
    const decoded = decodePrefix(DEMO_CATALOG, "service", "v1", svcAddr);
    expect(decoded.env.value).toBe("prod");
    expect(decoded.region.value).toBe("asia");
    expect(decoded.svc_name.value).toBe("shopping-web");
  });
});

// ═══════════════════════════════════════════════════════════════
//  4. 실전 패턴 — 이벤트 발생 시 좌표 + refs 분리
// ═══════════════════════════════════════════════════════════════

describe("실전: 이벤트 발생 시 좌표와 refs 분리", () => {
  it("장바구니 담기: 좌표(action=add) + refs(actor=member_42, target=item_7)", () => {
    const ver = latestPrefixVersion(DEMO_CATALOG, "cart_event");
    const svcRef = DEMO_CATALOG.prefixes.cart_event.versions[0].refEntries!.svc_ref.values[0];

    // 좌표 인코딩 — action만 들어감
    const address = encodePrefixByValue(DEMO_CATALOG, "cart_event", ver, {
      svc_ref: svcRef,
      action: "add",
    });

    // 전송 형식
    const serialized = `cart_event:${ver}:${address}`;

    // 이벤트 레코드 (ingest로 전송되는 형태)
    const record = {
      event_key: "cart.add",
      address_context: { cart_event: serialized },
      payload: {
        actor_id: 42,    // table_ref → members.id
        item_id: 7,      // table_ref → items.id
        qty: 1,
      },
    };

    // 검증: 좌표에서 "무슨 행위"를 복원
    const decoded = decodePrefix(DEMO_CATALOG, "cart_event", ver, address);
    expect(decoded.action.value).toBe("add");

    // 검증: "누가" "무엇을"은 payload에서 추출
    expect(record.payload.actor_id).toBe(42);
    expect(record.payload.item_id).toBe(7);
  });

  it("주문 생성: 좌표(action=create) + refs(actor=member, order=new_order)", () => {
    const ver = latestPrefixVersion(DEMO_CATALOG, "order_event");
    const svcRef = DEMO_CATALOG.prefixes.order_event.versions[0].refEntries!.service_ctx.values[0];

    const address = encodePrefixByValue(DEMO_CATALOG, "order_event", ver, {
      service_ctx: svcRef,
      action: "create",
    });

    const decoded = decodePrefix(DEMO_CATALOG, "order_event", ver, address);
    expect(decoded.action.value).toBe("create");

    // 주문 정보는 좌표 밖
    const record = {
      event_key: "checkout.process",
      address_context: { order_event: `order_event:${ver}:${address}` },
      payload: {
        actor_id: 42,      // → members 테이블
        order_id: "ORD-001", // → orders 테이블
        amount: 89000,
      },
    };

    expect(record.payload.order_id).toBe("ORD-001");
  });

  it("ColumnRef 4종류가 테이블 스키마에서 모두 사용됨", () => {
    const allRefs = new Set<string>();
    for (const t of Object.values(DEMO_CATALOG.tables!)) {
      for (const col of Object.values(t.columns)) {
        allRefs.add(col.kind);
      }
    }
    expect(allRefs).toContain("scalar");     // id, name 등 일반 값
    expect(allRefs).toContain("axis_ref");   // role → role 축 참조
    expect(allRefs).toContain("prefix_ref"); // region_addr → service prefix
    expect(allRefs).toContain("table_ref");  // org_id → orgs FK
  });
});
