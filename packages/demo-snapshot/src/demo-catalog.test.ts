import { describe, it, expect } from "vitest";
import {
  DEMO_CATALOG,
  getPrefixStructure, getPrefixShape, getPrefixEntries,
  encodePrefix, decodePrefix, encodePrefixByValue,
  resolveAddress, decomposeAddress,
  verifyRoundTrip,
  catalogToRegistryInput,
  // compat 검증: 기존 상수와 카탈로그 파생 값 일치
  DEMO_ENVS, DEMO_REGIONS, DEMO_SVCS, DEMO_NSS,
  DEMO_ROLES_V1, DEMO_ROLES_V2, DEMO_ROLES_V3, DEMO_ROLES_V4,
  DEMO_EVENTS_V1, DEMO_EVENTS_V2, DEMO_EVENTS_V3, DEMO_EVENTS_V4,
  DEMO_ROLE_CAP, DEMO_EVENT_CAP,
  DEMO_INITIATORS, DEMO_KO,
  DEMO_SVC_SHAPE, DEMO_SVC_STRIDES,
  DEMO_PERM_SVC_VALUES, DEMO_EVT_SVC_VALUES,
  demoEncodeSvc, demoDecodeSvc,
  demoCalcPermAddr,
  AXIS, DEMO_DOMAINS,
  buildDemoSchemaSnapshot,
} from "./index.js";

// ── 카탈로그 파생값 검증 ─────────────────────────────────────────────────────

describe("DEMO_CATALOG 파생값 검증", () => {
  it("dimension entries가 기존 상수와 일치", () => {
    expect([...DEMO_ENVS]).toEqual(["dev", "stage", "prod", "test", "local"]);
    expect([...DEMO_REGIONS]).toEqual(["asia", "usa"]);
    expect([...DEMO_SVCS]).toEqual(["shopping-web", "shopping-backend", "auth", "payment", "gateway"]);
    expect([...DEMO_NSS]).toEqual(["shop", "cms"]);
    expect([...DEMO_INITIATORS]).toEqual(["web", "mobile"]);
  });

  it("버전별 role entries/capacity", () => {
    expect([...DEMO_ROLES_V1]).toEqual(["admin", "developer", "operator", "viewer", "readonly"]);
    expect([...DEMO_ROLES_V2]).toEqual(["admin", "developer", "operator", "viewer", "readonly", "customer"]);
    expect([...DEMO_ROLES_V3]).toEqual([...DEMO_ROLES_V2]);
    expect([...DEMO_ROLES_V4]).toEqual(["admin", "developer", "operator", "viewer", "readonly", "customer", "auditor"]);
    expect(DEMO_ROLE_CAP).toEqual({ v1: 5, v2: 6, v3: 8, v4: 8 });
  });

  it("버전별 event entries/capacity", () => {
    expect(DEMO_EVENTS_V1.length).toBe(7);
    expect(DEMO_EVENTS_V2.length).toBe(9);
    expect([...DEMO_EVENTS_V3]).toEqual([...DEMO_EVENTS_V2]);
    expect(DEMO_EVENTS_V4.length).toBe(10);
    expect(DEMO_EVENT_CAP).toEqual({ v1: 7, v2: 9, v3: 12, v4: 12 });
  });

  it("SVC shape & strides", () => {
    expect([...DEMO_SVC_SHAPE]).toEqual([5, 2, 5, 2]);
    expect([...DEMO_SVC_STRIDES]).toEqual([20, 10, 2, 1]);
  });

  it("demoEncodeSvc/demoDecodeSvc 라운드트립", () => {
    const coords = [3, 1, 4, 1] as const;
    const encoded = demoEncodeSvc(coords);
    const decoded = demoDecodeSvc(encoded);
    expect(decoded).toEqual([...coords]);
  });

  it("cross-index address values", () => {
    expect([...DEMO_PERM_SVC_VALUES]).toEqual([40, 41, 42, 43, 44, 45, 46, 47, 48, 49]);
    expect([...DEMO_EVT_SVC_VALUES]).toEqual([0, 2, 4, 6, 8, 40, 42, 44, 46, 48]);
  });

  it("DEMO_KO 키 매핑 (svc→svc_name, ns→namespace)", () => {
    expect(DEMO_KO.svc["shopping-web"]).toBe("쇼핑웹");
    expect(DEMO_KO.ns["shop"]).toBe("쇼핑몰");
    expect(DEMO_KO.role["auditor"]).toBe("감사자"); // v4 ko 포함
    expect(DEMO_KO.event["payment.refunded"]).toBe("환불완료"); // v4 ko 포함
  });

  it("AXIS 카탈로그 — rbac_role → role 매핑", () => {
    expect(AXIS.role.id).toBe("role");
    expect(AXIS.role.entries).toEqual(["admin", "editor", "viewer"]);
    expect(AXIS.role.capacity).toBe(8);
  });

  it("DEMO_DOMAINS 키 목록", () => {
    expect(Object.keys(DEMO_DOMAINS)).toEqual(["rbac", "content", "tracking", "relational"]);
  });

  it("buildDemoSchemaSnapshot 정상 동작", () => {
    const snap = buildDemoSchemaSnapshot("v1");
    expect(snap.version).toBe("v1");
    expect(Object.keys(snap.axes)).toContain("role");
    expect(Object.keys(snap.domains)).toContain("rbac");
  });
});

