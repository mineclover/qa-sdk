/**
 * Registry DSL Spec — 선언적 서비스 관리 DSL 스펙 + 메타 DSL
 *
 * ── 3계층 구조 ──
 *
 *   Layer 0: EnumAxis         — 열거형 축 선언 (1차원 엔트리 목록)
 *   Layer 1: Prefix           — 축을 조합한 주소 공간 선언 (leaf / composite)
 *   Layer 2: Schema           — prefix 집합 + 의존 관계 + 버전 정책
 *
 * ── 메타 DSL ──
 *
 *   DSL 자체를 저장하는 DSL. Layer 0~2의 요소를 교차 축으로 인코딩하여
 *   "어떤 스키마의 어떤 prefix의 어떤 축" 주소를 정수로 표현한다.
 *   → DSL 정의가 데이터로 다뤄지므로 버전 관리, diff, 마이그레이션이 가능해진다.
 *
 * ── 축 배치 원칙 (전 테스트에서 증명) ──
 *
 *   변경 빈도 높은 축 → 외부(첫 번째): stride 불변, 마이그레이션 불필요
 *   변경 빈도 낮은 축 → 내부(마지막): stride 변경 시 전체 재계산
 */

import { describe, it, expect } from "vitest";
import { WeightedIndex, calcWeights } from "weighted-index";

// ══════════════════════════════════════════════════════════════
//  Layer 0: EnumAxis — 열거형 축 선언
// ══════════════════════════════════════════════════════════════

/**
 * EnumAxis: DSL의 최소 단위.
 *
 * 문자열 엔트리의 순서 목록. position(1-based)이 곧 좌표.
 * capacity ≥ entries.length → headroom = capacity - entries.length.
 */
interface EnumAxis<T extends string = string> {
  readonly id: string;
  readonly entries: readonly T[];
  readonly capacity: number;
  readonly meta?: Record<string, unknown>;  // 축별 메타데이터 (ko 라벨, 설명 등)
}

/** EnumAxis 팩토리 */
function enumAxis<T extends string>(
  id: string,
  entries: readonly T[],
  capacity?: number,
): EnumAxis<T> {
  const cap = capacity ?? entries.length;
  if (cap < entries.length) throw new Error(`capacity(${cap}) < entries(${entries.length})`);
  return { id, entries, capacity: cap };
}

// ══════════════════════════════════════════════════════════════
//  Layer 1: Prefix — 주소 공간 선언
// ══════════════════════════════════════════════════════════════

/**
 * Prefix: 축을 조합한 n차원 주소 공간.
 *
 * leaf:      단일 EnumAxis를 직접 사용. capacity = axis.capacity.
 * composite: 여러 prefix를 dims로 참조. capacity = Π dims[i].capacity.
 *
 * shape/stride는 선언에서 자동 계산된다.
 */
type PrefixKind = "leaf" | "composite";

interface LeafPrefix {
  readonly kind: "leaf";
  readonly id: string;
  readonly axis: EnumAxis;
  readonly owner: string;
}

interface CompositePrefix {
  readonly kind: "composite";
  readonly id: string;
  readonly dims: readonly string[];   // 참조하는 prefix id 순서 (축 배치 순서)
  readonly owner: string;
}

type Prefix = LeafPrefix | CompositePrefix;

/** Leaf prefix 팩토리 */
function leaf(id: string, axis: EnumAxis, owner: string): LeafPrefix {
  return { kind: "leaf", id, axis, owner };
}

/** Composite prefix 팩토리 */
function composite(id: string, dims: readonly string[], owner: string): CompositePrefix {
  return { kind: "composite", id, dims, owner };
}

// ══════════════════════════════════════════════════════════════
//  Layer 2: Schema — prefix 집합 + 의존 관계
// ══════════════════════════════════════════════════════════════

/**
 * Schema: prefix 들의 집합 + DAG + 버전 정보.
 *
 * resolve()로 모든 composite의 shape/stride를 계산한다.
 * 자체 참조 무결성 검증 내장.
 */
interface Schema {
  readonly id: string;
  readonly version: string;
  readonly prefixes: readonly Prefix[];
}

/** Schema에서 shape/stride를 계산한 결과 */
interface ResolvedPrefix {
  readonly id: string;
  readonly kind: PrefixKind;
  readonly capacity: number;
  readonly shape: readonly number[];
  readonly strides: readonly number[];
  readonly owner: string;
}

