/**
 * semantic-address.ts — Protocol-independent semantic address representation.
 *
 * A SemanticAddress is the universal form of (schema, version, index).
 * It can be serialized into different protocols and parsed back:
 *
 *   SemanticAddress { schema: "perm", version: "v1", index: 42 }
 *       ↓ colon     "perm:v1:42"
 *       ↓ uri       "wi://perm/v1/42"
 *       ↓ compact   "perm-v1-42"
 *
 * All protocols represent the same information — the protocol only
 * determines the physical string format.
 *
 * Layout protocol (hex container):
 *   SemanticAddress { schema: "perm", version: "v1", index: 42 }
 *       ↓ layout:uuid  "00010001-0000-0000-0000-00000000002a"
 *       ↓ layout:int64 "0001000100000042"
 *
 * Compatibility:
 *   - VersionedIndex { prefix, v, id }       (prefix-registry.ts)
 *   - VersionedValue { indexId, versionId, value } (index-meta)
 *   Both are SemanticAddress with different field names.
 */

import { formatHex, parseHex, type PackFormat } from "./pack-format.js";

// ═══════════════════════════════════════════════════════════════════════════
//  SemanticAddress — 정보 좌표의 보편적 표현
// ═══════════════════════════════════════════════════════════════════════════

/** A protocol-independent information coordinate. */
export interface SemanticAddress {
  /** 스키마 식별자 (= prefix / indexId) */
  readonly schema:  string;
  /** 스키마 버전 (= v / versionId) */
  readonly version: string;
  /** 인코딩된 정수 (= id / value) */
  readonly index:   number;
}

// ═══════════════════════════════════════════════════════════════════════════
//  AddressProtocol — 직렬화 프로토콜 인터페이스
// ═══════════════════════════════════════════════════════════════════════════

export interface AddressProtocol {
  readonly name: string;
  /** 이 프로토콜의 문자열인지 판별 */
  test(input: string): boolean;
  /** SemanticAddress → 문자열 */
  serialize(addr: SemanticAddress): string;
  /** 문자열 → SemanticAddress */
  parse(input: string): SemanticAddress;
}

// ═══════════════════════════════════════════════════════════════════════════
//  Built-in protocols
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Colon protocol: `"schema:version:index"`
 *
 * 기존 PrefixRegistry.serialize() / MetaRegistry.serialize() 호환.
 *
 * @example
 * colonProtocol.serialize({ schema: "perm", version: "v1", index: 42 })
 * // → "perm:v1:42"
 */
export const colonProtocol: AddressProtocol = {
  name: "colon",

  test(input: string): boolean {
    if (input.includes("://")) return false;
    const parts = input.split(":");
    return parts.length === 3 && parts.every(p => p.length > 0);
  },

  serialize(addr: SemanticAddress): string {
    return `${addr.schema}:${addr.version}:${addr.index}`;
  },

  parse(input: string): SemanticAddress {
    const parts = input.split(":");
    if (parts.length !== 3 || parts.some(p => !p)) {
      throw new SyntaxError(`Invalid colon address: "${input}"`);
    }
    const index = Number(parts[2]);
    if (!Number.isFinite(index)) {
      throw new SyntaxError(`Invalid index in colon address: "${parts[2]}"`);
    }
    return { schema: parts[0], version: parts[1], index };
  },
};

/**
 * URI protocol: `"wi://schema/version/index"`
 *
 * World Information URI — 정보 좌표의 URI 표현.
 * scheme `wi`는 weighted-index의 약어.
 *
 * @example
 * uriProtocol.serialize({ schema: "perm", version: "v1", index: 42 })
 * // → "wi://perm/v1/42"
 */
export const uriProtocol: AddressProtocol = {
  name: "uri",

  test(input: string): boolean {
    return input.startsWith("wi://");
  },

  serialize(addr: SemanticAddress): string {
    return `wi://${addr.schema}/${addr.version}/${addr.index}`;
  },

  parse(input: string): SemanticAddress {
    if (!input.startsWith("wi://")) {
      throw new SyntaxError(`Invalid URI address: "${input}" (expected wi:// scheme)`);
    }
    const path = input.slice(5); // strip "wi://"
    const parts = path.split("/");
    if (parts.length !== 3 || parts.some(p => !p)) {
      throw new SyntaxError(`Invalid URI address path: "${path}" (expected schema/version/index)`);
    }
    const index = Number(parts[2]);
    if (!Number.isFinite(index)) {
      throw new SyntaxError(`Invalid index in URI address: "${parts[2]}"`);
    }
    return { schema: parts[0], version: parts[1], index };
  },
};

