// @def.boundary validation-layer-group
// @def.doc validation-layer-group

/**
 * 쇼핑 플랫폼 다차원 인덱스 데모
 *
 * 3개의 인덱스:
 *   1. service    (4D) — env × region × svc_name × namespace
 *   2. permission (2D) — perm_svc(index_ref→service) × role
 *   3. event      (3D) — event_svc(index_ref→service) × event_name × initiator
 *
 * service 인덱스의 1D 압축 주소가 permission·event 인덱스의 한 차원(index_ref)으로 사용된다.
 * 이를 통해 "서비스 식별자 = 1개의 정수" 로 다른 테이블에서 서비스를 참조할 수 있다.
 */

import { describe, it, expect } from "vitest";
import { MetaRegistry } from "index-meta";
import {
  DEMO_ENVS,
  DEMO_REGIONS,
  DEMO_SVCS,
  DEMO_NSS,
  DEMO_ROLES_V1,
  DEMO_EVENTS_V1,
  buildDemoRegistryInput,
} from "demo-snapshot";

// ── MetaRegistry 정의 ───────────────────────────────────────────────────────

const registryInput = buildDemoRegistryInput();
const registry = new MetaRegistry(registryInput);

// ── 코덱 생성 ───────────────────────────────────────────────────────────────
const svcCodec  = registry.createCodec("service",    "v1");
const permCodec = registry.createCodec("permission", "v1");
const evtCodec  = registry.createCodec("event",      "v1");

const permSvcEntries = registryInput.dims.perm_svc.snapshots.v1.entries as readonly number[];
const evtSvcEntries = registryInput.dims.evt_svc.snapshots.v1.entries as readonly number[];

function serviceAddr(input: {
  env: string;
  region: string;
  svc_name: string;
  namespace: string;
}) {
  return svcCodec.encode(input).value;
}

// ── 테스트 ──────────────────────────────────────────────────────────────────

describe("1. Service Index (4D: env × region × svc_name × namespace)", () => {
  it("shape과 size가 정확하다", () => {
    expect(svcCodec.shape).toEqual([DEMO_ENVS.length, DEMO_REGIONS.length, DEMO_SVCS.length, DEMO_NSS.length]);
    expect(svcCodec.size).toBe(DEMO_ENVS.length * DEMO_REGIONS.length * DEMO_SVCS.length * DEMO_NSS.length);
  });

  it("prod/asia/shopping-web/shop 주소를 계산한다", () => {
    const vv = svcCodec.encode({ env: "prod", region: "asia", svc_name: "shopping-web", namespace: "shop" });
    const expected = (
      DEMO_ENVS.indexOf("prod") * DEMO_REGIONS.length * DEMO_SVCS.length * DEMO_NSS.length
      + DEMO_REGIONS.indexOf("asia") * DEMO_SVCS.length * DEMO_NSS.length
      + DEMO_SVCS.indexOf("shopping-web") * DEMO_NSS.length
      + DEMO_NSS.indexOf("shop")
    );
    expect(vv.value).toBe(expected);
  });

  it("auth/shop 주소를 디코드하면 원래 좌표를 복원한다", () => {
    const coords = svcCodec.decodeValue(serviceAddr({
      env: "prod",
      region: "asia",
      svc_name: "auth",
      namespace: "shop",
    }));
    expect(coords).toEqual({ env: "prod", region: "asia", svc_name: "auth", namespace: "shop" });
  });

  it("dev/asia/gateway 서비스들의 주소 범위 조회", () => {
    // dev(pos1)/asia(pos1)/gateway(pos5) + namespace wildcard
    // weights [20, 10, 2, 1]
    // base = (1-1)*20+(1-1)*10+(5-1)*2 = 8
    // asia/shop=8, asia/cms=9 → [[8, 9]]
    // usa/shop = 8+(2-1)*10 = 18, usa/cms = 19 → [[18, 19]]
    const gatewayPos = DEMO_SVCS.indexOf("gateway");
    const expectedStartAsia = gatewayPos * DEMO_NSS.length;
    const expectedStartUsa = DEMO_SVCS.length * DEMO_NSS.length + gatewayPos * DEMO_NSS.length;
    expect(svcCodec.matchRanges({ env: "dev", svc_name: "gateway" }))
      .toEqual([[expectedStartAsia, expectedStartAsia + 1], [expectedStartUsa, expectedStartUsa + 1]]);
  });

  it("prod/asia 전체 서비스 범위를 연속 구간으로 계산한다", () => {
    // prod(pos3)/asia(pos1) + name wildcard + ns wildcard
    // base = (3-1)*20 = 40, max = 40+4*2+1 = 49
    const start = DEMO_ENVS.indexOf("prod") * DEMO_REGIONS.length * DEMO_SVCS.length * DEMO_NSS.length;
    const length = DEMO_SVCS.length * DEMO_NSS.length;
    expect(svcCodec.matchRanges({ env: "prod", region: "asia" }))
      .toEqual([[start, start + length - 1]]);
  });

  it("VersionedValue → colon 프로토콜 직렬화 / 역파싱", () => {
    const vv = svcCodec.encode({ env: "prod", region: "asia", svc_name: "auth", namespace: "shop" });
    const str = registry.serialize(vv);
    expect(str).toBe(`service:v1:${vv.value}`);
    expect(registry.parse(str)).toEqual(vv);
  });
});