// ── 선택적 접근 API ──────────────────────────────────────────────────────────

describe("getPrefixStructure", () => {
  it("permission prefix 구조", () => {
    const s = getPrefixStructure(DEMO_CATALOG, "permission");
    expect(s.labels).toEqual(["perm_svc", "role"]);
    expect(s.versions).toEqual(["v1", "v2", "v3", "v4"]);
  });
});

describe("getPrefixShape", () => {
  it("permission v1 → [10, 5]", () => {
    const s = getPrefixShape(DEMO_CATALOG, "permission", "v1");
    expect(s.shape).toEqual([10, 5]);
    expect(s.capacity).toBe(50);
  });

  it("permission v3 → [10, 8]", () => {
    const s = getPrefixShape(DEMO_CATALOG, "permission", "v3");
    expect(s.shape).toEqual([10, 8]);
    expect(s.capacity).toBe(80);
  });

  it("service v1 → [5, 2, 5, 2]", () => {
    const s = getPrefixShape(DEMO_CATALOG, "service", "v1");
    expect(s.shape).toEqual([5, 2, 5, 2]);
    expect(s.capacity).toBe(100);
  });

  it("event v1 → [10, 7, 2]", () => {
    const s = getPrefixShape(DEMO_CATALOG, "event", "v1");
    expect(s.shape).toEqual([10, 7, 2]);
    expect(s.capacity).toBe(140);
  });

  it("rbac v1 → [8, 4, 16]", () => {
    const s = getPrefixShape(DEMO_CATALOG, "rbac", "v1");
    expect(s.shape).toEqual([8, 4, 16]);
    expect(s.capacity).toBe(512);
  });
});

describe("getPrefixEntries", () => {
  it("permission v1 entries", () => {
    const e = getPrefixEntries(DEMO_CATALOG, "permission", "v1");
    expect(e.entries.perm_svc).toEqual([40, 41, 42, 43, 44, 45, 46, 47, 48, 49]);
    expect(e.entries.role).toEqual(["admin", "developer", "operator", "viewer", "readonly"]);
    expect(e.ko.role?.admin).toBe("관리자");
  });
});

// ── 브릿지 ───────────────────────────────────────────────────────────────────

describe("catalogToRegistryInput", () => {
  it("기존 buildDemoRegistryInput과 구조적으로 동일한 결과", () => {
    const input = catalogToRegistryInput();
    // dims
    expect(Object.keys(input.dims)).toContain("env");
    expect(Object.keys(input.dims)).toContain("perm_svc");
    expect(Object.keys(input.dims)).toContain("role");
    expect(Object.keys(input.dims)).toContain("event_name");
    // indices
    expect(Object.keys(input.indices)).toEqual(["service", "permission", "event"]);
    expect(input.indices.service.dims).toEqual(["env", "region", "svc_name", "namespace"]);
    expect(input.indices.permission.dims).toEqual(["perm_svc", "role"]);
  });

  it("perm_svc는 index_ref 타입", () => {
    const input = catalogToRegistryInput();
    expect(input.dims.perm_svc.kind.type).toBe("index_ref");
  });
});

// ── demoCalcPermAddr 일관성 (카탈로그 shape 기반) ────────────────────────────

describe("demoCalcPermAddr — 카탈로그와 일관", () => {
  it("v1: svcPos=1, rolePos=1 → addr 0", () => {
    expect(demoCalcPermAddr(1, 1, "v1")).toBe(0);
  });

  it("v3: shape 변경 반영 (role capacity 8)", () => {
    // svcPos=2, rolePos=1 → (2-1)*8 + 0 = 8
    expect(demoCalcPermAddr(2, 1, "v3")).toBe(8);
  });
});

// ══════════════════════════════════════════════════════════════════════════════
//  차원 합성·분해·의미 해석 (encode / decode / resolve)
// ══════════════════════════════════════════════════════════════════════════════

