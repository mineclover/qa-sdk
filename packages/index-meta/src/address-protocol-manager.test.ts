import { describe, it, expect } from "vitest";
import {
  PACK_FORMATS,
  type AddressProtocol,
  type SemanticAddress,
} from "weighted-index";
import { AddressProtocolManager } from "./address-protocol-manager.js";
import { MetaRegistry } from "./meta-registry.js";
import {
  ParseError,
  ValidationError,
  NegotiationError,
} from "./errors.js";
import type { AddressConfig, MetaRegistryInput } from "./types.js";

// ── 테스트 픽스처 ────────────────────────────────────────────────────────────

const testConfig: AddressConfig = {
  format: PACK_FORMATS.uuid,
  schemaChars: 4,
  versionChars: 2,
  schemas: { perm: 1, content: 2 },
  versions: { v1: 1, v2: 2 },
};

/** 커스텀 프로토콜 (§18 테스트용) */
function makeCustomProtocol(
  name: string,
  prefix: string
): AddressProtocol {
  return {
    name,
    test: (input: string) => input.startsWith(`${prefix}:`),
    serialize: (addr: SemanticAddress) =>
      `${prefix}:${addr.schema}|${addr.version}|${addr.index}`,
    parse: (input: string) => {
      const body = input.slice(prefix.length + 1);
      const [schema, version, indexStr] = body.split("|");
      return { schema, version, index: Number(indexStr) };
    },
  };
}

/** MetaRegistryInput (§19 테스트용) */
const registryInput: MetaRegistryInput = {
  dims: {
    role: {
      kind: { type: "string_enum" },
      snapshots: {
        v1: { entries: ["admin", "editor", "viewer"] },
      },
    },
    action: {
      kind: { type: "string_enum" },
      snapshots: {
        v1: { entries: ["read", "write", "delete"] },
      },
    },
  },
  indices: {
    perm: {
      dims: ["role", "action"],
      versions: {
        iv1: { snapshots: { role: "v1", action: "v1" } },
      },
    },
  },
};

// ═══════════════════════════════════════════════════════════════════════════
//  §16-detect. Format Detection
// ═══════════════════════════════════════════════════════════════════════════

