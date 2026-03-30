/**
 * DecodeResult 통일 타입 테스트.
 *
 * 검증 항목:
 * 1. L1/L2/L3 → DecodeResult 변환 정합성
 * 2. S계열 ↔ DecodeResult 라운드트립
 * 3. prefix_ref 재귀 refs 구조
 * 4. kind 판별 정확성
 */
import { describe, it, expect } from "vitest";
import type { Catalog } from "./catalog.types.js";
import {
  decodePrefix,
  resolveAddress,
  decomposeAddress,
  encodePrefix,
  decodePrefixAsResult,
  resolveAddressAsResult,
  decomposeAddressAsResult,
} from "./runtime.js";
import {
  entitiesToDecodeResult,
  decodeResultToEntities,
  decodeResultToDeep,
  type DecodeResult,
} from "./decode-result.js";

// ── 테스트용 미니 카탈로그 ────────────────────────────────────

const TEST_CATALOG: Catalog = {
  id: "test",
  name: "Test",
  axes: {
    env: {
      id: "env", name: "환경",
      versions: { v1: { entries: ["dev", "prod"], capacity: 4, ko: { dev: "개발", prod: "운영" } } },
    },
    region: {
      id: "region", name: "리전",
      versions: { v1: { entries: ["asia", "usa"], capacity: 4 } },
    },
    role: {
      id: "role", name: "역할",
      versions: { v1: { entries: ["admin", "viewer"], capacity: 4, ko: { admin: "관리자", viewer: "뷰어" } } },
    },
  },
  prefixes: {
    service: {
      id: "service", name: "서비스",
      labels: ["env", "region"],
      dims: {
        env: { kind: "axis" as const, axisId: "env" },
        region: { kind: "axis" as const, axisId: "region" },
      },
      versions: [{ version: "v1", axisVersions: { env: "v1", region: "v1" } }],
    },
    permission: {
      id: "permission", name: "권한",
      labels: ["svc_ref", "role"],
      dims: {
        svc_ref: { kind: "prefix_ref" as const, prefixId: "service" },
        role: { kind: "axis" as const, axisId: "role" },
      },
      versions: [{
        version: "v1",
        axisVersions: { role: "v1" },
        refEntries: { svc_ref: { values: [0, 1, 5], refVersion: "v1" } },
      }],
    },
  },
};

// service: shape=[4,4], strides=[4,1]
// addr 0 = { env: "dev", region: "asia" }
// addr 5 = { env: 1("prod"), region: 1("usa") }

// permission: shape=[3,4] (refEntries 3개 × role capacity 4)
// addr 0 = { svc_ref: 0(→service addr 0), role: "admin" }

const SVC_ADDR_0 = 0; // dev/asia
const PERM_ADDR_0 = 0; // svc_ref=0 → service:0, role=admin

// ── L1: decodePrefixAsResult ───────────────────────────────────

describe("decodePrefixAsResult (L1 → DecodeResult)", () => {
  it("axis 차원이 kind=axis로 반환된다", () => {
    const result = decodePrefixAsResult(TEST_CATALOG, "service", "v1", SVC_ADDR_0);

    expect(result.prefix).toBe("service");
    expect(result.version).toBe("v1");
    expect(result.address).toBe(SVC_ADDR_0);
    expect(result.dims["env"].kind).toBe("axis");
    expect(result.dims["env"].label).toBe("env");
    expect(result.dims["env"].value).toBe("dev");
    expect(result.dims["env"].position).toBe(0);
  });

  it("기존 decodePrefix 결과와 값이 일치한다", () => {
    const old = decodePrefix(TEST_CATALOG, "service", "v1", SVC_ADDR_0);
    const result = decodePrefixAsResult(TEST_CATALOG, "service", "v1", SVC_ADDR_0);

    for (const [label, oldDim] of Object.entries(old)) {
      expect(result.dims[label].position).toBe(oldDim.position);
      expect(result.dims[label].value).toBe(oldDim.value);
    }
  });

  it("모든 dim에 label과 kind가 명시되어 있다", () => {
    const result = decodePrefixAsResult(TEST_CATALOG, "service", "v1", SVC_ADDR_0);
    for (const [label, dim] of Object.entries(result.dims)) {
      expect(dim.label).toBe(label);
      expect(["axis", "prefix_ref", "table_ref"]).toContain(dim.kind);
    }
  });
});

