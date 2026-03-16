/**
 * semantic-address.ts — 닫힌 패턴 주소의 외부 표현 및 직렬화
 *
 * ── 개념 ───────────────────────────────────────────────────────────────────
 *
 * WeightedIndex가 좌표를 1D 정수(주소)로 압축하면, SemanticAddress는 그 주소에
 * "어떤 패턴 스키마의 어느 버전에서 압축된 값인가"라는 맥락을 붙인다.
 *
 *   { schema: "perm", version: "v1", index: 42 }
 *       → "perm 스키마 v1 버전에서 압축된 주소 42"
 *
 * 이 맥락이 있어야 주소 단독으로도 원래 좌표를 완전히 복원할 수 있다.
 * (index-meta의 VersionedValue { indexId, versionId, value }와 동일한 개념)
 *
 * ── 직렬화 프로토콜 ─────────────────────────────────────────────────────────
 *
 * 같은 SemanticAddress를 다양한 외부 형식으로 직렬화할 수 있다.
 * 프로토콜은 형식(포맷)만 다를 뿐 담긴 정보는 동일하다.
 *
 *   SemanticAddress { schema: "perm", version: "v1", index: 42 }
 *       ↓ colon        "perm:v1:42"
 *       ↓ uri          "wi://perm/v1/42"
 *       ↓ compact      "perm-v1-42"
 *       ↓ layout:uuid  "00010001-0000-0000-0000-00000000002a"
 *       ↓ layout:int64 "0001000100000042"
 *
 * layout 프로토콜은 hex 컨테이너(UUID, int64 등)에 주소를 packed해 DB 기본 키나
 * UUID 필드에 직접 저장할 수 있도록 한다.
 */

import { formatHex, parseHex, type PackFormat } from "./pack-format.js";

// ═══════════════════════════════════════════════════════════════════════════
//  SemanticAddress — 정보 좌표의 보편적 표현
// ═══════════════════════════════════════════════════════════════════════════

/**
 * 버전 + 1D 주소의 메타 레이어 표현.
 * "어떤 스키마의 어느 버전에서 압축된 값인가"를 나타낸다.
 *
 * SemanticAddress와 동일한 정보를 담지만, 메타 레이어(index-meta 등)에서
 * 사용하는 필드명 관례를 따른다.
 */
export interface VersionedValue {
  indexId: string;
  versionId: string;
  value: number;
}

/** A protocol-independent information coordinate. */
export interface SemanticAddress {
  /** 스키마 식별자 (= prefix / indexId) */
  readonly schema:  string;
  /** 스키마 버전 (= v / versionId) */
  readonly version: string;
  /** 인코딩된 정수 (= id / value) */
  readonly index:   number;
  /**
   * 샤드 라우팅 힌트. layout protocol에 shardChars가 설정된 경우에만 존재.
   * serialize 시 index % numShards로 자동 계산되어 hex에 삽입된다.
   * parse 시 hex에서 추출되어 반환된다.
   */
  readonly shard?: number;
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
 * 기존 PrefixCodec.serialize() / MetaRegistry.serialize() 호환.
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
    if (!/^\d+$/.test(parts[2])) {
      throw new SyntaxError(`Invalid index in colon address: "${parts[2]}"`);
    }
    const index = Number(parts[2]);
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
    if (!/^\d+$/.test(parts[2])) {
      throw new SyntaxError(`Invalid index in URI address: "${parts[2]}"`);
    }
    const index = Number(parts[2]);
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

  /**
   * Detect whether an input string matches the compact format.
   *
   * NOTE: If both schema and version consist entirely of hex characters
   * (e.g., "a1b2-c3d4-42"), the input is treated as a layout protocol
   * address and this method returns false. Such compact addresses cannot
   * be auto-detected and must be explicitly parsed via
   * `compactProtocol.parse()`.
   */
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

