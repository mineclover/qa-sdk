import { describe, it, expect } from "vitest";
import * as fc from "fast-check";
import { LabelRegistry } from "./label-registry.js";
import { PrefixCodec } from "./prefix-registry.js";
import {
  WeightedIndexError,
  CoordError,
  MigrateError,
  PrefixNotFoundError,
  VersionNotFoundError,
  EntityNotFoundError,
  SerializeError,
} from "./errors.js";

// ── 픽스처 ────────────────────────────────────────────────────────────────────
const labelReg = new LabelRegistry({
  role: [
    { version: "v1", ids: [1, 2, 3] },
    { version: "v2", ids: [1, 2, 3, 4], changelog: "superadmin(id=4) 추가" },
  ],
  action: [
    { version: "v1", ids: ["read", "write", "delete", "admin"] },
  ],
  api: [
    { version: "v1", ids: ["/users", "/posts", "/comments", "/files", "/tags", "/likes", "/auth", "/search"] },
    {
      version: "v2",
      ids: [
        "/users", "/posts", "/comments", "/files",
        "/tags",  "/likes", "/auth",     "/search",
        "/upload", "/download", "/export", "/import",
      ],
      changelog: "엔드포인트 4개 추가",
    },
  ],
  tenant: [{ version: "v1", ids: [100, 200] }],
  page: [
    {
      version: "v1",
      ids: Array.from({ length: 12 }, (_, i) => `page-${String(i + 1).padStart(3, "0")}`),
    },
  ],
});

const registry = new PrefixCodec(labelReg, {
  api_perm: {
    labels: ["role", "action", "api", "tenant"],
    versions: [
      { version: "pv1", labelVersions: { role: "v1", action: "v1", api: "v1", tenant: "v1" } },
      { version: "pv2", labelVersions: { role: "v2", action: "v1", api: "v1", tenant: "v1" }, changelog: "role superadmin 추가" },
      { version: "pv3", labelVersions: { role: "v2", action: "v1", api: "v2", tenant: "v1" }, changelog: "api 엔드포인트 추가" },
    ],
  },
  page_perm: {
    labels: ["role", "page", "tenant"],
    versions: [
      { version: "pv1", labelVersions: { role: "v1", page: "v1", tenant: "v1" } },
      { version: "pv2", labelVersions: { role: "v2", page: "v1", tenant: "v1" } },
    ],
  },
});

