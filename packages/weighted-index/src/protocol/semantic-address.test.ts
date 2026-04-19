// @def.boundary weighted-index-system
// @def.doc weighted-index-system

import { describe, it, expect } from "vitest";
import {
  colonProtocol,
  uriProtocol,
  compactProtocol,
  detectProtocol,
  parseAddress,
  serializeAddress,
  convertAddress,
  createLayoutProtocol,
  AddressConverter,
  createAddressConverter,
  fromVersionedIndex,
  toVersionedIndex,
  fromVersionedValue,
  toVersionedValue,
  type SemanticAddress,
} from "./semantic-address.js";
import { PACK_FORMATS, defineFormat } from "./pack-format.js";

const ADDR: SemanticAddress = { schema: "perm", version: "v1", index: 42 };

// ═══════════════════════════════════════════════════════════════════════════
//  colonProtocol
// ═══════════════════════════════════════════════════════════════════════════

describe("colonProtocol", () => {
  it("serialize → colon-separated", () => {
    expect(colonProtocol.serialize(ADDR)).toBe("perm:v1:42");
  });

  it("parse → SemanticAddress", () => {
    expect(colonProtocol.parse("perm:v1:42")).toEqual(ADDR);
  });

  it("round-trip", () => {
    expect(colonProtocol.parse(colonProtocol.serialize(ADDR))).toEqual(ADDR);
  });

  it("test detects colon format", () => {
    expect(colonProtocol.test("perm:v1:42")).toBe(true);
    expect(colonProtocol.test("wi://perm/v1/42")).toBe(false);
    expect(colonProtocol.test("perm-v1-42")).toBe(false);
  });

  it("parse rejects malformed input", () => {
    expect(() => colonProtocol.parse("perm:v1")).toThrow(SyntaxError);
    expect(() => colonProtocol.parse("perm::42")).toThrow(SyntaxError);
    expect(() => colonProtocol.parse(":v1:42")).toThrow(SyntaxError);
    expect(() => colonProtocol.parse("perm:v1:abc")).toThrow(SyntaxError);
  });

  it("handles index=0", () => {
    const addr = { schema: "s", version: "v", index: 0 };
    expect(colonProtocol.parse(colonProtocol.serialize(addr))).toEqual(addr);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
//  uriProtocol
// ═══════════════════════════════════════════════════════════════════════════

describe("uriProtocol", () => {
  it("serialize → wi:// URI", () => {
    expect(uriProtocol.serialize(ADDR)).toBe("wi://perm/v1/42");
  });

  it("parse → SemanticAddress", () => {
    expect(uriProtocol.parse("wi://perm/v1/42")).toEqual(ADDR);
  });

  it("round-trip", () => {
    expect(uriProtocol.parse(uriProtocol.serialize(ADDR))).toEqual(ADDR);
  });

  it("test detects URI format", () => {
    expect(uriProtocol.test("wi://perm/v1/42")).toBe(true);
    expect(uriProtocol.test("perm:v1:42")).toBe(false);
    expect(uriProtocol.test("http://example.com")).toBe(false);
  });

  it("parse rejects wrong scheme", () => {
    expect(() => uriProtocol.parse("http://perm/v1/42")).toThrow(SyntaxError);
  });

  it("parse rejects missing parts", () => {
    expect(() => uriProtocol.parse("wi://perm/v1")).toThrow(SyntaxError);
    expect(() => uriProtocol.parse("wi://perm//42")).toThrow(SyntaxError);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
//  compactProtocol
// ═══════════════════════════════════════════════════════════════════════════

describe("compactProtocol", () => {
  it("serialize → dash-separated", () => {
    expect(compactProtocol.serialize(ADDR)).toBe("perm-v1-42");
  });

  it("parse → SemanticAddress", () => {
    expect(compactProtocol.parse("perm-v1-42")).toEqual(ADDR);
  });

  it("round-trip", () => {
    expect(compactProtocol.parse(compactProtocol.serialize(ADDR))).toEqual(ADDR);
  });

  it("handles schema with embedded dash", () => {
    // "api-perm-v1-42" → schema="api-perm", version="v1", index=42
    const addr = { schema: "api-perm", version: "v1", index: 42 };
    const serialized = compactProtocol.serialize(addr);
    expect(serialized).toBe("api-perm-v1-42");
    expect(compactProtocol.parse(serialized)).toEqual(addr);
  });

  it("test detects compact format", () => {
    expect(compactProtocol.test("perm-v1-42")).toBe(true);
    expect(compactProtocol.test("perm:v1:42")).toBe(false);
    expect(compactProtocol.test("wi://perm/v1/42")).toBe(false);
    expect(compactProtocol.test("no-dashes-here")).toBe(false); // last part not numeric
  });
});

// ═══════════════════════════════════════════════════════════════════════════
//  detectProtocol — format detection
// ═══════════════════════════════════════════════════════════════════════════

describe("detectProtocol", () => {
  it("colon 감지", () => {
    expect(detectProtocol("perm:v1:42")).toBe("colon");
  });

  it("URI 감지", () => {
    expect(detectProtocol("wi://perm/v1/42")).toBe("uri");
  });

  it("compact 감지", () => {
    expect(detectProtocol("perm-v1-42")).toBe("compact");
  });

  it("매칭 없으면 null", () => {
    expect(detectProtocol("???")).toBeNull();
  });

  it("URI가 colon보다 우선", () => {
    // wi:// 가 포함되면 URI로 감지
    expect(detectProtocol("wi://perm/v1/42")).toBe("uri");
  });

  it("커스텀 프로토콜 목록으로 감지", () => {
    expect(detectProtocol("perm:v1:42", [uriProtocol])).toBeNull();
    expect(detectProtocol("perm:v1:42", [colonProtocol])).toBe("colon");
  });
});

// ═══════════════════════════════════════════════════════════════════════════
//  parseAddress — auto-detect
// ═══════════════════════════════════════════════════════════════════════════

describe("parseAddress", () => {
  it("detects colon protocol", () => {
    expect(parseAddress("perm:v1:42")).toEqual(ADDR);
  });

  it("detects URI protocol", () => {
    expect(parseAddress("wi://perm/v1/42")).toEqual(ADDR);
  });

  it("detects compact protocol", () => {
    expect(parseAddress("perm-v1-42")).toEqual(ADDR);
  });

  it("URI takes priority over colon", () => {
    // wi://a:b/v1/42 contains ":" but should detect as URI
    const addr = parseAddress("wi://perm/v1/42");
    expect(addr.schema).toBe("perm");
  });

  it("throws for unrecognized format", () => {
    expect(() => parseAddress("???")).toThrow(SyntaxError);
  });

  it("all three protocols produce the same SemanticAddress", () => {
    const fromColon   = parseAddress("perm:v1:42");
    const fromUri     = parseAddress("wi://perm/v1/42");
    const fromCompact = parseAddress("perm-v1-42");
    expect(fromColon).toEqual(fromUri);
    expect(fromUri).toEqual(fromCompact);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
//  serializeAddress
// ═══════════════════════════════════════════════════════════════════════════

describe("serializeAddress", () => {
  it("accepts protocol name string", () => {
    expect(serializeAddress(ADDR, "colon")).toBe("perm:v1:42");
    expect(serializeAddress(ADDR, "uri")).toBe("wi://perm/v1/42");
    expect(serializeAddress(ADDR, "compact")).toBe("perm-v1-42");
  });

  it("accepts protocol object", () => {
    expect(serializeAddress(ADDR, colonProtocol)).toBe("perm:v1:42");
  });

  it("throws for unknown protocol name", () => {
    expect(() => serializeAddress(ADDR, "nope" as any)).toThrow(RangeError);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
//  convertAddress
// ═══════════════════════════════════════════════════════════════════════════

describe("convertAddress", () => {
  it("colon → uri", () => {
    expect(convertAddress("perm:v1:42", "uri")).toBe("wi://perm/v1/42");
  });

  it("uri → colon", () => {
    expect(convertAddress("wi://perm/v1/42", "colon")).toBe("perm:v1:42");
  });

  it("colon → compact", () => {
    expect(convertAddress("perm:v1:42", "compact")).toBe("perm-v1-42");
  });

  it("compact → uri", () => {
    expect(convertAddress("perm-v1-42", "uri")).toBe("wi://perm/v1/42");
  });

  it("round-trip through all three", () => {
    const colon   = "perm:v1:42";
    const uri     = convertAddress(colon, "uri");
    const compact = convertAddress(uri, "compact");
    const back    = convertAddress(compact, "colon");
    expect(back).toBe(colon);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
//  Compatibility adapters
// ═══════════════════════════════════════════════════════════════════════════

describe("VersionedIndex compatibility", () => {
  const vi = { prefix: "perm", v: "v1", id: 42 };

  it("fromVersionedIndex → SemanticAddress", () => {
    expect(fromVersionedIndex(vi)).toEqual(ADDR);
  });

  it("toVersionedIndex → VersionedIndex", () => {
    expect(toVersionedIndex(ADDR)).toEqual(vi);
  });

  it("round-trip", () => {
    expect(toVersionedIndex(fromVersionedIndex(vi))).toEqual(vi);
  });
});

describe("VersionedValue compatibility", () => {
  const vv = { indexId: "perm", versionId: "v1", value: 42 };

  it("fromVersionedValue → SemanticAddress", () => {
    expect(fromVersionedValue(vv)).toEqual(ADDR);
  });

  it("toVersionedValue → VersionedValue", () => {
    expect(toVersionedValue(ADDR)).toEqual(vv);
  });

  it("round-trip", () => {
    expect(toVersionedValue(fromVersionedValue(vv))).toEqual(vv);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
//  Cross-protocol interop
// ═══════════════════════════════════════════════════════════════════════════

describe("end-to-end: VersionedIndex → URI → colon → SemanticAddress", () => {
  it("full pipeline", () => {
    const vi = { prefix: "api_perm", v: "pv2", id: 100 };
    const addr = fromVersionedIndex(vi);
    const uri  = serializeAddress(addr, "uri");
    expect(uri).toBe("wi://api_perm/pv2/100");

    const colon = convertAddress(uri, "colon");
    expect(colon).toBe("api_perm:pv2:100");

    const back = toVersionedIndex(parseAddress(colon));
    expect(back).toEqual(vi);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
//  createLayoutProtocol — hex container 기반 프로토콜
// ═══════════════════════════════════════════════════════════════════════════

describe("createLayoutProtocol", () => {
  const mappings = {
    schemas:  { perm: 1, doc: 2 },
    versions: { v1: 1, v2: 2 },
  };

  describe("UUID format", () => {
    const proto = createLayoutProtocol({
      format: PACK_FORMATS.uuid,
      schemaChars: 4,
      versionChars: 2,
      ...mappings,
    });

    it("name includes format name", () => {
      expect(proto.name).toBe("layout:uuid");
    });

    it("serialize → UUID with dashes", () => {
      const out = proto.serialize(ADDR);
      expect(out).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
      // schema=1 in 4 chars → "0001", version=1 in 2 chars → "01", index=42 right-aligned
      expect(out.startsWith("000101")).toBe(true);
      expect(out.endsWith("2a")).toBe(true);
    });

    it("round-trip", () => {
      const serialized = proto.serialize(ADDR);
      expect(proto.parse(serialized)).toEqual(ADDR);
    });

    it("test detects UUID format", () => {
      expect(proto.test("00010100-0000-0000-0000-00000000002a")).toBe(true);
      expect(proto.test("perm:v1:42")).toBe(false);
      expect(proto.test("not-a-uuid")).toBe(false);
    });

    it("parse rejects unknown schema number", () => {
      // schema=0x0099 is not in mappings
      expect(() => proto.parse("00990100-0000-0000-0000-00000000002a")).toThrow(SyntaxError);
    });

    it("parse rejects unknown version number", () => {
      expect(() => proto.parse("00010900-0000-0000-0000-00000000002a")).toThrow(SyntaxError);
    });

    it("preserves large index values", () => {
      const addr = { schema: "perm", version: "v1", index: 999999 };
      expect(proto.parse(proto.serialize(addr))).toEqual(addr);
    });
  });

  describe("int64 format", () => {
    const proto = createLayoutProtocol({
      format: PACK_FORMATS.int64,
      schemaChars: 2,
      versionChars: 2,
      ...mappings,
    });

    it("serialize → 16 hex chars without dashes", () => {
      const out = proto.serialize(ADDR);
      expect(out).toHaveLength(16);
      expect(out).toMatch(/^[0-9a-f]{16}$/);
    });

    it("round-trip", () => {
      expect(proto.parse(proto.serialize(ADDR))).toEqual(ADDR);
    });
  });

  describe("custom format with groups", () => {
    const custom = defineFormat({ name: "token", chars: 20, label: "Token", groups: [4, 4, 4, 4, 4] });
    const proto = createLayoutProtocol({
      format: custom,
      schemaChars: 4,
      versionChars: 2,
      ...mappings,
    });

    it("serialize → custom dash pattern", () => {
      const out = proto.serialize(ADDR);
      expect(out).toMatch(/^[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}$/);
    });

    it("round-trip", () => {
      expect(proto.parse(proto.serialize(ADDR))).toEqual(ADDR);
    });
  });

  it("throws when schema+version exceeds capacity", () => {
    expect(() => createLayoutProtocol({
      format: PACK_FORMATS.int64,
      schemaChars: 10,
      versionChars: 10,
      ...mappings,
    })).toThrow(RangeError);
  });

  it("serialize throws for unknown schema", () => {
    const proto = createLayoutProtocol({
      format: PACK_FORMATS.int64,
      schemaChars: 2,
      versionChars: 2,
      ...mappings,
    });
    expect(() => proto.serialize({ schema: "nope", version: "v1", index: 0 })).toThrow(RangeError);
  });

  // ── overflow validation ──────────────────────────────────────────────

  describe("overflow validation", () => {
    it("index exceeding hex char capacity throws RangeError", () => {
      // int64: 16 chars total, schemaChars=2, versionChars=2 → indexChars=12
      // max index = 16^12 - 1
      const proto = createLayoutProtocol({
        format: PACK_FORMATS.int64,
        schemaChars: 2,
        versionChars: 2,
        ...mappings,
      });
      const indexMax = 16 ** 12 - 1;
      expect(() => proto.serialize({ schema: "perm", version: "v1", index: indexMax + 1 })).toThrow(RangeError);
    });

    it("schema value exceeding allocated chars throws RangeError", () => {
      // schemaChars=1 → max schema value = 15
      const proto = createLayoutProtocol({
        format: PACK_FORMATS.int64,
        schemaChars: 1,
        versionChars: 1,
        schemas: { big: 16 },
        versions: { v1: 1 },
      });
      expect(() => proto.serialize({ schema: "big", version: "v1", index: 0 })).toThrow(RangeError);
    });

    it("version value exceeding allocated chars throws RangeError", () => {
      // versionChars=1 → max version value = 15
      const proto = createLayoutProtocol({
        format: PACK_FORMATS.int64,
        schemaChars: 2,
        versionChars: 1,
        schemas: { perm: 1 },
        versions: { bigv: 16 },
      });
      expect(() => proto.serialize({ schema: "perm", version: "bigv", index: 0 })).toThrow(RangeError);
    });

    it("values at boundary (max valid value) succeed", () => {
      // schemaChars=2 → max=255, versionChars=2 → max=255
      // int64: 16 chars, indexChars=12 → max index = 16^12 - 1 = 281474976710655
      // 16^12 - 1 = 2^48 - 1 which is within Number.MAX_SAFE_INTEGER
      const proto = createLayoutProtocol({
        format: PACK_FORMATS.int64,
        schemaChars: 2,
        versionChars: 2,
        schemas: { maxs: 255 },
        versions: { maxv: 255 },
      });
      const indexMax = 16 ** 12 - 1;
      const addr = { schema: "maxs", version: "maxv", index: indexMax };
      // Should not throw
      const serialized = proto.serialize(addr);
      expect(proto.parse(serialized)).toEqual(addr);
    });
  });

  it("works with parseAddress when added to protocols", () => {
    const proto = createLayoutProtocol({
      format: PACK_FORMATS.uuid,
      schemaChars: 4,
      versionChars: 2,
      ...mappings,
    });
    const serialized = proto.serialize(ADDR);
    // parseAddress with custom protocols list
    const result = parseAddress(serialized, [proto, colonProtocol, uriProtocol]);
    expect(result).toEqual(ADDR);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
//  AddressConverter — 통합 양방향 변환
// ═══════════════════════════════════════════════════════════════════════════

describe("AddressConverter", () => {
  const mappings = {
    schemas:  { perm: 1, doc: 2 },
    versions: { v1: 1, v2: 2 },
  };

  function buildConverter() {
    const conv = createAddressConverter(); // colon, uri, compact 포함
    conv.register(createLayoutProtocol({
      format: PACK_FORMATS.uuid,
      schemaChars: 4, versionChars: 2,
      ...mappings,
    }));
    conv.register(createLayoutProtocol({
      format: PACK_FORMATS.int64,
      schemaChars: 2, versionChars: 2,
      ...mappings,
    }));
    return conv;
  }

  describe("basic operations", () => {
    it("createAddressConverter includes 3 text protocols", () => {
      const conv = createAddressConverter();
      expect(conv.protocols()).toEqual(["uri", "colon", "compact"]);
    });

    it("register adds protocols", () => {
      const conv = buildConverter();
      expect(conv.protocols()).toContain("layout:uuid");
      expect(conv.protocols()).toContain("layout:int64");
    });

    it("get returns registered protocol", () => {
      const conv = buildConverter();
      expect(conv.get("colon")).toBe(colonProtocol);
      expect(conv.get("layout:uuid")?.name).toBe("layout:uuid");
    });

    it("require throws for unknown", () => {
      const conv = createAddressConverter();
      expect(() => conv.require("nope")).toThrow(RangeError);
    });

    it("detect identifies protocol name", () => {
      const conv = buildConverter();
      expect(conv.detect("perm:v1:42")).toBe("colon");
      expect(conv.detect("wi://perm/v1/42")).toBe("uri");
      expect(conv.detect("perm-v1-42")).toBe("compact");
      const uuid = conv.serialize(ADDR, "layout:uuid");
      expect(conv.detect(uuid)).toBe("layout:uuid");
      expect(conv.detect("???")).toBeNull();
    });

    it("parse auto-detects protocol", () => {
      const conv = buildConverter();
      expect(conv.parse("perm:v1:42")).toEqual(ADDR);
      expect(conv.parse("wi://perm/v1/42")).toEqual(ADDR);
      expect(conv.parse("perm-v1-42")).toEqual(ADDR);
      // UUID layout
      const uuid = conv.serialize(ADDR, "layout:uuid");
      expect(conv.parse(uuid)).toEqual(ADDR);
    });

    it("serialize to any protocol", () => {
      const conv = buildConverter();
      expect(conv.serialize(ADDR, "colon")).toBe("perm:v1:42");
      expect(conv.serialize(ADDR, "uri")).toBe("wi://perm/v1/42");
      expect(conv.serialize(ADDR, "compact")).toBe("perm-v1-42");
      expect(conv.serialize(ADDR, "layout:uuid")).toMatch(/^[0-9a-f]{8}-/);
      expect(conv.serialize(ADDR, "layout:int64")).toMatch(/^[0-9a-f]{16}$/);
    });
  });

  // ── text → text ──────────────────────────────────────────────────────

  describe("text ↔ text", () => {
    const conv = buildConverter();

    it("colon → uri", () => {
      expect(conv.convert("perm:v1:42", "uri")).toBe("wi://perm/v1/42");
    });
    it("uri → colon", () => {
      expect(conv.convert("wi://perm/v1/42", "colon")).toBe("perm:v1:42");
    });
    it("colon → compact", () => {
      expect(conv.convert("perm:v1:42", "compact")).toBe("perm-v1-42");
    });
    it("compact → uri", () => {
      expect(conv.convert("perm-v1-42", "uri")).toBe("wi://perm/v1/42");
    });
  });

  // ── text → layout ───────────────────────────────────────────────────

  describe("text → layout", () => {
    const conv = buildConverter();

    it("colon → layout:uuid", () => {
      const uuid = conv.convert("perm:v1:42", "layout:uuid");
      expect(uuid).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
      expect(conv.parse(uuid)).toEqual(ADDR);
    });

    it("uri → layout:uuid", () => {
      const uuid = conv.convert("wi://perm/v1/42", "layout:uuid");
      expect(conv.parse(uuid)).toEqual(ADDR);
    });

    it("compact → layout:int64", () => {
      const hex = conv.convert("perm-v1-42", "layout:int64");
      expect(hex).toMatch(/^[0-9a-f]{16}$/);
      expect(conv.parse(hex)).toEqual(ADDR);
    });

    it("colon → layout:int64", () => {
      const hex = conv.convert("perm:v1:42", "layout:int64");
      expect(conv.parse(hex)).toEqual(ADDR);
    });
  });

  // ── layout → text ───────────────────────────────────────────────────

  describe("layout → text", () => {
    const conv = buildConverter();

    it("layout:uuid → colon", () => {
      const uuid = conv.serialize(ADDR, "layout:uuid");
      expect(conv.convert(uuid, "colon")).toBe("perm:v1:42");
    });

    it("layout:uuid → uri", () => {
      const uuid = conv.serialize(ADDR, "layout:uuid");
      expect(conv.convert(uuid, "uri")).toBe("wi://perm/v1/42");
    });

    it("layout:int64 → colon", () => {
      const hex = conv.serialize(ADDR, "layout:int64");
      expect(conv.convert(hex, "colon")).toBe("perm:v1:42");
    });

    it("layout:int64 → compact", () => {
      const hex = conv.serialize(ADDR, "layout:int64");
      expect(conv.convert(hex, "compact")).toBe("perm-v1-42");
    });
  });

  // ── layout → layout ─────────────────────────────────────────────────

  describe("layout ↔ layout", () => {
    const conv = buildConverter();

    it("layout:uuid → layout:int64", () => {
      const uuid = conv.serialize(ADDR, "layout:uuid");
      const hex  = conv.convert(uuid, "layout:int64");
      expect(hex).toMatch(/^[0-9a-f]{16}$/);
      expect(conv.parse(hex)).toEqual(ADDR);
    });

    it("layout:int64 → layout:uuid", () => {
      const hex  = conv.serialize(ADDR, "layout:int64");
      const uuid = conv.convert(hex, "layout:uuid");
      expect(uuid).toMatch(/^[0-9a-f]{8}-/);
      expect(conv.parse(uuid)).toEqual(ADDR);
    });
  });

  // ── full round-trip: 5 protocols ─────────────────────────────────────

  describe("full round-trip across all 5 protocols", () => {
    const conv = buildConverter();
    const protos = conv.protocols();

    it("any → any → original preserves SemanticAddress", () => {
      for (const from of protos) {
        const serialized = conv.serialize(ADDR, from);
        for (const to of protos) {
          const converted = conv.convert(serialized, to);
          const result = conv.parse(converted);
          expect(result).toEqual(ADDR);
        }
      }
    });

    it("chain: colon → uuid → int64 → uri → compact → colon", () => {
      let current = "perm:v1:42";
      current = conv.convert(current, "layout:uuid");
      current = conv.convert(current, "layout:int64");
      current = conv.convert(current, "uri");
      current = conv.convert(current, "compact");
      current = conv.convert(current, "colon");
      expect(current).toBe("perm:v1:42");
    });
  });

  // ── multiple schemas & versions ──────────────────────────────────────

  describe("multiple schemas and versions", () => {
    const conv = buildConverter();

    it("doc:v2:100 round-trips through all protocols", () => {
      const addr: SemanticAddress = { schema: "doc", version: "v2", index: 100 };
      for (const proto of conv.protocols()) {
        const s = conv.serialize(addr, proto);
        expect(conv.parse(s)).toEqual(addr);
      }
    });

    it("different addresses produce different serializations", () => {
      const a1: SemanticAddress = { schema: "perm", version: "v1", index: 1 };
      const a2: SemanticAddress = { schema: "perm", version: "v1", index: 2 };
      for (const proto of conv.protocols()) {
        expect(conv.serialize(a1, proto)).not.toBe(conv.serialize(a2, proto));
      }
    });
  });

  // ── custom format in converter ───────────────────────────────────────

  describe("custom format integration", () => {
    it("custom PackFormat works in converter", () => {
      const custom = defineFormat({ name: "tok", chars: 12, label: "Token", groups: [4, 4, 4] });
      const conv = createAddressConverter();
      conv.register(createLayoutProtocol({
        format: custom,
        schemaChars: 2, versionChars: 2,
        schemas: { perm: 1 }, versions: { v1: 1 },
      }));

      const tok = conv.serialize(ADDR, "layout:tok");
      expect(tok).toMatch(/^[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}$/);

      // tok → colon
      expect(conv.convert(tok, "colon")).toBe("perm:v1:42");
      // colon → tok → colon
      expect(conv.convert(conv.convert("perm:v1:42", "layout:tok"), "colon")).toBe("perm:v1:42");
    });
  });
});

// ── 샤딩 레이아웃 ─────────────────────────────────────────────────────────────

describe("createLayoutProtocol with sharding", () => {
  const baseOpts = {
    format: PACK_FORMATS.uuid,
    schemaChars: 4,
    versionChars: 2,
    schemas:  { perm: 1 },
    versions: { v1: 1 },
  };

  // ── 기본 동작 ────────────────────────────────────────────────────────────

  const modulo4 = { type: "modulo" as const, chars: 1, numShards: 4 };

  it("sharding.type=modulo, chars=1, numShards=4: layout이 [schema|version|shard|gap|index]로 확장된다", () => {
    const proto = createLayoutProtocol({ ...baseOpts, sharding: modulo4 });
    // index=42 → shard = 42 % 4 = 2
    const out = proto.serialize({ schema: "perm", version: "v1", index: 42 });
    const raw = out.replace(/-/g, "");
    expect(raw.slice(0, 4)).toBe("0001"); // schema
    expect(raw.slice(4, 6)).toBe("01");   // version
    expect(raw.slice(6, 7)).toBe("2");    // shard = 42 % 4 = 2
    expect(raw.slice(-2)).toBe("2a");     // index = 42 = 0x2a
  });

  it("parse가 shard 필드를 반환한다", () => {
    const proto = createLayoutProtocol({ ...baseOpts, sharding: modulo4 });
    const serialized = proto.serialize({ schema: "perm", version: "v1", index: 42 });
    const parsed = proto.parse(serialized);
    expect(parsed.schema).toBe("perm");
    expect(parsed.version).toBe("v1");
    expect(parsed.index).toBe(42);
    expect(parsed.shard).toBe(2); // 42 % 4 = 2
  });

  it("round-trip: serialize → parse가 index를 보존한다", () => {
    const proto = createLayoutProtocol({ ...baseOpts, sharding: modulo4 });
    for (const idx of [0, 1, 3, 4, 7, 15, 42, 100]) {
      const addr = { schema: "perm", version: "v1", index: idx };
      const parsed = proto.parse(proto.serialize(addr));
      expect(parsed.index).toBe(idx);
      expect(parsed.shard).toBe(idx % 4);
    }
  });

  // ── shard 분배 ───────────────────────────────────────────────────────────

  it("modulo 분배: 4개 샤드에 균등하게 배분되는지 확인", () => {
    const proto = createLayoutProtocol({ ...baseOpts, sharding: modulo4 });
    const counts = [0, 0, 0, 0];
    for (let idx = 0; idx < 100; idx++) {
      const parsed = proto.parse(proto.serialize({ schema: "perm", version: "v1", index: idx }));
      counts[parsed.shard!]++;
    }
    // 100개 → 각 샤드 25개
    expect(counts).toEqual([25, 25, 25, 25]);
  });

  it("numShards=16: hex 1자리 용량 전체 사용", () => {
    const proto = createLayoutProtocol({ ...baseOpts, sharding: { type: "modulo", chars: 1, numShards: 16 } });
    const parsed = proto.parse(proto.serialize({ schema: "perm", version: "v1", index: 17 }));
    expect(parsed.shard).toBe(17 % 16); // = 1
  });

  // ── sharding 미설정 (기존 동작 유지) ────────────────────────────────────

  it("sharding 미설정 시 shard가 반환되지 않는다 (하위 호환)", () => {
    const proto = createLayoutProtocol({ ...baseOpts });
    const parsed = proto.parse(proto.serialize({ schema: "perm", version: "v1", index: 42 }));
    expect(parsed.shard).toBeUndefined();
  });

  // ── 검증 ────────────────────────────────────────────────────────────────

  it("numShards가 chars 용량 초과면 RangeError", () => {
    // chars=1 → 최대 16 shards
    expect(() =>
      createLayoutProtocol({ ...baseOpts, sharding: { type: "modulo", chars: 1, numShards: 17 } })
    ).toThrow(RangeError);
  });

  it("sharding.chars + 다른 필드가 format.chars 초과 시 RangeError", () => {
    // uuid = 32 chars, schemaChars=4, versionChars=2, sharding.chars=27 → left=33 > 32
    expect(() =>
      createLayoutProtocol({ ...baseOpts, sharding: { type: "modulo", chars: 27, numShards: 4 } })
    ).toThrow(RangeError);
  });

});