/** Schema → ResolvedPrefix[] 변환 */
function resolveSchema(schema: Schema): Map<string, ResolvedPrefix> {
  const map = new Map<string, Prefix>();
  for (const p of schema.prefixes) map.set(p.id, p);

  const resolved = new Map<string, ResolvedPrefix>();

  const resolve = (id: string): ResolvedPrefix => {
    if (resolved.has(id)) return resolved.get(id)!;
    const p = map.get(id);
    if (!p) throw new Error(`Prefix '${id}' not found in schema '${schema.id}'`);

    if (p.kind === "leaf") {
      const r: ResolvedPrefix = {
        id: p.id,
        kind: "leaf",
        capacity: p.axis.capacity,
        shape: [p.axis.capacity],
        strides: [1],
        owner: p.owner,
      };
      resolved.set(id, r);
      return r;
    }

    // composite: dims 순서대로 resolve → shape 조합
    const dimResolved = p.dims.map((dimId) => resolve(dimId));
    const shape = dimResolved.map((d) => d.capacity);
    const strides = calcWeights(shape);
    const capacity = shape.reduce((a, b) => a * b, 1);

    const r: ResolvedPrefix = {
      id: p.id,
      kind: "composite",
      capacity,
      shape,
      strides,
      owner: p.owner,
    };
    resolved.set(id, r);
    return r;
  };

  for (const p of schema.prefixes) resolve(p.id);
  return resolved;
}

// ══════════════════════════════════════════════════════════════
//  Capacity Budget — 변경 빈도 가중 배분
// ══════════════════════════════════════════════════════════════

const MAX_SAFE = Number.MAX_SAFE_INTEGER; // 2^53 - 1
const TOTAL_BITS = 53;

/**
 * Number 가용량(2^53)을 변경 빈도 가중치에 비례하여 배분한다.
 *
 * 원리:
 *   53비트 예산을 weights 비율로 나눠 축당 비트 수를 결정.
 *   자주 바뀌는 축 → 비트 많이 → capacity 크게 → headroom 소진 늦음.
 *   안정적인 축 → 비트 적게 → 충분하지만 절약.
 *
 * Number로 시작하되, product가 2^53에 접근하면 BigInt로 전환.
 * BigInt 전환 시 기존 Number 주소는 그대로 유효 (BigInt ⊃ Number).
 */
function allocateBudget(weights: readonly number[]): number[] {
  const totalWeight = weights.reduce((a, b) => a + b, 0);
  return weights.map((w) => {
    const bits = Math.floor((w / totalWeight) * TOTAL_BITS);
    return 2 ** Math.max(bits, 1);
  });
}

/** product가 Number 한계에 도달했는지 검사. true면 BigInt 전환 필요. */
function needsBigInt(shape: readonly number[]): boolean {
  let product = 1;
  for (const s of shape) {
    product *= s;
    if (product > MAX_SAFE) return true;
  }
  return false;
}

/**
 * Versioned Address — 스키마 버전이 포함된 주소.
 *
 * 주소는 schema:version 컨텍스트 없이는 의미가 없다.
 * encode 시 스키마 버전을 함께 기록하고, decode 시 동일 버전으로만 해석 가능.
 */
interface VersionedAddress {
  readonly schemaId: string;
  readonly schemaVersion: string;
  readonly prefixId: string;
  readonly address: number;
}

/** 직렬화: "schemaId:version:prefix:address" */
function serializeAddress(va: VersionedAddress): string {
  return `${va.schemaId}:${va.schemaVersion}:${va.prefixId}:${va.address}`;
}

/** 역직렬화 */
function parseAddress(s: string): VersionedAddress {
  const parts = s.split(":");
  if (parts.length !== 4) throw new Error(`Invalid address format: '${s}'`);
  return {
    schemaId: parts[0],
    schemaVersion: parts[1],
    prefixId: parts[2],
    address: Number(parts[3]),
  };
}

// ══════════════════════════════════════════════════════════════
//  §1. 기본 선언 — 이 모노레포의 git 체계
// ══════════════════════════════════════════════════════════════

// capacity 설계: 변경 빈도 가중 배분.
//
// change_map = [pkg, semver, cc_type] 3축:
//   pkg:     가장 자주 변경 → 가중치 5 → 26비트 → 2^26 = 67M
//   semver:  중간 빈도      → 가중치 3 → 15비트 → 2^15 = 32K
//   cc_type: 거의 불변      → 가중치 2 → 10비트 → 2^10 = 1K
//   product = 2^51 ≤ 2^53 ✓ (headroom 2비트)
//
// Number 한계 도달 시 BigInt 전환 (기존 주소 그대로 유효).

const CHANGE_MAP_BUDGET = allocateBudget([5, 3, 2]);  // [pkg, semver, cc_type]
const PKG_CLASS_BUDGET  = allocateBudget([5, 2, 1]);  // [pkg, tier, runtime]

const PKG = enumAxis("pkg", [
  "weighted-index", "bit-index", "index-meta", "permission-engine",
  "core", "engine", "sdk", "store", "registry-client", "event-catalog", "pino",
  "ingest-server", "registry-service", "decode-service", "gate-service", "query-service",
  "platform-demo", "browser-sdk", "viz-web",
  "demo-snapshot",
] as const, CHANGE_MAP_BUDGET[0]);  // 2^26 = 67,108,864

const SEMVER = enumAxis("semver", [
  "0.1.0", "0.2.0",
] as const, CHANGE_MAP_BUDGET[1]);  // 2^15 = 32,768

const CC_TYPE = enumAxis("cc_type", [
  "feat", "fix", "refactor", "docs", "test", "chore",
] as const, CHANGE_MAP_BUDGET[2]);  // 2^10 = 1,024

