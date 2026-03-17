/**
 * AddressProtocolManager — 독립 주소 직렬화 게이트웨이
 *
 * ── 목적 ───────────────────────────────────────────────────────────────────
 *
 * MetaRegistry 없이 VersionedValue ↔ 프로토콜 문자열 변환을 수행하는 독립 모듈.
 * registry 검증(indexId/versionId 존재, value 범위)을 수행하지 않는 loose parsing을 제공한다.
 *
 * MetaRegistry 내부에서도 address 직렬화를 위임하는 백엔드로 사용된다.
 * MetaRegistry.parse()는 이 모듈의 parse() 결과에 registry 검증을 추가한다.
 *
 * ── 주요 API ───────────────────────────────────────────────────────────────
 *
 * serialize(vv, protocol?)          : VersionedValue → 프로토콜 문자열
 * parse(input, protocol?)           : 프로토콜 문자열 → VersionedValue (loose)
 * parseSchemaOnly(input)            : 주소에서 schema(indexId)만 추출
 * convert(input, targetProtocol)    : 프로토콜 간 변환
 *
 * register(protocol) / unregister(name) : 런타임 프로토콜 등록/해제
 * negotiate(client, server)             : 포맷 협상
 * setWriteProtocol / addReadProtocol / removeReadProtocol : 프로토콜 버전 전환
 * setFallbackChain / getFallbackStats   : fallback 체인 + 메트릭
 *
 * ── 사용 시나리오 ──────────────────────────────────────────────────────────
 *
 * - 로그 파서 / 감사 도구: 과거 스키마 없이 UUID 파싱
 * - 프록시 / 라우터: schema 필드만 추출해 서비스 라우팅
 * - 포맷 변환기: registry 없이 UUID ↔ colon ↔ int64 변환
 * - 프로토콜 수명 관리: 런타임 등록/해제, 버전 전환, fallback
 */

import {
  AddressConverter,
  CANONICAL_TEXT_PROTOCOL,
  colonProtocol,
  uriProtocol,
  compactProtocol,
  createLayoutProtocol,
  fromVersionedValue,
  toVersionedValue,
  type AddressProtocol,
  type SemanticAddress,
} from "weighted-index";
import type { AddressConfig, VersionedValue } from "./types.js";
import { NegotiationError, ParseError, ValidationError } from "./errors.js";

// ── 공개 타입 ────────────────────────────────────────────────────────────────

export interface FallbackStats {
  attempted: number;
  succeeded: number;
}

// ── AddressProtocolManager ───────────────────────────────────────────────────

export class AddressProtocolManager {
  /** 등록된 프로토콜. name → protocol */
  private _protocols = new Map<string, AddressProtocol>();
  /** 자동 감지 순서 (layout first, then text) */
  private _order: AddressProtocol[] = [];

  /** 기본 직렬화 프로토콜 */
  private _defaultProtocol: string;

  /** 명시적 write 프로토콜 (setWriteProtocol로 설정) */
  private _writeProtocol?: string;
  /** 읽기 허용 프로토콜 집합 (addReadProtocol 호출 시 초기화) */
  private _readProtocols?: Set<string>;

  /** fallback 체인 (setFallbackChain으로 설정) */
  private _fallbackChain?: string[];
  /** fallback 프로토콜별 시도/성공 통계 */
  private _fallbackStats = new Map<string, FallbackStats>();

  /** layout schema 역매핑 (parseSchemaOnly용) */
  private _schemaReverseMap?: Map<number, string>;
  /** layout schema hex 자릿수 */
  private _schemaChars?: number;

  /** converter 캐시 */
  private _cachedConverter?: AddressConverter;
  private _converterDirty = true;

