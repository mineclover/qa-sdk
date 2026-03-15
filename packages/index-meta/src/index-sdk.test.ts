import { describe, it, expect } from "vitest";
import { createIndexSDK } from "./index-sdk.js";
import { MetaCodec } from "./meta-codec.js";
import { DimNotFoundError, EntryNotFoundError, ValidationError } from "./errors.js";

// ── 픽스처 ──────────────────────────────────────────────────────────────────

const trackingSchema = () => createIndexSDK({
  dims: {
    action: {
      kind: { type: "string_enum" as const },
      snapshots: {
        v1: { entries: ["click", "view", "scroll", "submit"] },
      },
    },
    page: {
      kind: { type: "string_enum" as const },
      snapshots: {
        v1: { entries: ["home", "product", "cart", "checkout"] },
      },
    },
    userType: {
      kind: { type: "string_enum" as const },
      snapshots: {
        v1: { entries: ["guest", "member", "premium"] },
      },
    },
  },
  indices: {
    tracking: {
      dims: ["action", "page", "userType"],
      versions: {
        v1: { snapshots: { action: "v1", page: "v1", userType: "v1" } },
      },
    },
  },
});

// ── SDK 생성 ─────────────────────────────────────────────────────────────────

describe("createIndexSDK", () => {
  it("SDK 인스턴스를 생성한다", () => {
    const sdk = trackingSchema();
    expect(sdk.registry).toBeDefined();
  });

  it("잘못된 스키마는 에러를 던진다", () => {
    expect(() => createIndexSDK({
      dims: {},
      indices: {
        broken: { dims: ["missing"], versions: { v1: { snapshots: { missing: "v1" } } } },
      },
    })).toThrow();
  });
});

// ── client ────────────────────────────────────────────────────────────────────

describe("client", () => {
  it("encode → decode round-trip", () => {
    const sdk = trackingSchema();
    const tracking = sdk.client("tracking", "v1");
    const input = { action: "click", page: "home", userType: "member" };

    const vv = tracking.encode(input);

    expect(vv.indexId).toBe("tracking");
    expect(vv.versionId).toBe("v1");
    expect(typeof vv.value).toBe("number");
    expect(tracking.decode(vv)).toEqual(input);
  });

  it("decodeValue로 indexId/versionId 없이 decode", () => {
    const sdk = trackingSchema();
    const tracking = sdk.client("tracking", "v1");
    const vv = tracking.encode({ action: "scroll", page: "cart", userType: "premium" });

    expect(tracking.decodeValue(vv.value)).toEqual({
      action: "scroll",
      page: "cart",
      userType: "premium",
    });
  });

  it("shape과 size가 정확하다", () => {
    const sdk = trackingSchema();
    const tracking = sdk.client("tracking", "v1");

    expect(tracking.shape).toEqual([4, 4, 3]);
    expect(tracking.size).toBe(48); // 4 × 4 × 3
  });

  it("동일 client는 캐싱된다", () => {
    const sdk = trackingSchema();
    expect(sdk.client("tracking", "v1")).toBe(sdk.client("tracking", "v1"));
  });

  it("전체 value 범위가 bijection이다", () => {
    const sdk = trackingSchema();
    const tracking = sdk.client("tracking", "v1");
    const seen = new Set<number>();

    for (let v = 0; v < tracking.size; v++) {
      const ids = tracking.decodeValue(v);
      const re = tracking.encode(ids);
      expect(re.value).toBe(v);
      seen.add(v);
    }
    expect(seen.size).toBe(tracking.size);
  });
});

// ── entries / constants ──────────────────────────────────────────────────────