/**
 * Compact protocol: `"schema-version-index"`
 *
 * dash 구분. schema/version에 dash가 없을 때만 안전.
 * 간결한 표현이 필요한 URL path segment, 파일명 등에 적합.
 *
 * @example
 * compactProtocol.serialize({ schema: "perm", version: "v1", index: 42 })
 * // → "perm-v1-42"
 */
export const compactProtocol: AddressProtocol = {
  name: "compact",

  test(input: string): boolean {
    if (input.includes(":") || input.includes("/")) return false;
    const parts = input.split("-");
    // 최소 3파트, 마지막이 10진수 숫자, 그리고 전체가 hex-only가 아닐 것
    if (parts.length < 3 || !/^\d+$/.test(parts[parts.length - 1])) return false;
    // hex layout과 구분: 모든 파트가 [0-9a-f]로만 구성되면 layout으로 간주
    const allHex = parts.every(p => /^[0-9a-f]+$/i.test(p));
    if (allHex) return false;
    return true;
  },

  serialize(addr: SemanticAddress): string {
    return `${addr.schema}-${addr.version}-${addr.index}`;
  },

  parse(input: string): SemanticAddress {
    // 뒤에서부터 파싱: index는 마지막 `-` 뒤, version은 그 앞 `-` 뒤, schema는 나머지
    const lastDash = input.lastIndexOf("-");
    if (lastDash < 0) throw new SyntaxError(`Invalid compact address: "${input}"`);

    const indexStr = input.slice(lastDash + 1);
    const rest = input.slice(0, lastDash);
    const secondDash = rest.lastIndexOf("-");
    if (secondDash < 0) throw new SyntaxError(`Invalid compact address: "${input}"`);

    const version = rest.slice(secondDash + 1);
    const schema  = rest.slice(0, secondDash);

    if (!schema || !version || !indexStr) {
      throw new SyntaxError(`Invalid compact address: "${input}"`);
    }

    const index = Number(indexStr);
    if (!Number.isFinite(index)) {
      throw new SyntaxError(`Invalid index in compact address: "${indexStr}"`);
    }
    return { schema, version, index };
  },
};

// ═══════════════════════════════════════════════════════════════════════════
//  Protocol registry & resolution
// ═══════════════════════════════════════════════════════════════════════════

/** All built-in protocols, ordered by detection priority. */
const BUILTIN_PROTOCOLS: readonly AddressProtocol[] = [
  uriProtocol,
  colonProtocol,
  compactProtocol,
];

/**
 * Auto-detect protocol and parse a serialized address string.
 *
 * Detection order: URI (`wi://`) → colon (`:`) → compact (`-`).
 *
 * @throws {SyntaxError} if no protocol matches
 *
 * @example
 * parseAddress("perm:v1:42")      // → { schema: "perm", version: "v1", index: 42 }
 * parseAddress("wi://perm/v1/42") // → { schema: "perm", version: "v1", index: 42 }
 * parseAddress("perm-v1-42")      // → { schema: "perm", version: "v1", index: 42 }
 */
export function parseAddress(
  input: string,
  protocols: readonly AddressProtocol[] = BUILTIN_PROTOCOLS,
): SemanticAddress {
  for (const proto of protocols) {
    if (proto.test(input)) return proto.parse(input);
  }
  throw new SyntaxError(`Cannot detect address protocol: "${input}"`);
}

/**
 * Serialize a SemanticAddress using a named protocol.
 *
 * @example
 * serializeAddress({ schema: "perm", version: "v1", index: 42 }, "uri")
 * // → "wi://perm/v1/42"
 */
export function serializeAddress(
  addr: SemanticAddress,
  protocol: AddressProtocol | "colon" | "uri" | "compact",
): string {
  if (typeof protocol === "object") return protocol.serialize(addr);
  const proto = resolveBuiltinProtocol(protocol);
  return proto.serialize(addr);
}

/**
 * Convert a serialized address from one protocol to another.
 *
 * @example
 * convertAddress("perm:v1:42", "uri")       // → "wi://perm/v1/42"
 * convertAddress("wi://perm/v1/42", "colon") // → "perm:v1:42"
 */
export function convertAddress(
  input: string,
  toProtocol: AddressProtocol | "colon" | "uri" | "compact",
): string {
  const addr = parseAddress(input);
  return serializeAddress(addr, toProtocol);
}

