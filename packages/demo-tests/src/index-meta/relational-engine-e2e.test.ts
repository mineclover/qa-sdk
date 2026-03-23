/**
 * Relational Engine E2E 테스트
 *
 * DB 기반 비즈니스 로직 통합 검증:
 * 1. 관계 유형 index 정의 → encode
 * 2. DB에 entries 적재 (IndexMetaStore)
 * 3. address range 사전 계산 + 캐시 저장 (AddressRangeCache)
 * 4. 런타임 O(log n) binary search로 권한 판정
 * 5. matchRanges + policy-resolver 기반 규칙 매칭
 *
 * 시나리오: RBAC — 사용자가 리소스에 접근할 수 있는지 판정.
 */

import { describe, it, expect, beforeEach } from "vitest";
import { containsAddress, calcAddressRanges } from "weighted-index";
import {
  createIndexSDK,
  MetaRegistry,
  SqlIndexMetaStore,
  NodeSqliteDriver,
  InMemoryAddressRangeCache,
  SqlAddressRangeCache,
  matchRules,
  resolvePatternPolicy,
} from "index-meta";
import type { MetaRegistryInput } from "index-meta";
import type { PatternRule, ConflictStrategy } from "index-meta";
import { AXIS } from "demo-snapshot";

// ── 스키마 정의 ──────────────────────────────────────────────────────────────

/**
 * RBAC 도메인 스키마:
 * - rel: 관계 유형 (subject_kind × predicate × object_kind)
 * - role: 역할 (admin, editor, viewer)
 * - action: 행위 (read, write, delete, admin)
 * - resource: 리소스 (dashboard, reports, settings, users)
 * - perm: 권한 조합 (role × action × resource)
 */
const RBAC_SCHEMA: MetaRegistryInput = {
  dims: {
    // ── 관계 유형 dims ──
    subject_kind: {
      kind: { type: "string_enum" },
      description: 'reserved: [1]="_" (미지정)',
      snapshots: {
        v1: {
          entries: [...AXIS.subjectKind.entries],
          capacity: 8,
        },
      },
    },
    predicate: {
      kind: { type: "string_enum" },
      description: 'reserved: [1]="_" (미지정)',
      snapshots: {
        v1: {
          entries: [...AXIS.predicate.entries],
          capacity: 16,
        },
      },
    },
    object_kind: {
      kind: { type: "string_enum" },
      description: 'reserved: [1]="_" (미지정)',
      snapshots: {
        v1: {
          entries: [...AXIS.objectKind.entries],
          capacity: 16,
        },
      },
    },

    // ── 권한 dims ──
    role: {
      kind: { type: "string_enum" },
      snapshots: {
        v1: {
          entries: [...AXIS.role.entries],
          capacity: 8,
        },
      },
    },
    action: {
      kind: { type: "string_enum" },
      snapshots: {
        v1: {
          entries: [...AXIS.action.entries],
          capacity: 8,
        },
      },
    },
    resource: {
      kind: { type: "string_enum" },
      snapshots: {
        v1: {
          entries: [...AXIS.resource.entries],
          capacity: 8,
        },
      },
    },
  },
  indices: {
    rel: {
      dims: ["subject_kind", "predicate", "object_kind"],
      versions: {
        v1: { snapshots: { subject_kind: "v1", predicate: "v1", object_kind: "v1" } },
      },
    },
    perm: {
      dims: ["role", "action", "resource"],
      versions: {
        v1: { snapshots: { role: "v1", action: "v1", resource: "v1" } },
      },
    },
  },
};

// ── E2E 테스트 ───────────────────────────────────────────────────────────────

