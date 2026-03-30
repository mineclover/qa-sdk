/**
 * 검색 인덱스 데모 — 콘텐츠 플랫폼 다차원 필터링
 *
 * ── 시나리오 ────────────────────────────────────────────────────────────────
 *
 * 콘텐츠 플랫폼에서 게시물(article)을 다차원 카테고리로 분류하고,
 * 정수 주소로 압축해 검색 인덱스의 보조 라벨로 사용하는 시나리오.
 *
 * ── 인덱스 구조 ─────────────────────────────────────────────────────────────
 *
 *   1. tag       (1D) — 태그 관리 (8개, headroom 포함)
 *   2. article   (3D) — category × status × locale  (4×3×3 = 36)
 *   3. feed      (2D) — feed_article(index_ref→article) × channel  (12×2 = 24)
 *
 * ── 검색 인덱스 활용 ────────────────────────────────────────────────────────
 *
 * DB의 articles 테이블에 addr INTEGER 컬럼을 추가하면:
 *   - "published + ko 게시물" → matchRanges → SQL WHERE addr BETWEEN ? AND ?
 *   - 비활성화된 카테고리 → gate 제어로 검색 결과에서 제외
 *   - cross-index: feed에서 특정 article 조건으로 역방향 검색
 *
 * ── 테스트 구성 ─────────────────────────────────────────────────────────────
 *
 * [S1] 기본 encode/decode — 게시물 분류 → 정수 → 복원
 * [S2] 범위 검색 — 부분 조건으로 주소 범위 조회 (검색 쿼리 생성)
 * [S3] 복합 필터 — 다중 조건 AND 필터링
 * [S4] 게이트 제어 — 카테고리 비활성화 → 검색 결과 제외
 * [S5] cross-index 검색 — feed에서 article 조건으로 역방향 탐색
 * [S6] 배치 디코딩 — 분석 로그에서 주소 일괄 복원
 * [S7] 버전 업그레이드 — 카테고리 추가 후 기존 주소 보존
 */

import { describe, it, expect, beforeEach } from "vitest";
import {
  MetaRegistry,
  composeQuery,
  deepDecode,
  computeStateRanges,
  checkGate,
  positionsToConstraint,
  type DimStateSpec,
} from "index-meta";
import { containsAddress } from "weighted-index";
import { AXIS } from "demo-snapshot";

// ── 스키마 정의 ─────────────────────────────────────────────

const registry = new MetaRegistry({
  dims: {
    // ── tag (1D 독립) ─────────────────────────────────────────
    tag: {
      kind: { type: "string_enum" },
      description: "게시물 태그",
      snapshots: {
        v1: { entries: [...AXIS.tag.entries] },
        // v2에서 태그 추가
        v2: {
          entries: [...AXIS.tag.entries, "security", "mobile"],
          capacity: 10, // headroom 3
        },
      },
    },

    // ── article 3D 차원 ──────────────────────────────────────
    category: {
      kind: { type: "string_enum" },
      description: "게시물 카테고리",
      snapshots: {
        v1: { entries: [...AXIS.category.entries] },
      },
    },
    status: {
      kind: { type: "string_enum" },
      description: "게시물 상태",
      snapshots: {
        v1: { entries: [...AXIS.status.entries] },
      },
    },
    locale: {
      kind: { type: "string_enum" },
      description: "게시물 언어",
      snapshots: {
        v1: { entries: [...AXIS.locale.entries] },
      },
    },

    // ── feed 2D 차원 ─────────────────────────────────────────
    feed_article: {
      kind: { type: "index_ref", indexId: "article" },
      description: "피드에 노출할 게시물 (article 1D 주소)",
      snapshots: {
        v1: {
          // published 상태의 게시물 12개 (category 4 × locale 3)
          // article shape [4, 3, 3], weights [9, 3, 1]
          // published = status pos 2
          // category=tech,   locale=ko → (0)*9 + (1)*3 + (0) = 3
          // category=tech,   locale=en → (0)*9 + (1)*3 + (1) = 4
          // category=tech,   locale=ja → (0)*9 + (1)*3 + (2) = 5
          // category=design, locale=ko → (1)*9 + (1)*3 + (0) = 12
          // ...
          entries: [3, 4, 5, 12, 13, 14, 21, 22, 23, 30, 31, 32],
        },
      },
    },
    channel: {
      kind: { type: "string_enum" },
      description: "배포 채널",
      snapshots: {
        v1: { entries: ["web", "app"] },
      },
    },
  },

  indices: {
    tag: {
      description: "태그 (1D, capacity 8/10)",
      dims: ["tag"],
      versions: {
        v1: { snapshots: { tag: "v1" } },
        v2: { snapshots: { tag: "v2" } },
      },
    },

    article: {
      description: "category × status × locale  (4×3×3 = 36)",
      dims: ["category", "status", "locale"],
      versions: {
        v1: { snapshots: { category: "v1", status: "v1", locale: "v1" } },
      },
    },

    feed: {
      description: "feed_article(→article) × channel  (12×2 = 24)",
      dims: ["feed_article", "channel"],
      versions: {
        v1: { snapshots: { feed_article: "v1", channel: "v1" } },
      },
    },
  },
});