const TIER = enumAxis("tier", [
  "foundation", "platform", "service", "app", "data",
] as const, PKG_CLASS_BUDGET[1]);  // 2^13 = 8,192

const RUNTIME = enumAxis("runtime", [
  "library", "server", "browser",
] as const, PKG_CLASS_BUDGET[2]);  // 2^6 = 64

// ── 스키마 선언 ─────────────────────────────────────────────

const GIT_SCHEMA: Schema = {
  id: "qa-sdk",
  version: "v1",
  prefixes: [
    // leaf prefixes — 각 축을 주소 공간으로 등록
    leaf("pkg",     PKG,     "registry"),
    leaf("semver",  SEMVER,  "registry"),
    leaf("cc_type", CC_TYPE, "registry"),
    leaf("tier",    TIER,    "registry"),
    leaf("runtime", RUNTIME, "registry"),

    // composite prefixes — 축 조합
    composite("pkg_version", ["pkg", "semver"],            "registry"),
    composite("change_map",  ["pkg", "semver", "cc_type"], "registry"),
    composite("commit_addr", ["cc_type", "pkg"],           "registry"),
    composite("pkg_class",   ["pkg", "tier", "runtime"],   "registry"),
  ],
};

// ══════════════════════════════════════════════════════════════

describe("§1 EnumAxis 선언", () => {
  it("enumAxis 팩토리: entries + capacity + headroom", () => {
    const a = enumAxis("role", ["admin", "editor", "viewer"], 8);
    expect(a.id).toBe("role");
    expect(a.entries).toEqual(["admin", "editor", "viewer"]);
    expect(a.capacity).toBe(8);
    expect(a.capacity - a.entries.length).toBe(5); // headroom
  });

  it("capacity 생략 시 entries.length", () => {
    const a = enumAxis("flag", ["on", "off"]);
    expect(a.capacity).toBe(2);
  });

  it("capacity < entries → 에러", () => {
    expect(() => enumAxis("bad", ["a", "b", "c"], 2)).toThrow();
  });

  it("실제 축: pkg 20개, 가중 배분 capacity", () => {
    expect(PKG.entries).toHaveLength(20);
    expect(PKG.capacity).toBe(2 ** 26);  // 67,108,864
    expect(PKG.capacity - PKG.entries.length).toBe(67_108_844); // headroom
  });
});

describe("§2 Prefix 선언", () => {
  it("leaf prefix: 단일 축 → shape = [capacity]", () => {
    const p = leaf("pkg", PKG, "registry");
    expect(p.kind).toBe("leaf");
    expect(p.axis.capacity).toBe(2 ** 26);
  });

  it("composite prefix: 다중 축 참조", () => {
    const p = composite("change_map", ["pkg", "semver", "cc_type"], "registry");
    expect(p.kind).toBe("composite");
    expect(p.dims).toEqual(["pkg", "semver", "cc_type"]);
  });
});

describe("§3 Schema resolve — 자동 shape/stride 계산", () => {
  it("resolve: 전체 스키마의 shape/stride 일괄 계산", () => {
    const resolved = resolveSchema(GIT_SCHEMA);
    const P = PKG.capacity, S = SEMVER.capacity, C = CC_TYPE.capacity;
    const T = TIER.capacity, R = RUNTIME.capacity;

    // leaf
    expect(resolved.get("pkg")!.capacity).toBe(P);

    // composite: pkg_version = [P, S]
    const pvR = resolved.get("pkg_version")!;
    expect(pvR.shape).toEqual([P, S]);
    expect(pvR.strides).toEqual([S, 1]);
    expect(pvR.capacity).toBe(P * S);

    // composite: change_map = [P, S, C]
    const cmR = resolved.get("change_map")!;
    expect(cmR.shape).toEqual([P, S, C]);
    expect(cmR.strides).toEqual([S * C, C, 1]);
    expect(cmR.capacity).toBe(P * S * C);

    // composite: commit_addr = [C, P]
    const caR = resolved.get("commit_addr")!;
    expect(caR.shape).toEqual([C, P]);
    expect(caR.strides).toEqual([P, 1]);

    // composite: pkg_class = [P, T, R]
    const pcR = resolved.get("pkg_class")!;
    expect(pcR.shape).toEqual([P, T, R]);
    expect(pcR.strides).toEqual([T * R, R, 1]);

    // 전체 composite가 Number.MAX_SAFE_INTEGER 이내
    for (const [, r] of resolved) {
      expect(r.capacity).toBeLessThanOrEqual(MAX_SAFE);
    }

    // change_map이 가장 큰 composite — 비트 합계 확인
    expect(Math.log2(cmR.capacity)).toBeLessThanOrEqual(53);
  });

  it("resolve: 누락 prefix → 에러", () => {
    const bad: Schema = {
      id: "bad",
      version: "v1",
      prefixes: [
        composite("broken", ["missing_axis"], "x"),
      ],
    };
    expect(() => resolveSchema(bad)).toThrow("not found");
  });
});