  constructor(config?: AddressConfig) {
    // 기본 text 프로토콜 등록
    this._registerInternal(uriProtocol);
    this._registerInternal(colonProtocol);
    this._registerInternal(compactProtocol);
    this._defaultProtocol = CANONICAL_TEXT_PROTOCOL;

    if (config) {
      // parseSchemaOnly를 위한 역매핑 구축
      this._schemaReverseMap = new Map();
      for (const [name, num] of Object.entries(config.schemas)) {
        this._schemaReverseMap.set(num, name);
      }
      this._schemaChars = config.schemaChars;

      // schemas와 versions가 모두 있어야 layout 프로토콜 생성 가능
      if (
        Object.keys(config.schemas).length > 0 &&
        Object.keys(config.versions).length > 0
      ) {
        const layoutProto = createLayoutProtocol({
          format: config.format,
          schemaChars: config.schemaChars,
          versionChars: config.versionChars,
          sharding: config.sharding,
          schemas: config.schemas,
          versions: config.versions,
        });
        this._registerInternal(layoutProto);
        this._defaultProtocol = layoutProto.name;
      }
    }
  }

  // ── Core operations (§17) ────────────────────────────────────────────────

  /**
   * 입력 문자열의 프로토콜을 감지해 이름을 반환한다.
   *
   * 등록된 프로토콜을 감지 순서(layout first, then text)대로 시도.
   * 매칭 없으면 `null`.
   *
   * @example
   * apm.detect("perm:v1:42")      // → "colon"
   * apm.detect("wi://perm/v1/42") // → "uri"
   * apm.detect("???")             // → null
   */
  detect(input: string): string | null {
    for (const proto of this._order) {
      if (proto.test(input)) return proto.name;
    }
    return null;
  }

  /**
   * VersionedValue → 프로토콜 형식 문자열.
   *
   * protocol 생략 시 writeProtocol → defaultProtocol 순으로 사용.
   */
  serialize(vv: VersionedValue, protocol?: AddressProtocol | string): string {
    const addr = fromVersionedValue(vv);
    if (typeof protocol === "object") return protocol.serialize(addr);
    const protoName = protocol ?? this._writeProtocol ?? this._defaultProtocol;
    return this._requireProtocol(protoName).serialize(addr);
  }

  /**
   * 프로토콜 형식 문자열 → VersionedValue.
   *
   * registry 검증 없는 loose parsing.
   * fallbackChain > readProtocols > 자동 감지 순으로 파싱 전략 결정.
   */
  parse(input: string, protocol?: AddressProtocol | string): VersionedValue {
    let addr: SemanticAddress;
    try {
      if (typeof protocol === "object") {
        addr = protocol.parse(input);
      } else if (protocol) {
        addr = this._requireProtocol(protocol).parse(input);
      } else if (this._fallbackChain) {
        addr = this._parseWithFallback(input);
      } else if (this._readProtocols) {
        addr = this._parseWithReadProtocols(input);
      } else {
        addr = this._autoDetect(input);
      }
    } catch (e) {
      if (e instanceof ParseError) throw e;
      throw new ParseError(
        `Failed to parse address "${input}": ${e instanceof Error ? e.message : String(e)}`
      );
    }
    return toVersionedValue(addr);
  }

  /**
   * 주소에서 schema(indexId)만 추출.
   *
   * layout 설정이 있으면 hex에서 schema 필드를 직접 읽어 이름 역매핑.
   * 없으면 전체 파싱 후 schema 반환.
   */
  parseSchemaOnly(input: string): { schema: string } {
    if (this._schemaReverseMap && this._schemaChars) {
      const rawHex = input.replace(/[^0-9a-fA-F]/g, "");
      const schemaHex = rawHex.slice(0, this._schemaChars);
      const schemaNum = parseInt(schemaHex, 16);
      const schema = this._schemaReverseMap.get(schemaNum);
      if (schema === undefined) {
        throw new ParseError(
          `Unknown schema number ${schemaNum} (0x${schemaHex}) in "${input}"`
        );
      }
      return { schema };
    }
    const addr = this._autoDetect(input);
    return { schema: addr.schema };
  }

