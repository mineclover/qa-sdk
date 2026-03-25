import { describe, it, expect, beforeEach } from "vitest";
import { InMemoryAddressIndex } from "./memory-store.js";
import { parseAddressValue, parseAddressContext } from "./types.js";

/* ================================================================== */
/*  tag-search + address-index 조합 시나리오                            */
/*  (tag-search를 직접 import하지 않고, 조합 패턴만 시뮬레이션)          */
/* ================================================================== */

describe("조합 시나리오: 태그 + 주소 교차 검색", () => {
  it("태그로 후보 축소 → 주소로 정밀 필터", async () => {
    const addressIdx = new InMemoryAddressIndex();

    // 태그 역색인 시뮬레이션 (tag → recordIds)
    const tagIndex = new Map<string, Set<string>>();
    function attachTag(recordId: string, tag: string) {
      if (!tagIndex.has(tag)) tagIndex.set(tag, new Set());
      tagIndex.get(tag)!.add(recordId);
    }
    function findByTag(tag: string): string[] {
      return [...(tagIndex.get(tag) ?? [])];
    }

    // 데이터 준비: 5개 레코드
    const records = [
      { id: "r1", ctx: { page: "page:v1:10", env: "env:v1:0" }, tags: ["promo", "checkout"] },
      { id: "r2", ctx: { page: "page:v1:20", env: "env:v1:0" }, tags: ["promo"] },
      { id: "r3", ctx: { page: "page:v1:10", env: "env:v1:1" }, tags: ["promo", "checkout"] },
      { id: "r4", ctx: { page: "page:v1:30", env: "env:v1:0" }, tags: ["seasonal"] },
      { id: "r5", ctx: { page: "page:v1:10", env: "env:v1:0" }, tags: ["checkout"] },
    ];

    for (const r of records) {
      await addressIdx.index(r.id, r.ctx, "2026-01-01T00:00:00Z");
      for (const tag of r.tags) attachTag(r.id, tag);
    }

    // 쿼리: "promo 태그 + env=0(prod) + page=10"
    // 1단계: 태그로 후보 축소
    const promoIds = findByTag("promo"); // r1, r2, r3
    expect(promoIds).toHaveLength(3);

    // 2단계: 주소로 정밀 필터
    const addressHits = await addressIdx.findCross({
      constraints: [
        { prefixId: "env", address: 0 },
        { prefixId: "page", address: 10 },
      ],
    });
    const addressIds = new Set(addressHits.map((h) => h.recordId));

    // 3단계: 교집합
    const finalIds = promoIds.filter((id) => addressIds.has(id));
    expect(finalIds).toEqual(["r1"]); // promo + env=prod + page=10
  });
});

/* ================================================================== */
/*  파서 테스트                                                        */
/* ================================================================== */

describe("parseAddressValue", () => {
  it("정상 파싱: tracking:v2:1200", () => {
    expect(parseAddressValue("tracking:v2:1200")).toEqual({
      prefixId: "tracking",
      version: "v2",
      address: 1200,
    });
  });

  it("콜론 포함 prefix: cart_event:v1:42", () => {
    expect(parseAddressValue("cart_event:v1:42")).toEqual({
      prefixId: "cart_event",
      version: "v1",
      address: 42,
    });
  });

  it("주소 0도 유효", () => {
    const result = parseAddressValue("env:v1:0");
    expect(result).toEqual({ prefixId: "env", version: "v1", address: 0 });
  });

  it("파트 부족 → null", () => {
    expect(parseAddressValue("tracking:v2")).toBeNull();
    expect(parseAddressValue("tracking")).toBeNull();
    expect(parseAddressValue("")).toBeNull();
  });

  it("주소가 숫자가 아님 → null", () => {
    expect(parseAddressValue("tracking:v2:abc")).toBeNull();
  });

  it("음수 주소 → null", () => {
    expect(parseAddressValue("tracking:v2:-1")).toBeNull();
  });
});