describe("§4 인코딩/디코딩 — resolved schema 기반", () => {
  const resolved = resolveSchema(GIT_SCHEMA);

  /** prefix의 resolved 정보로 WeightedIndex 생성 */
  function indexFor(prefixId: string): WeightedIndex {
    const r = resolved.get(prefixId)!;
    return new WeightedIndex(r.shape as number[]);
  }

  /** axis에서 entry의 1-based position */
  function pos(axis: EnumAxis, entry: string): number {
    const idx = axis.entries.indexOf(entry);
    if (idx === -1) throw new Error(`'${entry}' not in axis '${axis.id}'`);
    return idx + 1;
  }

  it("pkg_version: encode + decode 라운드트립", () => {
    const wi = indexFor("pkg_version");
    const addr = wi.encode([pos(PKG, "index-meta"), pos(SEMVER, "0.2.0")]);

    const [p, v] = wi.decode(addr);
    expect(PKG.entries[p - 1]).toBe("index-meta");
    expect(SEMVER.entries[v - 1]).toBe("0.2.0");
  });

  it("change_map: 3D 인코딩 라운드트립", () => {
    const wi = indexFor("change_map");
    const addr = wi.encode([
      pos(PKG, "ingest-server"),
      pos(SEMVER, "0.1.0"),
      pos(CC_TYPE, "feat"),
    ]);

    const [p, v, t] = wi.decode(addr);
    expect(PKG.entries[p - 1]).toBe("ingest-server");
    expect(SEMVER.entries[v - 1]).toBe("0.1.0");
    expect(CC_TYPE.entries[t - 1]).toBe("feat");
  });

  it("commit_addr: 2D 인코딩 라운드트립", () => {
    const wi = indexFor("commit_addr");
    const addr = wi.encode([pos(CC_TYPE, "feat"), pos(PKG, "index-meta")]);

    const [t, p] = wi.decode(addr);
    expect(CC_TYPE.entries[t - 1]).toBe("feat");
    expect(PKG.entries[p - 1]).toBe("index-meta");
  });

  it("VersionedAddress: 스키마 버전이 포함된 주소 직렬화", () => {
    const wi = indexFor("change_map");
    const addr = wi.encode([
      pos(PKG, "index-meta"), pos(SEMVER, "0.2.0"), pos(CC_TYPE, "feat"),
    ]);

    const va: VersionedAddress = {
      schemaId: GIT_SCHEMA.id,
      schemaVersion: GIT_SCHEMA.version,
      prefixId: "change_map",
      address: addr,
    };

    const serialized = serializeAddress(va);
    expect(serialized).toBe(`qa-sdk:v1:change_map:${addr}`);

    const parsed = parseAddress(serialized);
    expect(parsed.schemaId).toBe("qa-sdk");
    expect(parsed.schemaVersion).toBe("v1");
    expect(parsed.prefixId).toBe("change_map");
    expect(parsed.address).toBe(addr);

    // parsed address를 같은 스키마 버전으로 decode
    const [p, v, t] = wi.decode(parsed.address);
    expect(PKG.entries[p - 1]).toBe("index-meta");
    expect(SEMVER.entries[v - 1]).toBe("0.2.0");
    expect(CC_TYPE.entries[t - 1]).toBe("feat");
  });
});

// ══════════════════════════════════════════════════════════════
//  Layer 3: Meta-DSL — DSL을 저장하는 DSL
//
//  핵심: DSL 구성 요소(axis, prefix, schema)를 그 자체로 축 엔트리로 만들어
//  교차 축으로 조합하면 "어떤 스키마의 어떤 prefix의 어떤 축" 주소를 얻는다.
// ══════════════════════════════════════════════════════════════