    if (!/^\d+$/.test(indexStr)) {
      throw new SyntaxError(`Invalid index in compact address: "${indexStr}"`);
    }
    const index = Number(indexStr);
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
 * 입력 문자열의 프로토콜을 감지해 이름을 반환한다.
 *
 * 감지 순서: URI (`wi://`) → colon (`:`) → compact (`-`).
 * 어떤 프로토콜에도 매칭되지 않으면 `null`.
 *
 * @example
 * detectProtocol("perm:v1:42")      // → "colon"
 * detectProtocol("wi://perm/v1/42") // → "uri"
 * detectProtocol("perm-v1-42")      // → "compact"
 * detectProtocol("???")             // → null
 */
export function detectProtocol(
  input: string,
  protocols: readonly AddressProtocol[] = BUILTIN_PROTOCOLS,
): string | null {
  for (const proto of protocols) {
    if (proto.test(input)) return proto.name;
  }
  return null;
}

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

/**
 * shard 라우팅 전략.
 *
 * layout이 [schema | version | shard | gap | index]로 확장되며,
 * shard 값은 index에서 자동으로 파생된다 (호출자가 직접 지정하지 않아도 됨).
 *
 * `type` 필드가 discriminant(판별자) 역할을 한다. 현재는 "modulo"만 지원하며,
 * 향후 전략 추가 시 union에 멤버를 추가하면 exhaustive switch가 자동으로
 * 처리 누락을 컴파일 에러로 잡는다.
 *
 * ── 전략 ─────────────────────────────────────────────────────────────────────
 *
 *  "modulo"  shard = index % numShards
 *            - index를 인터리브(교차)로 분배: 0→s0, 1→s1, 2→s2, 3→s0 …
 *            - 레지스트리 레벨로 설정해도 모든 인덱스에 일관 적용 가능.
 *              (totalSize 불필요 — 인덱스마다 크기가 달라도 동일하게 동작)
 *            - 균형 조건: size % numShards === 0 이면 완전 균형.
 *
 * ── layout 변화 ─────────────────────────────────────────────────────────────
 *
 *  미설정: [schema | version | ··gap·· | index]
 *  설정 시: [schema | version | shard | ··gap·· | index]
 *
 * @example
 * sharding: { type: "modulo", chars: 1, numShards: 4 }
 * // index=42 → shard = 42 % 4 = 2
 * // layout:uuid  "00010001-2000-0000-0000-00000000002a"
 * //               ^^^^^^^^ ↑
 * //               schema+ver  shard=2 (7번째 hex 자리)
 */
export type ShardingStrategy = {
  type: "modulo";
  /** shard 라우팅 필드에 할당할 hex 자릿수. numShards - 1이 이 용량 안에 들어와야 한다. */
  chars: number;
  /** 논리 샤드 수 (≥ 1). shard = index % numShards. */
  numShards: number;
};

export interface LayoutProtocolOptions {
  /** 컨테이너 포맷 (UUID, int64, custom 등) */
  format: PackFormat;
  /** schema 필드에 할당할 hex 자릿수 */
  schemaChars: number;
  /** version 필드에 할당할 hex 자릿수 */
  versionChars: number;
  /**
   * 샤딩 전략. 설정 시 layout이 [schema | version | shard | gap | index]로 확장된다.
   * 미설정(기본값) 시 [schema | version | gap | index].
   */
  sharding?: ShardingStrategy;
  /** schema 이름 ↔ 숫자 매핑 */
  schemas: Record<string, number>;
  /** version 이름 ↔ 숫자 매핑 */
  versions: Record<string, number>;
}

/**
 * Create an AddressProtocol that packs SemanticAddress fields into a hex container.
 *
 * Layout (shardChars = 0): [schema | version | ...gap... | index]
 * Layout (shardChars > 0): [schema | version | shard | ...gap... | index]
 *
 * Left fields from char 0 rightward. Index right-aligned. Gap is zero-filled.
 * shard = index % numShards (auto-derived, no caller input required).
 *
 * @example
 * // sharding 없이
 * const proto = createLayoutProtocol({
 *   format: PACK_FORMATS.uuid,
 *   schemaChars: 4, versionChars: 2,
 *   schemas: { perm: 1 }, versions: { v1: 1, v2: 2 },
 * });
 * proto.serialize({ schema: "perm", version: "v1", index: 42 })
 * // → "00010001-0000-0000-0000-00000000002a"
 *
 * @example
 * // 4개 샤드
 * const proto = createLayoutProtocol({
 *   format: PACK_FORMATS.uuid,
 *   schemaChars: 4, versionChars: 2, shardChars: 1, numShards: 4,
 *   schemas: { perm: 1 }, versions: { v1: 1 },
 * });
 * proto.serialize({ schema: "perm", version: "v1", index: 42 })
 * // shard = 42 % 4 = 2 → "00010001-2000-0000-0000-00000000002a"
 * proto.parse("00010001-2000-0000-0000-00000000002a")
 * // → { schema: "perm", version: "v1", index: 42, shard: 2 }
 */
export function createLayoutProtocol(opts: LayoutProtocolOptions): AddressProtocol {
  const { format, schemaChars, versionChars, schemas, versions, sharding } = opts;
  const shardChars = sharding?.chars ?? 0;

  // sharding 유효성 검증
  if (sharding !== undefined) {
    if (!Number.isInteger(sharding.chars) || sharding.chars <= 0) {
      throw new RangeError(`createLayoutProtocol: sharding.chars must be a positive integer, got ${sharding.chars}`);
    }
    if (!Number.isInteger(sharding.numShards) || sharding.numShards < 1) {
      throw new RangeError(`createLayoutProtocol: sharding.numShards must be a positive integer, got ${sharding.numShards}`);
    }
    const shardCapacity = 16 ** sharding.chars;
    if (sharding.numShards > shardCapacity) {
      throw new RangeError(
        `createLayoutProtocol: sharding.numShards(${sharding.numShards}) exceeds chars(${sharding.chars}) capacity (max ${shardCapacity})`
      );
    }
  }

  const leftChars  = schemaChars + versionChars + shardChars;
  const indexChars = format.chars - leftChars;
  if (indexChars <= 0) {
    throw new RangeError(
      `createLayoutProtocol: schema(${schemaChars}) + version(${versionChars}) + shard(${shardChars}) = ${leftChars} ≥ format.chars(${format.chars})`
    );
  }

  // shard 계산 — 현재 modulo만 지원. 향후 전략 추가 시 여기에 분기 추가.
  function computeShard(index: number): number {
    return index % sharding!.numShards;
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

      const schemaMax = 16 ** schemaChars - 1;
      if (sNum > schemaMax) {
        throw new RangeError(
          `Schema value ${sNum} exceeds allocated ${schemaChars} hex char(s) (max ${schemaMax})`
        );
      }
      const versionMax = 16 ** versionChars - 1;
      if (vNum > versionMax) {
        throw new RangeError(
          `Version value ${vNum} exceeds allocated ${versionChars} hex char(s) (max ${versionMax})`
        );
      }
      const indexMax = 16 ** indexChars - 1;
      if (addr.index > indexMax) {
        throw new RangeError(
          `Index value ${addr.index} exceeds allocated ${indexChars} hex char(s) (max ${indexMax})`
        );
      }

      const sHex  = sNum.toString(16).padStart(schemaChars, "0");
      const vHex  = vNum.toString(16).padStart(versionChars, "0");
      const shHex = shardChars > 0
        ? computeShard(addr.index).toString(16).padStart(shardChars, "0")
        : "";
      const iHex  = addr.index.toString(16).padStart(indexChars, "0");
      // leftChars + indexChars === format.chars 이므로 gap은 항상 0
      const rawHex = sHex + vHex + shHex + iHex;

      return formatHex(format, rawHex);
    },

    parse(input: string): SemanticAddress {
      const raw = parseHex(input);
      if (raw.length !== format.chars) {
        throw new SyntaxError(`Expected ${format.chars} hex chars, got ${raw.length}`);
      }

      const sNum  = parseInt(raw.slice(0, schemaChars), 16);
      const vNum  = parseInt(raw.slice(schemaChars, schemaChars + versionChars), 16);
      const shNum = shardChars > 0
        ? parseInt(raw.slice(schemaChars + versionChars, leftChars), 16)
        : undefined;
      // Index is right-aligned: take last indexChars
      const idx   = parseInt(raw.slice(format.chars - indexChars), 16);

      const schema  = schemaByNum.get(sNum);
      const version = versionByNum.get(vNum);
      if (schema === undefined)  throw new SyntaxError(`Unknown schema number: ${sNum} (0x${sNum.toString(16)})`);
      if (version === undefined) throw new SyntaxError(`Unknown version number: ${vNum} (0x${vNum.toString(16)})`);

      return { schema, version, index: idx, ...(shNum !== undefined && { shard: shNum }) };
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

  /** 입력 문자열의 프로토콜을 감지해 이름 반환. 매칭 없으면 null. */
  detect(input: string): string | null {
    for (const proto of this.order) {
      if (proto.test(input)) return proto.name;
    }
    return null;
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
 * Convert a VersionedIndex (from PrefixCodec) to a SemanticAddress.
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
 * Convert a VersionedValue to a SemanticAddress.
 */
export function fromVersionedValue(vv: VersionedValue): SemanticAddress {
  return { schema: vv.indexId, version: vv.versionId, index: vv.value };
}

/**
 * Convert a SemanticAddress to a VersionedValue.
 */
export function toVersionedValue(addr: SemanticAddress): VersionedValue {
  return { indexId: addr.schema, versionId: addr.version, value: addr.index };
}