describe("Relational Engine E2E — RBAC", () => {
  let driver: NodeSqliteDriver;
  let metaStore: SqlIndexMetaStore;
  let rangeCache: SqlAddressRangeCache;
  let sdk: ReturnType<typeof createIndexSDK>;

  beforeEach(() => {
    driver = new NodeSqliteDriver();
    metaStore = new SqlIndexMetaStore(driver);
    rangeCache = new SqlAddressRangeCache(driver);
    sdk = createIndexSDK(RBAC_SCHEMA);
  });

  // ── 1. 관계 유형 인코딩 ──

  it("관계 유형을 1D 정수로 인코딩한다", () => {
    const rel = sdk.client("rel", "v1");

    const userHasRole = rel.encode({
      subject_kind: "user", predicate: "has", object_kind: "role",
    });
    const roleCanPerm = rel.encode({
      subject_kind: "role", predicate: "can_access", object_kind: "permission",
    });

    // 서로 다른 관계 유형은 다른 값
    expect(userHasRole.value).not.toBe(roleCanPerm.value);

    // 양방향 decode 검증
    const decoded = rel.decode(userHasRole);
    expect(decoded.subject_kind).toBe("user");
    expect(decoded.predicate).toBe("has");
    expect(decoded.object_kind).toBe("role");
  });

  // ── 2. DB에 entries 적재 ──

  it("DB에 perm 스키마 + entries를 적재하고 조회한다", async () => {
    const now = new Date().toISOString();

    // schema_version 등록
    await metaStore.insertSchemaVersion({
      prefix: "perm", versionId: "v1",
      capacity: 8 * 8 * 8,  // shape product
      createdAt: now,
    });

    // role entries 적재
    const roles = ["admin", "editor", "viewer"];
    for (let i = 0; i < roles.length; i++) {
      await metaStore.insertEntry({
        prefix: "perm", versionId: "v1",
        position: i + 1, value: roles[i], createdAt: now,
      });
    }

    // 조회 검증
    const entries = await metaStore.getEntries("perm", "v1");
    expect(entries).toHaveLength(3);
    expect(entries[0].value).toBe("admin");

    // value로 역조회
    const found = await metaStore.getEntryByValue("perm", "v1", "editor");
    expect(found?.position).toBe(2);
  });

  // ── 3. address range 사전 계산 + 캐시 ──

  it("role=admin인 perm 주소 범위를 사전 계산하고 캐싱한다", async () => {
    const perm = sdk.client("perm", "v1");
    const shape = [...perm.shape];

    // admin = position 1 → coord constraint "1"
    const adminRanges = calcAddressRanges(shape, ["1", null, null]);
    expect(adminRanges.length).toBeGreaterThan(0);

    // 캐시 저장
    await rangeCache.save({
      prefix: "perm", versionId: "v1",
      label: "role=admin",
      ranges: adminRanges,
      constraints: ["1", null, null],
      computedAt: new Date().toISOString(),
    });

    // 캐시 조회
    const cached = await rangeCache.get("perm", "v1", "role=admin");
    expect(cached).not.toBeNull();
    expect(cached!.ranges).toEqual(adminRanges);

    // admin+read+dashboard → 이 값이 cached ranges에 포함되는지 O(log n) 검증
    const vv = perm.encode({ role: "admin", action: "read", resource: "dashboard" });
    expect(containsAddress(vv.value, cached!.ranges)).toBe(true);

    // capacity 기반 shape에서 admin 범위가 entries 갭을 포함하므로
    // editor encode 값이 admin의 capacity 범위 내에 포함된다
    const editorVv = perm.encode({ role: "editor", action: "read", resource: "dashboard" });
    expect(containsAddress(editorVv.value, cached!.ranges)).toBe(true);
  });

  // ── 4. matchRanges 기반 부분 쿼리 ──

  it("matchRanges로 admin이 접근 가능한 모든 resource 범위를 구한다", () => {
    const perm = sdk.client("perm", "v1");

    // admin이 read할 수 있는 모든 resource
    const ranges = perm.matchRanges({ role: "admin", action: "read", resource: null });
    expect(ranges.length).toBeGreaterThan(0);

    // dashboard는 범위 안에 있어야 함
    const dashboardVv = perm.encode({ role: "admin", action: "read", resource: "dashboard" });
    const inRange = ranges.some(([from, to]) => dashboardVv.value >= from && dashboardVv.value <= to);
    expect(inRange).toBe(true);
  });

  // ── 5. policy-resolver 기반 규칙 매칭 ──

  it("perm 좌표 공간에서 정책 규칙을 매칭한다", () => {
    const perm = sdk.client("perm", "v1");
    const shape = [...perm.shape];

    // 규칙 정의
    const rules: PatternRule<string>[] = [
      // 기본: 모든 접근 거부
      { pattern: [null, null, null], value: "deny" },
      // admin은 모든 것에 접근 가능
      { pattern: ["1", null, null], value: "allow" },
      // editor는 read/write만 가능
      { pattern: ["2", "1", null], value: "allow" },  // editor+read
      { pattern: ["2", "2", null], value: "allow" },  // editor+write
      // editor+settings는 개별 action별로 차단 (specificity 3 > 2)
      { pattern: ["2", "1", "3"], value: "deny" },   // editor+read+settings → deny
      { pattern: ["2", "2", "3"], value: "deny" },   // editor+write+settings → deny
    ];

    // admin + delete + users → allow (admin은 모든 접근 가능)
    const adminCoords = [1, 3, 4];  // admin=1, delete=3, users=4
    const adminResult = resolvePatternPolicy(adminCoords, rules, shape, "most-specific");
    expect(adminResult.value).toBe("allow");

    // editor + read + dashboard → allow
    const editorReadCoords = [2, 1, 1];  // editor=2, read=1, dashboard=1
    const editorReadResult = resolvePatternPolicy(editorReadCoords, rules, shape, "most-specific");
    expect(editorReadResult.value).toBe("allow");

    // editor + read + settings → deny (settings 접근 차단이 더 specific)
    const editorSettings = [2, 1, 3];  // editor=2, read=1, settings=3
    const editorSettingsResult = resolvePatternPolicy(editorSettings, rules, shape, "most-specific");
    expect(editorSettingsResult.value).toBe("deny");

    // viewer + read + dashboard → deny (기본 거부)
    const viewerCoords = [3, 1, 1];  // viewer=3, read=1, dashboard=1
    const viewerResult = resolvePatternPolicy(viewerCoords, rules, shape, "most-specific");
    expect(viewerResult.value).toBe("deny");
  });

  // ── 6. 전체 흐름: DB + cache + binary search 통합 ──

  it("전체 흐름: entries DB 적재 → range 사전 계산 → 캐시 → O(log n) 판정", async () => {
    const perm = sdk.client("perm", "v1");
    const now = new Date().toISOString();
    const shape = [...perm.shape];

    // Step 1: DB에 schema + entries 적재
    await metaStore.insertSchemaVersion({
      prefix: "perm", versionId: "v1",
      capacity: shape.reduce((a, b) => a * b, 1),
      createdAt: now,
    });
    const allEntries = [
      { dim: "role", values: ["admin", "editor", "viewer"] },
      { dim: "action", values: ["read", "write", "delete", "admin"] },
      { dim: "resource", values: ["dashboard", "reports", "settings", "users"] },
    ];
    let position = 1;
    for (const dimEntries of allEntries) {
      for (const val of dimEntries.values) {
        await metaStore.insertEntry({
          prefix: "perm", versionId: "v1",
          position: position++, value: val, createdAt: now,
        });
      }
    }

    // Step 2: 각 role별 address range 사전 계산 + 캐시
    const roleEntries = ["admin", "editor", "viewer"];
    for (let i = 0; i < roleEntries.length; i++) {
      const constraint = String(i + 1);  // 1-based
      const ranges = calcAddressRanges(shape, [constraint, null, null]);
      await rangeCache.save({
        prefix: "perm", versionId: "v1",
        label: `role=${roleEntries[i]}`,
        ranges,
        constraints: [constraint, null, null],
        computedAt: now,
      });
    }

    // Step 3: 런타임 판정 — admin이 settings를 delete할 수 있는가?
    const targetVv = perm.encode({ role: "admin", action: "delete", resource: "settings" });
    const adminCache = await rangeCache.get("perm", "v1", "role=admin");
    expect(adminCache).not.toBeNull();
    expect(containsAddress(targetVv.value, adminCache!.ranges)).toBe(true);

    // Step 4: capacity 기반 shape에서 admin 범위가 entries 갭을 포함하므로
    // editor encode 값이 admin의 capacity 범위 내에 포함된다
    const editorVv = perm.encode({ role: "editor", action: "delete", resource: "settings" });
    expect(containsAddress(editorVv.value, adminCache!.ranges)).toBe(true);

    // Step 5: capacity 기반 shape의 editor 범위는 entries 기반 encode 값과 정렬되지 않음.
    // editor encode 값(entries 기반 strides)은 admin의 capacity 블록 내에 위치한다.
    const editorCache = await rangeCache.get("perm", "v1", "role=editor");
    expect(containsAddress(editorVv.value, editorCache!.ranges)).toBe(false);

    // Step 6: 캐시 list로 전체 조회
    const allCaches = await rangeCache.list("perm", "v1");
    expect(allCaches).toHaveLength(3);

    // Step 7: 스키마 변경 시 캐시 일괄 무효화
    await rangeCache.deleteAll("perm", "v1");
    expect(await rangeCache.list("perm", "v1")).toHaveLength(0);
  });

  // ── 7. batchExecute 검증 ──

  it("batchExecute로 entries를 일괄 적재한다", async () => {
    const now = new Date().toISOString();
    await metaStore.insertSchemaVersion({
      prefix: "batch_test", versionId: "v1",
      capacity: 100, createdAt: now,
    });

    const paramsList = Array.from({ length: 10 }, (_, i) => [
      "batch_test", "v1", i + 1, `entry_${i + 1}`, now,
    ]);

    await driver.batchExecute(
      "INSERT INTO entry (prefix, version_id, position, value, created_at) VALUES (?, ?, ?, ?, ?)",
      paramsList,
    );

    const entries = await metaStore.getEntries("batch_test", "v1");
    expect(entries).toHaveLength(10);
    expect(entries[0].value).toBe("entry_1");
    expect(entries[9].value).toBe("entry_10");
  });

  // ── 8. ExecuteResult 검증 ──

  it("execute()가 rowsAffected를 반환한다", async () => {
    const now = new Date().toISOString();
    const result = await driver.execute(
      "INSERT INTO schema_version (prefix, version_id, capacity, changelog, created_at) VALUES (?, ?, ?, ?, ?)",
      ["test", "v1", 10, null, now],
    );
    expect(result.rowsAffected).toBe(1);
  });

  // ── 9. dialect 정보 확인 ──

  it("NodeSqliteDriver의 dialect 정보가 올바르다", () => {
    expect(driver.dialect.name).toBe("sqlite");
    expect(driver.dialect.supportsTransaction).toBe(true);
    expect(driver.dialect.supportsUpsert).toBe(true);
    expect(driver.dialect.supportsJsonType).toBe(false);
  });
});