describe("§5 Meta-DSL — DSL 정의를 데이터로 인코딩", () => {
  // ── 메타 축: DSL 요소 종류 ──────────────────────────────────

  const DSL_ELEMENT = enumAxis("dsl_element", [
    "enum_axis",    // Layer 0: 열거형 축 정의
    "leaf_prefix",  // Layer 1: leaf prefix 선언
    "comp_prefix",  // Layer 1: composite prefix 선언
    "schema",       // Layer 2: 스키마 선언
    "entry",        // Layer 0 하위: 개별 엔트리
  ] as const, 8);

  // ── 메타 축: 이 DSL에 등록된 축 목록 ────────────────────────

  const DSL_AXIS = enumAxis("dsl_axis", [
    "pkg", "semver", "cc_type", "tier", "runtime",
  ] as const, 16);

  // ── 메타 축: 이 DSL에 등록된 prefix 목록 ────────────────────

  const DSL_PREFIX = enumAxis("dsl_prefix", [
    "pkg", "semver", "cc_type", "tier", "runtime",
    "pkg_version", "change_map", "commit_addr", "pkg_class",
  ] as const, 32);

  // ── 메타 축: 이 DSL에 등록된 스키마 목록 ────────────────────

  const DSL_SCHEMA = enumAxis("dsl_schema", [
    "qa-sdk",
  ] as const, 8);

  it("메타 인덱스: schema × prefix → 스키마 내 prefix 주소", () => {
    const META_SCHEMA_PREFIX: Schema = {
      id: "meta_schema_prefix",
      version: "v1",
      prefixes: [
        leaf("dsl_schema", DSL_SCHEMA, "meta"),
        leaf("dsl_prefix", DSL_PREFIX, "meta"),
        composite("schema_prefix_map", ["dsl_schema", "dsl_prefix"], "meta"),
      ],
    };

    const resolved = resolveSchema(META_SCHEMA_PREFIX);
    const r = resolved.get("schema_prefix_map")!;

    const wi = new WeightedIndex(r.shape as number[]);

    // "qa-sdk 스키마의 change_map" 주소
    const addr = wi.encode([
      DSL_SCHEMA.entries.indexOf("qa-sdk") + 1,       // 1
      DSL_PREFIX.entries.indexOf("change_map") + 1,    // 7
    ]);

    const [s, p] = wi.decode(addr);
    expect(DSL_SCHEMA.entries[s - 1]).toBe("qa-sdk");
    expect(DSL_PREFIX.entries[p - 1]).toBe("change_map");
  });

  it("메타 인덱스: element × axis × entry → DSL 요소 주소", () => {
    // "enum_axis 타입의 pkg 축에서 index-meta 엔트리"를 정수로
    // 3차원: dsl_element × dsl_axis × entry_position
    const ENTRY_POS = enumAxis("entry_pos", [] as string[], 64); // 최대 엔트리 수

    const META_ELEMENT: Schema = {
      id: "meta_element",
      version: "v1",
      prefixes: [
        leaf("dsl_element", DSL_ELEMENT, "meta"),
        leaf("dsl_axis",    DSL_AXIS,    "meta"),
        leaf("entry_pos",   ENTRY_POS,   "meta"),
        composite("element_map", ["dsl_element", "dsl_axis", "entry_pos"], "meta"),
      ],
    };

    const resolved = resolveSchema(META_ELEMENT);
    const r = resolved.get("element_map")!;
    expect(r.shape).toEqual([8, 16, 64]);
    expect(r.strides).toEqual([1024, 64, 1]);
    expect(r.capacity).toBe(8192);

    const wi = new WeightedIndex(r.shape as number[]);

    // "enum_axis 타입 / pkg 축 / index-meta 엔트리" 주소
    const addr = wi.encode([
      DSL_ELEMENT.entries.indexOf("enum_axis") + 1,   // 1
      DSL_AXIS.entries.indexOf("pkg") + 1,             // 1
      PKG.entries.indexOf("index-meta") + 1,           // 3
    ]);
    expect(addr).toBe(2); // (1-1)*1024 + (1-1)*64 + (3-1) = 2

    const [e, a, p] = wi.decode(addr);
    expect(DSL_ELEMENT.entries[e - 1]).toBe("enum_axis");
    expect(DSL_AXIS.entries[a - 1]).toBe("pkg");
    expect(p).toBe(3); // index-meta는 PKG 축의 3번째
  });

  it("메타 인덱스: schema × element × prefix → DSL diff 주소", () => {
    // 스키마 diff: "qa-sdk v1에서 comp_prefix인 change_map이 변경됨"
    const META_DIFF: Schema = {
      id: "meta_diff",
      version: "v1",
      prefixes: [
        leaf("dsl_schema",  DSL_SCHEMA,  "meta"),
        leaf("dsl_element", DSL_ELEMENT, "meta"),
        leaf("dsl_prefix",  DSL_PREFIX,  "meta"),
        composite("diff_map", ["dsl_schema", "dsl_element", "dsl_prefix"], "meta"),
      ],
    };

    const resolved = resolveSchema(META_DIFF);
    const r = resolved.get("diff_map")!;
    expect(r.shape).toEqual([8, 8, 32]);
    expect(r.capacity).toBe(2048);

    const wi = new WeightedIndex(r.shape as number[]);

    // "qa-sdk 스키마에서 comp_prefix 타입의 change_map 변경"
    const addr = wi.encode([
      DSL_SCHEMA.entries.indexOf("qa-sdk") + 1,       // 1
      DSL_ELEMENT.entries.indexOf("comp_prefix") + 1,  // 3
      DSL_PREFIX.entries.indexOf("change_map") + 1,    // 7
    ]);

    const [s, e, p] = wi.decode(addr);
    expect(DSL_SCHEMA.entries[s - 1]).toBe("qa-sdk");
    expect(DSL_ELEMENT.entries[e - 1]).toBe("comp_prefix");
    expect(DSL_PREFIX.entries[p - 1]).toBe("change_map");
  });
});

// ══════════════════════════════════════════════════════════════
//  §6. Schema Diff — 두 스키마 버전 간 변경 감지
// ══════════════════════════════════════════════════════════════