  /**
   * 프로토콜 간 변환.
   *
   * 입력을 자동 감지 파싱 → targetProtocol로 직렬화.
   */
  convert(input: string, targetProtocol: string): string {
    const addr = this._autoDetect(input);
    return this._requireProtocol(targetProtocol).serialize(addr);
  }

  // ── Protocol lifecycle (§18-1) ───────────────────────────────────────────

  /**
   * 프로토콜 등록.
   *
   * layout: 접두사 프로토콜은 text 프로토콜보다 앞에 배치된다.
   * 동일 이름이면 덮어쓴다.
   */
  register(protocol: AddressProtocol): void {
    this._registerInternal(protocol);
    this._converterDirty = true;
  }

  /**
   * 프로토콜 해제.
   *
   * 해제 전 생성된 PK는 다른 프로토콜로 파싱 가능.
   * default/write/read/fallback에서도 자동 제거.
   */
  unregister(name: string): void {
    if (!this._protocols.has(name)) {
      throw new ValidationError(`Protocol "${name}" is not registered`);
    }
    this._protocols.delete(name);
    this._order = this._order.filter((p) => p.name !== name);
    this._converterDirty = true;

    if (this._defaultProtocol === name) {
      this._defaultProtocol =
        this._order.length > 0 ? this._order[0].name : CANONICAL_TEXT_PROTOCOL;
    }
    if (this._writeProtocol === name) {
      this._writeProtocol = undefined;
    }
    this._readProtocols?.delete(name);
    if (this._fallbackChain) {
      this._fallbackChain = this._fallbackChain.filter((n) => n !== name);
    }
  }

  // ── Negotiation (§18-2) ──────────────────────────────────────────────────

  /**
   * 포맷 협상.
   *
   * 서버 우선순위에서 클라이언트도 지원하는 첫 번째 프로토콜을 반환.
   * 공통 프로토콜이 없으면 NegotiationError.
   */
  negotiate(
    clientCapabilities: string[],
    serverPreferences: string[]
  ): string {
    for (const pref of serverPreferences) {
      if (
        clientCapabilities.includes(pref) &&
        this._protocols.has(pref)
      ) {
        return pref;
      }
    }
    throw new NegotiationError(
      `No common protocol: client=[${clientCapabilities.join(", ")}], ` +
        `server=[${serverPreferences.join(", ")}]`
    );
  }

  // ── Protocol versioning (§18-3) ──────────────────────────────────────────

  /**
   * 쓰기 프로토콜 설정.
   *
   * serialize()에서 protocol 인자 생략 시 이 프로토콜 사용.
   */
  setWriteProtocol(name: string): void {
    this._requireProtocol(name);
    this._writeProtocol = name;
  }

  /**
   * 읽기 프로토콜 추가.
   *
   * 최초 호출 시 등록된 모든 프로토콜로 읽기 집합 초기화.
   * 이후 추가/제거로 읽기 허용 범위 관리.
   */
  addReadProtocol(name: string): void {
    this._requireProtocol(name);
    if (!this._readProtocols) {
      this._readProtocols = new Set(this._protocols.keys());
    }
    this._readProtocols.add(name);
  }

  /**
   * 읽기 프로토콜 제거.
   *
   * 제거된 프로토콜 형식의 입력은 parse() 시 ParseError.
   */
  removeReadProtocol(name: string): void {
    if (!this._readProtocols) {
      this._readProtocols = new Set(this._protocols.keys());
    }
    if (!this._readProtocols.has(name)) {
      throw new ValidationError(
        `Read protocol "${name}" is not in the read set`
      );
    }
    this._readProtocols.delete(name);
  }

  // ── Fallback (§18-4) ────────────────────────────────────────────────────

  /**
   * fallback 체인 설정.
   *
   * parse()에서 protocol 인자 생략 시 이 체인 순서대로 시도.
   * 통계는 초기화된다.
   */
  setFallbackChain(protocols: string[]): void {
    for (const name of protocols) {
      this._requireProtocol(name);
    }
    this._fallbackChain = [...protocols];
    this._fallbackStats.clear();
    for (const name of protocols) {
      this._fallbackStats.set(name, { attempted: 0, succeeded: 0 });
    }
  }