describe("2. Permission Index (2D: perm_svc × role)", () => {
  it("shape과 size가 정확하다", () => {
    expect(permCodec.shape).toEqual([permSvcEntries.length, DEMO_ROLES_V1.length]);
    expect(permCodec.size).toBe(permSvcEntries.length * DEMO_ROLES_V1.length);
  });

  it("prod/asia/auth/shop + admin 역할 인코딩·디코딩", () => {
    const authShop = serviceAddr({ env: "prod", region: "asia", svc_name: "auth", namespace: "shop" });
    const authShopPos = permSvcEntries.indexOf(authShop) + 1;
    const vv = permCodec.encode({ perm_svc: authShop, role: "admin" });
    expect(vv.value).toBe((authShopPos - 1) * DEMO_ROLES_V1.length);
    const decoded = permCodec.decode(vv);
    expect(decoded.role).toBe("admin");
    expect(decoded.perm_svc).toBe(authShop);
  });

  it("perm_svc 값을 service codec으로 역참조하면 실제 서비스 좌표를 얻는다", () => {
    const paymentShop = serviceAddr({ env: "prod", region: "asia", svc_name: "payment", namespace: "shop" });
    const permVV = permCodec.encode({ perm_svc: paymentShop, role: "developer" });
    const permCoords = permCodec.decode(permVV);

    // perm_svc는 service 인덱스의 1D 압축값이므로 svcCodec으로 디코딩 가능
    const svcCoords = svcCodec.decodeValue(permCoords.perm_svc as number);
    expect(svcCoords).toEqual({ env: "prod", region: "asia", svc_name: "payment", namespace: "shop" });
  });

  it("prod/asia/auth/shop의 모든 역할 권한이 연속 범위를 이룬다", () => {
    const authShop = serviceAddr({ env: "prod", region: "asia", svc_name: "auth", namespace: "shop" });
    const authShopPos = permSvcEntries.indexOf(authShop) + 1;
    const start = (authShopPos - 1) * DEMO_ROLES_V1.length;
    expect(permCodec.matchRanges({ perm_svc: authShop }))
      .toEqual([[start, start + DEMO_ROLES_V1.length - 1]]);
  });

  it("prod/asia/payment 서비스들(shop+cms) + readonly 역할 검색", () => {
    const readonlyPos = DEMO_ROLES_V1.indexOf("readonly");
    const paymentShop = serviceAddr({ env: "prod", region: "asia", svc_name: "payment", namespace: "shop" });
    const paymentCms = serviceAddr({ env: "prod", region: "asia", svc_name: "payment", namespace: "cms" });
    const paymentShopPos = permSvcEntries.indexOf(paymentShop) + 1;
    const paymentCmsPos = permSvcEntries.indexOf(paymentCms) + 1;
    expect(permCodec.matchRanges({ perm_svc: paymentShop, role: "readonly" }))
      .toEqual([[(paymentShopPos - 1) * DEMO_ROLES_V1.length + readonlyPos, (paymentShopPos - 1) * DEMO_ROLES_V1.length + readonlyPos]]);
    expect(permCodec.matchRanges({ perm_svc: paymentCms, role: "readonly" }))
      .toEqual([[(paymentCmsPos - 1) * DEMO_ROLES_V1.length + readonlyPos, (paymentCmsPos - 1) * DEMO_ROLES_V1.length + readonlyPos]]);
  });
});