describe("§6 Schema Diff — v1→v2 변경 감지", () => {
  // v2: 패키지 3개 추가, semver에 0.3.0 추가, cc_type에 perf 추가
  // headroom이 넉넉하므로 capacity 변경 없이 흡수
  const PKG_V2 = enumAxis("pkg", [
    ...PKG.entries,
    "weighted-gpu", "weighted-wasm", "roleplay-web",
  ] as const, CHANGE_MAP_BUDGET[0]);  // 동일 capacity

  const SEMVER_V2 = enumAxis("semver", [
    ...SEMVER.entries, "0.3.0",
  ] as const, CHANGE_MAP_BUDGET[1]);  // 동일 capacity

  const CC_TYPE_V2 = enumAxis("cc_type", [
    ...CC_TYPE.entries, "perf",
  ] as const, CHANGE_MAP_BUDGET[2]);  // 동일 capacity

  const GIT_SCHEMA_V2: Schema = {
    id: "qa-sdk",
    version: "v2",
    prefixes: [
      leaf("pkg",     PKG_V2,     "registry"),
      leaf("semver",  SEMVER_V2,  "registry"),
      leaf("cc_type", CC_TYPE_V2, "registry"),
      leaf("tier",    TIER,    "registry"),
      leaf("runtime", RUNTIME, "registry"),
      composite("pkg_version", ["pkg", "semver"],            "registry"),
      composite("change_map",  ["pkg", "semver", "cc_type"], "registry"),
      composite("commit_addr", ["cc_type", "pkg"],           "registry"),
      composite("pkg_class",   ["pkg", "tier", "runtime"],   "registry"),
    ],
  };

  const PKG_OVERFLOW = enumAxis("pkg", PKG_V2.entries, PKG.capacity * 2);

  const SCHEMA_OVERFLOW: Schema = {
    id: "qa-sdk",
    version: "v3",
    prefixes: [
      leaf("pkg",     PKG_OVERFLOW, "registry"),
      leaf("semver",  SEMVER_V2,    "registry"),
      leaf("cc_type", CC_TYPE_V2,   "registry"),
      leaf("tier",    TIER,         "registry"),
      leaf("runtime", RUNTIME,      "registry"),
      composite("pkg_version", ["pkg", "semver"],            "registry"),
      composite("change_map",  ["pkg", "semver", "cc_type"], "registry"),
      composite("commit_addr", ["cc_type", "pkg"],           "registry"),
      composite("pkg_class",   ["pkg", "tier", "runtime"],   "registry"),
    ],
  };

  interface SchemaDiffEntry {
    readonly prefixId: string;
    readonly field: "shape" | "strides" | "capacity";
    readonly v1: unknown;
    readonly v2: unknown;
  }

  function diffSchemas(s1: Schema, s2: Schema): SchemaDiffEntry[] {
    const r1 = resolveSchema(s1);
    const r2 = resolveSchema(s2);
    const diffs: SchemaDiffEntry[] = [];

    for (const [id, p2] of r2) {
      const p1 = r1.get(id);
      if (!p1) continue; // 신규 prefix → diff 대상 아님

      if (p1.capacity !== p2.capacity) {
        diffs.push({ prefixId: id, field: "capacity", v1: p1.capacity, v2: p2.capacity });
      }
      if (JSON.stringify(p1.shape) !== JSON.stringify(p2.shape)) {
        diffs.push({ prefixId: id, field: "shape", v1: p1.shape, v2: p2.shape });
      }
      if (JSON.stringify(p1.strides) !== JSON.stringify(p2.strides)) {
        diffs.push({ prefixId: id, field: "strides", v1: p1.strides, v2: p2.strides });
      }
    }
    return diffs;
  }

  it("pkg 축 확장 (20→23): pkg가 첫 번째 축인 composite는 stride 불변", () => {
    const diffs = diffSchemas(GIT_SCHEMA, GIT_SCHEMA_V2);

    // pkg leaf: capacity 동일 (32 유지, headroom에서 흡수)
    expect(diffs.find((d) => d.prefixId === "pkg")).toBeUndefined();

    // pkg_version: capacity/shape/strides 전부 동일 (pkg가 첫 번째 축)
    expect(diffs.find((d) => d.prefixId === "pkg_version")).toBeUndefined();

    // change_map: capacity/shape/strides 전부 동일
    expect(diffs.find((d) => d.prefixId === "change_map")).toBeUndefined();

    // commit_addr: cc_type가 첫 번째 축이지만, capacity 동일 (8 유지)
    expect(diffs.find((d) => d.prefixId === "commit_addr")).toBeUndefined();

    // 모든 composite에서 stride 변경 없음 → 마이그레이션 불필요
    const strideChanges = diffs.filter((d) => d.field === "strides");
    expect(strideChanges).toHaveLength(0);
  });

  it("headroom 소진 시나리오: pkg capacity 2배 확장", () => {
    const diffs = diffSchemas(GIT_SCHEMA, SCHEMA_OVERFLOW);

    // pkg leaf: capacity 변경
    const pkgDiff = diffs.find((d) => d.prefixId === "pkg" && d.field === "capacity");
    expect(pkgDiff).toBeDefined();
    expect(pkgDiff!.v2).toBe(PKG_OVERFLOW.capacity);

    // pkg가 첫 번째 축인 composite: capacity/shape 변경, strides 불변!
    const pvDiffs = diffs.filter((d) => d.prefixId === "pkg_version");
    expect(pvDiffs.find((d) => d.field === "capacity")).toBeDefined();
    expect(pvDiffs.find((d) => d.field === "strides")).toBeUndefined();   // stride 불변 ✓

    const cmDiffs = diffs.filter((d) => d.prefixId === "change_map");
    expect(cmDiffs.find((d) => d.field === "capacity")).toBeDefined();
    expect(cmDiffs.find((d) => d.field === "strides")).toBeUndefined();   // stride 불변 ✓

    // commit_addr: pkg가 두 번째 축 → stride[0] 변경!
    const caDiffs = diffs.filter((d) => d.prefixId === "commit_addr");
    expect(caDiffs.find((d) => d.field === "strides")).toBeDefined();
    // → commit_addr만 마이그레이션 필요 (pkg가 내부 축이므로)
  });
});

