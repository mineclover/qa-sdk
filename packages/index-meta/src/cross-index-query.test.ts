import { describe, it, expect } from "vitest";
import { MetaRegistry } from "./meta-registry.js";
import { composeQuery, deepDecode } from "./cross-index-query.js";
import { EntryNotFoundError, ValidationError } from "./errors.js";

// ── 픽스처: 2-level cross-index ──────────────────────────────────────────────
//
// doc_meta = [format(3), lang(4)]  → 12 combinations
// article  = [quality_tier(→doc_meta, 12), priority(5)] → 60 combinations

const createFixture = () => {
  const registry = new MetaRegistry({
    dims: {
      format: {
        kind: { type: "string_enum" },
        snapshots: {
          v1: { entries: ["HTML", "PDF", "EPUB"] },
        },
      },
      lang: {
        kind: { type: "string_enum" },
        snapshots: {
          v1: { entries: ["en", "ko", "ja", "zh"] },
        },
      },
      quality_tier: {
        kind: { type: "index_ref", indexId: "doc_meta" },
        snapshots: {
          // entries = doc_meta 압축 주소들 (0-based)
          // format(3) × lang(4) = 12 조합, 전부 편입
          v1: { entries: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11] },
        },
      },
      priority: {
        kind: { type: "number_enum" },
        snapshots: {
          v1: { entries: [0, 1, 2, 3, 4] },
        },
      },
    },
    indices: {
      doc_meta: {
        dims: ["format", "lang"],
        versions: {
          v1: { snapshots: { format: "v1", lang: "v1" } },
        },
      },
      article: {
        dims: ["quality_tier", "priority"],
        versions: {
          v1: { snapshots: { quality_tier: "v1", priority: "v1" } },
        },
      },
    },
  });

  return registry;
};

// ── composeQuery ─────────────────────────────────────────────────────────────

describe("composeQuery", () => {
  it("하위 index 조건으로 상위 index 범위를 계산한다", () => {
    const registry = createFixture();

    // "format=PDF인 article의 value 범위"
    // doc_meta에서 format=PDF → position 2 → addresses [4,5,6,7]
    // quality_tier entries에서 4,5,6,7 → positions 5,6,7,8
    // article shape = [12, 5], quality_tier = positions 5-8
    const ranges = composeQuery(
      { indexId: "article", versionId: "v1" },
      "quality_tier",
      { format: "PDF" },
      registry,
    );

    expect(ranges.length).toBeGreaterThan(0);

    // 검증: 범위 내 모든 주소를 decode해서 quality_tier가 doc_meta의 format=PDF인지 확인
    const articleCodec = registry.createCodec("article", "v1");
    const docMetaCodec = registry.createCodec("doc_meta", "v1");

    for (const [from, to] of ranges) {
      for (let addr = from; addr <= to; addr++) {
        const decoded = articleCodec.decodeValue(addr);
        const qualityTierValue = decoded.quality_tier as number;
        const docMeta = docMetaCodec.decodeValue(qualityTierValue);
        expect(docMeta.format).toBe("PDF");
      }
    }
  });

  it("복합 조건: format=PDF AND lang=ko", () => {
    const registry = createFixture();

    const ranges = composeQuery(
      { indexId: "article", versionId: "v1" },
      "quality_tier",
      { format: "PDF", lang: "ko" },
      registry,
    );

    expect(ranges.length).toBeGreaterThan(0);

    const articleCodec = registry.createCodec("article", "v1");
    const docMetaCodec = registry.createCodec("doc_meta", "v1");

    for (const [from, to] of ranges) {
      for (let addr = from; addr <= to; addr++) {
        const decoded = articleCodec.decodeValue(addr);
        const docMeta = docMetaCodec.decodeValue(decoded.quality_tier as number);
        expect(docMeta.format).toBe("PDF");
        expect(docMeta.lang).toBe("ko");
      }
    }
  });

  it("조건에 맞는 entry가 없으면 빈 배열", () => {
    const registry = createFixture();

    // lang에 존재하지 않는 entity → 에러
    expect(() =>
      composeQuery(
        { indexId: "article", versionId: "v1" },
        "quality_tier",
        { format: "DOCX" },
        registry,
      ),
    ).toThrow(EntryNotFoundError);
  });

  it("index_ref가 아닌 dim으로 호출하면 에러", () => {
    const registry = createFixture();

    expect(() =>
      composeQuery(
        { indexId: "article", versionId: "v1" },
        "priority",
        { format: "PDF" },
        registry,
      ),
    ).toThrow(ValidationError);
  });

  it("존재하지 않는 dim으로 호출하면 에러", () => {
    const registry = createFixture();

    expect(() =>
      composeQuery(
        { indexId: "article", versionId: "v1" },
        "nonexistent",
        { format: "PDF" },
        registry,
      ),
    ).toThrow(ValidationError);
  });
});