describe("parseAddressContext", () => {
  it("여러 prefix 파싱", () => {
    const ctx = {
      tracking: "tracking:v2:1200",
      content: "content:v1:42",
    };
    const results = parseAddressContext(ctx);
    expect(results).toHaveLength(2);
    expect(results.find((r) => r.prefixId === "tracking")?.address).toBe(1200);
    expect(results.find((r) => r.prefixId === "content")?.address).toBe(42);
  });

  it("파싱 실패 항목은 건너뜀", () => {
    const ctx = {
      valid: "tracking:v1:100",
      invalid: "bad-format",
    };
    expect(parseAddressContext(ctx)).toHaveLength(1);
  });
});

/* ================================================================== */
/*  InMemoryAddressIndex 테스트                                        */
/* ================================================================== */

describe("InMemoryAddressIndex", () => {
  let idx: InMemoryAddressIndex;

  beforeEach(() => {
    idx = new InMemoryAddressIndex();
  });

  /* ---- 인덱싱 + 기본 조회 ---- */

  it("인덱싱 후 prefix로 조회", async () => {
    await idx.index("r1", { tracking: "tracking:v2:100" }, "2026-01-01T00:00:00Z");
    await idx.index("r2", { tracking: "tracking:v2:200" }, "2026-01-01T01:00:00Z");

    const hits = await idx.find({ prefixId: "tracking" });
    expect(hits).toHaveLength(2);
  });

  it("정확한 주소 매치", async () => {
    await idx.index("r1", { tracking: "tracking:v2:100" }, "2026-01-01T00:00:00Z");
    await idx.index("r2", { tracking: "tracking:v2:200" }, "2026-01-01T01:00:00Z");
    await idx.index("r3", { tracking: "tracking:v2:100" }, "2026-01-01T02:00:00Z");

    const hits = await idx.find({ prefixId: "tracking", address: 100 });
    expect(hits).toHaveLength(2);
    expect(hits.every((h) => h.addresses["tracking"].address === 100)).toBe(true);
  });

  it("존재하지 않는 prefix → 빈 결과", async () => {
    const hits = await idx.find({ prefixId: "nonexistent" });
    expect(hits).toEqual([]);
  });

  /* ---- 범위 검색 ---- */

  it("주소 범위 검색 [100, 300]", async () => {
    await idx.index("r1", { t: "t:v1:50" }, "2026-01-01T00:00:00Z");
    await idx.index("r2", { t: "t:v1:100" }, "2026-01-01T01:00:00Z");
    await idx.index("r3", { t: "t:v1:200" }, "2026-01-01T02:00:00Z");
    await idx.index("r4", { t: "t:v1:300" }, "2026-01-01T03:00:00Z");
    await idx.index("r5", { t: "t:v1:400" }, "2026-01-01T04:00:00Z");

    const hits = await idx.find({
      prefixId: "t",
      addressRange: { from: 100, to: 300 },
    });
    expect(hits).toHaveLength(3);
    const ids = hits.map((h) => h.recordId).sort();
    expect(ids).toEqual(["r2", "r3", "r4"]);
  });

  it("범위 경계 inclusive", async () => {
    await idx.index("r1", { t: "t:v1:10" }, "2026-01-01T00:00:00Z");
    await idx.index("r2", { t: "t:v1:20" }, "2026-01-01T01:00:00Z");

    // from=10, to=10 → r1만
    const hits = await idx.find({
      prefixId: "t",
      addressRange: { from: 10, to: 10 },
    });
    expect(hits).toHaveLength(1);
    expect(hits[0].recordId).toBe("r1");
  });

  /* ---- 버전 필터 ---- */

  it("version 필터", async () => {
    await idx.index("r1", { t: "t:v1:100" }, "2026-01-01T00:00:00Z");
    await idx.index("r2", { t: "t:v2:100" }, "2026-01-01T01:00:00Z");

    const v1 = await idx.find({ prefixId: "t", address: 100, version: "v1" });
    expect(v1).toHaveLength(1);
    expect(v1[0].recordId).toBe("r1");

    const v2 = await idx.find({ prefixId: "t", address: 100, version: "v2" });
    expect(v2).toHaveLength(1);
    expect(v2[0].recordId).toBe("r2");
  });

  /* ---- 시간 범위 ---- */

  it("시간 범위 필터", async () => {
    await idx.index("r1", { t: "t:v1:100" }, "2026-01-01T00:00:00Z");
    await idx.index("r2", { t: "t:v1:100" }, "2026-01-02T00:00:00Z");
    await idx.index("r3", { t: "t:v1:100" }, "2026-01-03T00:00:00Z");

    const hits = await idx.find({
      prefixId: "t",
      timeRange: {
        from: "2026-01-01T12:00:00Z",
        to: "2026-01-02T12:00:00Z",
      },
    });
    expect(hits).toHaveLength(1);
    expect(hits[0].recordId).toBe("r2");
  });

  /* ---- 페이지네이션 ---- */

  it("limit + offset", async () => {
    for (let i = 0; i < 10; i++) {
      await idx.index(`r${i}`, { t: `t:v1:${i * 10}` }, `2026-01-01T0${i}:00:00Z`);
    }

    const page1 = await idx.find({ prefixId: "t", limit: 3, offset: 0 });
    expect(page1).toHaveLength(3);

    const page2 = await idx.find({ prefixId: "t", limit: 3, offset: 3 });
    expect(page2).toHaveLength(3);

    // 겹치지 않음
    const ids1 = new Set(page1.map((h) => h.recordId));
    for (const h of page2) {
      expect(ids1.has(h.recordId)).toBe(false);
    }
  });

  /* ---- 다중 prefix 레코드 ---- */

  it("하나의 레코드에 여러 prefix 주소", async () => {
    await idx.index(
      "r1",
      {
        tracking: "tracking:v2:100",
        content: "content:v1:42",
        env: "env:v1:0",
      },
      "2026-01-01T00:00:00Z",
    );

    // tracking으로 조회
    const byTracking = await idx.find({ prefixId: "tracking", address: 100 });
    expect(byTracking).toHaveLength(1);
    expect(byTracking[0].addresses).toEqual({
      tracking: { version: "v2", address: 100 },
      content: { version: "v1", address: 42 },
      env: { version: "v1", address: 0 },
    });

    // content으로 조회 — 같은 레코드
    const byContent = await idx.find({ prefixId: "content", address: 42 });
    expect(byContent).toHaveLength(1);
    expect(byContent[0].recordId).toBe("r1");
  });

  /* ---- 교차 prefix 조회 ---- */

  it("cross-prefix AND 쿼리", async () => {
    // r1: tracking=100, env=0
    await idx.index(
      "r1",
      { tracking: "tracking:v1:100", env: "env:v1:0" },
      "2026-01-01T00:00:00Z",
    );
    // r2: tracking=200, env=0
    await idx.index(
      "r2",
      { tracking: "tracking:v1:200", env: "env:v1:0" },
      "2026-01-01T01:00:00Z",
    );
    // r3: tracking=100, env=1
    await idx.index(
      "r3",
      { tracking: "tracking:v1:100", env: "env:v1:1" },
      "2026-01-01T02:00:00Z",
    );

    // tracking=100 AND env=0 → r1만
    const hits = await idx.findCross({
      constraints: [
        { prefixId: "tracking", address: 100 },
        { prefixId: "env", address: 0 },
      ],
    });
    expect(hits).toHaveLength(1);
    expect(hits[0].recordId).toBe("r1");
  });

  it("cross-prefix 범위 + 정확 매치", async () => {
    await idx.index("r1", { t: "t:v1:50", e: "e:v1:0" }, "2026-01-01T00:00:00Z");
    await idx.index("r2", { t: "t:v1:150", e: "e:v1:0" }, "2026-01-01T01:00:00Z");
    await idx.index("r3", { t: "t:v1:250", e: "e:v1:0" }, "2026-01-01T02:00:00Z");
    await idx.index("r4", { t: "t:v1:150", e: "e:v1:1" }, "2026-01-01T03:00:00Z");

    // t in [100,200] AND e=0 → r2만
    const hits = await idx.findCross({
      constraints: [
        { prefixId: "t", addressRange: { from: 100, to: 200 } },
        { prefixId: "e", address: 0 },
      ],
    });
    expect(hits).toHaveLength(1);
    expect(hits[0].recordId).toBe("r2");
  });

  it("cross-prefix 빈 교집합", async () => {
    await idx.index("r1", { t: "t:v1:100" }, "2026-01-01T00:00:00Z");
    await idx.index("r2", { e: "e:v1:0" }, "2026-01-01T01:00:00Z");

    // r1에는 e 없고, r2에는 t 없음 → 교집합 비어있음
    const hits = await idx.findCross({
      constraints: [
        { prefixId: "t", address: 100 },
        { prefixId: "e", address: 0 },
      ],
    });
    expect(hits).toHaveLength(0);
  });

  /* ---- getAddresses ---- */

  it("레코드별 주소 조회", async () => {
    await idx.index(
      "r1",
      { tracking: "tracking:v2:100", content: "content:v1:42" },
      "2026-01-01T00:00:00Z",
    );

    const addrs = await idx.getAddresses("r1");
    expect(addrs).toEqual({
      tracking: { version: "v2", address: 100 },
      content: { version: "v1", address: 42 },
    });
  });

  it("존재하지 않는 레코드 → null", async () => {
    expect(await idx.getAddresses("nope")).toBeNull();
  });

  /* ---- stats ---- */

  it("prefix별 통계", async () => {
    await idx.index("r1", { t: "t:v1:100" }, "2026-01-01T00:00:00Z");
    await idx.index("r2", { t: "t:v1:200" }, "2026-01-01T01:00:00Z");
    await idx.index("r3", { t: "t:v1:100" }, "2026-01-01T02:00:00Z");

    const [stat] = await idx.stats("t");
    expect(stat.prefixId).toBe("t");
    expect(stat.recordCount).toBe(3);
    expect(stat.uniqueAddresses).toBe(2); // 100, 200
    expect(stat.addressRange).toEqual({ min: 100, max: 200 });
  });

  it("전체 통계 — 레코드 수 순 내림차순", async () => {
    await idx.index("r1", { a: "a:v1:0", b: "b:v1:0" }, "2026-01-01T00:00:00Z");
    await idx.index("r2", { a: "a:v1:1" }, "2026-01-01T01:00:00Z");

    const stats = await idx.stats();
    expect(stats[0].prefixId).toBe("a"); // 2건
    expect(stats[1].prefixId).toBe("b"); // 1건
  });

  /* ---- count / clear ---- */

  it("count + clear", async () => {
    await idx.index("r1", { t: "t:v1:0" }, "2026-01-01T00:00:00Z");
    await idx.index("r2", { t: "t:v1:1" }, "2026-01-01T01:00:00Z");
    expect(await idx.count()).toBe(2);

    await idx.clear();
    expect(await idx.count()).toBe(0);
    expect(await idx.find({ prefixId: "t" })).toEqual([]);
  });

  /* ---- 재인덱싱 (덮어쓰기) ---- */

  it("동일 recordId 재인덱싱 — 이전 주소 제거, 새 주소로 교체", async () => {
    await idx.index("r1", { t: "t:v1:100" }, "2026-01-01T00:00:00Z");

    // 같은 recordId로 다른 주소 인덱싱
    await idx.index("r1", { t: "t:v1:999" }, "2026-01-02T00:00:00Z");

    // 이전 주소 100으로 검색 → 없어야 함
    expect(await idx.find({ prefixId: "t", address: 100 })).toHaveLength(0);

    // 새 주소 999로 검색 → 1건
    const hits = await idx.find({ prefixId: "t", address: 999 });
    expect(hits).toHaveLength(1);
    expect(hits[0].recordId).toBe("r1");

    // count는 여전히 1
    expect(await idx.count()).toBe(1);
  });

  it("동일 recordId 재인덱싱 — 중복 없이 최신 상태만 유지", async () => {
    // ingest 재시도: 같은 log_id, 같은 address_context
    await idx.index("r1", { t: "t:v1:100" }, "2026-01-01T00:00:00Z");
    await idx.index("r1", { t: "t:v1:100" }, "2026-01-01T00:00:00Z");

    // 중복 없이 1건만
    const hits = await idx.find({ prefixId: "t", address: 100 });
    expect(hits).toHaveLength(1);
    expect(await idx.count()).toBe(1);
  });

  /* ---- findCross + timeRange ---- */

  it("cross-prefix + timeRange 결합", async () => {
    await idx.index("r1", { t: "t:v1:100", e: "e:v1:0" }, "2026-01-01T00:00:00Z");
    await idx.index("r2", { t: "t:v1:100", e: "e:v1:0" }, "2026-01-03T00:00:00Z");

    // 1월 2일까지만 → r1만
    const hits = await idx.findCross({
      constraints: [
        { prefixId: "t", address: 100 },
        { prefixId: "e", address: 0 },
      ],
      timeRange: { to: "2026-01-02T00:00:00Z" },
    });
    expect(hits).toHaveLength(1);
    expect(hits[0].recordId).toBe("r1");
  });

  /* ---- 빈 인덱스 stats ---- */

  it("빈 인덱스 stats — 빈 배열", async () => {
    const stats = await idx.stats();
    expect(stats).toEqual([]);
  });

  it("존재하지 않는 prefix stats — recordCount 0", async () => {
    const stats = await idx.stats("nonexistent");
    expect(stats).toHaveLength(1);
    expect(stats[0].recordCount).toBe(0);
    expect(stats[0].addressRange).toBeNull();
  });

  /* ---- 현실적 address_context 시나리오 ---- */

  it("실제 카탈로그 수준 address_context", async () => {
    // 쇼핑몰 결제 흐름 시나리오
    const checkoutCtx = {
      page_view: "page_view:v2:48",       // 결제 페이지
      endpoint: "endpoint:v1:112",         // checkout API
      tracking: "tracking:v2:1200",        // 사용자 행동 추적
      cart_event: "cart_event:v1:7",       // 장바구니 이벤트
      order_event: "order_event:v1:3",     // 주문 이벤트
    };

    await idx.index("log-001", checkoutCtx, "2026-03-25T09:30:00Z");
    await idx.index("log-002", checkoutCtx, "2026-03-25T09:30:01Z");

    // 다른 흐름: 장바구니만
    await idx.index(
      "log-003",
      {
        page_view: "page_view:v2:12",    // 상품 페이지
        cart_event: "cart_event:v1:7",    // 같은 장바구니 이벤트
      },
      "2026-03-25T09:31:00Z",
    );

    // "결제 페이지(48)에서 발생한 레코드"
    const checkoutPages = await idx.find({
      prefixId: "page_view",
      address: 48,
    });
    expect(checkoutPages).toHaveLength(2);

    // "cart_event=7 AND endpoint=112" → 결제 흐름만 (log-003은 endpoint 없음)
    const checkoutFlow = await idx.findCross({
      constraints: [
        { prefixId: "cart_event", address: 7 },
        { prefixId: "endpoint", address: 112 },
      ],
    });
    expect(checkoutFlow).toHaveLength(2);
    expect(checkoutFlow.every((h) => h.addresses["order_event"])).toBe(true);

    // "page_view 범위 [1, 50]에서 cart_event가 있는 레코드"
    const browsingWithCart = await idx.findCross({
      constraints: [
        { prefixId: "page_view", addressRange: { from: 1, to: 50 } },
        { prefixId: "cart_event", address: 7 },
      ],
    });
    expect(browsingWithCart).toHaveLength(3); // log-001, log-002, log-003 모두
  });

  /* ---- 엣지 케이스 ---- */

  it("address_context 파싱 실패 → 인덱싱 건너뜀", async () => {
    await idx.index("r1", { bad: "invalid-format" }, "2026-01-01T00:00:00Z");
    expect(await idx.count()).toBe(0);
  });

  it("빈 address_context → 인덱싱 건너뜀", async () => {
    await idx.index("r1", {}, "2026-01-01T00:00:00Z");
    expect(await idx.count()).toBe(0);
  });

  /* ---- 대량 인덱싱 성능 확인 ---- */

  it("1000건 인덱싱 + 범위 검색", async () => {
    for (let i = 0; i < 1000; i++) {
      await idx.index(
        `r${i}`,
        { t: `t:v1:${i}` },
        `2026-01-01T00:00:${String(i % 60).padStart(2, "0")}Z`,
      );
    }

    expect(await idx.count()).toBe(1000);

    // 범위 [400, 600] → 201건
    const hits = await idx.find({
      prefixId: "t",
      addressRange: { from: 400, to: 600 },
      limit: 1000,
    });
    expect(hits).toHaveLength(201);
  });
});