// ══════════════════════════════════════════════════════════════
//  §7. 직렬화 — DSL 정의를 JSON으로 표현
// ══════════════════════════════════════════════════════════════

describe("§7 직렬화 — DSL → JSON 라운드트립", () => {
  interface SerializedAxis {
    id: string;
    entries: string[];
    capacity: number;
  }

  interface SerializedPrefix {
    id: string;
    kind: "leaf" | "composite";
    owner: string;
    axis?: string;        // leaf: axis id
    dims?: string[];      // composite: dim prefix ids
  }

  interface SerializedSchema {
    id: string;
    version: string;
    axes: SerializedAxis[];
    prefixes: SerializedPrefix[];
  }

  function serializeSchema(schema: Schema): SerializedSchema {
    const axes = new Map<string, EnumAxis>();
    const prefixes: SerializedPrefix[] = [];

    for (const p of schema.prefixes) {
      if (p.kind === "leaf") {
        axes.set(p.axis.id, p.axis);
        prefixes.push({ id: p.id, kind: "leaf", owner: p.owner, axis: p.axis.id });
      } else {
        prefixes.push({ id: p.id, kind: "composite", owner: p.owner, dims: [...p.dims] });
      }
    }

    return {
      id: schema.id,
      version: schema.version,
      axes: [...axes.values()].map((a) => ({
        id: a.id, entries: [...a.entries], capacity: a.capacity,
      })),
      prefixes,
    };
  }

  function deserializeSchema(json: SerializedSchema): Schema {
    const axisMap = new Map<string, EnumAxis>();
    for (const a of json.axes) {
      axisMap.set(a.id, enumAxis(a.id, a.entries, a.capacity));
    }

    const prefixes: Prefix[] = json.prefixes.map((p) => {
      if (p.kind === "leaf") {
        const axis = axisMap.get(p.axis!);
        if (!axis) throw new Error(`Axis '${p.axis}' not found`);
        return leaf(p.id, axis, p.owner);
      }
      return composite(p.id, p.dims!, p.owner);
    });

    return { id: json.id, version: json.version, prefixes };
  }

  it("GIT_SCHEMA → JSON → 복원 → resolve 결과 동일", () => {
    const serialized = serializeSchema(GIT_SCHEMA);
    const jsonStr = JSON.stringify(serialized);
    const restored = deserializeSchema(JSON.parse(jsonStr));

    // 복원된 스키마로 resolve
    const original = resolveSchema(GIT_SCHEMA);
    const fromJson = resolveSchema(restored);

    // 모든 prefix의 shape/strides/capacity 동일
    for (const [id, orig] of original) {
      const rest = fromJson.get(id)!;
      expect(rest.shape).toEqual(orig.shape);
      expect(rest.strides).toEqual(orig.strides);
      expect(rest.capacity).toBe(orig.capacity);
    }
  });

  it("직렬화 포맷 구조 확인", () => {
    const s = serializeSchema(GIT_SCHEMA);

    expect(s.id).toBe("qa-sdk");
    expect(s.version).toBe("v1");
    expect(s.axes).toHaveLength(5);  // pkg, semver, cc_type, tier, runtime
    expect(s.prefixes).toHaveLength(9); // 5 leaf + 4 composite

    // leaf prefix는 axis 참조
    const pkgPrefix = s.prefixes.find((p) => p.id === "pkg")!;
    expect(pkgPrefix.kind).toBe("leaf");
    expect(pkgPrefix.axis).toBe("pkg");

    // composite prefix는 dims 참조
    const cmPrefix = s.prefixes.find((p) => p.id === "change_map")!;
    expect(cmPrefix.kind).toBe("composite");
    expect(cmPrefix.dims).toEqual(["pkg", "semver", "cc_type"]);
  });
});

// ══════════════════════════════════════════════════════════════
//  §8. Budget 배분 + Number→BigInt 전환
// ══════════════════════════════════════════════════════════════