// ── L1 with prefix_ref ─────────────────────────────────────────

describe("decodePrefixAsResult — prefix_ref dim", () => {
  it("prefix_ref 차원이 kind=prefix_ref + 정수 value로 반환된다", () => {
    const result = decodePrefixAsResult(TEST_CATALOG, "permission", "v1", PERM_ADDR_0);

    const svcDim = result.dims["svc_ref"];
    expect(svcDim).toBeDefined();
    expect(svcDim.kind).toBe("prefix_ref");
    expect(typeof svcDim.value).toBe("number");
    expect(svcDim.ref).toBeUndefined(); // L1은 ref 없음
  });

  it("axis 차원과 prefix_ref 차원이 공존한다", () => {
    const result = decodePrefixAsResult(TEST_CATALOG, "permission", "v1", PERM_ADDR_0);

    expect(result.dims["role"].kind).toBe("axis");
    expect(typeof result.dims["role"].value).toBe("string");
    expect(result.dims["svc_ref"].kind).toBe("prefix_ref");
    expect(typeof result.dims["svc_ref"].value).toBe("number");
  });
});

// ── L2: resolveAddressAsResult ─────────────────────────────────

describe("resolveAddressAsResult (L2 → DecodeResult)", () => {
  it("axis 차원에 ko가 포함된다", () => {
    const result = resolveAddressAsResult(TEST_CATALOG, "service", "v1", SVC_ADDR_0);
    expect(result.dims["env"].ko).toBe("개발");
  });

  it("prefix_ref 차원에 ref가 재귀적으로 채워진다", () => {
    const result = resolveAddressAsResult(TEST_CATALOG, "permission", "v1", PERM_ADDR_0);

    const svcDim = result.dims["svc_ref"];
    expect(svcDim.kind).toBe("prefix_ref");
    expect(svcDim.ref).toBeDefined();
    expect(svcDim.ref!.prefix).toBe("service");
    expect(svcDim.ref!.dims["env"]).toBeDefined();
    expect(typeof svcDim.ref!.dims["env"].value).toBe("string");
  });

  it("기존 resolveAddress 결과와 값이 일치한다", () => {
    const old = resolveAddress(TEST_CATALOG, "service", "v1", SVC_ADDR_0);
    const result = resolveAddressAsResult(TEST_CATALOG, "service", "v1", SVC_ADDR_0);

    for (const [label, oldDim] of Object.entries(old.dims)) {
      expect(result.dims[label].value).toBe(oldDim.value);
      expect(result.dims[label].position).toBe(oldDim.position);
      if (oldDim.ko) expect(result.dims[label].ko).toBe(oldDim.ko);
    }
  });
});

// ── L3: decomposeAddressAsResult ───────────────────────────────

describe("decomposeAddressAsResult (L3 → DecodeResult)", () => {
  it("prefix_ref 차원에 ref(1-level)가 채워진다", () => {
    const result = decomposeAddressAsResult(TEST_CATALOG, "permission", "v1", PERM_ADDR_0);

    const svcDim = result.dims["svc_ref"];
    expect(svcDim.ref).toBeDefined();
    expect(svcDim.ref!.prefix).toBe("service");
    expect(Object.keys(svcDim.ref!.dims).length).toBeGreaterThan(0);
  });

  it("기존 decomposeAddress 결과와 값이 일치한다", () => {
    const old = decomposeAddress(TEST_CATALOG, "permission", "v1", PERM_ADDR_0);
    const result = decomposeAddressAsResult(TEST_CATALOG, "permission", "v1", PERM_ADDR_0);

    for (const [label, oldDim] of Object.entries(old)) {
      expect(result.dims[label].position).toBe(oldDim.position);
      expect(result.dims[label].value).toBe(oldDim.value);
    }
  });
});

// ── S계열 변환 라운드트립 ──────────────────────────────────────

