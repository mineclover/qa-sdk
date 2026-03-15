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
import { MetaRegistry } from "./meta-registry.js";

// ── service 1D 주소 상수 ────────────────────────────────────────────────────
//
// service 인덱스 shape: [env=5, region=2, svc_name=5, namespace=2] → size = 100
// weights: [20, 10, 2, 1]
// formula: value = (env_pos-1)*20 + (region_pos-1)*10 + (name_pos-1)*2 + (ns_pos-1)
//
// env     : dev=1, stage=2, prod=3, test=4, local=5
// region  : asia=1, usa=2
// svc_name: shopping-web=1, shopping-backend=2, auth=3, payment=4, gateway=5
// namespace: shop=1, cms=2

const SVC = {
  // dev / asia
  DEV_ASIA_SHOPPING_WEB_SHOP: 0,     // (1-1)*20+(1-1)*10+(1-1)*2+(1-1)
  DEV_ASIA_SHOPPING_BACKEND_SHOP: 2, // (1-1)*20+(1-1)*10+(2-1)*2+(1-1)
  DEV_ASIA_AUTH_SHOP: 4,             // (1-1)*20+(1-1)*10+(3-1)*2+(1-1)
  DEV_ASIA_PAYMENT_SHOP: 6,          // (1-1)*20+(1-1)*10+(4-1)*2+(1-1)
  DEV_ASIA_GATEWAY_SHOP: 8,          // (1-1)*20+(1-1)*10+(5-1)*2+(1-1)

  // prod / asia / shop namespace
  PROD_ASIA_SHOPPING_WEB_SHOP: 40,     // (3-1)*20+(1-1)*10+(1-1)*2+(1-1)
  PROD_ASIA_SHOPPING_BACKEND_SHOP: 42, // (3-1)*20+(1-1)*10+(2-1)*2+(1-1)
  PROD_ASIA_AUTH_SHOP: 44,             // (3-1)*20+(1-1)*10+(3-1)*2+(1-1)
  PROD_ASIA_PAYMENT_SHOP: 46,          // (3-1)*20+(1-1)*10+(4-1)*2+(1-1)
  PROD_ASIA_GATEWAY_SHOP: 48,          // (3-1)*20+(1-1)*10+(5-1)*2+(1-1)

  // prod / asia / cms namespace
  PROD_ASIA_SHOPPING_WEB_CMS: 41,     // (3-1)*20+(1-1)*10+(1-1)*2+(2-1)
  PROD_ASIA_SHOPPING_BACKEND_CMS: 43, // (3-1)*20+(1-1)*10+(2-1)*2+(2-1)
  PROD_ASIA_AUTH_CMS: 45,             // (3-1)*20+(1-1)*10+(3-1)*2+(2-1)
  PROD_ASIA_PAYMENT_CMS: 47,          // (3-1)*20+(1-1)*10+(4-1)*2+(2-1)
  PROD_ASIA_GATEWAY_CMS: 49,          // (3-1)*20+(1-1)*10+(5-1)*2+(2-1)
} as const;

// ── MetaRegistry 정의 ───────────────────────────────────────────────────────

