/**
 * SDK 라이프사이클 운영 시나리오 E2E 테스트
 *
 * 클라이언트·서버 SDK의 전체 운영 동선을 실제 서비스 시나리오로 검증한다.
 *
 * ── 시나리오 구조 ──
 *
 * §20  SDK 소비 라이프사이클: 스키마 정의 → SDK → client → encode/decode → constants
 * §21  엔트리 제공 모드: Client(entries) vs Full(dimFullView) 모드 운영
 * §22  스키마 진화·SDK 동기화: entry 추가 → headroom 변화 → SDK 재생성
 * §23  멀티 서비스 스키마 공유: 프론트엔드·백엔드 독립 운용 + DecodeMap 전달
 * §24  CLI 시뮬레이션: info, capacity, constants, diff를 SDK API로 재현
 */

import { describe, it, expect } from "vitest";
import { createIndexSDK, RESERVED_TOKENS } from "./index-sdk.js";
import { MetaCodec } from "./meta-codec.js";
import { MetaResolver } from "./meta-resolver.js";
import { MetaRegistry } from "./meta-registry.js";
import type { MetaRegistryInput, VersionedValue } from "./types.js";
import { DimNotFoundError, EntryNotFoundError, ValidationError } from "./errors.js";

// ══════════════════════════════════════════════════════════════════════════════
// 공유 스키마: SaaS 권한 관리 시스템
//
// 실제 서비스에서 사용하는 수준의 스키마 설계:
// - role: 사용자 역할 (예약 토큰 + headroom 포함)
// - action: 수행 가능 동작 (예약 토큰 포함)
// - resource: 대상 리소스 (headroom 포함)
// ══════════════════════════════════════════════════════════════════════════════

/** v1 스키마: 초기 배포 */
const PERM_SCHEMA_V1: MetaRegistryInput = {
  dims: {
    role: {
      kind: { type: "string_enum" },
      description: 'reserved: [1]="_" (미지정), [2]="~" (기타)',
      snapshots: {
        sv1: {
          entries: ["_", "~", "admin", "editor", "viewer"],
          capacity: 10,
        },
      },
    },
    action: {
      kind: { type: "string_enum" },
      description: 'reserved: [1]="_" (해당없음)',
      snapshots: {
        sv1: {
          entries: ["_", "read", "write", "delete"],
          capacity: 8,
        },
      },
    },
    resource: {
      kind: { type: "string_enum" },
      snapshots: {
        sv1: {
          entries: ["post", "comment", "user"],
          capacity: 8,
        },
      },
    },
  },
  indices: {
    perm: {
      dims: ["role", "action", "resource"],
      versions: {
        v1: { snapshots: { role: "sv1", action: "sv1", resource: "sv1" } },
      },
    },
  },
};

/** v2 스키마: role에 moderator 추가, action에 approve 추가 */
const PERM_SCHEMA_V2: MetaRegistryInput = {
  dims: {
    role: {
      kind: { type: "string_enum" },
      description: 'reserved: [1]="_" (미지정), [2]="~" (기타)',
      snapshots: {
        sv1: {
          entries: ["_", "~", "admin", "editor", "viewer"],
          capacity: 10,
        },
        sv2: {
          entries: ["_", "~", "admin", "editor", "viewer", "moderator"],
          capacity: 10,
        },
      },
      migrations: [
        { fromSnapshotId: "sv1", toSnapshotId: "sv2", indexMap: {} },
      ],
    },
    action: {
      kind: { type: "string_enum" },
      description: 'reserved: [1]="_" (해당없음)',
      snapshots: {
        sv1: {
          entries: ["_", "read", "write", "delete"],
          capacity: 8,
        },
        sv2: {
          entries: ["_", "read", "write", "delete", "approve"],
          capacity: 8,
        },
      },
      migrations: [
        { fromSnapshotId: "sv1", toSnapshotId: "sv2", indexMap: {} },
      ],
    },
    resource: {
      kind: { type: "string_enum" },
      snapshots: {
        sv1: {
          entries: ["post", "comment", "user"],
          capacity: 8,
        },
      },
    },
  },
  indices: {
    perm: {
      dims: ["role", "action", "resource"],
      versions: {
        v1: { snapshots: { role: "sv1", action: "sv1", resource: "sv1" } },
        v2: { snapshots: { role: "sv2", action: "sv2", resource: "sv1" } },
      },
    },
  },
};