// ── 코덱 ────────────────────────────────────────────────────

const tagCodec = registry.createCodec("tag", "v1");
const tagCodecV2 = registry.createCodec("tag", "v2");
const articleCodec = registry.createCodec("article", "v1");
const feedCodec = registry.createCodec("feed", "v1");

// ── [S1] 기본 encode/decode ─────────────────────────────────

describe("[S1] 기본 encode/decode — 게시물 분류 압축", () => {
  it("article shape = [4, 3, 3], size = 36", () => {
    expect(articleCodec.shape).toEqual([4, 3, 3]);
    expect(articleCodec.size).toBe(36);
  });

  it("tech/published/ko → 3", () => {
    const vv = articleCodec.encode({ category: "tech", status: "published", locale: "ko" });
    // weights [9, 3, 1] → (1-1)*9 + (2-1)*3 + (1-1)*1 = 3
    expect(vv.value).toBe(3);
  });

  it("culture/archived/ja → 35 (최대 주소)", () => {
    const vv = articleCodec.encode({ category: "culture", status: "archived", locale: "ja" });
    // (4-1)*9 + (3-1)*3 + (3-1)*1 = 27+6+2 = 35
    expect(vv.value).toBe(35);
  });

  it("value 12 → design/published/ko", () => {
    const decoded = articleCodec.decodeValue(12);
    expect(decoded).toEqual({ category: "design", status: "published", locale: "ko" });
  });

  it("encode → decode 왕복 일관성", () => {
    const original = { category: "product", status: "draft", locale: "en" };
    const vv = articleCodec.encode(original);
    const decoded = articleCodec.decode(vv);
    expect(decoded).toEqual(original);
  });

  it("1D tag: frontend=0, ai=3", () => {
    expect(tagCodec.encode({ tag: "frontend" }).value).toBe(0);
    expect(tagCodec.encode({ tag: "ai" }).value).toBe(3);
  });
});

// ── [S2] 범위 검색 — 부분 조건으로 주소 범위 조회 ────────────

