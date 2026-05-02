// @def.boundary index-meta-system
// @def.doc index-meta-system

/**
 * named-policy.test.ts — entity name 기반 정책 규칙 테스트
 *
 * [NP-1] matchToConstraints: entity name → CoordConstraint 변환
 * [NP-2] matchToConstraints: dim 누락 시 에러
 * [NP-3] matchToConstraints: unknown dim 시 에러
 * [NP-4] matchToConstraints: 존재하지 않는 entry 시 에러
 * [NP-5] matchToConstraints: 배열(복수 entry) 지원
 * [NP-6] resolvePolicy: admin allow, default deny
 * [NP-7] resolvePolicy: 복수 entry + most-specific
 * [NP-8] detectConflicts: 겹치는 규칙 감지
 * [NP-9] entitiesToCoord: 전체 좌표 변환
 */

import { describe, it, expect } from "vitest";
import { MetaCodec } from "./meta-codec.js";
import type { DecodeMap } from "./types.js";
import {
  WILDCARD,
  matchToConstraints,
  entitiesToCoord,
  resolvePolicy,
  detectConflicts,
} from "./named-policy.js";
import type { PolicyRule } from "./named-policy.js";

// ── 픽스처: role(3) × action(4) × resource(2) ──────────

const DECODE_MAP: DecodeMap = {
  indexId: "perm",
  versionId: "v1",
  shape: [3, 4, 2],
  size: 24,
  dims: [
    {
      dimId: "role",
      snapshotId: "rv1",
      kind: { type: "string_enum" },
      entries: ["admin", "editor", "viewer"],
    },
    {
      dimId: "action",
      snapshotId: "av1",
      kind: { type: "string_enum" },
      entries: ["read", "write", "delete", "admin"],
    },
    {
      dimId: "resource",
      snapshotId: "resv1",
      kind: { type: "string_enum" },
      entries: ["dashboard", "settings"],
    },
  ],
};

const codec = new MetaCodec(DECODE_MAP);

// ── matchToConstraints ──────────────────────────────────

describe("matchToConstraints", () => {
  it("[NP-1] entity name → CoordConstraint 변환", () => {
    const result = matchToConstraints(codec, {
      role: "admin",
      action: WILDCARD,
      resource: "dashboard",
    });

    expect(result).toEqual(["1", null, "1"]);
  });

  it("[NP-2] dim 누락 시 에러", () => {
    expect(() =>
      matchToConstraints(codec, {
        role: "admin",
        // action 누락!
        resource: "dashboard",
      }),
    ).toThrow(/dim "action" 누락/);
  });

  it("[NP-3] unknown dim 시 에러", () => {
    expect(() =>
      matchToConstraints(codec, {
        role: "admin",
        action: WILDCARD,
        resource: "dashboard",
        unknown_dim: "foo",
      }),
    ).toThrow(/unknown dim "unknown_dim"/);
  });

  it("[NP-4] 존재하지 않는 entry 시 에러", () => {
    expect(() =>
      matchToConstraints(codec, {
        role: "superadmin",
        action: WILDCARD,
        resource: WILDCARD,
      }),
    ).toThrow(/entry "superadmin" 없음/);
  });

  it("[NP-5] 배열(복수 entry) → position 목록", () => {
    const result = matchToConstraints(codec, {
      role: ["admin", "editor"],
      action: WILDCARD,
      resource: WILDCARD,
    });

    // admin=1, editor=2
    expect(result).toEqual(["1,2", null, null]);
  });
});

// ── entitiesToCoord ─────────────────────────────────────

describe("entitiesToCoord", () => {
  it("[NP-9] 전체 좌표 변환", () => {
    const coord = entitiesToCoord(codec, {
      role: "editor",
      action: "write",
      resource: "settings",
    });

    // editor=2, write=2, settings=2
    expect(coord).toEqual([2, 2, 2]);
  });
});

// ── resolvePolicy ──────────────────────────────────

describe("resolvePolicy", () => {
  const rules: PolicyRule<string>[] = [
    {
      id: "default",
      match: { role: WILDCARD, action: WILDCARD, resource: WILDCARD },
      value: "deny",
    },
    {
      id: "admin-all",
      match: { role: "admin", action: WILDCARD, resource: WILDCARD },
      value: "allow",
    },
    {
      id: "read-all",
      match: { role: WILDCARD, action: "read", resource: WILDCARD },
      value: "allow",
    },
  ];

  it("[NP-6] admin × delete → allow (admin-all 규칙 승리)", () => {
    const result = resolvePolicy(
      codec,
      { role: "admin", action: "delete", resource: "dashboard" },
      rules,
      "most-specific",
    );

    expect(result).not.toBeNull();
    expect(result!.value).toBe("allow");
    expect(result!.matchedRules[0].id).toBe("admin-all");
  });

  it("[NP-6] editor × write → deny (default만 매칭)", () => {
    const result = resolvePolicy(
      codec,
      { role: "editor", action: "write", resource: "settings" },
      rules,
      "most-specific",
    );

    expect(result).not.toBeNull();
    expect(result!.value).toBe("deny");
  });

  it("[NP-6] viewer × read → allow (read-all 규칙 승리)", () => {
    const result = resolvePolicy(
      codec,
      { role: "viewer", action: "read", resource: "dashboard" },
      rules,
      "most-specific",
    );

    expect(result).not.toBeNull();
    expect(result!.value).toBe("allow");
    expect(result!.matchedRules[0].id).toBe("read-all");
  });

  it("[NP-7] 복수 entry 규칙 매칭", () => {
    const rulesWithMulti: PolicyRule<string>[] = [
      {
        id: "default",
        match: { role: WILDCARD, action: WILDCARD, resource: WILDCARD },
        value: "deny",
      },
      {
        id: "rw-editors",
        match: { role: "editor", action: ["read", "write"], resource: WILDCARD },
        value: "allow",
      },
    ];

    const readResult = resolvePolicy(
      codec,
      { role: "editor", action: "read", resource: "dashboard" },
      rulesWithMulti,
      "most-specific",
    );
    expect(readResult!.value).toBe("allow");

    const deleteResult = resolvePolicy(
      codec,
      { role: "editor", action: "delete", resource: "dashboard" },
      rulesWithMulti,
      "most-specific",
    );
    expect(deleteResult!.value).toBe("deny");
  });
});

// ── detectConflicts ────────────────────────────────

describe("detectConflicts", () => {
  it("[NP-8] 겹치는 규칙 감지", () => {
    const conflictingRules: PolicyRule<string>[] = [
      {
        id: "admin-all",
        match: { role: "admin", action: WILDCARD, resource: WILDCARD },
        value: "allow",
      },
      {
        id: "deny-delete",
        match: { role: WILDCARD, action: "delete", resource: WILDCARD },
        value: "deny",
      },
    ];

    const conflicts = detectConflicts(codec, conflictingRules);
    // admin × delete에서 allow vs deny 충돌
    expect(conflicts.length).toBe(1);
    expect(conflicts[0].conflictingRules.map(r => r.id)).toEqual(["admin-all", "deny-delete"]);
  });
});