  /**
   * fallback 프로토콜별 시도/성공 통계 반환.
   */
  getFallbackStats(): Record<string, FallbackStats> {
    const result: Record<string, FallbackStats> = {};
    for (const [name, stats] of this._fallbackStats) {
      result[name] = { ...stats };
    }
    return result;
  }

  // ── Accessors ────────────────────────────────────────────────────────────

  /**
   * AddressConverter 인스턴스 반환.
   *
   * 등록된 프로토콜에서 on-demand 구축. register/unregister 시 재구축.
   */
  get converter(): AddressConverter {
    if (this._converterDirty || !this._cachedConverter) {
      const conv = new AddressConverter();
      for (const proto of this._order) {
        conv.register(proto);
      }
      this._cachedConverter = conv;
      this._converterDirty = false;
    }
    return this._cachedConverter;
  }

  /**
   * 현재 기본 프로토콜.
   *
   * writeProtocol이 설정되어 있으면 writeProtocol 반환.
   */
  get defaultProtocol(): string {
    return this._writeProtocol ?? this._defaultProtocol;
  }

  /** 등록된 프로토콜 이름 목록 (감지 순서). */
  get registeredProtocols(): readonly string[] {
    return this._order.map((p) => p.name);
  }

  // ── Internal ─────────────────────────────────────────────────────────────

  /** 프로토콜을 내부 맵과 감지 순서에 등록. */
  private _registerInternal(protocol: AddressProtocol): void {
    const existed = this._protocols.has(protocol.name);
    this._protocols.set(protocol.name, protocol);

    if (existed) {
      this._order = this._order.map((p) =>
        p.name === protocol.name ? protocol : p
      );
    } else if (protocol.name.startsWith("layout:")) {
      const firstTextIdx = this._order.findIndex(
        (p) => !p.name.startsWith("layout:")
      );
      if (firstTextIdx >= 0) {
        this._order.splice(firstTextIdx, 0, protocol);
      } else {
        this._order.push(protocol);
      }
    } else {
      this._order.push(protocol);
    }
  }

  /** 이름으로 프로토콜 조회. 없으면 ParseError. */
  private _requireProtocol(name: string): AddressProtocol {
    const p = this._protocols.get(name);
    if (!p) throw new ParseError(`Unknown protocol "${name}"`);
    return p;
  }

  /** 등록된 프로토콜을 감지 순서대로 시도. */
  private _autoDetect(input: string): SemanticAddress {
    for (const proto of this._order) {
      if (proto.test(input)) return proto.parse(input);
    }
    throw new ParseError(`Cannot detect protocol for "${input}"`);
  }

  /** readProtocols 집합에 포함된 프로토콜만으로 자동 감지. */
  private _parseWithReadProtocols(input: string): SemanticAddress {
    for (const proto of this._order) {
      if (this._readProtocols!.has(proto.name) && proto.test(input)) {
        return proto.parse(input);
      }
    }
    throw new ParseError(
      `No read protocol matches "${input}". ` +
        `Allowed: [${[...this._readProtocols!].join(", ")}]`
    );
  }

  /** fallback 체인 순서대로 시도. 통계 수집. */
  private _parseWithFallback(input: string): SemanticAddress {
    for (const name of this._fallbackChain!) {
      const proto = this._protocols.get(name);
      if (!proto) continue;

      const stats = this._fallbackStats.get(name);
      if (stats) stats.attempted++;

      try {
        if (proto.test(input)) {
          const addr = proto.parse(input);
          if (stats) stats.succeeded++;
          return addr;
        }
      } catch {
        // parse threw — try next protocol
        continue;
      }
    }
    throw new ParseError(
      `All fallback protocols failed for "${input}": ` +
        `[${this._fallbackChain!.join(", ")}]`
    );
  }
}