describe("3. Event Index (3D: event_svc × event_name × initiator)", () => {
  it("shape과 size가 정확하다", () => {
    expect(evtCodec.shape).toEqual([evtSvcEntries.length, DEMO_EVENTS_V1.length, 2]);
    expect(evtCodec.size).toBe(evtSvcEntries.length * DEMO_EVENTS_V1.length * 2);
  });

  it("prod/asia/shopping-web/shop + order.created + web 이벤트 인코딩", () => {
    const shoppingWebShop = serviceAddr({ env: "prod", region: "asia", svc_name: "shopping-web", namespace: "shop" });
    const svcPos = evtSvcEntries.indexOf(shoppingWebShop) + 1;
    const eventPos = DEMO_EVENTS_V1.indexOf("order.created") + 1;
    const vv = evtCodec.encode({
      evt_svc:    shoppingWebShop,
      event_name: "order.created",
      initiator:  "web",
    });
    expect(vv.value).toBe((svcPos - 1) * DEMO_EVENTS_V1.length * 2 + (eventPos - 1) * 2);
  });

  it("이벤트 디코딩 후 event_svc를 service codec으로 역참조", () => {
    const authShop = serviceAddr({ env: "prod", region: "asia", svc_name: "auth", namespace: "shop" });
    const vv = evtCodec.encode({
      evt_svc:    authShop,
      event_name: "user.login",
      initiator:  "mobile",
    });
    const evtCoords = evtCodec.decode(vv);
    expect(evtCoords.event_name).toBe("user.login");
    expect(evtCoords.initiator).toBe("mobile");

    // event_svc → service 역참조
    const svcCoords = svcCodec.decodeValue(evtCoords.evt_svc as number);
    expect(svcCoords).toEqual({ env: "prod", region: "asia", svc_name: "auth", namespace: "shop" });
  });

  it("prod/asia/auth/shop에서 발생한 모든 이벤트가 연속 범위를 이룬다", () => {
    const authShop = serviceAddr({ env: "prod", region: "asia", svc_name: "auth", namespace: "shop" });
    const authShopPos = evtSvcEntries.indexOf(authShop) + 1;
    const blockSize = DEMO_EVENTS_V1.length * 2;
    const start = (authShopPos - 1) * blockSize;
    expect(evtCodec.matchRanges({ evt_svc: authShop }))
      .toEqual([[start, start + blockSize - 1]]);
  });

  it("prod/asia/payment/shop + payment.failed 이벤트 범위 (web·mobile 2개)", () => {
    const paymentShop = serviceAddr({ env: "prod", region: "asia", svc_name: "payment", namespace: "shop" });
    const paymentShopPos = evtSvcEntries.indexOf(paymentShop) + 1;
    const eventPos = DEMO_EVENTS_V1.indexOf("payment.failed") + 1;
    const start = (paymentShopPos - 1) * DEMO_EVENTS_V1.length * 2 + (eventPos - 1) * 2;
    expect(evtCodec.matchRanges({
      evt_svc:    paymentShop,
      event_name: "payment.failed",
    })).toEqual([[start, start + 1]]);
  });

  it("dev 환경 서비스들의 이벤트 범위는 서비스별 연속 블록으로 분리된다", () => {
    const ranges: [number, number][] = [];
    for (const svc of [
      serviceAddr({ env: "dev", region: "asia", svc_name: "shopping-web", namespace: "shop" }),
      serviceAddr({ env: "dev", region: "asia", svc_name: "shopping-backend", namespace: "shop" }),
      serviceAddr({ env: "dev", region: "asia", svc_name: "auth", namespace: "shop" }),
      serviceAddr({ env: "dev", region: "asia", svc_name: "payment", namespace: "shop" }),
      serviceAddr({ env: "dev", region: "asia", svc_name: "gateway", namespace: "shop" }),
    ]) {
      const r = evtCodec.matchRanges({ evt_svc: svc });
      ranges.push(...r);
    }
    const blockSize = DEMO_EVENTS_V1.length * 2;
    expect(ranges).toEqual(
      [0, 1, 2, 3, 4].map((index) => [index * blockSize, index * blockSize + blockSize - 1] as [number, number]),
    );
  });
});

describe("index_ref 체인 요약", () => {
  it("permission 주소 하나에서 서비스 좌표까지 전개 가능하다", () => {
    //   permission VersionedValue
    //     → permCodec.decode() → { perm_svc: number, role: string }
    //     → svcCodec.decodeValue(perm_svc) → { env, region, svc_name, namespace }

    const gatewayShop = serviceAddr({ env: "prod", region: "asia", svc_name: "gateway", namespace: "shop" });
    const permAddr = permCodec.encode({ perm_svc: gatewayShop, role: "operator" });
    const { perm_svc, role } = permCodec.decode(permAddr);
    const svc = svcCodec.decodeValue(perm_svc as number);

    expect(role).toBe("operator");
    expect(svc.env).toBe("prod");
    expect(svc.svc_name).toBe("gateway");
    expect(svc.namespace).toBe("shop");
  });

  it("event 주소 하나에서 서비스 좌표까지 전개 가능하다", () => {
    const paymentShop = serviceAddr({ env: "dev", region: "asia", svc_name: "payment", namespace: "shop" });
    const evtAddr = evtCodec.encode({
      evt_svc:    paymentShop,
      event_name: "order.paid",
      initiator:  "mobile",
    });
    const { evt_svc, event_name, initiator } = evtCodec.decode(evtAddr);
    const svc = svcCodec.decodeValue(evt_svc as number);

    expect(event_name).toBe("order.paid");
    expect(initiator).toBe("mobile");
    expect(svc.env).toBe("dev");
    expect(svc.svc_name).toBe("payment");
  });
});
