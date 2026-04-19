// @def.boundary index-meta-system
// @def.doc index-meta-system

/**
 * 즉시 마이그레이션 유틸 테스트
 *
 * DB에 저장된 구버전 주소를 read 시점에 최신 버전으로 즉시 변환하는 read-repair 패턴을 검증한다.
 * "나중에 일괄"이 아니라 조회 시점에 처리하므로, `migrated` 플래그로 write-back 필요 여부를 판단한다.
 *
 * ── 픽스처 설명 ──────────────────────────────────────────────────────────────
 *
 * registryInput: role × action 2D 권한 인덱스. role은 v1(3종) → v2(4종)으로 확장.
 * crossRegistryInput: 같은 role × action에 resource dim을 추가한 perm_full(3D) 포함.
 *   - perm: role × action (2D)
 *   - perm_full: role × action × resource (3D)
 *   두 index는 prefix가 다르므로 같은 레지스트리에 공존 가능.
 *
 * ── 커버하는 유저 시나리오 ───────────────────────────────────────────────────
 *
 * [S1] Read-repair (단건): DB에서 읽은 구버전 직렬화 주소를 최신 버전으로 변환.
 *      변경이 있을 때만 DB write-back (migrated=true).
 *
 * [S2] 멱등성 보장: 이미 최신 버전인 주소를 마이그레이션해도 원본을 그대로 반환.
 *      중복 호출로 데이터가 변형되지 않는다.
 *
 * [S3] Soft delete 후 마이그레이션 보장: deprecated(inactive) 처리된 entity는 entries에서
 *      삭제하지 않고 entryFlags로 비활성화한다. 이 경우에도 구버전 주소의 마이그레이션은
 *      정상적으로 동작해야 한다. 기존 데이터를 읽을 수 있는 능력(decode)을 유지하는 것이 핵심.
 *
 * [S4] 전체 조합 커버리지: 버전 승격 후 구버전의 모든 좌표가 신버전에서 정확히
 *      복원되는지 검증. EntityId 불변성이 핵심.
 *
 * [S5] 일괄 업그레이드: 버전 배포 후 혼재된 버전의 주소 배열을 한 번에 처리.
 *      이미 최신인 항목은 건너뛰고, original 주소를 함께 반환해 update 추적을 지원.
 *
 * [S6] 새 dim 추가 시 정보 전이 (즉시): perm(2D) → perm_full(3D)처럼 dim이 추가되어
 *      prefix가 바뀔 때, 겹치는 dim 값은 자동 carry-over하고 새 dim 값은 함께 제공.
 *      누락 dim 없이 한 번에 완성.
 *
 * [S7] 새 dim 추가 시 정보 전이 (2단계): 새 dim 값을 즉시 결정하기 어려울 때.
 *      1단계: migrateCrossIndex로 partial 결과(carryOver + missingDimIds) 확보.
 *      2단계: completeCrossIndex로 누락 dim 값을 나중에 채워 encode 완성.
 *
 * [S8] dim 축소 시 정보 전이: perm_full(3D) → perm(2D)처럼 dim이 줄어들 때.
 *      target에 없는 여분 dim은 자동 폐기. 필요한 dim만 추출.
 */

import { describe, it, expect } from "vitest";
import { MetaRegistry } from "./meta-registry.js";
import { migrateAddress, migrateValue, migrateBatch, migrateCrossIndex, completeCrossIndex } from "./migrate-address.js";

// ── 픽스처 ──────────────────────────────────────────────────────────────────

const registryInput = () => ({
  dims: {
    role: {
      kind: { type: "string_enum" } as const,
      snapshots: {
        v1: { entries: ["admin", "editor", "viewer"] },
        v2: { entries: ["admin", "editor", "viewer", "guest"] }, // guest 추가
      },
    },
    action: {
      kind: { type: "string_enum" } as const,
      snapshots: {
        v1: { entries: ["read", "write", "delete"] },
      },
    },
  },
  indices: {
    perm: {
      dims: ["role", "action"],
      versions: {
        v1: { snapshots: { role: "v1", action: "v1" } },
        v2: { snapshots: { role: "v2", action: "v1" } }, // role이 v2 snapshot으로 교체
      },
    },
  },
});