const registry = new MetaRegistry({
  dims: {
    // ─── service 테이블 4개 차원 ───────────────────────────────────────────
    env: {
      kind: { type: "string_enum" },
      description: "배포 환경",
      snapshots: {
        v1: { entries: ["dev", "stage", "prod", "test", "local"] },
      },
    },
    region: {
      kind: { type: "string_enum" },
      description: "배포 리전",
      snapshots: {
        v1: { entries: ["asia", "usa"] },
      },
    },
    svc_name: {
      kind: { type: "string_enum" },
      description: "서비스 이름",
      snapshots: {
        v1: { entries: ["shopping-web", "shopping-backend", "auth", "payment", "gateway"] },
      },
    },
    namespace: {
      kind: { type: "string_enum" },
      description: "서비스 네임스페이스",
      snapshots: {
        v1: { entries: ["shop", "cms"] },
      },
    },

    // ─── permission 테이블 차원 ────────────────────────────────────────────
    perm_svc: {
      // service 인덱스 1D 압축 주소를 entries로 사용 (index_ref 패턴)
      // prod/asia 서비스만 포함 — shop/cms 순서로 10개
      kind: { type: "index_ref", indexId: "service" },
      description: "권한 대상 서비스 (service 1D 주소)",
      snapshots: {
        v1: {
          entries: [
            SVC.PROD_ASIA_SHOPPING_WEB_SHOP,     // 40 — pos 1
            SVC.PROD_ASIA_SHOPPING_WEB_CMS,      // 41 — pos 2
            SVC.PROD_ASIA_SHOPPING_BACKEND_SHOP, // 42 — pos 3
            SVC.PROD_ASIA_SHOPPING_BACKEND_CMS,  // 43 — pos 4
            SVC.PROD_ASIA_AUTH_SHOP,             // 44 — pos 5
            SVC.PROD_ASIA_AUTH_CMS,              // 45 — pos 6
            SVC.PROD_ASIA_PAYMENT_SHOP,          // 46 — pos 7
            SVC.PROD_ASIA_PAYMENT_CMS,           // 47 — pos 8
            SVC.PROD_ASIA_GATEWAY_SHOP,          // 48 — pos 9
            SVC.PROD_ASIA_GATEWAY_CMS,           // 49 — pos 10
          ],
        },
      },
    },
    role: {
      kind: { type: "string_enum" },
      description: "사용자 역할",
      snapshots: {
        v1: { entries: ["admin", "developer", "operator", "viewer", "readonly"] },
      },
    },

    // ─── event 테이블 차원 ─────────────────────────────────────────────────
    event_svc: {
      // dev + prod/asia 서비스 포함 — 개발·운영 이벤트 모두 추적
      kind: { type: "index_ref", indexId: "service" },
      description: "이벤트 발생 서비스 (service 1D 주소)",
      snapshots: {
        v1: {
          entries: [
            SVC.DEV_ASIA_SHOPPING_WEB_SHOP,      //  0 — pos 1
            SVC.DEV_ASIA_SHOPPING_BACKEND_SHOP,  //  2 — pos 2
            SVC.DEV_ASIA_AUTH_SHOP,              //  4 — pos 3
            SVC.DEV_ASIA_PAYMENT_SHOP,           //  6 — pos 4
            SVC.DEV_ASIA_GATEWAY_SHOP,           //  8 — pos 5
            SVC.PROD_ASIA_SHOPPING_WEB_SHOP,     // 40 — pos 6
            SVC.PROD_ASIA_SHOPPING_BACKEND_SHOP, // 42 — pos 7
            SVC.PROD_ASIA_AUTH_SHOP,             // 44 — pos 8
            SVC.PROD_ASIA_PAYMENT_SHOP,          // 46 — pos 9
            SVC.PROD_ASIA_GATEWAY_SHOP,          // 48 — pos 10
          ],
        },
      },
    },
    event_name: {
      kind: { type: "string_enum" },
      description: "이벤트 이름",
      snapshots: {
        v1: {
          entries: [
            "user.login", "user.logout",
            "order.created", "order.paid",
            "payment.failed", "session.expired", "config.changed",
          ],
        },
      },
    },
    initiator: {
      kind: { type: "string_enum" },
      description: "이벤트 실행 주체",
      snapshots: {
        v1: { entries: ["web", "mobile"] },
      },
    },
  },

  indices: {
    // ─── 1. 서비스 인덱스 (4D) ─────────────────────────────────────────────
    service: {
      description: "env × region × svc_name × namespace  (5×2×5×2 = 100)",
      dims: ["env", "region", "svc_name", "namespace"],
      versions: {
        v1: {
          snapshots: { env: "v1", region: "v1", svc_name: "v1", namespace: "v1" },
        },
      },
    },

    // ─── 2. 권한 인덱스 (2D) ──────────────────────────────────────────────
    permission: {
      description: "perm_svc(index_ref) × role  (10×5 = 50)",
      dims: ["perm_svc", "role"],
      versions: {
        v1: { snapshots: { perm_svc: "v1", role: "v1" } },
      },
    },

    // ─── 3. 이벤트 인덱스 (3D) ────────────────────────────────────────────
    event: {
      description: "event_svc(index_ref) × event_name × initiator  (10×7×2 = 140)",
      dims: ["event_svc", "event_name", "initiator"],
      versions: {
        v1: { snapshots: { event_svc: "v1", event_name: "v1", initiator: "v1" } },
      },
    },
  },
});

// ── 코덱 생성 ───────────────────────────────────────────────────────────────
const svcCodec  = registry.createCodec("service",    "v1");
const permCodec = registry.createCodec("permission", "v1");
const evtCodec  = registry.createCodec("event",      "v1");

// ── 테스트 ──────────────────────────────────────────────────────────────────