describe("entitiesToDecodeResult ↔ decodeResultToEntities", () => {
  it("flat entities → DecodeResult → flat entities 라운드트립", () => {
    const entities = { role: "admin", env: "prod" };
    const result = entitiesToDecodeResult("test", "v1", 42, entities);

    expect(result.prefix).toBe("test");
    expect(result.version).toBe("v1");
    expect(result.address).toBe(42);

    const back = decodeResultToEntities(result);
    expect(back).toEqual(entities);
  });

  it("dimKinds를 명시하면 kind가 정확히 반영된다", () => {
    const result = entitiesToDecodeResult("perm", "v1", 0,
      { svc_ref: 42, role: "admin" },
      { svc_ref: "prefix_ref", role: "axis" },
    );
    expect(result.dims["svc_ref"].kind).toBe("prefix_ref");
    expect(result.dims["role"].kind).toBe("axis");
  });

  it("dimKinds 미지정 시 number→prefix_ref, string→axis 자동 판별", () => {
    const result = entitiesToDecodeResult("test", "v1", 0,
      { svc_ref: 100, action: "read" },
    );
    expect(result.dims["svc_ref"].kind).toBe("prefix_ref");
    expect(result.dims["action"].kind).toBe("axis");
  });
});

// ── decodeResultToDeep ─────────────────────────────────────────

describe("decodeResultToDeep", () => {
  it("ref가 있는 dim은 refs에 펼쳐진다", () => {
    const result: DecodeResult = {
      prefix: "permission", version: "v1", address: 0,
      dims: {
        svc_ref: {
          label: "svc_ref", kind: "prefix_ref", position: 0, value: 0,
          ref: {
            prefix: "service", version: "v1", address: 0,
            dims: {
              env: { label: "env", kind: "axis", position: 0, value: "dev" },
              region: { label: "region", kind: "axis", position: 0, value: "asia" },
            },
          },
        },
        role: { label: "role", kind: "axis", position: 0, value: "admin" },
      },
    };

    const deep = decodeResultToDeep(result);
    expect(deep.entities).toEqual({ svc_ref: 0, role: "admin" });
    expect(deep.refs["svc_ref"]).toEqual({ env: "dev", region: "asia" });
    expect(deep.refs["role"]).toBeUndefined();
  });

  it("ref가 없으면 refs는 빈 객체", () => {
    const result: DecodeResult = {
      prefix: "service", version: "v1", address: 0,
      dims: {
        env: { label: "env", kind: "axis", position: 0, value: "dev" },
      },
    };
    expect(decodeResultToDeep(result).refs).toEqual({});
  });
});

// ── L→S 변환 일관성 ────────────────────────────────────────────

describe("L→S 변환 일관성", () => {
  it("decodePrefixAsResult → decodeResultToEntities === decodePrefix values", () => {
    const result = decodePrefixAsResult(TEST_CATALOG, "service", "v1", SVC_ADDR_0);
    const flat = decodeResultToEntities(result);
    const old = decodePrefix(TEST_CATALOG, "service", "v1", SVC_ADDR_0);

    for (const [label, dim] of Object.entries(old)) {
      expect(flat[label]).toBe(dim.value);
    }
  });

  it("resolveAddressAsResult → decodeResultToDeep — refs에 service 차원이 포함된다", () => {
    const result = resolveAddressAsResult(TEST_CATALOG, "permission", "v1", PERM_ADDR_0);
    const deep = decodeResultToDeep(result);

    expect(typeof deep.entities["svc_ref"]).toBe("number");
    expect(deep.refs["svc_ref"]).toBeDefined();
    expect(typeof deep.refs["svc_ref"]["env"]).toBe("string");
  });

  it("L1→flat과 L2→flat은 같은 값을 반환한다", () => {
    const l1 = decodePrefixAsResult(TEST_CATALOG, "permission", "v1", PERM_ADDR_0);
    const l2 = resolveAddressAsResult(TEST_CATALOG, "permission", "v1", PERM_ADDR_0);

    const flat1 = decodeResultToEntities(l1);
    const flat2 = decodeResultToEntities(l2);

    expect(flat1).toEqual(flat2);
  });
});