// perm(2D) + perm_full(3D)이 공존하는 레지스트리.
// cross-index 시나리오(S6~S8)에서 사용.
const crossRegistryInput = () => ({
  dims: {
    role: {
      kind: { type: "string_enum" } as const,
      snapshots: { v1: { entries: ["admin", "editor", "viewer"] } },
    },
    action: {
      kind: { type: "string_enum" } as const,
      snapshots: { v1: { entries: ["read", "write", "delete"] } },
    },
    resource: {
      kind: { type: "string_enum" } as const,
      snapshots: { v1: { entries: ["posts", "comments", "users"] } },
    },
  },
  indices: {
    perm: {
      dims: ["role", "action"],
      versions: { v1: { snapshots: { role: "v1", action: "v1" } } },
    },
    perm_full: {
      dims: ["role", "action", "resource"],
      versions: { v1: { snapshots: { role: "v1", action: "v1", resource: "v1" } } },
    },
  },
});

// ── [S1] Read-repair (단건) ──────────────────────────────────────────────────
//
// 앱이 DB에서 구버전 주소를 읽을 때마다 최신 버전으로 즉시 변환한다.
// migrated=true이면 DB에 write-back해 점진적으로 스키마를 최신화한다.

describe("[S1/S2] migrateAddress — 단건 read-repair", () => {
  it("[S1] 구버전 직렬화 주소를 최신 버전으로 변환하고 migrated=true를 반환한다", () => {
    const reg = new MetaRegistry(registryInput());
    const v1 = reg.createCodec("perm", "v1");
    const v1addr = reg.serialize(v1.encode({ role: "editor", action: "write" }));

    const result = migrateAddress(reg, v1addr, "v2");

    expect(result.migrated).toBe(true);
    expect(result.vv.versionId).toBe("v2");
    // 변환 후에도 동일한 entity를 가리킨다
    const v2 = reg.createCodec("perm", "v2");
    expect(v2.decode(result.vv)).toEqual({ role: "editor", action: "write" });
  });

  it("[S2] 이미 최신 버전이면 migrated=false, 원본 주소 그대로 반환한다 (중복 호출 안전)", () => {
    const reg = new MetaRegistry(registryInput());
    const v2 = reg.createCodec("perm", "v2");
    const v2addr = reg.serialize(v2.encode({ role: "admin", action: "read" }));

    const result = migrateAddress(reg, v2addr, "v2");

    expect(result.migrated).toBe(false);
    expect(result.serialized).toBe(v2addr);
  });

  it("[S3] deprecated(inactive) 처리된 entity도 구버전 주소를 신버전으로 마이그레이션할 수 있다", () => {
    // 시스템 규칙: entry 삭제는 허용하지 않는다. "viewer"를 비활성화하려면
    // entries 배열은 그대로 유지하고 entryFlags로 soft delete한다.
    // position(index)이 바뀌면 기존 데이터의 좌표가 깨지므로 절대 변경하지 않는다.
    const input = {
      dims: {
        role: {
          kind: { type: "string_enum" } as const,
          snapshots: {
            v1: { entries: ["admin", "editor", "viewer"] },
            v2: {
              entries: ["admin", "editor", "viewer", "guest"], // viewer는 position 3으로 유지
              entryFlags: {
                3: { status: "inactive" as const, reason: "deprecated", updatedAt: "2026-01-01" },
              },
            },
          },
        },
        action: {
          kind: { type: "string_enum" } as const,
          snapshots: { v1: { entries: ["read", "write", "delete"] } },
        },
      },
      indices: {
        perm: {
          dims: ["role", "action"],
          versions: {
            v1: { snapshots: { role: "v1", action: "v1" } },
            v2: { snapshots: { role: "v2", action: "v1" } },
          },
        },
      },
    };
    const reg = new MetaRegistry(input);
    const v1 = reg.createCodec("perm", "v1");
    const addr = reg.serialize(v1.encode({ role: "viewer", action: "read" }));

    // inactive 처리 후에도 마이그레이션은 성공하고 EntityId가 보존된다
    const result = migrateAddress(reg, addr, "v2");
    expect(result.migrated).toBe(true);
    const v2 = reg.createCodec("perm", "v2");
    expect(v2.decode(result.vv)).toEqual({ role: "viewer", action: "read" });
  });
});

// ── [S1] migrateValue — VV 수준 read-repair ──────────────────────────────────
//
// 이미 파싱된 VersionedValue를 다룰 때 직렬화/파싱 오버헤드 없이 변환한다.