describe("[S2] 범위 검색 — SQL WHERE 절 생성에 활용", () => {
  it("category=tech 전체 → [[0, 8]] (9개 주소, 연속 블록)", () => {
    // tech = pos 1, status/locale wildcard
    // (1-1)*9 + 0..8 = 0..8
    const ranges = articleCodec.matchRanges({ category: "tech" });
    expect(ranges).toEqual([[0, 8]]);
  });

  it("status=published 전체 → 4개 비연속 블록", () => {
    // published = status pos 2 → offset 3
    // tech: 0+3..5, design: 9+3..5=12..14, product: 18+3..5=21..23, culture: 27+3..5=30..32
    const ranges = articleCodec.matchRanges({ status: "published" });
    expect(ranges).toEqual([[3, 5], [12, 14], [21, 23], [30, 32]]);
  });

  it("locale=ko + status=published → 4개 단일 주소", () => {
    // published(pos2)/ko(pos1)
    // tech: 3, design: 12, product: 21, culture: 30
    const ranges = articleCodec.matchRanges({ status: "published", locale: "ko" });
    expect(ranges).toEqual([[3, 3], [12, 12], [21, 21], [30, 30]]);
  });

  it("전체 범위 → [[0, 35]]", () => {
    const ranges = articleCodec.matchRanges({});
    expect(ranges).toEqual([[0, 35]]);
  });

  it("containsAddress로 O(log n) 멤버십 판정", () => {
    const publishedRanges = articleCodec.matchRanges({ status: "published" });

    // tech/published/ko = 3 → published 범위에 포함
    expect(containsAddress(3, publishedRanges)).toBe(true);
    // tech/draft/ko = 0 → published 범위에 미포함
    expect(containsAddress(0, publishedRanges)).toBe(false);
    // design/published/en = 13 → 포함
    expect(containsAddress(13, publishedRanges)).toBe(true);
    // design/archived/en = 16 → 미포함
    expect(containsAddress(16, publishedRanges)).toBe(false);
  });

  it("enumerate로 개별 주소 목록 확인", () => {
    // tech + published = 3개 locale
    const values = articleCodec.enumerate({ category: "tech", status: "published" });
    expect(values).toEqual([3, 4, 5]);

    // 각각 decode
    expect(articleCodec.decodeValue(3).locale).toBe("ko");
    expect(articleCodec.decodeValue(4).locale).toBe("en");
    expect(articleCodec.decodeValue(5).locale).toBe("ja");
  });
});

// ── [S3] 복합 필터 — 검색 시나리오 시뮬레이션 ────────────────

describe("[S3] 복합 필터 — 실제 검색 쿼리 생성", () => {
  // 모의 DB: articles 테이블 (addr 컬럼에 article 주소 저장)
  const articles = [
    { id: 1, title: "React 18 새 기능",    addr: articleCodec.encode({ category: "tech",    status: "published", locale: "ko" }).value },
    { id: 2, title: "Node.js Best Practices", addr: articleCodec.encode({ category: "tech",    status: "published", locale: "en" }).value },
    { id: 3, title: "디자인 시스템 구축",      addr: articleCodec.encode({ category: "design",  status: "published", locale: "ko" }).value },
    { id: 4, title: "PM의 하루 (초안)",        addr: articleCodec.encode({ category: "product", status: "draft",     locale: "ko" }).value },
    { id: 5, title: "팀 문화 이야기",          addr: articleCodec.encode({ category: "culture", status: "archived",  locale: "ko" }).value },
    { id: 6, title: "AI入門",                addr: articleCodec.encode({ category: "tech",    status: "published", locale: "ja" }).value },
    { id: 7, title: "Design Tokens",          addr: articleCodec.encode({ category: "design",  status: "published", locale: "en" }).value },
  ];

  /** ranges 기반 필터 (SQL BETWEEN 시뮬레이션) */
  function search(ranges: [number, number][]): typeof articles {
    return articles.filter((a) =>
      ranges.some(([from, to]) => a.addr >= from && a.addr <= to),
    );
  }

  it("published 게시물 검색 → 5건", () => {
    const ranges = articleCodec.matchRanges({ status: "published" });
    const result = search(ranges);
    expect(result.map((a) => a.id)).toEqual([1, 2, 3, 6, 7]);
  });

  it("tech + published 검색 → 3건", () => {
    const ranges = articleCodec.matchRanges({ category: "tech", status: "published" });
    const result = search(ranges);
    expect(result.map((a) => a.id)).toEqual([1, 2, 6]);
  });

  it("ko + published 검색 → 2건", () => {
    const ranges = articleCodec.matchRanges({ status: "published", locale: "ko" });
    const result = search(ranges);
    expect(result.map((a) => a.id)).toEqual([1, 3]);
  });

  it("draft 게시물 검색 → 1건", () => {
    const ranges = articleCodec.matchRanges({ status: "draft" });
    const result = search(ranges);
    expect(result.map((a) => a.id)).toEqual([4]);
  });

  it("culture 카테고리 전체 → 1건 (archived 포함)", () => {
    const ranges = articleCodec.matchRanges({ category: "culture" });
    const result = search(ranges);
    expect(result.map((a) => a.id)).toEqual([5]);
  });

  it("검색 결과에서 decode로 필터 태그 복원", () => {
    const ranges = articleCodec.matchRanges({ category: "tech", status: "published" });
    const result = search(ranges);

    const decoded = result.map((a) => (Object.assign({title:a.title}, articleCodec.decodeValue(a.addr))));

    expect(decoded).toEqual([
      { title: "React 18 새 기능",         category: "tech", status: "published", locale: "ko" },
      { title: "Node.js Best Practices",    category: "tech", status: "published", locale: "en" },
      { title: "AI入門",                    category: "tech", status: "published", locale: "ja" },
    ]);
  });
});