describe("entries / constants", () => {
  it("client.entries()는 바인딩된 version의 dim entries를 반환한다", () => {
    const sdk = trackingSchema();
    const tracking = sdk.client("tracking", "v1");

    expect(tracking.entries("action")).toEqual(["click", "view", "scroll", "submit"]);
    expect(tracking.entries("page")).toEqual(["home", "product", "cart", "checkout"]);
    expect(tracking.entries("userType")).toEqual(["guest", "member", "premium"]);
  });

  it("client.entries()는 frozen 배열을 반환한다", () => {
    const sdk = trackingSchema();
    const tracking = sdk.client("tracking", "v1");
    expect(Object.isFrozen(tracking.entries("action"))).toBe(true);
  });

  it("client.entries()에 없는 dimId는 DimNotFoundError", () => {
    const sdk = trackingSchema();
    const tracking = sdk.client("tracking", "v1");
    expect(() => tracking.entries("unknown")).toThrow(DimNotFoundError);
  });

  it("client.constants()는 enum-like 객체를 반환한다", () => {
    const sdk = trackingSchema();
    const tracking = sdk.client("tracking", "v1");
    const ACTION = tracking.constants("action");

    expect(ACTION).toEqual({
      click: "click",
      view: "view",
      scroll: "scroll",
      submit: "submit",
    });
    expect(Object.isFrozen(ACTION)).toBe(true);
  });

  it("constants()를 encode에 사용할 수 있다", () => {
    const sdk = trackingSchema();
    const tracking = sdk.client("tracking", "v1");
    const ACTION = tracking.constants("action");
    const PAGE = tracking.constants("page");

    const vv = tracking.encode({ action: ACTION.click, page: PAGE.home, userType: "guest" });
    expect(tracking.decode(vv)).toEqual({ action: "click", page: "home", userType: "guest" });
  });

  it("sdk.constants()는 dimId + snapshotId로 직접 접근한다", () => {
    const sdk = trackingSchema();
    const ACTION = sdk.constants("action", "v1");

    expect(ACTION.click).toBe("click");
    expect(ACTION.submit).toBe("submit");
  });

  it("number_enum의 constants는 string key → number value", () => {
    const sdk = createIndexSDK({
      dims: {
        level: {
          kind: { type: "number_enum" as const },
          snapshots: { v1: { entries: [0, 10, 20, 30] } },
        },
      },
      indices: {
        tier: { dims: ["level"], versions: { v1: { snapshots: { level: "v1" } } } },
      },
    });
    const LEVEL = sdk.client("tier", "v1").constants("level");

    expect(LEVEL["0"]).toBe(0);
    expect(LEVEL["10"]).toBe(10);
    expect(LEVEL["30"]).toBe(30);
  });
});

// ── matchRanges ──────────────────────────────────────────────────────────────

describe("matchRanges", () => {
  it("첫 번째 dim 고정 → 연속 범위", () => {
    const sdk = trackingSchema();
    const tracking = sdk.client("tracking", "v1");

    // action=click(pos1): (1-1)*12 = 0 → [0, 11]
    // shape [4, 4, 3], weights [12, 3, 1]
    expect(tracking.matchRanges({ action: "click" })).toEqual([[0, 11]]);
  });

  it("전체 와일드카드 → [[0, size-1]]", () => {
    const sdk = trackingSchema();
    const tracking = sdk.client("tracking", "v1");
    expect(tracking.matchRanges({})).toEqual([[0, 47]]);
  });

  it("모든 dim 고정 → 단일 값 (encode와 일치)", () => {
    const sdk = trackingSchema();
    const tracking = sdk.client("tracking", "v1");
    const input = { action: "submit", page: "checkout", userType: "premium" };

    const ranges = tracking.matchRanges(input);
    const encoded = tracking.encode(input);

    expect(ranges).toEqual([[encoded.value, encoded.value]]);
  });
});

// ── toDecodeMap ──────────────────────────────────────────────────────────────

describe("toDecodeMap", () => {
  it("DecodeMap으로 독립 MetaCodec을 생성해 동일하게 동작한다", () => {
    const sdk = trackingSchema();
    const tracking = sdk.client("tracking", "v1");

    const map = tracking.toDecodeMap();
    const codec = new MetaCodec(map);

    const input = { action: "view", page: "product", userType: "guest" };
    expect(codec.encode(input)).toEqual(tracking.encode(input));
  });

  it("JSON 직렬화 후에도 동작한다 (네트워크 전송 시나리오)", () => {
    const sdk = trackingSchema();
    const tracking = sdk.client("tracking", "v1");
    const vv = tracking.encode({ action: "click", page: "home", userType: "member" });

    // 서버 → 클라이언트 전송 시뮬레이션
    const json = JSON.stringify(tracking.toDecodeMap());
    const received = JSON.parse(json);

    const remoteCodec = new MetaCodec(received);
    expect(remoteCodec.decode(vv)).toEqual({ action: "click", page: "home", userType: "member" });
  });
});