describe("[S1/S2] migrateValue — VV 수준 read-repair", () => {
  it("[S1] 구버전 VersionedValue를 최신 버전으로 변환한다", () => {
    const reg = new MetaRegistry(registryInput());
    const v1 = reg.createCodec("perm", "v1");
    const vv = v1.encode({ role: "editor", action: "read" });

    const result = migrateValue(reg, vv, "v2");

    expect(result.migrated).toBe(true);
    expect(result.vv.versionId).toBe("v2");
    const v2 = reg.createCodec("perm", "v2");
    expect(v2.decode(result.vv)).toEqual({ role: "editor", action: "read" });
  });

  it("[S2] 이미 최신이면 동일 객체를 그대로 반환한다 (불필요한 재인코딩 없음)", () => {
    const reg = new MetaRegistry(registryInput());
    const v2 = reg.createCodec("perm", "v2");
    const vv = v2.encode({ role: "admin", action: "write" });

    const result = migrateValue(reg, vv, "v2");
    expect(result.migrated).toBe(false);
    expect(result.vv).toBe(vv); // 동일 참조
  });
});

// ── [S4][S5] migrateBatch — 일괄 업그레이드 ─────────────────────────────────
//
// 버전 배포 후 DB에 남은 구버전 주소를 한 번에 처리한다.
// 혼재된 버전 배열에서 이미 최신인 항목은 건너뛰어 불필요한 write-back을 방지한다.

describe("[S4][S5] migrateBatch — 일괄 업그레이드", () => {
  it("[S4] 구버전 조합 전체가 신버전에서 동일한 entity로 복원된다", () => {
    const reg = new MetaRegistry(registryInput());
    const v1 = reg.createCodec("perm", "v1");
    const v2 = reg.createCodec("perm", "v2");

    const roles = ["admin", "editor", "viewer"];
    const actions = ["read", "write", "delete"];

    for (const role of roles) {
      for (const action of actions) {
        const addr = reg.serialize(v1.encode({ role, action }));
        const result = migrateAddress(reg, addr, "v2");

        expect(result.migrated).toBe(true);
        expect(v2.decode(result.vv)).toEqual({ role, action });
      }
    }
  });

  it("[S5] 혼재된 버전 배열에서 구버전만 변환하고 최신 버전은 건너뛴다", () => {
    const reg = new MetaRegistry(registryInput());
    const v1 = reg.createCodec("perm", "v1");
    const v2 = reg.createCodec("perm", "v2");

    const addresses = [
      reg.serialize(v1.encode({ role: "admin",  action: "read"   })), // v1 → 변환
      reg.serialize(v2.encode({ role: "guest",  action: "write"  })), // v2 → skip
      reg.serialize(v1.encode({ role: "viewer", action: "delete" })), // v1 → 변환
    ];

    const results = migrateBatch(reg, addresses, "v2");

    expect(results[0].migrated).toBe(true);
    expect(results[1].migrated).toBe(false);
    expect(results[2].migrated).toBe(true);
  });

  it("[S5] original 주소가 함께 반환되어 DB update 대상을 추적할 수 있다", () => {
    const reg = new MetaRegistry(registryInput());
    const v1 = reg.createCodec("perm", "v1");
    const addr = reg.serialize(v1.encode({ role: "admin", action: "read" }));

    const results = migrateBatch(reg, [addr], "v2");

    expect(results[0].original).toBe(addr);           // 원본 보존
    expect(results[0].serialized).not.toBe(addr);     // 변환된 주소는 다름
  });
});

// ── [S6] Cross-index 정보 전이 (즉시 완성) ───────────────────────────────────
//
// dim이 추가되어 prefix가 바뀔 때의 정보 전이 프로토콜.
// 구버전 dim 값은 자동 carry-over하고, 새 dim 값은 additionalEntityIds로 즉시 제공한다.
// 이것은 "마이그레이션"이 아니라 두 schema 간의 정보 연결이다.
// (prefix가 바뀌면 dim 구성이 달라지므로 완전 자동 변환은 불가능)