// ── deepDecode ───────────────────────────────────────────────────────────────

describe("deepDecode", () => {
  it("2-level cross-index를 끝까지 펼친다", () => {
    const registry = createFixture();

    // article address: quality_tier=5 (doc_meta addr=5), priority=2
    // doc_meta addr=5 → decode → format=PDF(pos2), lang=ko(pos2)
    //   format: 5 / 4 = 1 (0-based) → pos 2 → "PDF"
    //   lang: 5 % 4 = 1 (0-based) → pos 2 → "ko"
    const articleCodec = registry.createCodec("article", "v1");
    const vv = articleCodec.encode({ quality_tier: 5, priority: 2 });

    const result = deepDecode(vv, registry);

    // article layer
    expect(result.layers.has("article")).toBe(true);
    const articleLayer = result.layers.get("article")!;
    expect(articleLayer.quality_tier).toBe(5);
    expect(articleLayer.priority).toBe(2);

    // doc_meta layer (followed from quality_tier index_ref)
    expect(result.layers.has("doc_meta")).toBe(true);
    const docMetaLayer = result.layers.get("doc_meta")!;
    expect(docMetaLayer.format).toBe("PDF");
    expect(docMetaLayer.lang).toBe("ko");

    // path
    expect(result.path.length).toBe(2);
    expect(result.path[0].indexId).toBe("article");
    expect(result.path[1].indexId).toBe("doc_meta");
  });

  it("index_ref가 없는 단일 index → 1 layer만 반환", () => {
    const registry = createFixture();

    const docMetaCodec = registry.createCodec("doc_meta", "v1");
    const vv = docMetaCodec.encode({ format: "HTML", lang: "en" });

    const result = deepDecode(vv, registry);

    expect(result.layers.size).toBe(1);
    expect(result.layers.get("doc_meta")).toEqual({ format: "HTML", lang: "en" });
    expect(result.path.length).toBe(1);
  });

  it("maxDepth로 재귀 깊이를 제한할 수 있다", () => {
    const registry = createFixture();

    const articleCodec = registry.createCodec("article", "v1");
    const vv = articleCodec.encode({ quality_tier: 5, priority: 2 });

    // maxDepth=1이면 article만 decode하고 doc_meta는 따라가지 않음
    const result = deepDecode(vv, registry, 1);

    expect(result.layers.has("article")).toBe(true);
    expect(result.layers.has("doc_meta")).toBe(false);
  });

  it("순환 참조가 있어도 무한 루프 방지 (leaf node)", () => {
    // 같은 주소를 두 번 방문하지 않으므로 순환 방지됨
    const registry = createFixture();
    const vv = { indexId: "doc_meta", versionId: "v1", value: 0 };

    // doc_meta에 index_ref dim이 없으므로 1-layer만 반환
    const result = deepDecode(vv, registry);
    expect(result.path.length).toBe(1);
  });

  it("entry-level entryRefs 순환 참조 (A→B→A)가 있어도 무한 루프 방지", () => {
    // indexA의 number_enum entry에 entryRef로 indexB를 가리키고,
    // indexB의 number_enum entry에 entryRef로 indexA를 가리킴
    const cyclicRegistry = new MetaRegistry({
      dims: {
        val_a: {
          kind: { type: "number_enum" },
          snapshots: {
            v1: {
              entries: [0, 1],
              entryRefs: {
                1: { indexId: "indexB", versionId: "v1" },
              },
            },
          },
        },
        val_b: {
          kind: { type: "number_enum" },
          snapshots: {
            v1: {
              entries: [0, 1],
              entryRefs: {
                1: { indexId: "indexA", versionId: "v1" },
              },
            },
          },
        },
      },
      indices: {
        indexA: {
          dims: ["val_a"],
          versions: { v1: { snapshots: { val_a: "v1" } } },
        },
        indexB: {
          dims: ["val_b"],
          versions: { v1: { snapshots: { val_b: "v1" } } },
        },
      },
    });

    // indexA value 0 → decode → val_a=0 → entryRef at pos 1 → indexB value 0
    // → decode → val_b=0 → entryRef at pos 1 → indexA value 0 (이미 방문, 중단)
    const result = deepDecode(
      { indexId: "indexA", versionId: "v1", value: 0 },
      cyclicRegistry,
    );

    // 무한 루프 없이 두 layer만 반환
    expect(result.layers.has("indexA")).toBe(true);
    expect(result.layers.has("indexB")).toBe(true);
    expect(result.path.length).toBe(2);
  });
});

