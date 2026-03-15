import { describe, it, expect } from "vitest";
import { MetaRegistry } from "./meta-registry.js";
import {
  queryAcrossVersions,
  entityVersionSpan,
  translateConstraint,
} from "./version-query.js";
import { ValidationError } from "./errors.js";

// ── 픽스처: 다중 버전 index ──────────────────────────────────────────────────

const createFixture = () =>
  new MetaRegistry({
    dims: {
      role: {
        kind: { type: "string_enum" },
        snapshots: {
          v1: { entries: ["admin", "editor", "viewer"] },
          v2: { entries: ["admin", "editor", "viewer", "guest"] },
          v3: {
            entries: ["admin", "editor", "viewer", "guest"],
            entryFlags: {
              3: { status: "inactive", reason: "deprecated", updatedAt: "2026-01-01" },
            },
          },
        },
      },
      action: {
        kind: { type: "string_enum" },
        snapshots: {
          v1: { entries: ["read", "write", "delete"] },
        },
      },
      resource: {
        kind: { type: "number_enum" },
        snapshots: {
          v1: { entries: [10, 20, 30] },
        },
      },
    },
    indices: {
      perm: {
        dims: ["role", "action", "resource"],
        versions: {
          iv1: { snapshots: { role: "v1", action: "v1", resource: "v1" } },
          iv2: { snapshots: { role: "v2", action: "v1", resource: "v1" } },
          iv3: { snapshots: { role: "v3", action: "v1", resource: "v1" } },
        },
      },
    },
  });

// ── queryAcrossVersions ──────────────────────────────────────────────────────

describe("queryAcrossVersions", () => {
  it("entity 기준으로 여러 version의 범위를 반환한다", () => {
    const registry = createFixture();

    const result = queryAcrossVersions(
      "perm",
      ["iv1", "iv2", "iv3"],
      { role: "admin" },
      registry,
    );

    expect(result.size).toBe(3);
    // iv1: shape=[3,3,3]=27, admin=pos 1, weight=9 → [0, 8]
    expect(result.get("iv1")).toEqual([[0, 8]]);
    // iv2: shape=[4,3,3]=36, admin=pos 1, weight=9 → [0, 8]
    expect(result.get("iv2")).toEqual([[0, 8]]);
    // iv3: shape=[4,3,3]=36, admin=pos 1, weight=9 → [0, 8]
    expect(result.get("iv3")).toEqual([[0, 8]]);
  });

  it("entity가 특정 version에만 존재하면 해당 version만 반환", () => {
    const registry = createFixture();

    const result = queryAcrossVersions(
      "perm",
      ["iv1", "iv2", "iv3"],
      { role: "guest" },
      registry,
    );

    // guest는 v2부터 존재 → iv1은 제외
    expect(result.has("iv1")).toBe(false);
    expect(result.has("iv2")).toBe(true);
    expect(result.has("iv3")).toBe(true);
  });

  it("와일드카드 dim은 모든 version에서 전체 범위", () => {
    const registry = createFixture();

    const result = queryAcrossVersions(
      "perm",
      ["iv1", "iv2"],
      { role: "admin", action: null },
      registry,
    );

    expect(result.get("iv1")).toEqual([[0, 8]]);
    expect(result.get("iv2")).toEqual([[0, 8]]);
  });

  it("여러 dim 동시 제약", () => {
    const registry = createFixture();

    const result = queryAcrossVersions(
      "perm",
      ["iv1"],
      { role: "admin", action: "read", resource: 10 },
      registry,
    );

    // 완전 고정: 단일 주소
    const ranges = result.get("iv1")!;
    expect(ranges).toHaveLength(1);
    expect(ranges[0][0]).toBe(ranges[0][1]); // from === to
  });
});

// ── entityVersionSpan ────────────────────────────────────────────────────────

describe("entityVersionSpan", () => {
  it("entity가 존재하는 모든 version 반환", () => {
    const registry = createFixture();

    // admin은 v1, v2, v3 모두에 존재
    const span = entityVersionSpan("perm", "role", "admin", registry);
    expect(span).toEqual(["iv1", "iv2", "iv3"]);
  });

  it("일부 version에만 존재하는 entity", () => {
    const registry = createFixture();

    // guest는 v2부터 존재
    const span = entityVersionSpan("perm", "role", "guest", registry);
    expect(span).toEqual(["iv2", "iv3"]);
  });

  it("존재하지 않는 entity → 빈 배열", () => {
    const registry = createFixture();

    const span = entityVersionSpan("perm", "role", "superadmin", registry);
    expect(span).toEqual([]);
  });

  it("activeOnly: true이면 inactive인 version 제외", () => {
    const registry = createFixture();

    // viewer는 v3에서 inactive
    const allSpan = entityVersionSpan("perm", "role", "viewer", registry);
    expect(allSpan).toEqual(["iv1", "iv2", "iv3"]);

    const activeSpan = entityVersionSpan("perm", "role", "viewer", registry, {
      activeOnly: true,
    });
    expect(activeSpan).toEqual(["iv1", "iv2"]);
  });

  it("index에 없는 dim으로 호출하면 에러", () => {
    const registry = createFixture();

    expect(() =>
      entityVersionSpan("perm", "nonexistent", "admin", registry),
    ).toThrow(ValidationError);
  });
});