// ── [S4] 게이트 제어 — 카테고리 비활성화 ────────────────────

describe("[S4] 게이트 제어 — 비활성화 카테고리를 검색에서 제외", () => {
  it("culture 카테고리 비활성화 → culture 주소가 inactive", () => {
    // culture = category pos 4 비활성화
    const specs: DimStateSpec[] = [
      { dimIndex: 0, state: "inactive", coords: "4", reason: "culture 카테고리 폐지" },
    ];

    const { reservedRanges, inactiveRanges, openRanges } = computeStateRanges([4, 3, 3], specs);

    // culture/draft/ko = (4-1)*9 + 0 = 27 → inactive
    expect(checkGate(27, reservedRanges, inactiveRanges, openRanges).state).toBe("inactive");
    expect(checkGate(27, reservedRanges, inactiveRanges, openRanges).encode).toBe(false);
    expect(checkGate(27, reservedRanges, inactiveRanges, openRanges).decode).toBe(true); // 기존 데이터 읽기 가능

    // tech/published/ko = 3 → active (영향 없음)
    expect(checkGate(3, reservedRanges, inactiveRanges, openRanges).state).toBe("active");
  });

  it("gate 필터를 검색에 적용 — inactive 결과 제외", () => {
    const specs: DimStateSpec[] = [
      { dimIndex: 0, state: "inactive", coords: "4" },
    ];
    const { reservedRanges, inactiveRanges, openRanges } = computeStateRanges([4, 3, 3], specs);

    // 전체 게시물에서 active인 것만 필터
    const allAddresses = articleCodec.enumerate({});
    const activeAddresses = allAddresses.filter((addr) =>
      checkGate(addr, reservedRanges, inactiveRanges, openRanges).state === "active",
    );

    // culture(pos4) 범위 27-35 제외 → 0-26만 남음
    expect(activeAddresses).toEqual(
      Array.from({ length: 27 }, (_, i) => i),
    );
  });

  it("inactive + open 조합 — headroom 영역은 open 유지", () => {
    // 1D tag index: 5개 entry + capacity 8 → pos 6-8 open
    // ai(pos4) 비활성화
    const specs: DimStateSpec[] = [
      { dimIndex: 0, state: "inactive", coords: "4" },
      { dimIndex: 0, state: "open", coords: "6-8" },
    ];

    const { reservedRanges, inactiveRanges, openRanges } = computeStateRanges([8], specs);

    // frontend(0): active, ai(3): inactive, pos5(4): active, pos6(5): open
    expect(checkGate(0, reservedRanges, inactiveRanges, openRanges).state).toBe("active");
    expect(checkGate(3, reservedRanges, inactiveRanges, openRanges).state).toBe("inactive");
    expect(checkGate(4, reservedRanges, inactiveRanges, openRanges).state).toBe("active");
    expect(checkGate(5, reservedRanges, inactiveRanges, openRanges).state).toBe("open");
    expect(checkGate(6, reservedRanges, inactiveRanges, openRanges).state).toBe("open");
    expect(checkGate(7, reservedRanges, inactiveRanges, openRanges).state).toBe("open");
  });
});