// ── 멀티 인덱스 ──────────────────────────────────────────────────────────────

describe("멀티 인덱스 SDK", () => {
  it("하나의 SDK에서 여러 index client를 생성할 수 있다", () => {
    const sdk = createIndexSDK({
      dims: {
        action: {
          kind: { type: "string_enum" as const },
          snapshots: { v1: { entries: ["click", "view"] } },
        },
        role: {
          kind: { type: "string_enum" as const },
          snapshots: { v1: { entries: ["admin", "editor", "viewer"] } },
        },
        resource: {
          kind: { type: "string_enum" as const },
          snapshots: { v1: { entries: ["post", "comment"] } },
        },
      },
      indices: {
        tracking: {
          dims: ["action"],
          versions: { v1: { snapshots: { action: "v1" } } },
        },
        permission: {
          dims: ["role", "resource"],
          versions: { v1: { snapshots: { role: "v1", resource: "v1" } } },
        },
      },
    });

    const tracking = sdk.client("tracking", "v1");
    const permission = sdk.client("permission", "v1");

    expect(tracking.size).toBe(2);
    expect(permission.size).toBe(6); // 3 × 2

    const tvv = tracking.encode({ action: "click" });
    expect(tracking.decode(tvv)).toEqual({ action: "click" });

    const pvv = permission.encode({ role: "editor", resource: "post" });
    expect(permission.decode(pvv)).toEqual({ role: "editor", resource: "post" });
  });
});

// ── 에러 처리 ────────────────────────────────────────────────────────────────

describe("에러 처리", () => {
  it("존재하지 않는 entity → EntryNotFoundError", () => {
    const sdk = trackingSchema();
    const tracking = sdk.client("tracking", "v1");

    expect(() => tracking.encode({ action: "hover", page: "home", userType: "guest" }))
      .toThrow(EntryNotFoundError);
  });

  it("dim 누락 → ValidationError", () => {
    const sdk = trackingSchema();
    const tracking = sdk.client("tracking", "v1");

    expect(() => tracking.encode({ action: "click" }))
      .toThrow(ValidationError);
  });

  it("다른 index의 VersionedValue decode → ValidationError", () => {
    const sdk = createIndexSDK({
      dims: {
        a: { kind: { type: "string_enum" as const }, snapshots: { v1: { entries: ["x"] } } },
      },
      indices: {
        idx1: { dims: ["a"], versions: { v1: { snapshots: { a: "v1" } } } },
        idx2: { dims: ["a"], versions: { v1: { snapshots: { a: "v1" } } } },
      },
    });

    const c1 = sdk.client("idx1", "v1");
    const c2 = sdk.client("idx2", "v1");

    const vv = c1.encode({ a: "x" });
    expect(() => c2.decode(vv)).toThrow(ValidationError);
  });
});

// ── End-to-end: 백엔드/프론트엔드 공유 시나리오 ─────────────────────────────

describe("공유 SDK 시나리오", () => {
  it("동일 SDK 정의로 encode한 값을 다른 위치에서 decode할 수 있다", () => {
    // 공유 SDK 정의 (패키지로 배포되는 것을 시뮬레이션)
    const schema = {
      dims: {
        action: {
          kind: { type: "string_enum" as const },
          snapshots: { v1: { entries: ["click", "view", "scroll"] } },
        },
        page: {
          kind: { type: "string_enum" as const },
          snapshots: { v1: { entries: ["home", "product"] } },
        },
      },
      indices: {
        tracking: {
          dims: ["action", "page"],
          versions: { v1: { snapshots: { action: "v1", page: "v1" } } },
        },
      },
    };

    // 프론트엔드에서 encode
    const frontendSDK = createIndexSDK(schema);
    const frontendClient = frontendSDK.client("tracking", "v1");
    const vv = frontendClient.encode({ action: "click", page: "product" });

    // 백엔드에서 동일 스키마로 decode
    const backendSDK = createIndexSDK(schema);
    const backendClient = backendSDK.client("tracking", "v1");
    expect(backendClient.decode(vv)).toEqual({ action: "click", page: "product" });

    // VersionedValue만 전송하면 양쪽에서 일관된 해석 가능
    expect(vv.indexId).toBe("tracking");
    expect(vv.versionId).toBe("v1");
  });
});