describe("detect", () => {
  it("text 프로토콜 감지", () => {
    const manager = new AddressProtocolManager();
    expect(manager.detect("perm:v1:42")).toBe("colon");
    expect(manager.detect("wi://perm/v1/42")).toBe("uri");
    expect(manager.detect("perm-v1-42")).toBe("compact");
  });

  it("매칭 없으면 null", () => {
    const manager = new AddressProtocolManager();
    expect(manager.detect("???")).toBeNull();
  });

  it("layout 프로토콜 감지", () => {
    const manager = new AddressProtocolManager(testConfig);
    const vv = { indexId: "perm", versionId: "v1", value: 42 };
    const uuid = manager.serialize(vv);
    expect(manager.detect(uuid)).toMatch(/^layout:/);
  });

  it("layout이 text보다 우선 감지", () => {
    const manager = new AddressProtocolManager(testConfig);
    const vv = { indexId: "perm", versionId: "v1", value: 42 };
    const uuid = manager.serialize(vv);
    // UUID 형식은 layout으로 감지되어야 함
    const detected = manager.detect(uuid);
    expect(detected).not.toBe("colon");
    expect(detected).toMatch(/^layout:/);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
//  §17. Loose Address Parsing (registry 없는 주소 파싱)
// ═══════════════════════════════════════════════════════════════════════════

describe("§17-0 loose vs validated parse 분기", () => {
  it("LOOSE-0: 동일 PK — address.parse 통과, reg.parse ParseError", () => {
    const inputWithAddress: MetaRegistryInput = {
      ...registryInput,
      address: {
        format: PACK_FORMATS.uuid,
        schemaChars: 4,
        versionChars: 2,
        schemas: { perm: 1 },
        versions: { iv1: 1 },
      },
    };
    const reg = new MetaRegistry(inputWithAddress);

    const bigVV = { indexId: "perm", versionId: "iv1", value: 999999 };
    const pk = reg.address.serialize(bigVV);

    // loose: value 범위 검증 안 함 → 통과
    expect(reg.address.parse(pk)).toEqual(bigVV);

    // validated: registry 검증 → value 범위 초과 → ParseError
    expect(() => reg.parse(pk)).toThrow(ParseError);
  });
});

describe("§17-1 로그 파서 / 감사 도구", () => {
  it("LOOSE-1: 폐기 스키마 UUID 파싱 — registry 없이 VV 추출", () => {
    const manager = new AddressProtocolManager(testConfig);
    const vv = { indexId: "perm", versionId: "v1", value: 42 };
    const uuid = manager.serialize(vv);

    // registry 없이 loose parse
    const parsed = manager.parse(uuid);
    expect(parsed).toEqual(vv);
  });

  it("LOOSE-2: 미등록 schema 숫자 → 명시적 에러", () => {
    const manager = new AddressProtocolManager(testConfig);
    // schema=99 (0x0063)는 매핑에 없음
    const fakeUUID = "00630001-0000-0000-0000-000000000000";
    expect(() => manager.parse(fakeUUID)).toThrow();
  });

  it("LOOSE-3: value 범위 무검증 — registry가 없으므로 범위 검증 없음", () => {
    const manager = new AddressProtocolManager(testConfig);
    // 매우 큰 value로 serialize → parse: AddressProtocolManager는 범위 검증 안 함
    const vv = { indexId: "perm", versionId: "v1", value: 999999 };
    const uuid = manager.serialize(vv);
    const parsed = manager.parse(uuid);
    expect(parsed).toEqual(vv);
  });
});

describe("§17-2 프록시 / 라우터", () => {
  it("LOOSE-4: schema-only 파싱 — UUID에서 schema만 추출", () => {
    const manager = new AddressProtocolManager(testConfig);
    const vv = { indexId: "perm", versionId: "v1", value: 42 };
    const uuid = manager.serialize(vv);

    const result = manager.parseSchemaOnly(uuid);
    expect(result).toEqual({ schema: "perm" });
  });

  it("LOOSE-5: 라우팅 결정 — schema로 서비스 매핑", () => {
    const router = new AddressProtocolManager(testConfig);
    const routeMap: Record<string, string> = {
      perm: "perm-service:8080",
      content: "content-service:8081",
    };

    const permUUID = router.serialize(
      { indexId: "perm", versionId: "v1", value: 0 }
    );
    const contentUUID = router.serialize(
      { indexId: "content", versionId: "v2", value: 5 }
    );

    expect(routeMap[router.parseSchemaOnly(permUUID).schema]).toBe(
      "perm-service:8080"
    );
    expect(routeMap[router.parseSchemaOnly(contentUUID).schema]).toBe(
      "content-service:8081"
    );
  });

  it("LOOSE-6: 미등록 schema 라우팅 → ParseError", () => {
    const router = new AddressProtocolManager(testConfig);
    // schema=99 (0x0063)는 매핑에 없음
    const fakeUUID = "00630001-0000-0000-0000-000000000000";
    expect(() => router.parseSchemaOnly(fakeUUID)).toThrow(ParseError);
  });

  it("LOOSE-4 변형: versions 없이도 parseSchemaOnly 동작", () => {
    // 라우터는 version 상세가 불필요 — empty versions
    const router = new AddressProtocolManager({
      format: PACK_FORMATS.uuid,
      schemaChars: 4,
      versionChars: 2,
      schemas: { perm: 1, content: 2, billing: 3 },
      versions: {}, // 라우팅에 불필요
    });

    // schema=perm(0x0001)인 UUID
    const uuid = "00010001-0000-0000-0000-000000000000";
    expect(router.parseSchemaOnly(uuid)).toEqual({ schema: "perm" });

    // schema=billing(0x0003)
    const uuid2 = "00030001-0000-0000-0000-000000000000";
    expect(router.parseSchemaOnly(uuid2)).toEqual({ schema: "billing" });
  });
});

describe("§17-3 포맷 변환기", () => {
  it("LOOSE-7: UUID → colon 변환", () => {
    const manager = new AddressProtocolManager(testConfig);
    const vv = { indexId: "perm", versionId: "v1", value: 42 };
    const uuid = manager.serialize(vv);

    const colon = manager.convert(uuid, "colon");
    expect(colon).toBe("perm:v1:42");
  });

  it("LOOSE-8: colon → UUID 변환 (역방향 round-trip)", () => {
    const manager = new AddressProtocolManager(testConfig);
    const vv = { indexId: "perm", versionId: "v1", value: 42 };
    const uuid = manager.serialize(vv);

    const colon = manager.convert(uuid, "colon");
    const uuidAgain = manager.convert(colon, "layout:uuid");
    expect(uuidAgain).toBe(uuid);
  });

  it("LOOSE-9: UUID → int64 변환 (cross-format)", () => {
    const int64Config: AddressConfig = {
      format: PACK_FORMATS.int64,
      schemaChars: 4,
      versionChars: 2,
      schemas: { perm: 1 },
      versions: { v1: 1 },
    };
    const manager = new AddressProtocolManager(int64Config);
    const vv = { indexId: "perm", versionId: "v1", value: 42 };

    const int64 = manager.serialize(vv);
    const colon = manager.convert(int64, "colon");
    expect(colon).toBe("perm:v1:42");

    const int64Again = manager.convert(colon, "layout:int64");
    expect(int64Again).toBe(int64);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
//  §18. Protocol Lifecycle Management
// ═══════════════════════════════════════════════════════════════════════════

describe("§18-1 런타임 protocol 등록/해제", () => {
  it("PROTO-DYN-1: register 후 해당 프로토콜로 serialize/parse 정상", () => {
    const manager = new AddressProtocolManager();
    const custom = makeCustomProtocol("custom:partner-a", "PARTNER_A");
    manager.register(custom);

    const vv = { indexId: "perm", versionId: "v1", value: 42 };
    const serialized = manager.serialize(vv, "custom:partner-a");
    expect(serialized).toBe("PARTNER_A:perm|v1|42");

    const parsed = manager.parse(serialized);
    expect(parsed).toEqual(vv);
  });

  it("PROTO-DYN-2: unregister 후 사용 시 에러", () => {
    const manager = new AddressProtocolManager();
    const custom = makeCustomProtocol("custom:partner-a", "PARTNER_A");
    manager.register(custom);

    const vv = { indexId: "perm", versionId: "v1", value: 42 };
    const serialized = manager.serialize(vv, "custom:partner-a");
    expect(serialized).toBe("PARTNER_A:perm|v1|42");

    manager.unregister("custom:partner-a");
    expect(() =>
      manager.serialize(vv, "custom:partner-a")
    ).toThrow(ParseError);
  });

  it("PROTO-DYN-3: unregister 후 나머지 프로토콜 정상 동작", () => {
    const manager = new AddressProtocolManager();
    const vv = { indexId: "perm", versionId: "v1", value: 42 };

    // colon 해제
    manager.unregister("colon");

    // uri/compact 등 나머지 프로토콜은 정상 동작
    const uriPK = manager.serialize(vv, "uri");
    expect(manager.parse(uriPK)).toEqual(vv);

    const compactPK = manager.serialize(vv, "compact");
    expect(manager.parse(compactPK)).toEqual(vv);
  });

  it("PROTO-DYN-4: 동일 이름 register 교체 — 중복 없음", () => {
    const manager = new AddressProtocolManager();
    const v1 = makeCustomProtocol("custom:x", "X1");
    const v2 = makeCustomProtocol("custom:x", "X2");

    manager.register(v1);
    const vv = { indexId: "a", versionId: "b", value: 1 };
    expect(manager.serialize(vv, "custom:x")).toBe("X1:a|b|1");

    // 같은 이름으로 재등록 → 교체
    manager.register(v2);
    expect(manager.serialize(vv, "custom:x")).toBe("X2:a|b|1");

    // 목록에 중복 없음
    const count = manager.registeredProtocols.filter(
      (n) => n === "custom:x"
    ).length;
    expect(count).toBe(1);
  });

  it("미등록 프로토콜 unregister 시 ValidationError", () => {
    const manager = new AddressProtocolManager();
    expect(() => manager.unregister("nonexistent")).toThrow(ValidationError);
  });

  it("registeredProtocols가 현재 등록된 프로토콜 목록 반환", () => {
    const manager = new AddressProtocolManager();
    expect(manager.registeredProtocols).toContain("colon");
    expect(manager.registeredProtocols).toContain("uri");
    expect(manager.registeredProtocols).toContain("compact");
  });
});

describe("§18-2 Format negotiation", () => {
  it("PROTO-NEG-1: 공통 포맷 선택 + 레거시 fallback", () => {
    const manager = new AddressProtocolManager(testConfig);

    // 양쪽 모두 지원 → 서버 우선순위 최우선
    expect(
      manager.negotiate(["layout:uuid", "colon"], ["layout:uuid", "colon"])
    ).toBe("layout:uuid");

    // UUID 미지원 → colon으로 자동 fallback
    expect(
      manager.negotiate(["colon", "compact"], ["layout:uuid", "colon"])
    ).toBe("colon");
  });

  it("PROTO-NEG-2: 공통 없음 → NegotiationError", () => {
    const manager = new AddressProtocolManager(testConfig);
    expect(() =>
      manager.negotiate(["custom:v3"], ["layout:uuid", "colon"])
    ).toThrow(NegotiationError);
  });
});

describe("§18-3 Protocol versioning", () => {
  const v4Proto = makeCustomProtocol("layout:uuid-v4", "V4");
  const v7Proto = makeCustomProtocol("layout:uuid-v7", "V7");

  it("PROTO-VER-1: write/read 프로토콜 분리", () => {
    const manager = new AddressProtocolManager();
    manager.register(v4Proto);
    manager.register(v7Proto);

    manager.setWriteProtocol("layout:uuid-v7");

    const vv = { indexId: "perm", versionId: "v1", value: 42 };
    const pk = manager.serialize(vv);
    // writeProtocol이 v7이므로 V7 형식
    expect(pk).toBe("V7:perm|v1|42");
  });

  it("PROTO-VER-2: 전환 기간 — v4와 v7 모두 파싱 가능", () => {
    const manager = new AddressProtocolManager();
    manager.register(v4Proto);
    manager.register(v7Proto);
    manager.setWriteProtocol("layout:uuid-v7");
    manager.addReadProtocol("layout:uuid-v4");

    const vv = { indexId: "perm", versionId: "v1", value: 42 };

    // v7 PK 파싱
    const v7pk = "V7:perm|v1|42";
    expect(manager.parse(v7pk)).toEqual(vv);

    // v4 PK도 파싱 가능
    const v4pk = "V4:perm|v1|42";
    expect(manager.parse(v4pk)).toEqual(vv);
  });

  it("PROTO-VER-3: 전환 완료 후 — v4 파싱 차단", () => {
    const manager = new AddressProtocolManager();
    manager.register(v4Proto);
    manager.register(v7Proto);
    manager.setWriteProtocol("layout:uuid-v7");
    manager.addReadProtocol("layout:uuid-v4");

    // 전환 기간: v4 파싱 가능
    expect(manager.parse("V4:perm|v1|42")).toBeTruthy();

    // 전환 완료: v4 제거
    manager.removeReadProtocol("layout:uuid-v4");

    // v4 파싱 차단
    expect(() => manager.parse("V4:perm|v1|42")).toThrow(ParseError);

    // v7은 여전히 가능
    expect(manager.parse("V7:perm|v1|42")).toEqual({
      indexId: "perm",
      versionId: "v1",
      value: 42,
    });
  });

  it("PROTO-VER-4: 전환 중 round-trip (v4 parse → v7 serialize → v7 parse)", () => {
    const manager = new AddressProtocolManager();
    manager.register(v4Proto);
    manager.register(v7Proto);
    manager.setWriteProtocol("layout:uuid-v7");
    manager.addReadProtocol("layout:uuid-v4");

    const vv = { indexId: "perm", versionId: "v1", value: 42 };

    // v4 parse → v7 serialize
    const parsed = manager.parse("V4:perm|v1|42");
    const v7pk = manager.serialize(parsed);
    expect(v7pk).toBe("V7:perm|v1|42");

    // v7 parse → 동일 VV
    expect(manager.parse(v7pk)).toEqual(vv);
  });
});

describe("§18-4 Fallback chain", () => {
  it("PROTO-FB-1: 첫 프로토콜 성공 — fallback 미발생", () => {
    const manager = new AddressProtocolManager(testConfig);
    manager.setFallbackChain(["layout:uuid", "colon", "uri"]);

    const vv = { indexId: "perm", versionId: "v1", value: 42 };
    const uuid = manager.serialize(vv, "layout:uuid");

    const parsed = manager.parse(uuid);
    expect(parsed).toEqual(vv);

    const stats = manager.getFallbackStats();
    expect(stats["layout:uuid"].attempted).toBe(1);
    expect(stats["layout:uuid"].succeeded).toBe(1);
    expect(stats["colon"].attempted).toBe(0);
  });

  it("PROTO-FB-2: fallback 성공 — 첫 번째 실패 → 두 번째 성공", () => {
    const manager = new AddressProtocolManager(testConfig);
    manager.setFallbackChain(["layout:uuid", "colon", "uri"]);

    // colon 형식 입력 → uuid에서 실패 → colon에서 성공
    const parsed = manager.parse("perm:v1:42");
    expect(parsed).toEqual({
      indexId: "perm",
      versionId: "v1",
      value: 42,
    });

    const stats = manager.getFallbackStats();
    expect(stats["layout:uuid"].attempted).toBe(1);
    expect(stats["layout:uuid"].succeeded).toBe(0);
    expect(stats["colon"].attempted).toBe(1);
    expect(stats["colon"].succeeded).toBe(1);
  });

  it("PROTO-FB-3: 전체 실패 → ParseError (시도 목록 포함)", () => {
    const manager = new AddressProtocolManager(testConfig);
    manager.setFallbackChain(["layout:uuid", "colon"]);

    expect(() => manager.parse("completely-invalid")).toThrow(ParseError);
  });

  it("PROTO-FB-4: fallback 메트릭 — 프로토콜별 시도/성공 추적", () => {
    const manager = new AddressProtocolManager(testConfig);
    manager.setFallbackChain(["layout:uuid", "colon"]);

    const vv = { indexId: "perm", versionId: "v1", value: 0 };
    const uuid = manager.serialize(vv, "layout:uuid");

    // 3번 uuid 파싱
    manager.parse(uuid);
    manager.parse(uuid);
    manager.parse(uuid);

    // 2번 colon 파싱
    manager.parse("perm:v1:0");
    manager.parse("perm:v1:1");

    const stats = manager.getFallbackStats();
    expect(stats["layout:uuid"]).toEqual({ attempted: 5, succeeded: 3 });
    expect(stats["colon"]).toEqual({ attempted: 2, succeeded: 2 });
  });

  it("PROTO-FB-5: fallback vs readProtocols — fallback 우선", () => {
    const manager = new AddressProtocolManager(testConfig);

    // readProtocols 설정: colon만 허용
    manager.addReadProtocol("colon");
    manager.removeReadProtocol("layout:uuid");
    manager.removeReadProtocol("uri");
    manager.removeReadProtocol("compact");

    // fallback 설정: uuid → colon
    manager.setFallbackChain(["layout:uuid", "colon"]);

    // readProtocols에서 uuid를 제거했지만, fallback이 우선 → uuid도 파싱 가능
    const vv = { indexId: "perm", versionId: "v1", value: 42 };
    const uuid = manager.serialize(vv, "layout:uuid");
    expect(manager.parse(uuid)).toEqual(vv);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
//  §19. Schema-only Registry Consumer (직렬화 없는 스키마 소비)
// ═══════════════════════════════════════════════════════════════════════════

describe("§19-1 CI/CD 스키마 검증 서비스", () => {
  it("SCHEMA-ONLY-1: address 없이 스키마 조회 정상", () => {
    const reg = new MetaRegistry(registryInput); // address 미설정

    expect(reg.getDimDef("role").kind).toEqual({ type: "string_enum" });
    expect(reg.getIndexDef("perm").dims).toEqual(["role", "action"]);
    expect(reg.getIndexVersion("perm", "iv1").snapshots).toEqual({
      role: "v1",
      action: "v1",
    });
  });

  it("SCHEMA-ONLY-2: dim/index 정합성 검증 — 조회 API만으로 무결성 확인", () => {
    const reg = new MetaRegistry(registryInput);

    const manifest = reg.getActiveManifest("perm", "iv1");
    expect(manifest.dims).toHaveLength(2);
    expect(manifest.dims[0].dimId).toBe("role");
    expect(manifest.dims[0].activeIndices).toEqual([1, 2, 3]);
    expect(manifest.dims[1].dimId).toBe("action");
    expect(manifest.dims[1].activeIndices).toEqual([1, 2, 3]);

    expect(reg.dimIds).toEqual(["role", "action"]);
    expect(reg.indexIds).toEqual(["perm"]);
    expect(reg.getVersionIds("perm")).toEqual(["iv1"]);
    expect(reg.getSnapshotIds("role")).toEqual(["v1"]);
  });

  it("SCHEMA-ONLY-3: address 포함 input으로 생성해도 조회 API 동작 변화 없음", () => {
    const inputWithAddress: MetaRegistryInput = {
      ...registryInput,
      address: {
        format: PACK_FORMATS.uuid,
        schemaChars: 4,
        versionChars: 2,
        schemas: { perm: 1 },
        versions: { iv1: 1 },
      },
    };

    const regWithout = new MetaRegistry(registryInput);
    const regWith = new MetaRegistry(inputWithAddress);

    // 스키마 조회 결과 동일
    expect(regWith.getDimDef("role")).toEqual(regWithout.getDimDef("role"));
    expect(regWith.getIndexDef("perm")).toEqual(
      regWithout.getIndexDef("perm")
    );
    expect(regWith.getActiveManifest("perm", "iv1")).toEqual(
      regWithout.getActiveManifest("perm", "iv1")
    );
  });
});

describe("§19-2 Edge 배포 경량 registry", () => {
  it("SCHEMA-ONLY-4: address 미설정 시 createCodec → encode/decode 정상", () => {
    const reg = new MetaRegistry(registryInput); // address 미설정
    const codec = reg.createCodec("perm", "iv1");

    const vv = codec.encode({ role: "editor", action: "write" });
    expect(vv).toEqual({ indexId: "perm", versionId: "iv1", value: 4 });

    const decoded = codec.decode(vv);
    expect(decoded).toEqual({ role: "editor", action: "write" });
  });

  it("SCHEMA-ONLY-5: address 미설정 시 text 프로토콜(colon/uri) 사용 가능", () => {
    const reg = new MetaRegistry(registryInput);
    const codec = reg.createCodec("perm", "iv1");

    const vv = codec.encode({ role: "admin", action: "read" });
    const colon = reg.serialize(vv, "colon");
    expect(colon).toBe("perm:iv1:0");

    const parsed = reg.parse(colon);
    expect(codec.decode(parsed)).toEqual({ role: "admin", action: "read" });
  });

  it("SCHEMA-ONLY-6: 동일 입력 분할 사용 — edge(codec) + origin(serialize/parse)", () => {
    const inputWithAddress: MetaRegistryInput = {
      ...registryInput,
      address: {
        format: PACK_FORMATS.uuid,
        schemaChars: 4,
        versionChars: 2,
        schemas: { perm: 1 },
        versions: { iv1: 1 },
      },
    };

    // Edge: codec만 사용 (address 불필요)
    const edgeReg = new MetaRegistry(registryInput);
    const edgeCodec = edgeReg.createCodec("perm", "iv1");
    const vv = edgeCodec.encode({ role: "viewer", action: "delete" });

    // Origin: serialize/parse 사용
    const originReg = new MetaRegistry(inputWithAddress);
    const pk = originReg.serialize(vv);
    const restored = originReg.parse(pk);

    // Edge에서 decode
    expect(edgeCodec.decode(restored)).toEqual({
      role: "viewer",
      action: "delete",
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════════
//  Edge cases — 커버리지 갭 보완
// ═══════════════════════════════════════════════════════════════════════════

describe("serialize/parse 경계 조건", () => {
  it("serialize에 AddressProtocol 객체를 직접 전달", () => {
    const manager = new AddressProtocolManager();
    const custom = makeCustomProtocol("custom:x", "X");
    // register 하지 않아도 객체 직접 전달은 동작
    const vv = { indexId: "perm", versionId: "v1", value: 7 };
    const result = manager.serialize(vv, custom);
    expect(result).toBe("X:perm|v1|7");
  });

  it("parse에 AddressProtocol 객체를 직접 전달", () => {
    const manager = new AddressProtocolManager();
    const custom = makeCustomProtocol("custom:x", "X");
    const parsed = manager.parse("X:perm|v1|7", custom);
    expect(parsed).toEqual({ indexId: "perm", versionId: "v1", value: 7 });
  });

  it("parse에 명시적 프로토콜 이름 전달", () => {
    const manager = new AddressProtocolManager();
    const parsed = manager.parse("perm:v1:42", "colon");
    expect(parsed).toEqual({ indexId: "perm", versionId: "v1", value: 42 });
  });

  it("parse에 미등록 프로토콜 이름 → ParseError", () => {
    const manager = new AddressProtocolManager();
    expect(() => manager.parse("x", "nonexistent")).toThrow(ParseError);
  });

  it("parseSchemaOnly — layout 없이 text protocol fallback", () => {
    const manager = new AddressProtocolManager(); // config 없음
    const result = manager.parseSchemaOnly("perm:v1:42");
    expect(result).toEqual({ schema: "perm" });
  });
});

describe("register 덮어쓰기", () => {
  it("동일 이름 register 시 기존 프로토콜 교체", () => {
    const manager = new AddressProtocolManager();
    const v1 = makeCustomProtocol("custom:x", "X1");
    const v2 = makeCustomProtocol("custom:x", "X2");

    manager.register(v1);
    const vv = { indexId: "a", versionId: "b", value: 1 };
    expect(manager.serialize(vv, "custom:x")).toBe("X1:a|b|1");

    // 같은 이름으로 재등록 → 교체
    manager.register(v2);
    expect(manager.serialize(vv, "custom:x")).toBe("X2:a|b|1");

    // 목록에 중복 없음
    const count = manager.registeredProtocols.filter(
      (n) => n === "custom:x"
    ).length;
    expect(count).toBe(1);
  });
});

describe("unregister 연쇄 정리", () => {
  it("defaultProtocol이 제거되면 첫 번째 프로토콜로 대체", () => {
    const manager = new AddressProtocolManager(testConfig);
    expect(manager.defaultProtocol).toBe("layout:uuid");

    manager.unregister("layout:uuid");
    // layout:uuid 제거 → 남은 프로토콜 중 첫 번째로 대체
    expect(manager.registeredProtocols).not.toContain("layout:uuid");
    expect(manager.defaultProtocol).toBe(manager.registeredProtocols[0]);
  });

  it("writeProtocol이 제거되면 undefined로 리셋", () => {
    const manager = new AddressProtocolManager();
    const custom = makeCustomProtocol("custom:w", "W");
    manager.register(custom);
    manager.setWriteProtocol("custom:w");
    expect(manager.defaultProtocol).toBe("custom:w");

    manager.unregister("custom:w");
    // writeProtocol 리셋 → defaultProtocol로 복귀
    expect(manager.defaultProtocol).toBe("colon");
  });

  it("readProtocols에서도 제거됨", () => {
    const manager = new AddressProtocolManager();
    const custom = makeCustomProtocol("custom:r", "R");
    manager.register(custom);
    manager.addReadProtocol("custom:r");

    // custom:r이 read set에 있는 상태에서 unregister
    manager.unregister("custom:r");

    // R: 형식 파싱 불가 (등록 자체가 없어짐)
    expect(() => manager.parse("R:a|b|1")).toThrow(ParseError);
  });

  it("fallbackChain에서도 제거됨", () => {
    const manager = new AddressProtocolManager();
    const custom = makeCustomProtocol("custom:f", "F");
    manager.register(custom);
    manager.setFallbackChain(["custom:f", "colon"]);

    manager.unregister("custom:f");

    // colon만 남아서 colon 파싱은 정상
    expect(manager.parse("perm:v1:0")).toEqual({
      indexId: "perm",
      versionId: "v1",
      value: 0,
    });
  });
});

describe("removeReadProtocol / setFallbackChain 경계", () => {
  it("removeReadProtocol — 읽기 집합에 없는 이름 → ValidationError", () => {
    const manager = new AddressProtocolManager();
    manager.addReadProtocol("colon"); // 초기화
    expect(() => manager.removeReadProtocol("nonexistent")).toThrow(
      ValidationError
    );
  });

  it("setFallbackChain — 미등록 프로토콜 포함 시 ParseError", () => {
    const manager = new AddressProtocolManager();
    expect(() =>
      manager.setFallbackChain(["colon", "nonexistent"])
    ).toThrow(ParseError);
  });
});

describe("converter 캐시", () => {
  it("연속 호출 시 동일 인스턴스 반환 (캐시 히트)", () => {
    const manager = new AddressProtocolManager();
    const conv1 = manager.converter;
    const conv2 = manager.converter;
    expect(conv1).toBe(conv2);
  });

  it("register 후 새 인스턴스 반환 (캐시 무효화)", () => {
    const manager = new AddressProtocolManager();
    const conv1 = manager.converter;

    manager.register(makeCustomProtocol("custom:c", "C"));
    const conv2 = manager.converter;
    expect(conv2).not.toBe(conv1);
    expect(conv2.protocols()).toContain("custom:c");
  });

  it("unregister 후 해당 프로토콜이 converter에서 제거됨", () => {
    const manager = new AddressProtocolManager();
    const custom = makeCustomProtocol("custom:d", "D");
    manager.register(custom);
    expect(manager.converter.protocols()).toContain("custom:d");

    manager.unregister("custom:d");
    expect(manager.converter.protocols()).not.toContain("custom:d");
  });
});

describe("defaultProtocol getter", () => {
  it("writeProtocol 설정 시 defaultProtocol이 반영됨", () => {
    const manager = new AddressProtocolManager();
    expect(manager.defaultProtocol).toBe("colon");

    manager.setWriteProtocol("uri");
    expect(manager.defaultProtocol).toBe("uri");
  });
});

// ═══════════════════════════════════════════════════════════════════════════
//  MetaRegistry.address 통합
// ═══════════════════════════════════════════════════════════════════════════

describe("MetaRegistry.address 통합", () => {
  it("reg.address가 AddressProtocolManager 인스턴스", () => {
    const reg = new MetaRegistry(registryInput);
    expect(reg.address).toBeInstanceOf(AddressProtocolManager);
  });

  it("reg.address.parse()는 registry 검증 없음 (loose)", () => {
    const inputWithAddress: MetaRegistryInput = {
      ...registryInput,
      address: {
        format: PACK_FORMATS.uuid,
        schemaChars: 4,
        versionChars: 2,
        schemas: { perm: 1 },
        versions: { iv1: 1 },
      },
    };
    const reg = new MetaRegistry(inputWithAddress);
    const codec = reg.createCodec("perm", "iv1");

    // 매우 큰 value — reg.parse()는 범위 검증으로 에러, address.parse()는 통과
    const bigVV = { indexId: "perm", versionId: "iv1", value: 999999 };
    const pk = reg.address.serialize(bigVV);

    // loose parse: 통과
    expect(reg.address.parse(pk)).toEqual(bigVV);

    // registry parse: 범위 검증으로 에러
    expect(() => reg.parse(pk)).toThrow(ParseError);
  });

  it("reg.serialize/parse는 기존 동작 유지 (backward compat)", () => {
    const inputWithAddress: MetaRegistryInput = {
      ...registryInput,
      address: {
        format: PACK_FORMATS.uuid,
        schemaChars: 4,
        versionChars: 2,
        schemas: { perm: 1 },
        versions: { iv1: 1 },
      },
    };
    const reg = new MetaRegistry(inputWithAddress);
    const codec = reg.createCodec("perm", "iv1");

    const vv = codec.encode({ role: "admin", action: "read" });
    const pk = reg.serialize(vv);
    const parsed = reg.parse(pk);
    expect(codec.decode(parsed)).toEqual({ role: "admin", action: "read" });
  });

  it("converter getter가 backward compat 유지", () => {
    const inputWithAddress: MetaRegistryInput = {
      ...registryInput,
      address: {
        format: PACK_FORMATS.uuid,
        schemaChars: 4,
        versionChars: 2,
        schemas: { perm: 1 },
        versions: { iv1: 1 },
      },
    };
    const reg = new MetaRegistry(inputWithAddress);

    const conv = reg.converter;
    expect(conv.protocols()).toContain("layout:uuid");
    expect(conv.protocols()).toContain("colon");

    // convert via converter
    const result = conv.convert("perm:iv1:0", "layout:uuid");
    expect(result).toBeTruthy();
  });
});