// ── [S5] cross-index 검색 ───────────────────────────────────

describe("[S5] cross-index 검색 — feed에서 article 조건으로 역방향 탐색", () => {
  it("feed shape = [12, 2], size = 24", () => {
    expect(feedCodec.shape).toEqual([12, 2]);
    expect(feedCodec.size).toBe(24);
  });

  it("tech/published 게시물의 feed 주소 범위", () => {
    // article에서 tech/published = addr 3, 4, 5
    // feed_article entries에서 3→pos1, 4→pos2, 5→pos3
    // feed shape [12, 2], weights [2, 1]
    // feed_article pos 1-3, channel wildcard
    // pos1: 0-1, pos2: 2-3, pos3: 4-5 → [[0, 5]]
    const ranges = composeQuery(
      { indexId: "feed", versionId: "v1" },
      "feed_article",
      { category: "tech", status: "published" },
      registry,
    );
    expect(ranges).toEqual([[0, 5]]);
  });

  it("design/published/ko 게시물의 feed 주소", () => {
    // article addr = 12 → feed_article entries에서 12→pos4
    // feed: (4-1)*2 + 0..1 = 6..7
    const ranges = composeQuery(
      { indexId: "feed", versionId: "v1" },
      "feed_article",
      { category: "design", status: "published", locale: "ko" },
      registry,
    );
    expect(ranges).toEqual([[6, 7]]);
  });

  it("culture/published 게시물의 feed 주소 범위", () => {
    // article에서 culture/published = addr 30, 31, 32
    // feed_article entries에서 30→pos10, 31→pos11, 32→pos12
    // feed: pos10: 18-19, pos11: 20-21, pos12: 22-23 → [[18, 23]]
    const ranges = composeQuery(
      { indexId: "feed", versionId: "v1" },
      "feed_article",
      { category: "culture", status: "published" },
      registry,
    );
    expect(ranges).toEqual([[18, 23]]);
  });

  it("deepDecode — feed 주소에서 article 차원까지 풀기", () => {
    // feed: tech/published/ko(article addr=3) × web
    // feed_article=3 → pos1, channel=web → pos1
    // feed addr = (1-1)*2 + (1-1) = 0
    const result = deepDecode(
      { indexId: "feed", versionId: "v1", value: 0 },
      registry,
    );

    // feed 레이어
    const feedLayer = result.layers.get("feed");
    expect(feedLayer).toBeDefined();
    expect(feedLayer!.feed_article).toBe(3);
    expect(feedLayer!.channel).toBe("web");

    // article 레이어 (feed_article=3 → article 자동 참조)
    const articleLayer = result.layers.get("article");
    expect(articleLayer).toBeDefined();
    expect(articleLayer!.category).toBe("tech");
    expect(articleLayer!.status).toBe("published");
    expect(articleLayer!.locale).toBe("ko");
  });
});

// ── [S6] 배치 디코딩 ────────────────────────────────────────