describe("1. Service Index (4D: env × region × svc_name × namespace)", () => {
  it("shape과 size가 정확하다", () => {
    expect(svcCodec.shape).toEqual([5, 2, 5, 2]);
    expect(svcCodec.size).toBe(100);
  });

  it("prod/asia/shopping-web/shop → 40", () => {
    const vv = svcCodec.encode({ env: "prod", region: "asia", svc_name: "shopping-web", namespace: "shop" });
    expect(vv.value).toBe(40);
  });

  it("value 44 → prod/asia/auth/shop", () => {
    const coords = svcCodec.decodeValue(44);
    expect(coords).toEqual({ env: "prod", region: "asia", svc_name: "auth", namespace: "shop" });
  });

  it("dev/asia/gateway 서비스들의 주소 범위 조회", () => {
    // dev(pos1)/asia(pos1)/gateway(pos5) + namespace wildcard
    // weights [20, 10, 2, 1]
    // base = (1-1)*20+(1-1)*10+(5-1)*2 = 8
    // asia/shop=8, asia/cms=9 → [[8, 9]]
    // usa/shop = 8+(2-1)*10 = 18, usa/cms = 19 → [[18, 19]]
    expect(svcCodec.matchRanges({ env: "dev", svc_name: "gateway" }))
      .toEqual([[8, 9], [18, 19]]);
  });

  it("prod/asia 전체 서비스 10개가 연속 범위 [[40, 49]]", () => {
    // prod(pos3)/asia(pos1) + name wildcard + ns wildcard
    // base = (3-1)*20 = 40, max = 40+4*2+1 = 49
    expect(svcCodec.matchRanges({ env: "prod", region: "asia" }))
      .toEqual([[40, 49]]);
  });

  it("VersionedValue → colon 프로토콜 직렬화 / 역파싱", () => {
    const vv = svcCodec.encode({ env: "prod", region: "asia", svc_name: "auth", namespace: "shop" });
    const str = registry.serialize(vv);
    expect(str).toBe("service:v1:44");
    expect(registry.parse(str)).toEqual(vv);
  });
});

describe("2. Permission Index (2D: perm_svc × role)", () => {
  it("shape과 size가 정확하다", () => {
    expect(permCodec.shape).toEqual([10, 5]);
    expect(permCodec.size).toBe(50);
  });

  it("prod/asia/auth/shop + admin 역할 인코딩·디코딩", () => {
    const vv = permCodec.encode({ perm_svc: SVC.PROD_ASIA_AUTH_SHOP, role: "admin" });
    // perm_svc=44 → pos5 in perm_svc entries, role=admin → pos1
    // value = (5-1)*5 + (1-1) = 20
    expect(vv.value).toBe(20);
    const decoded = permCodec.decode(vv);
    expect(decoded.role).toBe("admin");
    expect(decoded.perm_svc).toBe(SVC.PROD_ASIA_AUTH_SHOP);
  });

  it("perm_svc 값을 service codec으로 역참조하면 실제 서비스 좌표를 얻는다", () => {
    const permVV = permCodec.encode({ perm_svc: SVC.PROD_ASIA_PAYMENT_SHOP, role: "developer" });
    const permCoords = permCodec.decode(permVV);

    // perm_svc는 service 인덱스의 1D 압축값이므로 svcCodec으로 디코딩 가능
    const svcCoords = svcCodec.decodeValue(permCoords.perm_svc as number);
    expect(svcCoords).toEqual({ env: "prod", region: "asia", svc_name: "payment", namespace: "shop" });
  });

  it("prod/asia/auth/shop의 모든 역할 권한이 연속 범위 [[20, 24]]", () => {
    // perm_svc=44 → pos5, role wildcard
    // value = (5-1)*5 + 0..(5-1) = 20..24
    expect(permCodec.matchRanges({ perm_svc: SVC.PROD_ASIA_AUTH_SHOP }))
      .toEqual([[20, 24]]);
  });

  it("prod/asia/payment 서비스들(shop+cms) + readonly 역할 검색", () => {
    // shop(pos7): (7-1)*5+(5-1)=34, cms(pos8): (8-1)*5+(5-1)=39
    expect(permCodec.matchRanges({ perm_svc: SVC.PROD_ASIA_PAYMENT_SHOP, role: "readonly" }))
      .toEqual([[34, 34]]);
    expect(permCodec.matchRanges({ perm_svc: SVC.PROD_ASIA_PAYMENT_CMS, role: "readonly" }))
      .toEqual([[39, 39]]);
  });
});

