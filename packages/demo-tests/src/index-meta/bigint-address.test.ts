/**
 * B-1: SemanticAddressBig 프로토콜 테스트
 *
 * createLayoutProtocolBig의 serialize/parse 왕복 검증.
 * index > 2^53인 hex 직렬화가 정밀도 손실 없이 동작하는지 확인.
 */
import { describe, it, expect } from "vitest";
import {
  createLayoutProtocolBig,
  createLayoutProtocol,
  PACK_FORMATS,
  type SemanticAddressBig,
  type LayoutProtocolOptions,
} from "weighted-index";

// ── 공통 옵션 ───────────────────────────────────────────────────────────────

const uuidOpts: LayoutProtocolOptions = {
  format: PACK_FORMATS.uuid,
  schemaChars: 4,
  versionChars: 4,
  schemas: { perm: 1, doc: 2 },
  versions: { v1: 1, v2: 2 },
};

const int64Opts: LayoutProtocolOptions = {
  format: PACK_FORMATS.int64,
  schemaChars: 2,
  versionChars: 2,
  schemas: { perm: 1 },
  versions: { v1: 1 },
};

// ── 테스트 ─────────────────────────────────────────────────────────────────

describe("B-1: SemanticAddressBig 프로토콜", () => {
  describe("UUID 포맷 (24 hex chars for index → 2^96 공간)", () => {
    const proto = createLayoutProtocolBig(uuidOpts);

    it("소형 index 왕복 (Number 범위 내)", () => {
      const addr: SemanticAddressBig = {
        schema: "perm",
        version: "v1",
        index: 42n,
      };
      const serialized = proto.serialize(addr);
      const parsed = proto.parse(serialized);

      expect(parsed.schema).toBe("perm");
      expect(parsed.version).toBe("v1");
      expect(parsed.index).toBe(42n);
    });

    it("2^53 경계값 왕복", () => {
      const boundary = BigInt(Number.MAX_SAFE_INTEGER); // 2^53 - 1
      const addr: SemanticAddressBig = {
        schema: "perm",
        version: "v1",
        index: boundary,
      };
      const serialized = proto.serialize(addr);
      const parsed = proto.parse(serialized);

      expect(parsed.index).toBe(boundary);
    });

    it("2^53 초과 왕복 (Number로 불가능한 영역)", () => {
      const beyond = BigInt(Number.MAX_SAFE_INTEGER) + 1n; // 2^53
      const addr: SemanticAddressBig = {
        schema: "doc",
        version: "v2",
        index: beyond,
      };
      const serialized = proto.serialize(addr);
      const parsed = proto.parse(serialized);

      expect(parsed.schema).toBe("doc");
      expect(parsed.version).toBe("v2");
      expect(parsed.index).toBe(beyond);
    });

    it("매우 큰 index 왕복 (2^80)", () => {
      const huge = 1n << 80n;
      const addr: SemanticAddressBig = {
        schema: "perm",
        version: "v1",
        index: huge,
      };
      const serialized = proto.serialize(addr);
      const parsed = proto.parse(serialized);

      expect(parsed.index).toBe(huge);
    });

    it("index=0 왕복", () => {
      const addr: SemanticAddressBig = {
        schema: "perm",
        version: "v1",
        index: 0n,
      };
      const serialized = proto.serialize(addr);
      const parsed = proto.parse(serialized);

      expect(parsed.index).toBe(0n);
    });

    it("UUID 포맷 유효성 (8-4-4-4-12)", () => {
      const addr: SemanticAddressBig = {
        schema: "perm",
        version: "v1",
        index: 999n,
      };
      const serialized = proto.serialize(addr);
      expect(serialized).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
      );
    });

    it("test()는 유효한 직렬화 결과에 true 반환", () => {
      const addr: SemanticAddressBig = {
        schema: "perm",
        version: "v1",
        index: 12345n,
      };
      const serialized = proto.serialize(addr);
      expect(proto.test(serialized)).toBe(true);
    });

    it("다른 schema/version 조합 왕복", () => {
      const cases: SemanticAddressBig[] = [
        { schema: "perm", version: "v1", index: 1n },
        { schema: "perm", version: "v2", index: 100n },
        { schema: "doc", version: "v1", index: (1n << 64n) - 1n },
        { schema: "doc", version: "v2", index: 0n },
      ];

      for (const addr of cases) {
        const parsed = proto.parse(proto.serialize(addr));
        expect(parsed.schema).toBe(addr.schema);
        expect(parsed.version).toBe(addr.version);
        expect(parsed.index).toBe(addr.index);
      }
    });
  });

  describe("int64 포맷 (12 hex chars for index → 2^48 공간)", () => {
    const proto = createLayoutProtocolBig(int64Opts);

    it("소형 index 왕복", () => {
      const addr: SemanticAddressBig = {
        schema: "perm",
        version: "v1",
        index: 7n,
      };
      const serialized = proto.serialize(addr);
      const parsed = proto.parse(serialized);

      expect(parsed.index).toBe(7n);
    });

    it("int64 최대 index 근처 왕복", () => {
      // 12 hex chars → max = 16^12 - 1 = 2^48 - 1
      const maxIndex = (1n << 48n) - 1n;
      const addr: SemanticAddressBig = {
        schema: "perm",
        version: "v1",
        index: maxIndex,
      };
      const serialized = proto.serialize(addr);
      const parsed = proto.parse(serialized);

      expect(parsed.index).toBe(maxIndex);
    });
  });

  describe("Number 프로토콜과 소형 범위 동등성", () => {
    const bigProto = createLayoutProtocolBig(uuidOpts);
    const numProto = createLayoutProtocol(uuidOpts);

    it("소형 index에서 BigInt/Number 프로토콜이 같은 hex 생성", () => {
      const indices = [0n, 1n, 42n, 255n, 65535n, 1000000n];

      for (const idx of indices) {
        const bigSerialized = bigProto.serialize({
          schema: "perm",
          version: "v1",
          index: idx,
        });
        const numSerialized = numProto.serialize({
          schema: "perm",
          version: "v1",
          index: Number(idx),
        });

        expect(bigSerialized).toBe(numSerialized);
      }
    });
  });
});