describe("encodePrefix / decodePrefix — 기본 라운드트립", () => {
  it("service prefix: 0-based position 인코딩", () => {
    // env=prod(2), region=asia(0), svc=shopping-web(0), ns=shop(0)
    const addr = encodePrefix(DEMO_CATALOG, "service", "v1", {
      env: 2, region: 0, svc_name: 0, namespace: 0,
    });
    // shape [5,2,5,2], strides [20,10,2,1] → 2*20 + 0*10 + 0*2 + 0*1 = 40
    expect(addr).toBe(40);

    const decoded = decodePrefix(DEMO_CATALOG, "service", "v1", 40);
    expect(decoded.env.position).toBe(2);
    expect(decoded.env.value).toBe("prod");
    expect(decoded.region.position).toBe(0);
    expect(decoded.region.value).toBe("asia");
    expect(decoded.svc_name.position).toBe(0);
    expect(decoded.svc_name.value).toBe("shopping-web");
    expect(decoded.namespace.position).toBe(0);
    expect(decoded.namespace.value).toBe("shop");
  });

  it("permission prefix: prefix_ref 차원 포함", () => {
    // perm_svc=pos0(value=40), role=pos3(value="viewer")
    const addr = encodePrefix(DEMO_CATALOG, "permission", "v1", {
      perm_svc: 0, role: 3,
    });
    expect(addr).toBe(3); // 0*5 + 3

    const decoded = decodePrefix(DEMO_CATALOG, "permission", "v1", 3);
    expect(decoded.perm_svc.position).toBe(0);
    expect(decoded.perm_svc.value).toBe(40); // service address
    expect(decoded.role.position).toBe(3);
    expect(decoded.role.value).toBe("viewer");
  });
});

describe("encodePrefixByValue — 의미값으로 인코딩", () => {
  it("permission: { perm_svc: 40, role: 'admin' } → 0", () => {
    const addr = encodePrefixByValue(DEMO_CATALOG, "permission", "v1", {
      perm_svc: 40, role: "admin",
    });
    expect(addr).toBe(0);
  });

  it("permission: { perm_svc: 42, role: 'viewer' } → 13", () => {
    // perm_svc=42 → pos=2 in refEntries, role='viewer' → pos=3
    // 2*5 + 3 = 13
    const addr = encodePrefixByValue(DEMO_CATALOG, "permission", "v1", {
      perm_svc: 42, role: "viewer",
    });
    expect(addr).toBe(13);
  });

  it("service: { env: 'prod', region: 'asia', svc_name: 'shopping-web', namespace: 'shop' } → 40", () => {
    const addr = encodePrefixByValue(DEMO_CATALOG, "service", "v1", {
      env: "prod", region: "asia", svc_name: "shopping-web", namespace: "shop",
    });
    expect(addr).toBe(40);
  });
});

describe("resolveAddress — 재귀 의미 해석", () => {
  it("permission addr=3 → role='viewer' + perm_svc가 service prefix로 재귀 resolve", () => {
    const r = resolveAddress(DEMO_CATALOG, "permission", "v1", 3);
    expect(r.prefix).toBe("permission");
    expect(r.address).toBe(3);

    // role 차원: 직접 axis
    expect(r.dims.role.value).toBe("viewer");
    expect(r.dims.role.ko).toBe("뷰어");

    // perm_svc 차원: prefix_ref → service prefix 재귀 resolve
    expect(r.dims.perm_svc.value).toBe(40); // service address
    expect(r.dims.perm_svc.ref).toBeDefined();
    const svcRef = r.dims.perm_svc.ref!;
    expect(svcRef.prefix).toBe("service");
    expect(svcRef.address).toBe(40);
    expect(svcRef.dims.env.value).toBe("prod");
    expect(svcRef.dims.env.ko).toBe("운영");
    expect(svcRef.dims.svc_name.value).toBe("shopping-web");
    expect(svcRef.dims.svc_name.ko).toBe("쇼핑웹");
  });

  it("service addr=0 → env=dev, region=asia, svc_name=shopping-web, namespace=shop", () => {
    const r = resolveAddress(DEMO_CATALOG, "service", "v1", 0);
    expect(r.dims.env.value).toBe("dev");
    expect(r.dims.env.ko).toBe("개발");
    expect(r.dims.region.value).toBe("asia");
    expect(r.dims.namespace.value).toBe("shop");
  });
});

describe("decomposeAddress — 차원별 분해 (prefix_ref 포함)", () => {
  it("permission addr=13 → perm_svc=42 → service decode", () => {
    const d = decomposeAddress(DEMO_CATALOG, "permission", "v1", 13);

    expect(d.role.value).toBe("viewer");
    expect(d.role.position).toBe(3);

    // perm_svc: prefix_ref 분해
    expect(d.perm_svc.refAddress).toBe(42);
    expect(d.perm_svc.refDims).toBeDefined();
    expect(d.perm_svc.refDims!.env.value).toBe("prod");
    expect(d.perm_svc.refDims!.svc_name.value).toBe("shopping-backend");
    expect(d.perm_svc.refDims!.namespace.value).toBe("shop");
  });
});