// ── translateConstraint ──────────────────────────────────────────────────────

describe("translateConstraint", () => {
  it("같은 version → 동일 constraint 반환", () => {
    const registry = createFixture();

    const result = translateConstraint(
      "perm", "iv1", "iv1",
      { role: "1", action: null },
      registry,
    );
    expect(result).toEqual({ role: "1", action: null });
  });

  it("EntityId 기반 암묵적 이동 (append-only면 position 보존)", () => {
    const registry = createFixture();

    // iv1 → iv2: role entries에 guest 추가, 기존 위치 동일
    // admin = pos 1 in v1, pos 1 in v2
    const result = translateConstraint(
      "perm", "iv1", "iv2",
      { role: "1", action: null, resource: null },
      registry,
    );
    expect(result).not.toBeNull();
    expect(result!.role).toBe("1"); // position 보존
  });

  it("변경 없는 dim은 그대로 유지", () => {
    const registry = createFixture();

    // action은 iv1, iv2 모두 같은 snapshot
    const result = translateConstraint(
      "perm", "iv1", "iv2",
      { action: "2", resource: "1" },
      registry,
    );
    expect(result).not.toBeNull();
    expect(result!.action).toBe("2");
    expect(result!.resource).toBe("1");
  });

  it("와일드카드는 변환 없이 유지", () => {
    const registry = createFixture();

    const result = translateConstraint(
      "perm", "iv1", "iv2",
      { role: null, action: null, resource: null },
      registry,
    );
    expect(result).toEqual({ role: null, action: null, resource: null });
  });

  it("range 구문 constraint를 올바르게 파싱하고 변환한다", () => {
    const registry = createFixture();

    // iv1 → iv2: append-only (guest 추가), 기존 position 동일
    // "1-2" = admin(1), editor(2) → 그대로 "1-2"
    const result = translateConstraint(
      "perm", "iv1", "iv2",
      { role: "1-2", action: null, resource: null },
      registry,
    );
    expect(result).not.toBeNull();
    expect(result!.role).toBe("1-2");
  });

  it("비연속 range 구문도 올바르게 변환한다", () => {
    const registry = createFixture();

    // "1,3" = admin(1), viewer(3)
    const result = translateConstraint(
      "perm", "iv1", "iv2",
      { role: "1,3", action: null, resource: null },
      registry,
    );
    expect(result).not.toBeNull();
    expect(result!.role).toBe("1,3");
  });

  it("migration edge가 있는 swap 시나리오", () => {
    // editor(2)↔viewer(3) swap + guest(4) 추가
    const swapRegistry = new MetaRegistry({
      dims: {
        role: {
          kind: { type: "string_enum" },
          snapshots: {
            s1: { entries: ["admin", "editor", "viewer"] },
            s2: { entries: ["admin", "viewer", "editor", "guest"] },
          },
          migrations: [
            { fromSnapshotId: "s1", toSnapshotId: "s2", indexMap: { 2: 3, 3: 2 } },
          ],
        },
        action: {
          kind: { type: "string_enum" },
          snapshots: { v1: { entries: ["read", "write"] } },
        },
      },
      indices: {
        perm: {
          dims: ["role", "action"],
          versions: {
            iv1: { snapshots: { role: "s1", action: "v1" } },
            iv2: { snapshots: { role: "s2", action: "v1" } },
          },
        },
      },
    });

    // editor는 s1에서 pos 2, s2에서 pos 3 (migration에 의해)
    const result = translateConstraint(
      "perm", "iv1", "iv2",
      { role: "2", action: null },
      swapRegistry,
    );
    expect(result).not.toBeNull();
    expect(result!.role).toBe("3"); // editor: 2→3

    // range "2-3" (editor, viewer) → migration에 의해 "2-3" (viewer, editor, 순서만 바뀜)
    const rangeResult = translateConstraint(
      "perm", "iv1", "iv2",
      { role: "2-3", action: null },
      swapRegistry,
    );
    expect(rangeResult).not.toBeNull();
    expect(rangeResult!.role).toBe("2-3"); // {2→3, 3→2} → positions {3,2} → "2-3"
  });
});
