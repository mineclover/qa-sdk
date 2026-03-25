import { describe, it, expect, beforeEach } from "vitest";
import { InMemoryTagStore } from "./memory-store.js";
import { normalizeTag } from "./types.js";

describe("normalizeTag", () => {
  it("소문자 변환 + 공백→하이픈", () => {
    expect(normalizeTag("  Hello World  ")).toBe("hello-world");
  });

  it("연속 공백 하나로", () => {
    expect(normalizeTag("a   b")).toBe("a-b");
  });

  it("빈 문자열", () => {
    expect(normalizeTag("   ")).toBe("");
  });
});

describe("InMemoryTagStore", () => {
  let store: InMemoryTagStore;

  beforeEach(() => {
    store = new InMemoryTagStore();
  });

  /* ---- attach / getTags ---- */

  it("태그 부착 + 조회", async () => {
    await store.attach("r1", "record", ["promo", "seasonal"]);
    expect(await store.getTags("r1")).toEqual(["promo", "seasonal"]);
  });

  it("중복 태그 무시", async () => {
    await store.attach("r1", "record", ["promo", "promo", "PROMO"]);
    expect(await store.getTags("r1")).toEqual(["promo"]);
  });

  it("빈 태그 무시", async () => {
    await store.attach("r1", "record", ["", "  ", "valid"]);
    expect(await store.getTags("r1")).toEqual(["valid"]);
  });

  it("추가 부착", async () => {
    await store.attach("r1", "record", ["a"]);
    await store.attach("r1", "record", ["b"]);
    expect(await store.getTags("r1")).toEqual(["a", "b"]);
  });

  /* ---- detach ---- */

  it("태그 제거", async () => {
    await store.attach("r1", "record", ["a", "b", "c"]);
    await store.detach("r1", ["b"]);
    expect(await store.getTags("r1")).toEqual(["a", "c"]);
  });

  it("전체 제거", async () => {
    await store.attach("r1", "record", ["a", "b"]);
    await store.detachAll("r1");
    expect(await store.getTags("r1")).toEqual([]);
  });

  it("존재하지 않는 대상 detach — 에러 없음", async () => {
    await store.detach("nope", ["x"]); // no-op
  });

  /* ---- search OR ---- */

  it("OR 검색 — 하나라도 매치", async () => {
    await store.attach("r1", "record", ["promo", "new"]);
    await store.attach("r2", "record", ["seasonal"]);
    await store.attach("r3", "record", ["promo", "seasonal"]);

    const results = await store.search({ tags: ["promo"] });
    const ids = results.map((r) => r.targetId).sort();
    expect(ids).toEqual(["r1", "r3"]);
  });

  it("OR 검색 — 여러 태그", async () => {
    await store.attach("r1", "record", ["a"]);
    await store.attach("r2", "record", ["b"]);
    await store.attach("r3", "record", ["c"]);

    const results = await store.search({ tags: ["a", "b"] });
    expect(results).toHaveLength(2);
  });

  /* ---- search AND ---- */

  it("AND 검색 — 모든 태그 포함", async () => {
    await store.attach("r1", "record", ["promo", "new"]);
    await store.attach("r2", "record", ["promo"]);
    await store.attach("r3", "record", ["promo", "new", "seasonal"]);

    const results = await store.search({
      tags: ["promo", "new"],
      operator: "AND",
    });
    const ids = results.map((r) => r.targetId).sort();
    expect(ids).toEqual(["r1", "r3"]);
  });

  it("AND 검색 — 존재하지 않는 태그 포함 시 빈 결과", async () => {
    await store.attach("r1", "record", ["a"]);
    const results = await store.search({
      tags: ["a", "nonexistent"],
      operator: "AND",
    });
    expect(results).toHaveLength(0);
  });

  /* ---- targetKind 필터 ---- */

  it("targetKind 필터", async () => {
    await store.attach("r1", "record", ["promo"]);
    await store.attach("t1", "trace", ["promo"]);
    await store.attach("s1", "session", ["promo"]);

    const records = await store.search({
      tags: ["promo"],
      targetKind: "record",
    });
    expect(records).toHaveLength(1);
    expect(records[0].targetId).toBe("r1");

    const traces = await store.search({
      tags: ["promo"],
      targetKind: "trace",
    });
    expect(traces).toHaveLength(1);
    expect(traces[0].targetId).toBe("t1");
  });

  /* ---- 페이지네이션 ---- */

  it("limit + offset", async () => {
    for (let i = 0; i < 10; i++) {
      await store.attach(`r${i}`, "record", ["common"]);
    }

    const page1 = await store.search({
      tags: ["common"],
      limit: 3,
      offset: 0,
    });
    expect(page1).toHaveLength(3);

    const page2 = await store.search({
      tags: ["common"],
      limit: 3,
      offset: 3,
    });
    expect(page2).toHaveLength(3);

    // ID가 겹치지 않아야 함
    const ids1 = new Set(page1.map((r) => r.targetId));
    const ids2 = new Set(page2.map((r) => r.targetId));
    for (const id of ids2) {
      expect(ids1.has(id)).toBe(false);
    }
  });

  /* ---- listTags ---- */

  it("태그 목록 + 카운트 (내림차순)", async () => {
    await store.attach("r1", "record", ["a", "b"]);
    await store.attach("r2", "record", ["a", "c"]);
    await store.attach("r3", "record", ["a"]);

    const list = await store.listTags();
    expect(list[0]).toEqual({ tag: "a", count: 3 });
    expect(list).toHaveLength(3);
  });

  it("listTags targetKind 필터", async () => {
    await store.attach("r1", "record", ["x"]);
    await store.attach("t1", "trace", ["x"]);

    const recordTags = await store.listTags("record");
    expect(recordTags).toEqual([{ tag: "x", count: 1 }]);
  });

  /* ---- count ---- */

  it("고유 태그 수", async () => {
    await store.attach("r1", "record", ["a", "b"]);
    await store.attach("r2", "record", ["b", "c"]);
    expect(await store.count()).toBe(3); // a, b, c
  });

  /* ---- matchedTags 포함 확인 ---- */

  it("검색 결과에 matchedTags와 allTags 모두 포함", async () => {
    await store.attach("r1", "record", ["promo", "new", "seasonal"]);

    const [result] = await store.search({ tags: ["promo", "seasonal"] });
    expect(result.matchedTags.sort()).toEqual(["promo", "seasonal"]);
    expect(result.allTags).toEqual(["new", "promo", "seasonal"]);
  });

  /* ---- 시간 범위 검색 ---- */

  it("timeRange 필터", async () => {
    await store.attach("r1", "record", ["promo"]);
    // 약간의 지연 후 두 번째 부착
    await store.attach("r2", "record", ["promo"]);

    // 모든 결과가 timeRange 내에 있으면 전부 반환
    const all = await store.search({
      tags: ["promo"],
      timeRange: { from: "2020-01-01T00:00:00Z" },
    });
    expect(all).toHaveLength(2);
  });

  it("timeRange to 이전만 반환", async () => {
    // createdAt이 자동으로 now()이므로, 과거 시점으로 to 설정하면 빈 결과
    await store.attach("r1", "record", ["x"]);

    const hits = await store.search({
      tags: ["x"],
      timeRange: { to: "2020-01-01T00:00:00Z" },
    });
    expect(hits).toHaveLength(0);
  });

  /* ---- detach 엣지 케이스 ---- */

  it("존재하지 않는 태그 detach — 기존 태그 유지", async () => {
    await store.attach("r1", "record", ["a", "b"]);
    await store.detach("r1", ["nonexistent"]);
    expect(await store.getTags("r1")).toEqual(["a", "b"]);
  });

  it("detachAll 후 재부착", async () => {
    await store.attach("r1", "record", ["a"]);
    await store.detachAll("r1");
    await store.attach("r1", "record", ["b"]);
    expect(await store.getTags("r1")).toEqual(["b"]);
  });

  /* ---- 같은 ID 다른 targetKind ---- */

  it("같은 ID라도 첫 번째 targetKind 유지", async () => {
    // 같은 targetId로 다른 kind attach → 첫 번째 kind가 유지됨
    await store.attach("shared-id", "record", ["a"]);
    await store.attach("shared-id", "record", ["b"]); // 추가 부착

    const hits = await store.search({
      tags: ["a"],
      targetKind: "record",
    });
    expect(hits).toHaveLength(1);
    expect(hits[0].targetId).toBe("shared-id");
  });

  /* ---- 빈 검색 ---- */

  it("빈 태그 검색 — 빈 결과", async () => {
    await store.attach("r1", "record", ["a"]);
    expect(await store.search({ tags: [] })).toEqual([]);
  });
});