function resolveBuiltinProtocol(name: string): AddressProtocol {
  switch (name) {
    case "colon":   return colonProtocol;
    case "uri":     return uriProtocol;
    case "compact": return compactProtocol;
    default: throw new RangeError(`Unknown protocol: "${name}"`);
  }
}

// ═══════════════════════════════════════════════════════════════════════════
//  Layout protocol — hex container 기반 직렬화
// ═══════════════════════════════════════════════════════════════════════════

export interface LayoutProtocolOptions {
  /** 컨테이너 포맷 (UUID, int64, custom 등) */
  format: PackFormat;
  /** schema 필드에 할당할 hex 자릿수 */
  schemaChars: number;
  /** version 필드에 할당할 hex 자릿수 */
  versionChars: number;
  /** schema 이름 ↔ 숫자 매핑 */
  schemas: Record<string, number>;
  /** version 이름 ↔ 숫자 매핑 */
  versions: Record<string, number>;
}

/**
 * Create an AddressProtocol that packs SemanticAddress fields into a hex container.
 *
 * Layout: [schema | version | ...gap... | index]
 * Left fields (schema + version) from char 0 rightward.
 * Right field (index) from last char leftward.
 * Gap is zero-filled.
 *
 * @example
 * const proto = createLayoutProtocol({
 *   format: PACK_FORMATS.uuid,
 *   schemaChars: 4,
 *   versionChars: 2,
 *   schemas:  { perm: 1, doc: 2 },
 *   versions: { v1: 1, v2: 2 },
 * });
 *
 * proto.serialize({ schema: "perm", version: "v1", index: 42 })
 * // → "00010001-0000-0000-0000-00000000002a"
 *
 * proto.parse("00010001-0000-0000-0000-00000000002a")
 * // → { schema: "perm", version: "v1", index: 42 }
 */
export function createLayoutProtocol(opts: LayoutProtocolOptions): AddressProtocol {
  const { format, schemaChars, versionChars, schemas, versions } = opts;

  const leftChars  = schemaChars + versionChars;
  const indexChars = format.chars - leftChars;
  if (indexChars <= 0) {
    throw new RangeError(
      `createLayoutProtocol: schema(${schemaChars}) + version(${versionChars}) = ${leftChars} ≥ format.chars(${format.chars})`
    );
  }

  // Reverse maps for parse
  const schemaByNum  = new Map<number, string>();
  for (const [name, num] of Object.entries(schemas))  schemaByNum.set(num, name);
  const versionByNum = new Map<number, string>();
  for (const [name, num] of Object.entries(versions)) versionByNum.set(num, name);

  // UUID-style regex pattern for test()
  const hexPattern = format.groups
    ? new RegExp(`^${format.groups.map(g => `[0-9a-f]{${g}}`).join("-")}$`, "i")
    : new RegExp(`^[0-9a-f]{${format.chars}}$`, "i");

  return {
    name: `layout:${format.name}`,

    test(input: string): boolean {
      return hexPattern.test(input);
    },

    serialize(addr: SemanticAddress): string {
      const sNum = schemas[addr.schema];
      const vNum = versions[addr.version];
      if (sNum === undefined) throw new RangeError(`Unknown schema: "${addr.schema}"`);
      if (vNum === undefined) throw new RangeError(`Unknown version: "${addr.version}"`);

      // Left fields → gap → right field
      const sHex = sNum.toString(16).padStart(schemaChars, "0");
      const vHex = vNum.toString(16).padStart(versionChars, "0");
      const iHex = addr.index.toString(16).padStart(indexChars, "0");
      const gapLen = format.chars - leftChars - iHex.length;
      const rawHex = sHex + vHex + "0".repeat(Math.max(0, gapLen)) + iHex;

      return formatHex(format, rawHex);
    },

    parse(input: string): SemanticAddress {
      const raw = parseHex(input);
      if (raw.length !== format.chars) {
        throw new SyntaxError(`Expected ${format.chars} hex chars, got ${raw.length}`);
      }

      const sNum = parseInt(raw.slice(0, schemaChars), 16);
      const vNum = parseInt(raw.slice(schemaChars, leftChars), 16);
      // Index is right-aligned: take last indexChars
      const idx  = parseInt(raw.slice(format.chars - indexChars), 16);

      const schema  = schemaByNum.get(sNum);
      const version = versionByNum.get(vNum);
      if (schema === undefined)  throw new SyntaxError(`Unknown schema number: ${sNum} (0x${sNum.toString(16)})`);
      if (version === undefined) throw new SyntaxError(`Unknown version number: ${vNum} (0x${vNum.toString(16)})`);

      return { schema, version, index: idx };
    },
  };
}