describe("[S6] 배치 디코딩 — 분석 로그에서 주소 일괄 복원", () => {
  it("decodeBatch로 로그 주소 일괄 변환", () => {
    // 분석 로그에 기록된 article 주소들
    const logAddresses = [3, 4, 12, 21, 30];
    const decoded = articleCodec.decodeBatch(logAddresses);

    expect(decoded).toEqual([
      { category: "tech",    status: "published", locale: "ko" },
      { category: "tech",    status: "published", locale: "en" },
      { category: "design",  status: "published", locale: "ko" },
      { category: "product", status: "published", locale: "ko" },
      { category: "culture", status: "published", locale: "ko" },
    ]);
  });

  it("category별 게시물 수 집계 (analytics)", () => {
    const logAddresses = [3, 4, 5, 3, 12, 12, 21, 3, 30, 30, 30];
    const decoded = articleCodec.decodeBatch(logAddresses);

    const countByCategory = new Map<string, number>();
    for (const d of decoded) {
      const cat = d.category as string;
      countByCategory.set(cat, (countByCategory.get(cat) ?? 0) + 1);
    }

    expect(countByCategory.get("tech")).toBe(5);
    expect(countByCategory.get("design")).toBe(2);
    expect(countByCategory.get("product")).toBe(1);
    expect(countByCategory.get("culture")).toBe(3);
  });

  it("locale별 분포 — containsAddress로 범위 판정", () => {
    const koRanges = articleCodec.matchRanges({ locale: "ko" });
    const enRanges = articleCodec.matchRanges({ locale: "en" });
    const jaRanges = articleCodec.matchRanges({ locale: "ja" });

    const log = [3, 4, 5, 12, 13, 21, 30, 31];

    const koCnt = log.filter((a) => containsAddress(a, koRanges)).length;
    const enCnt = log.filter((a) => containsAddress(a, enRanges)).length;
    const jaCnt = log.filter((a) => containsAddress(a, jaRanges)).length;

    expect(koCnt).toBe(4); // 3, 12, 21, 30
    expect(enCnt).toBe(3); // 4, 13, 31
    expect(jaCnt).toBe(1); // 5
  });
});

// ── [S7] 버전 업그레이드 — 주소 보존 ────────────────────────

describe("[S7] 버전 업그레이드 — 태그 추가 후 기존 주소 보존", () => {
  it("v1 주소가 v2에서도 동일", () => {
    // v1: frontend=0, backend=1, devops=2, ai=3, database=4
    const v1Frontend = tagCodec.encode({ tag: "frontend" }).value;
    const v1Ai = tagCodec.encode({ tag: "ai" }).value;

    // v2: 동일 entries + security=5, mobile=6
    const v2Frontend = tagCodecV2.encode({ tag: "frontend" }).value;
    const v2Ai = tagCodecV2.encode({ tag: "ai" }).value;

    expect(v1Frontend).toBe(v2Frontend); // 0 = 0
    expect(v1Ai).toBe(v2Ai);             // 3 = 3
  });

  it("v2에서 새 태그 사용 가능", () => {
    expect(tagCodecV2.encode({ tag: "security" }).value).toBe(5);
    expect(tagCodecV2.encode({ tag: "mobile" }).value).toBe(6);
  });

  it("v2 capacity headroom — shape은 capacity 기반, headroom은 PositionEngine이 관리", () => {
    // WeightedIndex shape = snapshotCapacity = 10 (capacity 기반)
    expect(tagCodecV2.shape).toEqual([10]);
    expect(tagCodecV2.size).toBe(10);

    // capacity(10)는 shape에 반영됨. pos 8-10은 open 영역.
    // 게이트 제어 시 capacity 기준으로 DimStateSpec을 구성한다.
    const capacity = 10;
    const specs: DimStateSpec[] = [
      { dimIndex: 0, state: "open", coords: positionsToConstraint([8, 9, 10]) },
    ];
    const { openRanges } = computeStateRanges([capacity], specs);

    // addr 7, 8, 9 = open (0-based, pos 8-10)
    expect(checkGate(7, [], [], openRanges).state).toBe("open");
    expect(checkGate(8, [], [], openRanges).state).toBe("open");
    expect(checkGate(9, [], [], openRanges).state).toBe("open");

    // addr 0-6 = active (entries 영역)
    for (let i = 0; i < 7; i++) {
      expect(checkGate(i, [], [], openRanges).state).toBe("active");
    }
  });

  it("직렬화 프로토콜에 버전 포함 — v1/v2 구분 가능", () => {
    const v1 = tagCodec.encode({ tag: "ai" });
    const v2 = tagCodecV2.encode({ tag: "ai" });

    expect(registry.serialize(v1)).toBe("tag:v1:3");
    expect(registry.serialize(v2)).toBe("tag:v2:3");

    // 같은 value지만 version이 달라 구분됨
    expect(v1.versionId).toBe("v1");
    expect(v2.versionId).toBe("v2");
  });
});