// ─────────────────────────────────────────────────────────────────────────────
// [단위] shape 도출
// ─────────────────────────────────────────────────────────────────────────────
describe("[단위] shape 도출 (label ids.length 기반)", () => {
  it("prefix+version 별 shape = 각 label의 ids.length", () => {
    expect(registry.getShape("api_perm", "pv1")).toEqual([3, 4, 8, 2]);
    expect(registry.getShape("api_perm", "pv2")).toEqual([4, 4, 8, 2]); // role v2 → 4
    expect(registry.getShape("api_perm", "pv3")).toEqual([4, 4, 12, 2]); // api v2 → 12
  });

  it("version 생략 시 currentVersion의 shape 반환", () => {
    expect(registry.getShape("api_perm")).toEqual(registry.getShape("api_perm", "pv3"));
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// [단위] 인코딩/디코딩 변형
// ─────────────────────────────────────────────────────────────────────────────
describe("[단위] 인코딩/디코딩 변형", () => {
  it("encodeFromIds → decodeToIds 완전 왕복", () => {
    const original = { role: 2, action: "write", api: "/posts", tenant: 100 };
    const vi = registry.encodeFromIds("api_perm", original, "pv2");
    expect(registry.decodeToIds(vi)).toEqual(original);
  });

  it("다양한 조합 왕복 검증", () => {
    const cases = [
      { role: 1, action: "read",   api: "/users",  tenant: 100 },
      { role: 3, action: "delete", api: "/auth",   tenant: 200 },
      { role: 4, action: "admin",  api: "/search", tenant: 100 },
    ];
    for (const original of cases) {
      const vi = registry.encodeFromIds("api_perm", original, "pv2");
      expect(registry.decodeToIds(vi)).toEqual(original);
    }
  });

  it("동일 entity IDs 라도 버전이 다르면 id 값이 달라짐 (shape가 달라 가중치 변화)", () => {
    const ids = { role: 2, action: "read", api: "/users", tenant: 100 };
    const pv1 = registry.encodeFromIds("api_perm", ids, "pv1");
    const pv3 = registry.encodeFromIds("api_perm", ids, "pv3");
    expect(pv1.id).not.toBe(pv3.id);
  });

  it("encode (raw index 배열) 와 encodeFromIds 의 id 일치", () => {
    // role=2(idx2), action="write"(idx2), api="/posts"(idx2), tenant=100(idx1)
    const byId = registry.encodeFromIds("api_perm", { role: 2, action: "write", api: "/posts", tenant: 100 }, "pv2");
    const byRaw = registry.encode("api_perm", [2, 2, 2, 1], "pv2");
    expect(byRaw.id).toBe(byId.id);
  });

  it("encodeFromRecord (raw index 레코드) 와 encodeFromIds 의 id 일치", () => {
    const byId = registry.encodeFromIds("api_perm", { role: 1, action: "read", api: "/users", tenant: 100 }, "pv1");
    const byRec = registry.encodeFromRecord("api_perm", { role: 1, action: 1, api: 1, tenant: 1 }, "pv1");
    expect(byRec.id).toBe(byId.id);
    expect(byRec.id).toBe(0); // 모두 최솟값 → index 0
  });

  it("pv1로 저장된 id는 pv1으로만 정확히 복원 (version = decode 메타데이터)", () => {
    const ids = { role: 2, action: "write", api: "/posts", tenant: 200 };
    const vi = registry.encodeFromIds("api_perm", ids, "pv1");
    expect(registry.decodeToIds({ ...vi, v: "pv1" })).toEqual(ids);
    // 다른 버전으로 읽으면 shape 달라져 엉뚱한 좌표 → 버전 저장 필요성 증명
    const wrongRecord = registry.decodeToRecord({ ...vi, v: "pv3" });
    const correctRecord = registry.decodeToRecord({ ...vi, v: "pv1" });
    expect(wrongRecord).not.toEqual(correctRecord);
  });

  it("version 생략 시 currentVersion 자동 선택", () => {
    const vi = registry.encodeFromIds("api_perm", {
      role: 2, action: "write", api: "/posts", tenant: 100,
    });
    expect(vi.v).toBe("pv3");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// [단위] 직렬화 (serialize / parse)
// ─────────────────────────────────────────────────────────────────────────────
describe("[단위] 직렬화 (serialize / parse)", () => {
  it("serialize: { prefix, v, id } → '{prefix}:{v}:{id}' 형식", () => {
    const vi = registry.encodeFromIds("api_perm", { role: 1, action: "read", api: "/users", tenant: 100 }, "pv1");
    expect(registry.serialize(vi)).toBe(`api_perm:pv1:${vi.id}`);
  });

  it("serialize ∘ parse = identity", () => {
    const vi = registry.encodeFromIds("api_perm", { role: 3, action: "admin", api: "/files", tenant: 200 });
    expect(registry.parse(registry.serialize(vi))).toEqual(vi);
  });

  it("DB 전체 시나리오: encode → serialize(저장) → parse(조회) → decodeToIds", () => {
    const original = { role: 2, action: "write", api: "/posts", tenant: 100 };
    const dbValue = registry.serialize(registry.encodeFromIds("api_perm", original, "pv2"));
    expect(registry.decodeToIds(registry.parse(dbValue))).toEqual(original);
  });

  it("id=0 파싱 정상 처리 (최솟값 경계)", () => {
    expect(registry.parse("api_perm:pv1:0")).toEqual({ prefix: "api_perm", v: "pv1", id: 0 });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// [단위] parse 입력 유효성
// ─────────────────────────────────────────────────────────────────────────────
describe("[단위] parse 입력 유효성", () => {
  it.each([
    ["빈 문자열",                    "",                "Expected"],
    ["구분자 없음 (단일 세그먼트)",  "api_perm",        "Expected"],
    ["구분자 1개 (세그먼트 2개)",    "api_perm:pv1",    "Expected"],
    ["빈 prefix",                   ":pv1:0",          "Expected"],
    ["빈 version",                  "api_perm::0",     "Expected"],
    ["빈 id",                       "api_perm:pv1:",   "Expected"],
    ["id가 숫자 아님",               "api_perm:pv1:abc","Invalid id"],
    ["id가 음수",                    "api_perm:pv1:-1", "Invalid id"],
    ["알 수 없는 prefix",           "unknown:pv1:0",   "Unknown prefix"],
    ["알 수 없는 버전",              "api_perm:pv99:0", "Unknown version"],
  ])("%s 거부", (_label, input, expectedMsg) => {
    expect(() => registry.parse(input)).toThrow(expectedMsg);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// [단위] 마이그레이션
// ─────────────────────────────────────────────────────────────────────────────
describe("[단위] 마이그레이션", () => {
  it("pv1 → pv2: 좌표 그대로 통과 (role 1~3 의미 유지)", () => {
    const pv1Vi = registry.encodeFromIds("api_perm", { role: 2, action: "write", api: "/posts", tenant: 100 }, "pv1");
    const pv2Vi = registry.migrate(pv1Vi, "pv2", (coords) => coords);
    expect(registry.decodeToIds(pv2Vi)).toEqual({ role: 2, action: "write", api: "/posts", tenant: 100 });
  });

  it("동일 버전으로 migrate → id 불변 (idempotent)", () => {
    const vi = registry.encodeFromIds("api_perm", { role: 2, action: "write", api: "/posts", tenant: 100 }, "pv2");
    expect(registry.migrate(vi, "pv2", (c) => c)).toEqual(vi);
  });

  it("잘못된 길이 배열 반환 → MigrateError", () => {
    const vi = registry.encodeFromIds("api_perm", { role: 1, action: "read", api: "/users", tenant: 100 }, "pv1");
    expect(() => registry.migrate(vi, "pv2", () => [1, 1, 1])).toThrow("migrator returned 3");
  });

  it("범위 초과 좌표 반환 → MigrateError (index + label 명시)", () => {
    const vi = registry.encodeFromIds("api_perm", { role: 1, action: "read", api: "/users", tenant: 100 }, "pv1");
    expect(() => registry.migrate(vi, "pv2", () => [5, 1, 1, 1])).toThrow(
      "migrator returned invalid coordinate at index 0"
    );
  });

  it("0 (1-based 최솟값 미만) 좌표 반환 → MigrateError", () => {
    const vi = registry.encodeFromIds("api_perm", { role: 1, action: "read", api: "/users", tenant: 100 }, "pv1");
    expect(() => registry.migrate(vi, "pv2", () => [0, 1, 1, 1])).toThrow(
      "migrator returned invalid coordinate at index 0"
    );
  });

  it("소수 좌표 반환 → MigrateError", () => {
    const vi = registry.encodeFromIds("api_perm", { role: 1, action: "read", api: "/users", tenant: 100 }, "pv1");
    expect(() => registry.migrate(vi, "pv2", () => [1.5, 1, 1, 1])).toThrow(
      "migrator returned invalid coordinate at index 0"
    );
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// [단위] diff (label version 변경 추적)
// ─────────────────────────────────────────────────────────────────────────────
describe("[단위] diff", () => {
  it("pv1→pv2: role만 v1→v2 (max 3→4)", () => {
    const d = registry.diff("api_perm", "pv1", "pv2");
    expect(d.changedLabels).toHaveLength(1);
    expect(d.changedLabels[0]).toMatchObject({
      label: "role", fromLabelVersion: "v1", fromMax: 3, toLabelVersion: "v2", toMax: 4,
    });
  });

  it("pv2→pv3: api만 v1→v2 (max 8→12)", () => {
    const d = registry.diff("api_perm", "pv2", "pv3");
    expect(d.changedLabels).toHaveLength(1);
    expect(d.changedLabels[0]).toMatchObject({
      label: "api", fromLabelVersion: "v1", fromMax: 8, toLabelVersion: "v2", toMax: 12,
    });
  });

  it("pv1→pv3: role + api 두 label 변경", () => {
    const d = registry.diff("api_perm", "pv1", "pv3");
    expect(d.changedLabels.map((c) => c.label).sort()).toEqual(["api", "role"]);
  });

  it("동일 버전 diff → changedLabels 없음", () => {
    const d = registry.diff("api_perm", "pv2", "pv2");
    expect(d.changedLabels).toHaveLength(0);
    expect(d.from).toBe("pv2");
    expect(d.to).toBe("pv2");
  });

  it("역방향 diff (신→구) 도 정상 동작", () => {
    const d = registry.diff("api_perm", "pv3", "pv2");
    expect(d.changedLabels[0]).toMatchObject({
      label: "api", fromLabelVersion: "v2", fromMax: 12, toLabelVersion: "v1", toMax: 8,
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// [계약] API 완전성
// ─────────────────────────────────────────────────────────────────────────────
describe("[계약] API 완전성", () => {
  it("prefixNames: 등록된 모든 prefix 이름 반환", () => {
    expect(registry.prefixNames).toEqual(["api_perm", "page_perm"]);
  });

  it("getLabels: prefix의 레이블 순서 반환", () => {
    expect(registry.getLabels("api_perm")).toEqual(["role", "action", "api", "tenant"]);
    expect(registry.getLabels("page_perm")).toEqual(["role", "page", "tenant"]);
  });

  it("getCurrentVersion: 마지막으로 등록된 버전 반환", () => {
    expect(registry.getCurrentVersion("api_perm")).toBe("pv3");
    expect(registry.getCurrentVersion("page_perm")).toBe("pv2");
  });

  it("getPrefixVersions: 버전 히스토리 순서대로 반환", () => {
    const versions = registry.getPrefixVersions("api_perm");
    expect(versions.map((v) => v.version)).toEqual(["pv1", "pv2", "pv3"]);
  });

  it("isCurrent: currentVersion 여부 확인", () => {
    const current = registry.encodeFromIds("api_perm", { role: 1, action: "read", api: "/users", tenant: 100 });
    expect(registry.isCurrent(current)).toBe(true);

    const old = registry.encodeFromIds("api_perm", { role: 1, action: "read", api: "/users", tenant: 100 }, "pv1");
    expect(registry.isCurrent(old)).toBe(false);
  });

  it("getIndex: 캐시된 WeightedIndex 인스턴스 반환", () => {
    const wi1 = registry.getIndex("api_perm", "pv2");
    const wi2 = registry.getIndex("api_perm", "pv2");
    expect(wi1).toBe(wi2); // 동일 참조 (캐시 히트)
    expect(registry.getIndex("api_perm", "pv1")).not.toBe(wi1);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// [통합] 레이블 변경 = 조회 대상 변경 시나리오
// ─────────────────────────────────────────────────────────────────────────────
describe("[통합] 레이블 변경 → 조회 대상 변경", () => {
  it("superadmin(role id=4)은 role@v2 적용된 pv2 이상에서만 encode 가능", () => {
    const ids = { role: 4, action: "read", api: "/users", tenant: 100 };
    expect(() => registry.encodeFromIds("api_perm", ids, "pv1")).toThrow("not found");
    expect(() => registry.encodeFromIds("api_perm", ids, "pv2")).not.toThrow();
  });

  it("새 api 엔드포인트는 api@v2 적용된 pv3 이상에서만 encode 가능", () => {
    const ids = { role: 1, action: "read", api: "/upload", tenant: 100 };
    expect(() => registry.encodeFromIds("api_perm", ids, "pv2")).toThrow("not found");
    expect(() => registry.encodeFromIds("api_perm", ids, "pv3")).not.toThrow();
  });

  it("role label이 api_perm / page_perm 에 공유됨", () => {
    // role@v2 적용 후 두 prefix 모두에서 superadmin 사용 가능
    expect(() =>
      registry.encodeFromIds("api_perm", { role: 4, action: "read", api: "/users", tenant: 100 }, "pv2")
    ).not.toThrow();
    expect(() =>
      registry.encodeFromIds("page_perm", { role: 4, page: "page-001", tenant: 100 }, "pv2")
    ).not.toThrow();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// [동치 분할] 생성자 / 메서드 입력 유효성
// ─────────────────────────────────────────────────────────────────────────────
describe("[동치 분할] 입력 유효성", () => {
  it("encodeFromIds: label 누락 거부", () => {
    expect(() =>
      registry.encodeFromIds("api_perm", { role: 1, action: "read" })
    ).toThrow('Missing entity id for label "api"');
  });

  it("encodeFromIds: 등록되지 않은 entity ID 거부", () => {
    expect(() =>
      registry.encodeFromIds("api_perm", { role: 999, action: "read", api: "/users", tenant: 100 })
    ).toThrow("not found");
  });

  it("알 수 없는 prefix 거부", () => {
    expect(() => registry.encode("no_such_prefix", [1])).toThrow("Unknown prefix");
  });

  it("알 수 없는 버전 거부", () => {
    expect(() => registry.encode("api_perm", [1, 1, 1, 1], "pv99")).toThrow("Unknown version");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// [에러 계층] instanceof 타입 검증
// ─────────────────────────────────────────────────────────────────────────────
describe("[에러 계층] instanceof 타입 검증", () => {
  it("알 수 없는 prefix → PrefixNotFoundError extends WeightedIndexError", () => {
    try {
      registry.encode("no_prefix", [1]);
    } catch (e) {
      expect(e).toBeInstanceOf(PrefixNotFoundError);
      expect(e).toBeInstanceOf(WeightedIndexError);
      expect((e as Error).name).toBe("PrefixNotFoundError");
    }
  });

  it("알 수 없는 버전 → VersionNotFoundError extends WeightedIndexError", () => {
    try {
      registry.encode("api_perm", [1, 1, 1, 1], "pv99");
    } catch (e) {
      expect(e).toBeInstanceOf(VersionNotFoundError);
      expect(e).toBeInstanceOf(WeightedIndexError);
      expect((e as Error).name).toBe("VersionNotFoundError");
    }
  });

  it("등록되지 않은 entity ID → EntityNotFoundError extends WeightedIndexError", () => {
    try {
      registry.encodeFromIds("api_perm", { role: 9999, action: "read", api: "/users", tenant: 100 });
    } catch (e) {
      expect(e).toBeInstanceOf(EntityNotFoundError);
      expect(e).toBeInstanceOf(WeightedIndexError);
      expect((e as Error).name).toBe("EntityNotFoundError");
    }
  });

  it("잘못된 직렬화 형식 → SerializeError extends WeightedIndexError", () => {
    try {
      registry.parse("bad_format");
    } catch (e) {
      expect(e).toBeInstanceOf(SerializeError);
      expect(e).toBeInstanceOf(WeightedIndexError);
      expect((e as Error).name).toBe("SerializeError");
    }
  });

  it("잘못된 migrate 반환값 → MigrateError extends WeightedIndexError", () => {
    const vi = registry.encodeFromIds("api_perm", { role: 1, action: "read", api: "/users", tenant: 100 }, "pv1");
    try {
      registry.migrate(vi, "pv2", () => [1, 1, 1]); // 길이 불일치
    } catch (e) {
      expect(e).toBeInstanceOf(MigrateError);
      expect(e).toBeInstanceOf(WeightedIndexError);
      expect((e as Error).name).toBe("MigrateError");
    }
  });

  it("범위 초과 raw coords → CoordError extends WeightedIndexError", () => {
    try {
      registry.encode("api_perm", [99, 1, 1, 1], "pv1"); // role max=3
    } catch (e) {
      expect(e).toBeInstanceOf(CoordError);
      expect(e).toBeInstanceOf(WeightedIndexError);
      expect((e as Error).name).toBe("CoordError");
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// [속성 기반] 랜덤 왕복 (fast-check)
// ─────────────────────────────────────────────────────────────────────────────
describe("[속성 기반] 랜덤 왕복", () => {
  it("serialize ∘ parse = identity — 모든 등록된 prefix/version/id 조합", () => {
    // api_perm 의 각 버전에서 임의 id 생성 후 serialize→parse 왕복
    const prefixVersions = [
      ["api_perm",  "pv1", 3 * 4 * 8 * 2],
      ["api_perm",  "pv2", 4 * 4 * 8 * 2],
      ["api_perm",  "pv3", 4 * 4 * 12 * 2],
      ["page_perm", "pv1", 3 * 12 * 2],
    ] as const;

    fc.assert(
      fc.property(
        fc.constantFrom(...prefixVersions),
        fc.nat(),
        ([prefix, v, size], seed) => {
          const id = seed % size;
          const vi = { prefix, v, id };
          expect(registry.parse(registry.serialize(vi))).toEqual(vi);
        }
      ),
      { numRuns: 200 }
    );
  });

  it("encodeFromIds ∘ decodeToIds = identity — api_perm pv2 임의 조합", () => {
    const roles = [1, 2, 3, 4] as const;
    const actions = ["read", "write", "delete", "admin"] as const;
    const apis = ["/users", "/posts", "/comments", "/files", "/tags", "/likes", "/auth", "/search"] as const;
    const tenants = [100, 200] as const;

    fc.assert(
      fc.property(
        fc.constantFrom(...roles),
        fc.constantFrom(...actions),
        fc.constantFrom(...apis),
        fc.constantFrom(...tenants),
        (role, action, api, tenant) => {
          const ids = { role, action, api, tenant };
          const vi = registry.encodeFromIds("api_perm", ids, "pv2");
          expect(registry.decodeToIds(vi)).toEqual(ids);
        }
      ),
      { numRuns: 200 }
    );
  });

  it("migrate idempotent — 동일 버전으로 반복 migrate 시 id 불변", () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...[1, 2, 3] as const),
        fc.constantFrom(...["read", "write", "delete", "admin"] as const),
        fc.constantFrom(...["/users", "/posts", "/auth"] as const),
        fc.constantFrom(...[100, 200] as const),
        (role, action, api, tenant) => {
          const vi = registry.encodeFromIds("api_perm", { role, action, api, tenant }, "pv1");
          const migrated = registry.migrate(vi, "pv1", (c) => c);
          expect(migrated).toEqual(vi);
        }
      ),
      { numRuns: 100 }
    );
  });
});