// ══════════════════════════════════════════════════════════════════════════════
// §20. SDK 소비 라이프사이클
// ══════════════════════════════════════════════════════════════════════════════

describe("§20 SDK 소비 라이프사이클", () => {
  // SDK-LIFE-1: 스키마 → SDK → client → encode/decode 전체 경로
  it("SDK-LIFE-1: 스키마 정의 → SDK 생성 → client → encode → decode 전체 경로", () => {
    const sdk = createIndexSDK(PERM_SCHEMA_V1);
    const perm = sdk.client("perm", "v1");

    // 상수 추출 (예약 토큰 자동 제외)
    const ROLE = perm.constants("role");
    const ACTION = perm.constants("action");
    const RESOURCE = perm.constants("resource");

    // IDE 자동완성으로 접근 가능한 정규 값만 포함
    expect(Object.keys(ROLE).sort()).toEqual(["admin", "editor", "viewer"]);
    expect(Object.keys(ACTION).sort()).toEqual(["delete", "read", "write"]);
    expect(Object.keys(RESOURCE).sort()).toEqual(["comment", "post", "user"]);

    // 상수 기반 encode
    const vv = perm.encode({
      role: ROLE.admin,
      action: ACTION.write,
      resource: RESOURCE.post,
    });

    expect(vv.indexId).toBe("perm");
    expect(vv.versionId).toBe("v1");

    // decode로 원본 복원
    const decoded = perm.decode(vv);
    expect(decoded).toEqual({
      role: "admin",
      action: "write",
      resource: "post",
    });
  });

  // SDK-LIFE-2: 예약 토큰으로 encode (의도적 비선택)
  it("SDK-LIFE-2: 예약 토큰 '_'로 의도적 비선택 encode", () => {
    const sdk = createIndexSDK(PERM_SCHEMA_V1);
    const perm = sdk.client("perm", "v1");

    // 모든 role에 적용되는 정책 → role을 "_"로
    const vv = perm.encode({
      role: "_",
      action: "read",
      resource: "post",
    });

    const decoded = perm.decode(vv);
    expect(decoded.role).toBe("_");

    // constants에는 "_"가 없지만, entries에서는 접근 가능
    expect("_" in perm.constants("role")).toBe(false);
    expect(perm.entries("role")).toContain("_");
  });

  // SDK-LIFE-3: 전체 주소 공간의 결정성 검증
  it("SDK-LIFE-3: 동일 입력 → 동일 value (결정적 인코딩)", () => {
    const sdk1 = createIndexSDK(PERM_SCHEMA_V1);
    const sdk2 = createIndexSDK(PERM_SCHEMA_V1);

    const input = { role: "admin", action: "write", resource: "post" };
    const vv1 = sdk1.client("perm", "v1").encode(input);
    const vv2 = sdk2.client("perm", "v1").encode(input);

    expect(vv1).toEqual(vv2);
  });

  // SDK-LIFE-4: matchRanges로 부분 필터링
  it("SDK-LIFE-4: matchRanges로 특정 role의 모든 권한 조회", () => {
    const sdk = createIndexSDK(PERM_SCHEMA_V1);
    const perm = sdk.client("perm", "v1");

    // admin의 모든 action × resource 범위
    const ranges = perm.matchRanges({ role: "admin" });
    expect(ranges.length).toBeGreaterThan(0);

    // 범위 내 모든 value decode → role=admin
    for (const [from, to] of ranges) {
      for (let v = from; v <= to; v++) {
        expect(perm.decodeValue(v).role).toBe("admin");
      }
    }
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// §21. 엔트리 제공 모드 (Client vs Full)
// ══════════════════════════════════════════════════════════════════════════════

describe("§21 엔트리 제공 모드: Client vs Full", () => {
  // ENTRY-MODE-1: Client 모드 — 프론트엔드 소비
  it("ENTRY-MODE-1: Client 모드 — capacity 정보 없이 entries/constants만 제공", () => {
    const sdk = createIndexSDK(PERM_SCHEMA_V1);
    const perm = sdk.client("perm", "v1");

    // entries: 등록된 것만 (capacity 정보 없음)
    const roleEntries = perm.entries("role");
    expect(roleEntries).toEqual(["_", "~", "admin", "editor", "viewer"]);
    // 클라이언트는 capacity=10이라는 사실을 모름

    // constants: 예약 토큰 제외된 도메인 값만
    const ROLE = perm.constants("role");
    expect(ROLE).toEqual({ admin: "admin", editor: "editor", viewer: "viewer" });
    // 클라이언트는 headroom=5라는 사실을 모름
  });

  // ENTRY-MODE-2: Full 모드 — 백엔드 주소 추론
  it("ENTRY-MODE-2: Full 모드 — capacity 포함 전체 주소 공간", () => {
    const sdk = createIndexSDK(PERM_SCHEMA_V1);
    const perm = sdk.client("perm", "v1");

    // dimFullView: 전체 capacity 포함
    const roleView = perm.dimFullView("role");

    expect(roleView.total).toBe(5);
    expect(roleView.capacity).toBe(10);
    expect(roleView.headroom).toBe(5);
    expect(roleView.positions).toHaveLength(10);

    // 3분류 정확성
    const reserved = roleView.positions.filter((p) => p.kind === "reserved");
    const normals = roleView.positions.filter((p) => p.kind === "normal");
    const empties = roleView.positions.filter((p) => p.kind === "empty");

    expect(reserved.map((p) => p.value)).toEqual(["_", "~"]);
    expect(normals.map((p) => p.value)).toEqual(["admin", "editor", "viewer"]);
    expect(empties).toHaveLength(5);
    expect(empties.every((p) => p.value === null)).toBe(true);
  });

  // ENTRY-MODE-3: Full 모드로 주소 추론 시뮬레이션
  it("ENTRY-MODE-3: 백엔드에서 full view로 주소 공간 분석", () => {
    const sdk = createIndexSDK(PERM_SCHEMA_V1);
    const perm = sdk.client("perm", "v1");

    // 모든 dim의 full view 수집
    const dims = ["role", "action", "resource"] as const;
    const views = dims.map((d) => perm.dimFullView(d));

    // 백엔드: 전체 주소 공간 크기 계산 (capacity 기반)
    const totalAddressSpace = views.reduce((acc, v) => acc * v.capacity, 1);
    expect(totalAddressSpace).toBe(10 * 8 * 8); // 640

    // 실제 사용 중인 주소 공간 (entries 기반)
    expect(perm.size).toBe(5 * 4 * 3); // 60

    // headroom 활용: 어떤 dim에 여유가 있는지 판단
    const withHeadroom = views.filter((v) => v.headroom > 0);
    expect(withHeadroom).toHaveLength(3); // 모든 dim에 headroom

    // 가장 headroom이 적은 dim 식별
    const minHeadroom = views.reduce(
      (min, v) => (v.headroom < min.headroom ? v : min),
      views[0],
    );
    expect(minHeadroom.dimId).toBe("action");
    expect(minHeadroom.headroom).toBe(4);
  });

  // ENTRY-MODE-4: normal 엔트리만 추출해 index-label 매핑 구성
  it("ENTRY-MODE-4: full view에서 normal entries의 index-label 매핑", () => {
    const sdk = createIndexSDK(PERM_SCHEMA_V1);
    const perm = sdk.client("perm", "v1");

    const roleView = perm.dimFullView("role");

    // normal entries만 추출 → position(1-based index) ↔ label 매핑
    const indexLabelMap = roleView.positions
      .filter((p) => p.kind === "normal")
      .map((p) => ({ index: p.position, label: String(p.value) }));

    expect(indexLabelMap).toEqual([
      { index: 3, label: "admin" },
      { index: 4, label: "editor" },
      { index: 5, label: "viewer" },
    ]);

    // 이 매핑으로 encode 시 position 참조 가능
    // admin은 position 3, 예약 토큰(_=1, ~=2) 뒤에 위치
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// §22. 스키마 진화 · SDK 동기화
// ══════════════════════════════════════════════════════════════════════════════

describe("§22 스키마 진화 · SDK 동기화", () => {
  // SCHEMA-EVO-1: entry 추가 → headroom 감소
  it("SCHEMA-EVO-1: v1→v2 entry 추가 시 headroom 변화 확인", () => {
    const sdkV1 = createIndexSDK(PERM_SCHEMA_V1);
    const sdkV2 = createIndexSDK(PERM_SCHEMA_V2);

    const v1cap = sdkV1.client("perm", "v1").dimCapacity("role");
    const v2cap = sdkV2.client("perm", "v2").dimCapacity("role");

    // v1: 5 entries, capacity 10, headroom 5
    expect(v1cap).toEqual({ total: 5, capacity: 10, headroom: 5 });

    // v2: moderator 추가 → 6 entries, capacity 10, headroom 4
    expect(v2cap).toEqual({ total: 6, capacity: 10, headroom: 4 });
  });

  // SCHEMA-EVO-2: headroom 내 추가 → capacity 불변
  it("SCHEMA-EVO-2: headroom 내 entry 추가는 capacity를 변경하지 않는다", () => {
    const sdkV2 = createIndexSDK(PERM_SCHEMA_V2);
    const v2role = sdkV2.client("perm", "v2").dimFullView("role");

    // capacity는 v1과 동일하게 10 유지
    expect(v2role.capacity).toBe(10);

    // moderator가 position 6에 추가
    const p6 = v2role.positions.find((p) => p.position === 6);
    expect(p6).toEqual({ position: 6, value: "moderator", kind: "normal" });

    // headroom이 5→4로 감소
    expect(v2role.headroom).toBe(4);
  });

  // SCHEMA-EVO-3: v1 데이터를 v2로 마이그레이션
  it("SCHEMA-EVO-3: v1 encode → v2에서 동일 entity re-encode 가능", () => {
    const sdk = createIndexSDK(PERM_SCHEMA_V2);
    const v1 = sdk.client("perm", "v1");
    const v2 = sdk.client("perm", "v2");

    // v1에서 encode
    const v1Input = { role: "admin", action: "write", resource: "post" };
    const v1VV = v1.encode(v1Input);

    // v1 decode → v2 re-encode (마이그레이션)
    const entities = v1.decode(v1VV);
    const v2VV = v2.encode(entities);

    // v2에서 decode → 동일 entity
    expect(v2.decode(v2VV)).toEqual(v1Input);
  });

  // SCHEMA-EVO-4: v2 전용 entry는 v1에서 불가
  it("SCHEMA-EVO-4: v2 전용 entry(moderator, approve)는 v1에서 encode 불가", () => {
    const sdk = createIndexSDK(PERM_SCHEMA_V2);
    const v1 = sdk.client("perm", "v1");
    const v2 = sdk.client("perm", "v2");

    // moderator는 v2 전용
    expect(() => v1.encode({ role: "moderator", action: "read", resource: "post" }))
      .toThrow(EntryNotFoundError);

    // v2에서는 정상
    const vv = v2.encode({ role: "moderator", action: "approve", resource: "post" });
    expect(v2.decode(vv)).toEqual({
      role: "moderator",
      action: "approve",
      resource: "post",
    });
  });

  // SCHEMA-EVO-5: constants가 버전별로 정확히 반영
  it("SCHEMA-EVO-5: v1·v2 constants 차이 확인", () => {
    const sdk = createIndexSDK(PERM_SCHEMA_V2);

    const v1Role = sdk.client("perm", "v1").constants("role");
    const v2Role = sdk.client("perm", "v2").constants("role");

    // v1: moderator 없음
    expect(Object.keys(v1Role).sort()).toEqual(["admin", "editor", "viewer"]);

    // v2: moderator 포함
    expect(Object.keys(v2Role).sort()).toEqual(["admin", "editor", "moderator", "viewer"]);
  });

  // SCHEMA-EVO-6: SDK 재생성으로 동기화
  it("SCHEMA-EVO-6: 스키마 변경 → 새 SDK 생성으로 동기화", () => {
    // 운영 중: v1 스키마로 시작
    const sdk1 = createIndexSDK(PERM_SCHEMA_V1);
    const perm1 = sdk1.client("perm", "v1");
    expect(perm1.dimCapacity("role").headroom).toBe(5);

    // 관리 레이어에서 moderator 추가 → v2 스키마 배포
    // SDK를 새로 생성해야 변경이 반영됨
    const sdk2 = createIndexSDK(PERM_SCHEMA_V2);
    const perm2 = sdk2.client("perm", "v2");

    // 새 SDK에서 moderator 사용 가능
    const vv = perm2.encode({ role: "moderator", action: "read", resource: "post" });
    expect(perm2.decode(vv).role).toBe("moderator");

    // headroom 감소 확인
    expect(perm2.dimCapacity("role").headroom).toBe(4);
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// §23. 멀티 서비스 스키마 공유
// ══════════════════════════════════════════════════════════════════════════════

describe("§23 멀티 서비스 스키마 공유", () => {
  // MULTI-SVC-1: 프론트엔드 → 백엔드 encode/decode
  it("MULTI-SVC-1: 프론트엔드 encode → HTTP 전송 → 백엔드 decode", () => {
    // 프론트엔드: client 모드 (capacity 정보 불필요)
    const feSDK = createIndexSDK(PERM_SCHEMA_V1);
    const feClient = feSDK.client("perm", "v1");
    const ROLE = feClient.constants("role");
    const ACTION = feClient.constants("action");

    const payload = feClient.encode({
      role: ROLE.editor,
      action: ACTION.write,
      resource: "post",
    });

    // HTTP 전송 시뮬레이션
    const wire = JSON.stringify(payload);

    // 백엔드: 동일 스키마로 decode
    const beSDK = createIndexSDK(PERM_SCHEMA_V1);
    const beClient = beSDK.client("perm", "v1");
    const received: VersionedValue = JSON.parse(wire);
    const decoded = beClient.decode(received);

    expect(decoded).toEqual({
      role: "editor",
      action: "write",
      resource: "post",
    });
  });

  // MULTI-SVC-2: DecodeMap 전달 → 독립 서비스에서 decode
  it("MULTI-SVC-2: DecodeMap JSON 전달 → MetaCodec 독립 decode", () => {
    // 메인 서비스: SDK 보유
    const mainSDK = createIndexSDK(PERM_SCHEMA_V1);
    const mainClient = mainSDK.client("perm", "v1");
    const vv = mainClient.encode({ role: "admin", action: "delete", resource: "user" });

    // DecodeMap 추출 → JSON으로 전달
    const mapJson = JSON.stringify(mainClient.toDecodeMap());

    // 분석 서비스: SDK 없이 DecodeMap만으로 decode
    const remoteMap = JSON.parse(mapJson);
    const remoteCodec = new MetaCodec(remoteMap);
    const decoded = remoteCodec.decode(vv);

    expect(decoded).toEqual({
      role: "admin",
      action: "delete",
      resource: "user",
    });
  });

  // MULTI-SVC-3: 상수 기반 개발 — 문자열 직접 입력과 동일 결과
  it("MULTI-SVC-3: constants 사용과 문자열 직접 입력은 동일한 결과", () => {
    const sdk = createIndexSDK(PERM_SCHEMA_V1);
    const perm = sdk.client("perm", "v1");
    const ROLE = perm.constants("role");

    const withConst = perm.encode({ role: ROLE.admin, action: "read", resource: "post" });
    const withStr = perm.encode({ role: "admin", action: "read", resource: "post" });

    expect(withConst).toEqual(withStr);
  });

  // MULTI-SVC-4: 백엔드 matchRanges → DB 쿼리 시뮬레이션
  it("MULTI-SVC-4: 백엔드에서 matchRanges로 DB BETWEEN 쿼리 생성", () => {
    const sdk = createIndexSDK(PERM_SCHEMA_V1);
    const perm = sdk.client("perm", "v1");

    // "editor의 모든 write 권한" 범위 조회
    const ranges = perm.matchRanges({ role: "editor", action: "write" });
    expect(ranges.length).toBeGreaterThan(0);

    // DB 시뮬레이션: 범위 내 모든 value를 decode
    const results: Record<string, string>[] = [];
    for (const [from, to] of ranges) {
      for (let v = from; v <= to; v++) {
        results.push(perm.decodeValue(v) as Record<string, string>);
      }
    }

    // 모든 결과가 role=editor, action=write
    for (const r of results) {
      expect(r.role).toBe("editor");
      expect(r.action).toBe("write");
    }
    // resource는 전체 (3개)
    expect(results).toHaveLength(3);
    expect(results.map((r) => r.resource).sort()).toEqual(["comment", "post", "user"]);
  });

  // MULTI-SVC-5: versionId 기반 라우팅
  it("MULTI-SVC-5: 혼재 버전 수신 → versionId 기반 client 라우팅", () => {
    const sdk = createIndexSDK(PERM_SCHEMA_V2);
    const v1 = sdk.client("perm", "v1");
    const v2 = sdk.client("perm", "v2");

    // 프론트엔드들이 다른 버전 사용
    const payloads = [
      v1.encode({ role: "admin", action: "read", resource: "post" }),
      v2.encode({ role: "moderator", action: "approve", resource: "comment" }),
      v1.encode({ role: "viewer", action: "read", resource: "user" }),
    ];

    // 백엔드: versionId로 라우팅
    const decoded = payloads.map((vv) => {
      const client = sdk.client(vv.indexId, vv.versionId);
      return client.decode(vv);
    });

    expect(decoded).toEqual([
      { role: "admin", action: "read", resource: "post" },
      { role: "moderator", action: "approve", resource: "comment" },
      { role: "viewer", action: "read", resource: "user" },
    ]);
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// §24. CLI 시뮬레이션
//
// CLI는 아직 미구현이지만, SDK API로 동일한 결과를 산출할 수 있다.
// 이 테스트는 CLI 구현 시 기대하는 출력의 정확성을 검증한다.
// ══════════════════════════════════════════════════════════════════════════════

describe("§24 CLI 시뮬레이션", () => {
  // CLI-INFO-1: `index-meta info role` 시뮬레이션
  it("CLI-INFO-1: dim info 조회 — 스냅샷별 entries/capacity/headroom", () => {
    const sdk = createIndexSDK(PERM_SCHEMA_V2);
    const registry = sdk.registry;

    // CLI가 수행할 작업: dim의 모든 snapshot 정보 수집
    const dimId = "role";
    const resolver = new MetaResolver(registry);
    const dimRange = resolver.getDimRange(dimId);

    expect(dimRange.dimId).toBe("role");
    expect(dimRange.kind).toEqual({ type: "string_enum" });
    expect(dimRange.snapshots).toHaveLength(2);

    // sv1 snapshot
    const sv1 = dimRange.snapshots.find((s) => s.snapshotId === "sv1")!;
    expect(sv1.entries).toEqual(["_", "~", "admin", "editor", "viewer"]);
    expect(sv1.total).toBe(5);
    expect(sv1.capacity).toBe(10);
    expect(sv1.headroom).toBe(5);

    // sv2 snapshot
    const sv2 = dimRange.snapshots.find((s) => s.snapshotId === "sv2")!;
    expect(sv2.entries).toEqual(["_", "~", "admin", "editor", "viewer", "moderator"]);
    expect(sv2.total).toBe(6);
    expect(sv2.capacity).toBe(10);
    expect(sv2.headroom).toBe(4);
  });

  // CLI-CAP-2: `index-meta capacity perm/v1` 시뮬레이션
  it("CLI-CAP-2: index version의 dim별 용량 정보", () => {
    const sdk = createIndexSDK(PERM_SCHEMA_V1);
    const perm = sdk.client("perm", "v1");

    // CLI가 수행할 작업: 각 dim의 capacity 수집
    const dimIds = ["role", "action", "resource"];
    const capacityReport = dimIds.map((dimId) => ({
      dimId,
      ...perm.dimCapacity(dimId),
    }));

    expect(capacityReport).toEqual([
      { dimId: "role",     total: 5, capacity: 10, headroom: 5 },
      { dimId: "action",   total: 4, capacity: 8,  headroom: 4 },
      { dimId: "resource", total: 3, capacity: 8,  headroom: 5 },
    ]);

    // shape과 size
    expect(perm.shape).toEqual([5, 4, 3]);
    expect(perm.size).toBe(60);
  });

  // CLI-CONST-3: `index-meta constants perm/v1 role` 시뮬레이션
  it("CLI-CONST-3: constants 추출 (예약 토큰 자동 제외)", () => {
    const sdk = createIndexSDK(PERM_SCHEMA_V1);
    const perm = sdk.client("perm", "v1");

    // CLI가 수행할 작업: constants 추출
    const roleConstants = perm.constants("role");

    expect(roleConstants).toEqual({
      admin: "admin",
      editor: "editor",
      viewer: "viewer",
    });

    // 예약 토큰 포함 전체 목록도 출력 가능
    const roleEntries = perm.entries("role");
    expect(roleEntries).toEqual(["_", "~", "admin", "editor", "viewer"]);
  });

  // CLI-DIFF-4: `index-meta diff perm v1 v2` 시뮬레이션
  it("CLI-DIFF-4: 두 버전 간 diff 계산", () => {
    const sdk = createIndexSDK(PERM_SCHEMA_V2);

    const v1 = sdk.client("perm", "v1");
    const v2 = sdk.client("perm", "v2");

    // shape 변화
    expect(v1.shape).toEqual([5, 4, 3]);
    expect(v2.shape).toEqual([6, 5, 3]);

    // size 변화
    expect(v1.size).toBe(60);
    expect(v2.size).toBe(90);

    // dim별 constants 변화
    const v1RoleKeys = Object.keys(v1.constants("role")).sort();
    const v2RoleKeys = Object.keys(v2.constants("role")).sort();
    const addedRoles = v2RoleKeys.filter((k) => !v1RoleKeys.includes(k));
    expect(addedRoles).toEqual(["moderator"]);

    const v1ActionKeys = Object.keys(v1.constants("action")).sort();
    const v2ActionKeys = Object.keys(v2.constants("action")).sort();
    const addedActions = v2ActionKeys.filter((k) => !v1ActionKeys.includes(k));
    expect(addedActions).toEqual(["approve"]);

    // resource는 변경 없음
    const v1ResourceKeys = Object.keys(v1.constants("resource")).sort();
    const v2ResourceKeys = Object.keys(v2.constants("resource")).sort();
    expect(v1ResourceKeys).toEqual(v2ResourceKeys);
  });

  // CLI-FULLVIEW-5: full view로 관리 UI 데이터 제공
  it("CLI-FULLVIEW-5: dimFullView로 관리 UI용 전체 주소 공간 제공", () => {
    const sdk = createIndexSDK(PERM_SCHEMA_V2);
    const perm = sdk.client("perm", "v2");

    // 모든 dim의 full view 수집
    const dimIds = ["role", "action", "resource"];
    const fullViews = dimIds.map((d) => perm.dimFullView(d));

    // role dim: 6 entries / 10 capacity → 4 empty
    const roleView = fullViews[0];
    expect(roleView.positions.filter((p) => p.kind === "reserved")).toHaveLength(2);
    expect(roleView.positions.filter((p) => p.kind === "normal")).toHaveLength(4);
    expect(roleView.positions.filter((p) => p.kind === "empty")).toHaveLength(4);

    // action dim: 5 entries / 8 capacity → 3 empty
    const actionView = fullViews[1];
    expect(actionView.positions.filter((p) => p.kind === "reserved")).toHaveLength(1);
    expect(actionView.positions.filter((p) => p.kind === "normal")).toHaveLength(4);
    expect(actionView.positions.filter((p) => p.kind === "empty")).toHaveLength(3);

    // resource dim: 3 entries / 8 capacity → 5 empty (예약 토큰 없음)
    const resourceView = fullViews[2];
    expect(resourceView.positions.filter((p) => p.kind === "reserved")).toHaveLength(0);
    expect(resourceView.positions.filter((p) => p.kind === "normal")).toHaveLength(3);
    expect(resourceView.positions.filter((p) => p.kind === "empty")).toHaveLength(5);
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// §25. inactive 항목이 있는 운영 시나리오
// ══════════════════════════════════════════════════════════════════════════════

describe("§25 inactive 항목 운영", () => {
  const schemaWithInactive: MetaRegistryInput = {
    dims: {
      role: {
        kind: { type: "string_enum" },
        description: 'reserved: [1]="_" (미지정)',
        snapshots: {
          sv1: {
            entries: ["_", "admin", "editor", "tester", "viewer"],
            capacity: 10,
            entryFlags: {
              // tester(position 4)가 deprecated
              4: { status: "inactive" as const, reason: "역할 폐지", updatedAt: "2026-03-10" },
            },
          },
        },
      },
      action: {
        kind: { type: "string_enum" },
        snapshots: {
          sv1: { entries: ["read", "write"], capacity: 8 },
        },
      },
    },
    indices: {
      perm: {
        dims: ["role", "action"],
        versions: {
          v1: { snapshots: { role: "sv1", action: "sv1" } },
        },
      },
    },
  };

  // INACTIVE-1: constants에서 inactive 제외
  it("INACTIVE-1: constants에서 inactive(tester) 제외, entries에는 포함", () => {
    const sdk = createIndexSDK(schemaWithInactive);
    const perm = sdk.client("perm", "v1");

    // constants: tester 제외
    const ROLE = perm.constants("role");
    expect(Object.keys(ROLE).sort()).toEqual(["admin", "editor", "viewer"]);
    expect("tester" in ROLE).toBe(false);

    // entries: tester 포함 (기존 데이터 decode 가능)
    expect(perm.entries("role")).toContain("tester");
  });

  // INACTIVE-2: inactive entry로 encode/decode 가능 (기존 데이터)
  it("INACTIVE-2: inactive entry로 기존 데이터 decode 가능", () => {
    const sdk = createIndexSDK(schemaWithInactive);
    const perm = sdk.client("perm", "v1");

    // tester로 encode (기존 레코드 시뮬레이션)
    const vv = perm.encode({ role: "tester", action: "read" });
    const decoded = perm.decode(vv);
    expect(decoded.role).toBe("tester");
  });

  // INACTIVE-3: dimFullView에서 inactive는 normal로 표시 (kind는 위치 기반)
  it("INACTIVE-3: dimFullView에서 inactive도 normal로 분류", () => {
    const sdk = createIndexSDK(schemaWithInactive);
    const perm = sdk.client("perm", "v1");

    const view = perm.dimFullView("role");
    const p4 = view.positions.find((p) => p.position === 4)!;

    // inactive이지만 kind=normal (값이 존재하는 정규 위치)
    // inactive 상태는 entryFlags의 관심사, kind는 주소 공간 분류
    expect(p4).toEqual({ position: 4, value: "tester", kind: "normal" });
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// §26. reservedTokens 오버라이드 운영 시나리오
// ══════════════════════════════════════════════════════════════════════════════

describe("§26 reservedTokens 오버라이드 운영", () => {
  const schemaWithNaN: MetaRegistryInput = {
    dims: {
      score: {
        kind: { type: "string_enum" },
        description: 'reserved: [1]="_" (미지정), [2]="NaN" (숫자 아님)',
        snapshots: {
          sv1: {
            entries: ["_", "NaN", "low", "medium", "high"],
            capacity: 10,
          },
        },
      },
    },
    indices: {
      rating: {
        dims: ["score"],
        versions: {
          v1: { snapshots: { score: "sv1" } },
        },
      },
    },
  };

  // RESERVED-OVERRIDE-1: 기본 토큰은 NaN을 제외하지 않음
  it("RESERVED-OVERRIDE-1: 기본 RESERVED_TOKENS는 NaN을 포함하지 않음", () => {
    const sdk = createIndexSDK(schemaWithNaN);
    const SCORE = sdk.client("rating", "v1").constants("score");

    // NaN은 기본 예약 토큰이 아니므로 constants에 포함됨
    expect(SCORE).toEqual({ NaN: "NaN", low: "low", medium: "medium", high: "high" });
  });

  // RESERVED-OVERRIDE-2: NaN도 제외하도록 오버라이드
  it("RESERVED-OVERRIDE-2: NaN도 제외하는 커스텀 reservedTokens", () => {
    const sdk = createIndexSDK(schemaWithNaN, {
      reservedTokens: new Set(["_", "~", "?", "NaN"]),
    });
    const SCORE = sdk.client("rating", "v1").constants("score");

    expect(SCORE).toEqual({ low: "low", medium: "medium", high: "high" });
  });

  // RESERVED-OVERRIDE-3: dimFullView에도 커스텀 토큰 반영
  it("RESERVED-OVERRIDE-3: dimFullView에서 커스텀 reservedTokens 반영", () => {
    const sdk = createIndexSDK(schemaWithNaN, {
      reservedTokens: new Set(["_", "~", "?", "NaN"]),
    });
    const view = sdk.client("rating", "v1").dimFullView("score");

    const reserved = view.positions.filter((p) => p.kind === "reserved");
    expect(reserved).toHaveLength(2);
    expect(reserved.map((p) => p.value)).toEqual(["_", "NaN"]);
  });
});