// ═══════════════════════════════════════════════════════════════════════════
//  AddressConverter — 통합 양방향 변환 인터페이스
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Manages a set of protocols and provides unified bidirectional conversion.
 *
 * Text protocols (colon, uri, compact) and layout protocols (uuid, int64, custom)
 * are registered together and can convert to each other through SemanticAddress.
 *
 * @example
 * const conv = createAddressConverter();
 * conv.register(createLayoutProtocol({ format: PACK_FORMATS.uuid, ... }));
 *
 * // any → any
 * conv.convert("perm:v1:42", "layout:uuid")
 * conv.convert("00010100-0000-...-002a", "uri")
 * conv.convert("wi://perm/v1/42", "layout:int64")
 */
export class AddressConverter {
  private readonly protos = new Map<string, AddressProtocol>();
  /** Detection priority order (first match wins) */
  private order: AddressProtocol[] = [];

  /**
   * Register a protocol.
   * Layout protocols (`name.startsWith("layout:")`) are inserted before
   * text protocols so that hex patterns are tested before compact `-` matching.
   * Same name overwrites in place.
   */
  register(protocol: AddressProtocol): this {
    const existed = this.protos.has(protocol.name);
    this.protos.set(protocol.name, protocol);
    if (existed) {
      this.order = this.order.map(p => p.name === protocol.name ? protocol : p);
    } else if (protocol.name.startsWith("layout:")) {
      // Insert layout protocols before text protocols
      const firstTextIdx = this.order.findIndex(p => !p.name.startsWith("layout:"));
      if (firstTextIdx >= 0) {
        this.order.splice(firstTextIdx, 0, protocol);
      } else {
        this.order.push(protocol);
      }
    } else {
      this.order.push(protocol);
    }
    return this;
  }

  /** Get a protocol by name. */
  get(name: string): AddressProtocol | undefined {
    return this.protos.get(name);
  }

  /** Get a protocol by name, throw if not found. */
  require(name: string): AddressProtocol {
    const p = this.protos.get(name);
    if (!p) throw new RangeError(`AddressConverter: unknown protocol "${name}"`);
    return p;
  }

  /** List registered protocol names. */
  protocols(): string[] {
    return this.order.map(p => p.name);
  }

  /** Auto-detect protocol and parse. */
  parse(input: string): SemanticAddress {
    for (const proto of this.order) {
      if (proto.test(input)) return proto.parse(input);
    }
    throw new SyntaxError(`AddressConverter: cannot detect protocol for "${input}"`);
  }

  /** Serialize to a named protocol. */
  serialize(addr: SemanticAddress, protocolName: string): string {
    return this.require(protocolName).serialize(addr);
  }

  /** Convert from any registered protocol to another. */
  convert(input: string, to: string): string {
    return this.serialize(this.parse(input), to);
  }
}

/**
 * Create an AddressConverter pre-loaded with built-in text protocols.
 *
 * Detection order: uri → colon → compact.
 * Layout protocols can be added via `.register()`.
 *
 * @example
 * const conv = createAddressConverter();
 * conv.convert("perm:v1:42", "uri"); // → "wi://perm/v1/42"
 */
export function createAddressConverter(): AddressConverter {
  const conv = new AddressConverter();
  conv.register(uriProtocol);
  conv.register(colonProtocol);
  conv.register(compactProtocol);
  return conv;
}

// ═══════════════════════════════════════════════════════════════════════════
//  Compatibility adapters
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Convert a VersionedIndex (from PrefixRegistry) to a SemanticAddress.
 */
export function fromVersionedIndex(vi: {
  prefix: string;
  v: string;
  id: number;
}): SemanticAddress {
  return { schema: vi.prefix, version: vi.v, index: vi.id };
}

/**
 * Convert a SemanticAddress to a VersionedIndex.
 */
export function toVersionedIndex(addr: SemanticAddress): {
  prefix: string;
  v: string;
  id: number;
} {
  return { prefix: addr.schema, v: addr.version, id: addr.index };
}

/**
 * Convert a VersionedValue (from index-meta) to a SemanticAddress.
 */
export function fromVersionedValue(vv: {
  indexId: string;
  versionId: string;
  value: number;
}): SemanticAddress {
  return { schema: vv.indexId, version: vv.versionId, index: vv.value };
}

/**
 * Convert a SemanticAddress to a VersionedValue.
 */
export function toVersionedValue(addr: SemanticAddress): {
  indexId: string;
  versionId: string;
  value: number;
} {
  return { indexId: addr.schema, versionId: addr.version, value: addr.index };
}