describe("차원 합성·분해 동치성", () => {
  it("encode(decode(addr)) === addr — permission 전 범위", () => {
    const result = verifyRoundTrip(DEMO_CATALOG, "permission", "v1");
    expect(result.valid).toBe(true);
    expect(result.capacity).toBe(50);
  });

  it("encode(decode(addr)) === addr — service 전 범위", () => {
    const result = verifyRoundTrip(DEMO_CATALOG, "service", "v1");
    expect(result.valid).toBe(true);
    expect(result.capacity).toBe(100);
  });

  it("encode(decode(addr)) === addr — event 전 범위", () => {
    const result = verifyRoundTrip(DEMO_CATALOG, "event", "v1");
    expect(result.valid).toBe(true);
    expect(result.capacity).toBe(140);
  });

  it("encode(decode(addr)) === addr — rbac 전 범위", () => {
    const result = verifyRoundTrip(DEMO_CATALOG, "rbac", "v1");
    expect(result.valid).toBe(true);
    expect(result.capacity).toBe(512);
  });

  it("encodePrefixByValue → resolveAddress 왕복 일관성", () => {
    // service에서 의미값으로 인코딩 → resolve로 다시 의미값 추출
    const addr = encodePrefixByValue(DEMO_CATALOG, "service", "v1", {
      env: "stage", region: "usa", svc_name: "auth", namespace: "cms",
    });
    const r = resolveAddress(DEMO_CATALOG, "service", "v1", addr);
    expect(r.dims.env.value).toBe("stage");
    expect(r.dims.region.value).toBe("usa");
    expect(r.dims.svc_name.value).toBe("auth");
    expect(r.dims.namespace.value).toBe("cms");
  });

  it("prefix_ref 합성: service addr → permission encode → decompose → 동일 service addr", () => {
    // 1) service 주소 생성
    const svcAddr = encodePrefixByValue(DEMO_CATALOG, "service", "v1", {
      env: "prod", region: "asia", svc_name: "payment", namespace: "shop",
    });
    expect(svcAddr).toBe(46); // prod(2)*20 + asia(0)*10 + payment(3)*2 + shop(0)*1

    // 2) permission 인코딩: svcAddr=46 + role=admin
    const permAddr = encodePrefixByValue(DEMO_CATALOG, "permission", "v1", {
      perm_svc: 46, role: "admin",
    });

    // 3) decompose → perm_svc의 refAddress가 원래 service addr와 동일
    const decomposed = decomposeAddress(DEMO_CATALOG, "permission", "v1", permAddr);
    expect(decomposed.perm_svc.refAddress).toBe(svcAddr);
    expect(decomposed.role.value).toBe("admin");

    // 4) refDims가 원래 service 좌표와 동일
    expect(decomposed.perm_svc.refDims!.env.value).toBe("prod");
    expect(decomposed.perm_svc.refDims!.svc_name.value).toBe("payment");
    expect(decomposed.perm_svc.refDims!.namespace.value).toBe("shop");
  });
});

describe("버전 간 shape 변경과 주소 해석 일관성", () => {
  it("permission v1 vs v3: 동일 의미값 → 다른 주소 (shape 변경)", () => {
    // v1: shape [10,5], v3: shape [10,8]
    const addrV1 = encodePrefixByValue(DEMO_CATALOG, "permission", "v1", { perm_svc: 42, role: "admin" });
    const addrV3 = encodePrefixByValue(DEMO_CATALOG, "permission", "v3", { perm_svc: 42, role: "admin" });

    // v1: 2*5 + 0 = 10, v3: 2*8 + 0 = 16
    expect(addrV1).toBe(10);
    expect(addrV3).toBe(16);

    // 하지만 resolve하면 동일한 의미
    const r1 = resolveAddress(DEMO_CATALOG, "permission", "v1", addrV1);
    const r3 = resolveAddress(DEMO_CATALOG, "permission", "v3", addrV3);
    expect(r1.dims.role.value).toBe("admin");
    expect(r3.dims.role.value).toBe("admin");
    expect(r1.dims.perm_svc.value).toBe(42);
    expect(r3.dims.perm_svc.value).toBe(42);
  });

  it("permission v3 headroom 영역 (position >= entries.length)", () => {
    // v3 role capacity=8, entries=6 → position 6,7은 headroom
    const addr = encodePrefix(DEMO_CATALOG, "permission", "v3", { perm_svc: 0, role: 6 });
    const decoded = decodePrefix(DEMO_CATALOG, "permission", "v3", addr);
    expect(decoded.role.value).toBe("(reserved:6)");
  });
});