// ── 통합 시나리오 ─────────────────────────────────────────────────────────────

describe("cross-index integration", () => {
  it("composeQuery 결과와 deepDecode 결과가 일관된다", () => {
    const registry = createFixture();

    // composeQuery: format=EPUB인 article 범위
    const ranges = composeQuery(
      { indexId: "article", versionId: "v1" },
      "quality_tier",
      { format: "EPUB" },
      registry,
    );

    // 범위 내 모든 주소에 대해 deepDecode하면 format=EPUB이어야 함
    for (const [from, to] of ranges) {
      for (let addr = from; addr <= to; addr++) {
        const vv = { indexId: "article", versionId: "v1", value: addr };
        const result = deepDecode(vv, registry);
        expect(result.layers.get("doc_meta")!.format).toBe("EPUB");
      }
    }
  });
});

// ── composeQuery ↔ targetCodec.matchRanges 일관성 ──────────────────────────

describe("composeQuery는 내부적으로 targetCodec.matchRanges를 사용한다", () => {
  it("target 조건의 범위가 targetCodec.matchRanges와 일치", () => {
    const registry = createFixture();
    const targetConstraint = { format: "PDF" };

    // composeQuery 결과
    const composeResult = composeQuery(
      { indexId: "article", versionId: "v1" },
      "quality_tier",
      targetConstraint,
      registry,
    );

    // targetCodec.matchRanges로 직접 계산
    const targetCodec = registry.createCodec("doc_meta", "v1");
    const targetRanges = targetCodec.matchRanges(targetConstraint);

    // composeQuery가 반환한 article 주소들의 quality_tier를 추출하면
    // 모두 targetRanges 안에 있어야 함
    const articleCodec = registry.createCodec("article", "v1");
    for (const [from, to] of composeResult) {
      for (let addr = from; addr <= to; addr++) {
        const decoded = articleCodec.decodeValue(addr);
        const tierValue = decoded.quality_tier as number;
        const inRange = targetRanges.some(
          ([lo, hi]) => tierValue >= lo && tierValue <= hi,
        );
        expect(inRange).toBe(true);
      }
    }
  });

  it("entity 미존재 시 EntryNotFoundError를 throw한다", () => {
    const registry = createFixture();

    // targetCodec.matchRanges가 throw하는 것과 같은 에러 타입
    const targetCodec = registry.createCodec("doc_meta", "v1");
    expect(() => targetCodec.matchRanges({ format: "DOCX" })).toThrow(EntryNotFoundError);

    // composeQuery도 동일
    expect(() =>
      composeQuery(
        { indexId: "article", versionId: "v1" },
        "quality_tier",
        { format: "DOCX" },
        registry,
      ),
    ).toThrow(EntryNotFoundError);
  });
});
