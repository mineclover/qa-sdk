/**
 * Address Resolution + Graph-DB 효율 시나리오 테스트
 *
 * scenarios.spec.md §12, §13 검증
 *
 * §12: "perm:v1:1345" → capacity / shape / refs 즉시 복원
 * §13: leaf 값 디코딩 없이 address 범위 연산만으로 필터링 (graph-DB 효율)
 */

import { describe, it, expect, beforeEach } from "vitest";
import { calcAddressRanges, WeightedIndex } from "weighted-index";
import { defineTable } from "./table-def.js";
import { compileSchema } from "./compile-schema.js";
import { InMemoryPrefixRegistry } from "./adapters/memory-prefix-registry.js";
import { InMemoryIndexMetaStore } from "./adapters/memory-store.js";
import { syncSchemaToRegistry } from "./schema-sync.js";
import { applyEntryBatch } from "./api-payload.js";

// ── 픽스처 ───────────────────────────────────────────────

const role     = () => defineTable("role",     { source: { kind: { type: "string_enum" as const } }, versions: { v1: { capacity: 8 } } });
const action   = () => defineTable("action",   { source: { kind: { type: "string_enum" as const } }, versions: { v1: { capacity: 4 } } });
const resource = () => defineTable("resource", { source: { kind: { type: "string_enum" as const } }, versions: { v1: { capacity: 16 } } });
const env      = () => defineTable("env",      { source: { kind: { type: "string_enum" as const } }, versions: { v1: { capacity: 4 } } });

// perm = role(8) × action(4) × resource(16) × env(4) = 2048
const perm = () => defineTable("perm", {
  dims: [role(), action(), resource(), env()],
  versions: {
    v1: { refs: {
      role:     { prefix: "role",     version: "v1" },
      action:   { prefix: "action",   version: "v1" },
      resource: { prefix: "resource", version: "v1" },
      env:      { prefix: "env",      version: "v1" },
    }},
  },
});

// article = content_type(4) × perm(2048) × lang(2) = 16384
const contentType = () => defineTable("content_type", { source: { kind: { type: "string_enum" as const } }, versions: { v1: { capacity: 4  } } });
const lang        = () => defineTable("lang",          { source: { kind: { type: "string_enum" as const } }, versions: { v1: { capacity: 2  } } });
const article = () => defineTable("article", {
  dims: [contentType(), perm(), lang()],
  versions: {
    v1: { refs: {
      content_type: { prefix: "content_type", version: "v1" },
      perm:         { prefix: "perm",         version: "v1" },
      lang:         { prefix: "lang",         version: "v1" },
    }},
  },
});

// calcRange: calcAddressRanges 래퍼 (단일 dim 고정, 나머지 와일드카드)
function calcRange(
  shape: number[],
  dimIndex: number,
  coordFrom: number,
  coordTo: number
): [number, number][] {
  const constraint = coordFrom === coordTo
    ? String(coordFrom)
    : `${coordFrom}-${coordTo}`;
  const constraints = shape.map((_, i) => i === dimIndex ? constraint : null);
  return calcAddressRanges(shape, constraints);
}

// ── §12: 주소 해석 ────────────────────────────────────────