describe("3. Event Index (3D: event_svc × event_name × initiator)", () => {
  it("shape과 size가 정확하다", () => {
    expect(evtCodec.shape).toEqual([10, 7, 2]);
    expect(evtCodec.size).toBe(140);
  });

  it("prod/asia/shopping-web/shop + order.created + web 이벤트 인코딩", () => {
    const vv = evtCodec.encode({
      event_svc:  SVC.PROD_ASIA_SHOPPING_WEB_SHOP,
      event_name: "order.created",
      initiator:  "web",
    });
    // event_svc=40 → pos6, event_name=order.created → pos3, initiator=web → pos1
    // weights [14, 2, 1]
    // value = (6-1)*14 + (3-1)*2 + (1-1) = 70+4+0 = 74
    expect(vv.value).toBe(74);
  });

  it("이벤트 디코딩 후 event_svc를 service codec으로 역참조", () => {
    const vv = evtCodec.encode({
      event_svc:  SVC.PROD_ASIA_AUTH_SHOP,
      event_name: "user.login",
      initiator:  "mobile",
    });
    const evtCoords = evtCodec.decode(vv);
    expect(evtCoords.event_name).toBe("user.login");
    expect(evtCoords.initiator).toBe("mobile");

    // event_svc → service 역참조
    const svcCoords = svcCodec.decodeValue(evtCoords.event_svc as number);
    expect(svcCoords).toEqual({ env: "prod", region: "asia", svc_name: "auth", namespace: "shop" });
  });

  it("prod/asia/auth/shop에서 발생한 모든 이벤트(14개)가 연속 범위 [[98, 111]]", () => {
    // event_svc=44 → pos8, event_name/initiator wildcard
    // value = (8-1)*14 + 0..13 = 98..111
    expect(evtCodec.matchRanges({ event_svc: SVC.PROD_ASIA_AUTH_SHOP }))
      .toEqual([[98, 111]]);
  });

  it("prod/asia/payment/shop + payment.failed 이벤트 범위 (web·mobile 2개)", () => {
    // event_svc=46 → pos9, event_name=payment.failed → pos5, initiator wildcard
    // value = (9-1)*14 + (5-1)*2 + 0..1 = 112+8+0..1 = 120..121
    expect(evtCodec.matchRanges({
      event_svc:  SVC.PROD_ASIA_PAYMENT_SHOP,
      event_name: "payment.failed",
    })).toEqual([[120, 121]]);
  });

  it("dev 환경 서비스들(pos1~5)의 이벤트 범위는 0..69", () => {
    // dev 서비스 5개: pos1..pos5 → 각각 14개 주소 블록
    // pos1: 0..13, pos2: 14..27, pos3: 28..41, pos4: 42..55, pos5: 56..69
    const ranges: [number, number][] = [];
    for (const svc of [
      SVC.DEV_ASIA_SHOPPING_WEB_SHOP,
      SVC.DEV_ASIA_SHOPPING_BACKEND_SHOP,
      SVC.DEV_ASIA_AUTH_SHOP,
      SVC.DEV_ASIA_PAYMENT_SHOP,
      SVC.DEV_ASIA_GATEWAY_SHOP,
    ]) {
      const r = evtCodec.matchRanges({ event_svc: svc });
      ranges.push(...r);
    }
    // 연속 블록 5개: [[0,13],[14,27],[28,41],[42,55],[56,69]]
    expect(ranges).toEqual([[0, 13], [14, 27], [28, 41], [42, 55], [56, 69]]);
  });
});

describe("index_ref 체인 요약", () => {
  it("permission 주소 하나에서 서비스 좌표까지 전개 가능하다", () => {
    //   permission VersionedValue
    //     → permCodec.decode() → { perm_svc: number, role: string }
    //     → svcCodec.decodeValue(perm_svc) → { env, region, svc_name, namespace }

    const permAddr = permCodec.encode({ perm_svc: SVC.PROD_ASIA_GATEWAY_SHOP, role: "operator" });
    const { perm_svc, role } = permCodec.decode(permAddr);
    const svc = svcCodec.decodeValue(perm_svc as number);

    expect(role).toBe("operator");
    expect(svc.env).toBe("prod");
    expect(svc.svc_name).toBe("gateway");
    expect(svc.namespace).toBe("shop");
  });

  it("event 주소 하나에서 서비스 좌표까지 전개 가능하다", () => {
    const evtAddr = evtCodec.encode({
      event_svc:  SVC.DEV_ASIA_PAYMENT_SHOP,
      event_name: "order.paid",
      initiator:  "mobile",
    });
    const { event_svc, event_name, initiator } = evtCodec.decode(evtAddr);
    const svc = svcCodec.decodeValue(event_svc as number);

    expect(event_name).toBe("order.paid");
    expect(initiator).toBe("mobile");
    expect(svc.env).toBe("dev");
    expect(svc.svc_name).toBe("payment");
  });
});