describe("[S6][S8] migrateCrossIndex — cross-index 정보 전이", () => {
  it("[S6] 겹치는 dim 값은 자동 carry-over되고 새 dim 값을 제공하면 즉시 완성된다", () => {
    const reg = new MetaRegistry(crossRegistryInput());
    const codec = reg.createCodec("perm", "v1");
    const vv = codec.encode({ role: "viewer", action: "delete" });

    // perm(2D) → perm_full(3D): resource 새로 제공
    const result = migrateCrossIndex(reg, vv, "perm_full", "v1", { resource: "posts" });

    expect(result.complete).toBe(true);
    if (result.complete) {
      expect(result.migrated).toBe(true);
      const fullCodec = reg.createCodec("perm_full", "v1");
      expect(fullCodec.decode(result.vv)).toEqual({ role: "viewer", action: "delete", resource: "posts" });
    }
  });

  it("[S8] dim이 줄어드는 방향의 전이에서 여분 dim은 자동 폐기된다", () => {
    const reg = new MetaRegistry(crossRegistryInput());
    const fullCodec = reg.createCodec("perm_full", "v1");
    const vv = fullCodec.encode({ role: "admin", action: "read", resource: "users" });

    // perm_full(3D) → perm(2D): resource는 target에 없으므로 버려짐
    const result = migrateCrossIndex(reg, vv, "perm", "v1");

    expect(result.complete).toBe(true);
    if (result.complete) {
      expect(result.migrated).toBe(true);
      const permCodec = reg.createCodec("perm", "v1");
      expect(permCodec.decode(result.vv)).toEqual({ role: "admin", action: "read" });
    }
  });

  it("[S2] 이미 동일한 index/version이면 complete: true, migrated: false를 반환한다", () => {
    const reg = new MetaRegistry(crossRegistryInput());
    const codec = reg.createCodec("perm", "v1");
    const vv = codec.encode({ role: "admin", action: "read" });

    const result = migrateCrossIndex(reg, vv, "perm", "v1");

    expect(result).toEqual({ complete: true, vv, migrated: false });
  });

  it("[S7] 새 dim 값을 즉시 결정할 수 없으면 complete: false와 missingDimIds를 반환한다", () => {
    const reg = new MetaRegistry(crossRegistryInput());
    const codec = reg.createCodec("perm", "v1");
    const vv = codec.encode({ role: "editor", action: "write" });

    const result = migrateCrossIndex(reg, vv, "perm_full", "v1");

    expect(result.complete).toBe(false);
    if (!result.complete) {
      // 어떤 dim이 누락인지, 어떤 dim이 확보됐는지 명시적으로 알 수 있다
      expect(result.partial.missingDimIds).toEqual(["resource"]);
      expect(result.partial.carryOverEntityIds).toEqual({ role: "editor", action: "write" });
      expect(result.partial.targetIndexId).toBe("perm_full");
      expect(result.partial.targetVersionId).toBe("v1");
    }
  });
});

// ── [S7] completeCrossIndex — 2단계 정보 전이 완성 ───────────────────────────
//
// 새 dim 값을 즉시 결정하기 어려울 때 (예: UI에서 사용자가 선택해야 하거나,
// 다른 서비스에서 조회가 필요한 경우), partial 결과를 저장해두고 나중에 완성한다.

describe("[S7] completeCrossIndex — 2단계 전이 완성", () => {
  it("[S7] partial의 carryOver와 나중에 제공한 값이 합쳐져 target VV가 완성된다", () => {
    const reg = new MetaRegistry(crossRegistryInput());
    const codec = reg.createCodec("perm", "v1");
    const vv = codec.encode({ role: "editor", action: "write" });

    // 1단계: carry-over 확보, 새 dim은 아직 미확정
    const partialResult = migrateCrossIndex(reg, vv, "perm_full", "v1");
    expect(partialResult.complete).toBe(false);

    if (!partialResult.complete) {
      // 2단계: 나중에 resource 값이 확정되면 완성
      const newVV = completeCrossIndex(reg, partialResult.partial, { resource: "comments" });
      const fullCodec = reg.createCodec("perm_full", "v1");
      expect(fullCodec.decode(newVV)).toEqual({ role: "editor", action: "write", resource: "comments" });
    }
  });

  it("[S7] 완성된 VV는 targetIndex/targetVersion을 정확히 가리킨다", () => {
    const reg = new MetaRegistry(crossRegistryInput());
    const codec = reg.createCodec("perm", "v1");
    const vv = codec.encode({ role: "admin", action: "delete" });

    const partialResult = migrateCrossIndex(reg, vv, "perm_full", "v1");
    if (!partialResult.complete) {
      const newVV = completeCrossIndex(reg, partialResult.partial, { resource: "users" });

      expect(newVV.indexId).toBe("perm_full");
      expect(newVV.versionId).toBe("v1");
      const fullCodec = reg.createCodec("perm_full", "v1");
      expect(fullCodec.decode(newVV)).toEqual({ role: "admin", action: "delete", resource: "users" });
    }
  });
});