describe("§12 주소 해석 (Address Resolution)", () => {
  let registry: InMemoryPrefixRegistry;

  beforeEach(async () => {
    registry = new InMemoryPrefixRegistry();
    const schema = compileSchema([article()]);
    await syncSchemaToRegistry(schema, registry);
  });

  it("ADDR-1: colon 주소 파싱 → 전체 정보 복원", async () => {
    const resolved = await registry.resolveAddress("perm:v1:1345");
    expect(resolved).not.toBeNull();
    expect(resolved!.prefix).toBe("perm");
    expect(resolved!.versionId).toBe("v1");
    expect(resolved!.index).toBe(1345);
    expect(resolved!.capacity).toBe(2048);
    expect(resolved!.shape).toEqual([8, 4, 16, 4]);
    expect(resolved!.refs).toHaveLength(4);
    expect(resolved!.valid).toBe(true);
  });

  it("ADDR-2: index ≥ capacity → valid:false", async () => {
    const resolved = await registry.resolveAddress("perm:v1:2048");
    expect(resolved!.valid).toBe(false); // 2048 is out of [0, 2047]
  });

  it("ADDR-3: leaf 주소 → refs=[], shape=[capacity]", async () => {
    const resolved = await registry.resolveAddress("role:v1:3");
    expect(resolved!.refs).toEqual([]);
    expect(resolved!.shape).toEqual([8]);
    expect(resolved!.capacity).toBe(8);
    expect(resolved!.valid).toBe(true);
  });

  it("ADDR-4: 미등록 prefix → null", async () => {
    expect(await registry.resolveAddress("unknown:v1:0")).toBeNull();
  });

  it("ADDR-5: shape으로 WeightedIndex 없이 좌표 복원 가능", async () => {
    const resolved = await registry.resolveAddress("perm:v1:1345");
    const { shape, index } = resolved!;

    // shape만으로 decode (WeightedIndex 사용)
    const coords = new WeightedIndex(shape).decode(index);

    // 각 coord는 [1, shape[i]] 범위 내
    for (let i = 0; i < shape.length; i++) {
      expect(coords[i]).toBeGreaterThanOrEqual(1);
      expect(coords[i]).toBeLessThanOrEqual(shape[i]);
    }
  });

  it("getShape — leaf / composite 구분", async () => {
    expect(await registry.getShape("role",   "v1")).toEqual([8]);
    expect(await registry.getShape("perm",   "v1")).toEqual([8, 4, 16, 4]);
    expect(await registry.getShape("article","v1")).toEqual([4, 2048, 2]);
    expect(await registry.getShape("unknown","v1")).toBeNull();
  });
});

// ── §13: 디코딩 없는 주소 재사용 (Graph-DB 효율) ──────────
//
// 구조:
//   perm:v1    shape = [8, 4, 16, 4]   capacity = 2048
//              dims  = [role, action, resource, env]
//
//   article:v1 shape = [4, 2048, 2]    capacity = 16384
//              dims  = [content_type, perm, lang]
//
// WeightedIndex 인코딩 공식:
//   address = sum((coord_i - 1) × weight_i)
//   weight_i = product(shape[i+1:])
//
// perm 가중치:
//   weight[role]     = 4 × 16 × 4 = 256
//   weight[action]   = 16 × 4     = 64
//   weight[resource] = 4
//   weight[env]      = 1
//
// article 가중치:
//   weight[content_type] = 2048 × 2 = 4096
//   weight[perm]         = 2
//   weight[lang]         = 1