describe("§8 Budget 배분 원리 + Number→BigInt 전환", () => {
  it("allocateBudget: 가중치 비례 비트 배분", () => {
    // 가중치 [5, 3, 2] → 총 10
    // pkg:     floor(5/10 * 53) = 26비트 → 2^26
    // semver:  floor(3/10 * 53) = 15비트 → 2^15
    // cc_type: floor(2/10 * 53) = 10비트 → 2^10
    const caps = allocateBudget([5, 3, 2]);
    expect(caps).toEqual([2 ** 26, 2 ** 15, 2 ** 10]);

    // 비트 합 = 26 + 15 + 10 = 51 ≤ 53 (headroom 2비트)
    const totalBits = caps.reduce((sum, c) => sum + Math.log2(c), 0);
    expect(totalBits).toBeLessThanOrEqual(53);
  });

  it("자주 바뀌는 축에 더 많은 capacity", () => {
    const caps = allocateBudget([5, 3, 2]);

    // pkg(빈번 변경) > semver(중간) > cc_type(안정)
    expect(caps[0]).toBeGreaterThan(caps[1]);
    expect(caps[1]).toBeGreaterThan(caps[2]);

    // pkg가 전체 주소 공간의 절반 이상 비트를 차지
    const pkgBits = Math.log2(caps[0]);
    expect(pkgBits / 53).toBeGreaterThan(0.45);
  });

  it("균등 배분 vs 가중 배분 비교", () => {
    // 균등: 각 축 2^(53/3) = 2^17 = 131,072
    const equal = allocateBudget([1, 1, 1]);
    expect(equal[0]).toBe(equal[1]);
    expect(equal[1]).toBe(equal[2]);
    expect(equal[0]).toBe(2 ** 17); // 131,072

    // 가중: pkg에 집중
    const weighted = allocateBudget([5, 3, 2]);
    expect(weighted[0]).toBe(2 ** 26);  // 67M — 균등 대비 512배
    expect(weighted[2]).toBe(2 ** 10);  // 1K  — 균등 대비 1/128배

    // 가중 배분에서 pkg headroom: 67M - 20 = 거의 무한
    // 균등 배분에서 pkg headroom: 131K - 20 = 여전히 충분하지만 불균형
  });

  it("needsBigInt: Number 한계 감지", () => {
    // 현재 change_map shape
    const shape = [PKG.capacity, SEMVER.capacity, CC_TYPE.capacity];
    expect(needsBigInt(shape)).toBe(false); // 2^51 < 2^53

    // capacity 과대 확장 시나리오
    const overflowShape = [2 ** 30, 2 ** 20, 2 ** 10]; // 2^60 > 2^53
    expect(needsBigInt(overflowShape)).toBe(true);
  });

  it("Number→BigInt 전환 시 기존 주소는 그대로 유효", () => {
    // Number 모드에서 인코딩한 주소
    const shape = [PKG.capacity, SEMVER.capacity, CC_TYPE.capacity];
    const wi = new WeightedIndex(shape);
    const addr = wi.encode([3, 2, 1]); // index-meta, v0.2.0, feat

    // 같은 주소를 BigInt로 변환해도 좌표 동일
    // (BigInt 전환은 capacity 확장 시에만 필요하며,
    //  기존 capacity 범위 내의 주소는 Number와 BigInt에서 동일한 좌표를 가짐)
    const addrBig = BigInt(addr);
    const stridesBig = shape.map((_, i) =>
      shape.slice(i + 1).reduce((a, b) => BigInt(a) * BigInt(b), 1n),
    );

    // BigInt 디코딩
    const coords: number[] = [];
    let rest = addrBig;
    for (let i = 0; i < shape.length; i++) {
      coords.push(Number(rest / stridesBig[i]) + 1);
      rest = rest % stridesBig[i];
    }

    expect(coords).toEqual([3, 2, 1]); // 동일 좌표 ✓
  });

  it("가중 배분에서 축 추가 시 재배분 전략", () => {
    // 현재 3축 [5, 3, 2] → 축 1개 추가하면 4축 [5, 3, 2, 1]
    const caps3 = allocateBudget([5, 3, 2]);
    const caps4 = allocateBudget([5, 3, 2, 1]);

    // 축 추가 시 모든 축의 capacity가 줄어듦 (비트 재배분)
    expect(caps4[0]).toBeLessThan(caps3[0]);
    expect(caps4[1]).toBeLessThan(caps3[1]);

    // 하지만 기존 entries는 모두 새 capacity 이내
    expect(PKG.entries.length).toBeLessThan(caps4[0]);
    expect(SEMVER.entries.length).toBeLessThan(caps4[1]);
    expect(CC_TYPE.entries.length).toBeLessThan(caps4[2]);

    // → 축 추가 = stride 변경 = 마이그레이션 필요
    // → 하지만 기존 entries는 유실 없음 (capacity 감소해도 entries < new capacity)
    // → 극단적으로 entries가 new capacity를 초과하면 → BigInt 전환
  });
});
