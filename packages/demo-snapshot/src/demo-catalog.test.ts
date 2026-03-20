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

  it("버전별 role entries/capacity (SSOT 파생)", () => {
    expect([...DEMO_ROLES_V1]).toEqual(["admin", "developer", "operator", "viewer", "readonly"]);
    expect([...DEMO_ROLES_V2]).toEqual(["admin", "developer", "operator", "viewer", "readonly", "customer"]);
    expect([...DEMO_ROLES_V3]).toEqual([...DEMO_ROLES_V2]);
    expect([...DEMO_ROLES_V4]).toEqual(["admin", "developer", "operator", "viewer", "readonly", "customer", "auditor"]);
    // capacity는 DEMO_CATALOG에서 파생 — 하드코딩하지 않음
    for (const [v, cap] of Object.entries(DEMO_ROLE_CAP)) {
      const snap = (DEMO_CATALOG.axes.role.versions as Record<string, { capacity?: number; entries: readonly string[] }>)[v];
      expect(cap).toBe(snap.capacity ?? snap.entries.length);
    }
  });

  it("버전별 event entries/capacity (SSOT 파생)", () => {
    expect(DEMO_EVENTS_V1.length).toBe(7);
    expect(DEMO_EVENTS_V2.length).toBe(9);
    expect([...DEMO_EVENTS_V3]).toEqual([...DEMO_EVENTS_V2]);
    expect(DEMO_EVENTS_V4.length).toBe(10);
    // capacity는 DEMO_CATALOG에서 파생
    for (const [v, cap] of Object.entries(DEMO_EVENT_CAP)) {
      const snap = (DEMO_CATALOG.axes.event_name.versions as Record<string, { capacity?: number; entries: readonly string[] }>)[v];
      expect(cap).toBe(snap.capacity ?? snap.entries.length);
    }
  });

  it("SVC shape & strides (SSOT 파생)", () => {
    // shape는 catalog의 capacity에서 결정됨
    const svcShape = getPrefixShape(DEMO_CATALOG, "service", "v1");
    expect([...DEMO_SVC_SHAPE]).toEqual(svcShape.shape);
    // strides는 shape에서 결정됨
    expect(DEMO_SVC_STRIDES.length).toBe(4);
  });

  it("demoEncodeSvc/demoDecodeSvc 라운드트립", () => {
    const coords = [3, 1, 4, 1] as const;
    const encoded = demoEncodeSvc(coords);
    const decoded = demoDecodeSvc(encoded);
    expect(decoded).toEqual([...coords]);
  });

  it("cross-index address values (SSOT 파생)", () => {
    // refEntries 값은 DEMO_CATALOG에서 직접 파생
    const permV1 = DEMO_CATALOG.prefixes.permission.versions[0];
    const evtV1 = DEMO_CATALOG.prefixes.event.versions[0];
    expect([...DEMO_PERM_SVC_VALUES]).toEqual([...permV1.refEntries!.perm_svc.values]);
    expect([...DEMO_EVT_SVC_VALUES]).toEqual([...evtV1.refEntries!.evt_svc.values]);
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
    // capacity는 DEMO_CATALOG.axes.rbac_role에서 파생
    const rbacSnap = DEMO_CATALOG.axes.rbac_role.versions.v1;
    expect(AXIS.role.capacity).toBe(rbacSnap.capacity ?? rbacSnap.entries.length);
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

describe("getPrefixShape (SSOT 파생 검증)", () => {
  it("permission v1 — shape/capacity가 CATALOG에서 파생", () => {
    const s = getPrefixShape(DEMO_CATALOG, "permission", "v1");
    expect(s.shape.length).toBe(2); // perm_svc, role
    expect(s.capacity).toBe(s.shape.reduce((a: number, b: number) => a * b, 1));
  });

  it("permission v3 — role capacity 변경 반영", () => {
    const s = getPrefixShape(DEMO_CATALOG, "permission", "v3");
    expect(s.shape.length).toBe(2);
    // v3 role capacity가 반영됨
    const roleV3 = DEMO_CATALOG.axes.role.versions.v3;
    expect(s.shape[1]).toBe(roleV3.capacity ?? roleV3.entries.length);
  });

  it("service v1 — 4차원", () => {
    const s = getPrefixShape(DEMO_CATALOG, "service", "v1");
    expect(s.shape.length).toBe(4);
    expect(s.capacity).toBe(s.shape.reduce((a: number, b: number) => a * b, 1));
  });

  it("event v1 — 3차원 (evt_svc + event_name + initiator)", () => {
    const s = getPrefixShape(DEMO_CATALOG, "event", "v1");
    expect(s.shape.length).toBe(3);
    expect(s.capacity).toBe(s.shape.reduce((a: number, b: number) => a * b, 1));
  });

  it("rbac v1 — 3차원", () => {
    const s = getPrefixShape(DEMO_CATALOG, "rbac", "v1");
    expect(s.shape.length).toBe(3);
    expect(s.capacity).toBe(s.shape.reduce((a: number, b: number) => a * b, 1));
  });
});

describe("getPrefixEntries", () => {
  it("permission v1 entries", () => {
    const e = getPrefixEntries(DEMO_CATALOG, "permission", "v1");
    const refValues = DEMO_CATALOG.prefixes.permission.versions[0].refEntries!.perm_svc.values;
    expect(e.entries.perm_svc).toEqual([...refValues]);
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

describe("demoCalcPermAddr — 카탈로그와 일관 (SSOT 파생)", () => {
  it("v1: svcPos=1, rolePos=1 → addr 0", () => {
    expect(demoCalcPermAddr(1, 1, "v1")).toBe(0);
  });

  it("v3: shape 변경 반영 — SSOT에서 role capacity 파생", () => {
    // svcPos=2, rolePos=1 → (2-1) * roleCap + 0
    const roleCap = DEMO_CATALOG.axes.role.versions.v3.capacity ?? DEMO_CATALOG.axes.role.versions.v3.entries.length;
    expect(demoCalcPermAddr(2, 1, "v3")).toBe(roleCap);
  });
});

// ══════════════════════════════════════════════════════════════════════════════
//  차원 합성·분해·의미 해석 (encode / decode / resolve)
// ══════════════════════════════════════════════════════════════════════════════

describe("encodePrefix / decodePrefix — 기본 라운드트립 (SSOT 파생)", () => {
  it("service prefix: encode → decode 라운드트립", () => {
    // 의미값으로 인코딩하여 주소를 SSOT에서 파생
    const addr = encodePrefixByValue(DEMO_CATALOG, "service", "v1", {
      env: "prod", region: "asia", svc_name: "shopping-web", namespace: "shop",
    });

    const decoded = decodePrefix(DEMO_CATALOG, "service", "v1", addr);
    expect(decoded.env.position).toBe(2); // prod = index 2
    expect(decoded.env.value).toBe("prod");
    expect(decoded.region.position).toBe(0);
    expect(decoded.region.value).toBe("asia");
    expect(decoded.svc_name.position).toBe(0);
    expect(decoded.svc_name.value).toBe("shopping-web");
    expect(decoded.namespace.position).toBe(0);
    expect(decoded.namespace.value).toBe("shop");
  });

  it("permission prefix: prefix_ref 차원 포함", () => {
    // 먼저 service 주소를 SSOT에서 파생
    const svcAddr = encodePrefixByValue(DEMO_CATALOG, "service", "v1", {
      env: "prod", region: "asia", svc_name: "shopping-web", namespace: "shop",
    });

    const addr = encodePrefix(DEMO_CATALOG, "permission", "v1", {
      perm_svc: 0, role: 3,
    });
    const decoded = decodePrefix(DEMO_CATALOG, "permission", "v1", addr);
    expect(decoded.perm_svc.position).toBe(0);
    // perm_svc value는 refEntries의 첫 번째 값
    expect(decoded.perm_svc.value).toBe(DEMO_CATALOG.prefixes.permission.versions[0].refEntries!.perm_svc.values[0]);
    expect(decoded.role.position).toBe(3);
    expect(decoded.role.value).toBe("viewer");
  });
});

describe("encodePrefixByValue — 의미값으로 인코딩 (라운드트립)", () => {
  it("permission: encode → decode 라운드트립", () => {
    const refValues = DEMO_CATALOG.prefixes.permission.versions[0].refEntries!.perm_svc.values;
    const addr = encodePrefixByValue(DEMO_CATALOG, "permission", "v1", {
      perm_svc: refValues[0], role: "admin",
    });
    const decoded = decodePrefix(DEMO_CATALOG, "permission", "v1", addr);
    expect(decoded.role.value).toBe("admin");
    expect(decoded.perm_svc.value).toBe(refValues[0]);
  });

  it("permission: refEntries[2] + viewer → decode 일치 (SSOT 파생)", () => {
    const refValues = DEMO_CATALOG.prefixes.permission.versions[0].refEntries!.perm_svc.values;
    const svcAddr = refValues[2]; // 3번째 서비스
    const addr = encodePrefixByValue(DEMO_CATALOG, "permission", "v1", {
      perm_svc: svcAddr, role: "viewer",
    });
    const decoded = decodePrefix(DEMO_CATALOG, "permission", "v1", addr);
    expect(decoded.perm_svc.value).toBe(svcAddr);
    expect(decoded.role.value).toBe("viewer");
  });

  it("service: 의미값 인코딩 → 디코딩 일치", () => {
    const addr = encodePrefixByValue(DEMO_CATALOG, "service", "v1", {
      env: "prod", region: "asia", svc_name: "shopping-web", namespace: "shop",
    });
    const decoded = decodePrefix(DEMO_CATALOG, "service", "v1", addr);
    expect(decoded.env.value).toBe("prod");
    expect(decoded.region.value).toBe("asia");
    expect(decoded.svc_name.value).toBe("shopping-web");
    expect(decoded.namespace.value).toBe("shop");
  });
});

describe("resolveAddress — 재귀 의미 해석 (SSOT 파생)", () => {
  it("permission: viewer + 첫 번째 service → 재귀 resolve", () => {
    // 의미값으로 주소 파생 (하드코딩 없음)
    const refValues = DEMO_CATALOG.prefixes.permission.versions[0].refEntries!.perm_svc.values;
    const addr = encodePrefixByValue(DEMO_CATALOG, "permission", "v1", {
      perm_svc: refValues[0], role: "viewer",
    });

    const r = resolveAddress(DEMO_CATALOG, "permission", "v1", addr);
    expect(r.prefix).toBe("permission");
    expect(r.dims.role.value).toBe("viewer");
    expect(r.dims.role.ko).toBe("뷰어");

    // perm_svc → service 재귀 resolve
    expect(r.dims.perm_svc.value).toBe(refValues[0]);
    expect(r.dims.perm_svc.ref).toBeDefined();
    const svcRef = r.dims.perm_svc.ref!;
    expect(svcRef.prefix).toBe("service");
  });

  it("service addr=0 → env=dev, region=asia", () => {
    const r = resolveAddress(DEMO_CATALOG, "service", "v1", 0);
    expect(r.dims.env.value).toBe("dev");
    expect(r.dims.env.ko).toBe("개발");
    expect(r.dims.region.value).toBe("asia");
    expect(r.dims.namespace.value).toBe("shop");
  });
});

describe("decomposeAddress — 차원별 분해 (SSOT 파생)", () => {
  it("permission: refEntries[2] + viewer → decompose (SSOT 파생)", () => {
    const refValues = DEMO_CATALOG.prefixes.permission.versions[0].refEntries!.perm_svc.values;
    const svcAddr = refValues[2];
    const addr = encodePrefixByValue(DEMO_CATALOG, "permission", "v1", {
      perm_svc: svcAddr, role: "viewer",
    });
    const d = decomposeAddress(DEMO_CATALOG, "permission", "v1", addr);

    expect(d.role.value).toBe("viewer");
    expect(d.perm_svc.refAddress).toBe(svcAddr);
    expect(d.perm_svc.refDims).toBeDefined();
  });
});

describe("차원 합성·분해 동치성 (capacity-independent)", () => {
  it("encode(decode(addr)) === addr — permission 전 범위", () => {
    const result = verifyRoundTrip(DEMO_CATALOG, "permission", "v1");
    expect(result.valid).toBe(true);
    // capacity는 SSOT에서 파생
    const shape = getPrefixShape(DEMO_CATALOG, "permission", "v1");
    expect(result.capacity).toBe(shape.capacity);
  });

  it("encode(decode(addr)) === addr — service 전 범위", () => {
    const result = verifyRoundTrip(DEMO_CATALOG, "service", "v1");
    expect(result.valid).toBe(true);
    const shape = getPrefixShape(DEMO_CATALOG, "service", "v1");
    expect(result.capacity).toBe(shape.capacity);
  });

  it("encode(decode(addr)) === addr — event 전 범위", () => {
    const result = verifyRoundTrip(DEMO_CATALOG, "event", "v1");
    expect(result.valid).toBe(true);
  });

  it("encode(decode(addr)) === addr — rbac 전 범위", () => {
    const result = verifyRoundTrip(DEMO_CATALOG, "rbac", "v1");
    expect(result.valid).toBe(true);
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

  it("prefix_ref 합성: refEntries 값 → permission encode → decompose → 동일 refAddress", () => {
    // refEntries에서 SSOT 값 가져오기 (하드코딩 없음)
    const refValues = DEMO_CATALOG.prefixes.permission.versions[0].refEntries!.perm_svc.values;
    const svcAddr = refValues[0]; // 첫 번째 서비스 주소

    // permission 인코딩
    const permAddr = encodePrefixByValue(DEMO_CATALOG, "permission", "v1", {
      perm_svc: svcAddr, role: "admin",
    });

    // decompose → perm_svc의 refAddress가 원래 service addr와 동일
    const decomposed = decomposeAddress(DEMO_CATALOG, "permission", "v1", permAddr);
    expect(decomposed.perm_svc.refAddress).toBe(svcAddr);
    expect(decomposed.role.value).toBe("admin");

    // refDims에서 service 좌표 검증
    expect(decomposed.perm_svc.refDims).toBeDefined();
  });
});

describe("버전 간 shape 변경과 주소 해석 일관성 (SSOT 파생)", () => {
  it("permission v1 vs v3: 동일 의미값 → resolve하면 동일한 의미", () => {
    const refValues = DEMO_CATALOG.prefixes.permission.versions[0].refEntries!.perm_svc.values;
    const svcAddr = refValues[2]; // SSOT에서 파생
    const addrV1 = encodePrefixByValue(DEMO_CATALOG, "permission", "v1", { perm_svc: svcAddr, role: "admin" });
    const addrV3 = encodePrefixByValue(DEMO_CATALOG, "permission", "v3", { perm_svc: svcAddr, role: "admin" });

    // shape이 다르므로 주소도 다를 수 있음 (capacity 변경)
    // 하지만 resolve하면 동일한 의미 → 이것이 문자열 고정의 핵심
    const r1 = resolveAddress(DEMO_CATALOG, "permission", "v1", addrV1);
    const r3 = resolveAddress(DEMO_CATALOG, "permission", "v3", addrV3);
    expect(r1.dims.role.value).toBe("admin");
    expect(r3.dims.role.value).toBe("admin");
    expect(r1.dims.perm_svc.value).toBe(svcAddr);
    expect(r3.dims.perm_svc.value).toBe(svcAddr);
  });

  it("permission v3 headroom 영역", () => {
    // v3 role: entries 길이 이상의 position은 headroom
    const roleV3 = DEMO_CATALOG.axes.role.versions.v3;
    const headroomPos = roleV3.entries.length; // entries 바로 다음
    const addr = encodePrefix(DEMO_CATALOG, "permission", "v3", { perm_svc: 0, role: headroomPos });
    const decoded = decodePrefix(DEMO_CATALOG, "permission", "v3", addr);
    expect(decoded.role.value).toBe(`(reserved:${headroomPos})`);
  });
});