describe("§13 디코딩 없는 주소 재사용 (Graph-DB 효율)", () => {
  let registry: InMemoryPrefixRegistry;

  beforeEach(async () => {
    registry = new InMemoryPrefixRegistry();
    const schema = compileSchema([article()]);
    await syncSchemaToRegistry(schema, registry);
  });

  // ── 레이어 1: perm 내부 범위 좁히기 ──────────────────────
  //
  // perm address = (role-1)×256 + (action-1)×64 + (resource-1)×4 + (env-1)×1
  //
  // role이 dim 0 (outermost, weight=256) 이므로
  // role=editor(coord=3) → 하나의 연속 블록
  //   [512, 767] = [(3-1)×256, (3-1)×256 + 255]
  //   크기: 256 = action×resource×env 조합 수 (4×16×4)

  it("GRAPH-2a: role=editor → perm 연속 범위 [512, 767]", async () => {
    const permShape = (await registry.getShape("perm", "v1"))!;
    // shape = [8, 4, 16, 4], role = dim 0
    const [[from, to]] = calcRange(permShape, 0, 3, 3); // coord 3 = editor

    expect(from).toBe(512);  // (3-1) × 256
    expect(to).toBe(767);    // 512 + 256 - 1
    expect(to - from + 1).toBe(256); // action(4) × resource(16) × env(4)
  });

  it("GRAPH-2b: env=production(coord=1) → perm 파편화 범위 (비교)", async () => {
    const permShape = (await registry.getShape("perm", "v1"))!;
    // env = dim 3 (innermost, weight=1)
    // env=1 → 0, 4, 8, ... (매 4번째 주소) → 512개의 단일 범위
    const ranges = calcRange(permShape, 3, 1, 1);

    // outermost dim(role)과 달리 innermost dim(env)은 512개 분산 범위
    expect(ranges.length).toBe(8 * 4 * 16); // role × action × resource = 512
    expect(ranges[0]).toEqual([0, 0]);  // 각 range 크기 = 1
    expect(ranges[1]).toEqual([4, 4]);  // 간격 = weight[env]=1 이 아니라 다음 env 블록
  });

  it("GRAPH-2c: 외부 차원일수록 range가 연속적임을 수치로 확인", async () => {
    const permShape = (await registry.getShape("perm", "v1"))!;

    const roleRanges    = calcRange(permShape, 0, 3, 3); // dim 0 (outermost)
    const actionRanges  = calcRange(permShape, 1, 2, 2); // dim 1
    const resourceRanges= calcRange(permShape, 2, 5, 5); // dim 2
    const envRanges     = calcRange(permShape, 3, 1, 1); // dim 3 (innermost)

    // range 개수: 외부일수록 적음 (= 더 연속적)
    expect(roleRanges.length).toBe(1);           // 1개 연속 블록
    expect(actionRanges.length).toBe(8);         // role(8)개 블록
    expect(resourceRanges.length).toBe(8 * 4);   // role×action(32)개 블록
    expect(envRanges.length).toBe(8 * 4 * 16);  // role×action×resource(512)개 블록

    // range 크기: 외부일수록 큼
    expect(roleRanges[0][1]    - roleRanges[0][0]    + 1).toBe(256); // 4×16×4
    expect(actionRanges[0][1]  - actionRanges[0][0]  + 1).toBe(64);  // 16×4
    expect(resourceRanges[0][1]- resourceRanges[0][0]+ 1).toBe(4);   // 4
    expect(envRanges[0][1]     - envRanges[0][0]     + 1).toBe(1);   // 1
  });

  // ── 레이어 2: perm 범위 → article 범위 전파 ──────────────
  //
  // article address = (content_type-1)×4096 + perm_value×2 + (lang-1)×1
  //
  // perm은 dim 1 (weight=2). perm_value가 하나의 정수이므로
  // 각 perm_value → 2개의 연속 article address (lang=1, lang=2)
  //
  // perm 범위 [512, 767] (256개) →
  //   content_type=1: article [1024, 1535]
  //   content_type=2: article [5120, 5631]
  //   content_type=3: article [9216, 9727]
  //   content_type=4: article [13312, 13823]
  //   총 4개 구간 × 512 addresses = 2048 addresses

  it("GRAPH-3a: perm [512,767] → article 4개 연속 구간 (content_type별)", async () => {
    // article shape = [4, 2048, 2]
    // perm은 dim 1, perm_value [512..767] = 1-based coord [513..768]
    const articleShape = (await registry.getShape("article", "v1"))!;
    const ranges = calcRange(articleShape, 1, 513, 768);

    expect(ranges.length).toBe(4); // content_type 4개 × 1구간

    // content_type=1: perm_value×2 ∈ [1024, 1534], +lang offset [0,1]
    // → article [1024, 1535]
    expect(ranges[0]).toEqual([1024, 1535]);
    expect(ranges[0][1] - ranges[0][0] + 1).toBe(512); // 256 perm × 2 lang

    // content_type=2: +4096
    expect(ranges[1]).toEqual([5120, 5631]);
    // content_type=3
    expect(ranges[2]).toEqual([9216, 9727]);
    // content_type=4
    expect(ranges[3]).toEqual([13312, 13823]);
  });

  it("GRAPH-3b: 범위 좁히기 수치 — 전체 대비 비율", async () => {
    const permShape    = (await registry.getShape("perm",    "v1"))!;
    const articleShape = (await registry.getShape("article", "v1"))!;

    const permCapacity    = permShape.reduce((a, b) => a * b, 1);    // 2048
    const articleCapacity = articleShape.reduce((a, b) => a * b, 1); // 16384

    const [[permFrom, permTo]] = calcRange(permShape, 0, 3, 3);
    const permCovered = permTo - permFrom + 1; // 256

    const articleRanges = calcRange(articleShape, 1, permFrom + 1, permTo + 1);
    const articleCovered = articleRanges.reduce((sum, [f, t]) => sum + t - f + 1, 0);

    // perm에서 role=editor 비율: 1/8 (role 8개 중 1개)
    expect(permCovered / permCapacity).toBeCloseTo(1 / 8);

    // article에서 동일 비율 유지
    expect(articleCovered / articleCapacity).toBeCloseTo(1 / 8);
  });

  // ── DB range scan 시뮬레이션 ──────────────────────────────

  it("GRAPH-4: article DB range scan — role=editor인 article만 추출", async () => {
    const permShape    = (await registry.getShape("perm",    "v1"))!;
    const articleShape = (await registry.getShape("article", "v1"))!;

    // 1. role=editor(3) → perm 범위
    const [[permFrom, permTo]] = calcRange(permShape, 0, 3, 3);

    // 2. perm 범위 → article 범위 (1-based)
    const articleRanges = calcRange(articleShape, 1, permFrom + 1, permTo + 1);

    // 3. "DB"에 저장된 article index들 (실제 DB라면 INDEX range scan)
    const allArticles = [0, 1, 1024, 1025, 1100, 1535, 1536, 5120, 5200, 9999, 13312];

    const filtered = allArticles.filter((idx) =>
      articleRanges.some(([from, to]) => idx >= from && idx <= to)
    );

    // article [1024,1535], [5120,5631], [9216,9727], [13312,13823] 내의 것만
    expect(filtered).toEqual([1024, 1025, 1100, 1535, 5120, 5200, 13312]);
  });

  // ── 역산: 외부 + 내부 동시 고정 ─────────────────────────────
  //
  // "role=editor(3), env=production(1), action/resource 모두 허용"
  // → 디코딩 없이 해당 perm 주소 64개 정확히 역산

  it("GRAPH-역산: role=3, env=1 동시 고정 → 64개 주소 정확히 예측", async () => {
    const permShape = (await registry.getShape("perm", "v1"))!;
    // perm shape = [role(8), action(4), resource(16), env(4)]

    const ranges = calcAddressRanges(permShape, ["3", null, null, "1"]);

    // 총 64개 = action(4) × resource(16)
    const totalAddresses = ranges.reduce((s, [f, t]) => s + t - f + 1, 0);
    expect(totalAddresses).toBe(4 * 16);

    // 모든 구간이 role=3 블록 [512, 767] 내에 있어야 함
    for (const [f, t] of ranges) {
      expect(f).toBeGreaterThanOrEqual(512);
      expect(t).toBeLessThanOrEqual(767);
    }

    // env=1 고정이므로 모든 주소는 4의 배수여야 함
    for (const [f, t] of ranges) {
      expect(f % 4).toBe(0); // env weight=1, env 크기=4 → 4간격
      expect(t % 4).toBe(0);
    }
  });

  it("GRAPH-5: 전체 과정이 순수 산술 — entry DB 조회 없음", async () => {
    // registry.getShape()만 사용 (capacity 정보)
    // entry DB 접근 없이 완전한 필터링 가능
    const permShape    = (await registry.getShape("perm",    "v1"))!;
    const articleShape = (await registry.getShape("article", "v1"))!;

    // role=admin(4)에 해당하는 article 범위
    const [[permFrom, permTo]] = calcRange(permShape, 0, 4, 4);
    expect(permFrom).toBe(768);   // (4-1)×256
    expect(permTo).toBe(1023);

    const articleRanges = calcRange(articleShape, 1, permFrom + 1, permTo + 1);
    expect(articleRanges).toHaveLength(4); // content_type 4개
    expect(articleRanges[0]).toEqual([1536, 2047]); // ct=1, perm [768,1023], lang [1,2]
  });
});
