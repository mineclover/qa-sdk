/**
 * RelationalEngine facade 테스트
 *
 * 관계형 엔진의 통합 진입점이 올바르게 동작하는지 검증:
 * - 1D 인코딩/디코딩 위임
 * - 범위 쿼리 + containsAddress
 * - 2-level rule engine
 * - cross-index 합성 질의 + 깊은 디코딩
 */

import { describe, it, expect } from "vitest";
import { RelationalEngine } from "index-meta";
import type { RelationTypeRule } from "index-meta";
import type { PolicyRule } from "index-meta";
import type { MetaRegistryInput } from "index-meta";
import { AXIS } from "demo-snapshot";

// ── 공통 픽스처 ──────────────────────────────────────────────────────────────

const RBAC_SCHEMA: MetaRegistryInput = {
  dims: {
    subject_kind: {
      kind: { type: "string_enum" },
      snapshots: { v1: { entries: [...AXIS.subjectKind.entries], capacity: 8 } },
    },
    predicate: {
      kind: { type: "string_enum" },
      snapshots: { v1: { entries: [...AXIS.predicate.entries], capacity: 16 } },
    },
    object_kind: {
      kind: { type: "string_enum" },
      snapshots: { v1: { entries: [...AXIS.objectKind.entries], capacity: 16 } },
    },
    role: {
      kind: { type: "string_enum" },
      snapshots: { v1: { entries: [...AXIS.role.entries], capacity: 8 } },
    },
    action: {
      kind: { type: "string_enum" },
      snapshots: { v1: { entries: [...AXIS.action.entries], capacity: 8 } },
    },
    resource: {
      kind: { type: "string_enum" },
      snapshots: { v1: { entries: [...AXIS.resource.entries], capacity: 8 } },
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

// ── 테스트 ────────────────────────────────────────────────────────────────────

describe("RelationalEngine", () => {
  it("encode/decode가 양방향 변환된다", () => {
    const engine = new RelationalEngine(RBAC_SCHEMA);

    const vv = engine.encode("rel", "v1", {
      subject_kind: "user", predicate: "has", object_kind: "role",
    });
    const decoded = engine.decode("rel", "v1", vv);
    expect(decoded.subject_kind).toBe("user");
    expect(decoded.predicate).toBe("has");
    expect(decoded.object_kind).toBe("role");
  });

  it("matchRanges로 부분 쿼리 범위를 구한다", () => {
    const engine = new RelationalEngine(RBAC_SCHEMA);

    const ranges = engine.matchRanges("perm", "v1", {
      role: "admin", action: null, resource: null,
    });
    expect(ranges.length).toBeGreaterThan(0);

    // admin+read+dashboard는 범위 안에 있어야 함
    const vv = engine.encode("perm", "v1", {
      role: "admin", action: "read", resource: "dashboard",
    });
    expect(engine.contains(vv.value, ranges)).toBe(true);

    // editor+read+dashboard는 admin 범위 밖
    const editorVv = engine.encode("perm", "v1", {
      role: "editor", action: "read", resource: "dashboard",
    });
    expect(engine.contains(editorVv.value, ranges)).toBe(false);
  });

  it("single-level resolvePolicy로 규칙 매칭한다", () => {
    const engine = new RelationalEngine(RBAC_SCHEMA);
    const wi = engine.registry.getWeightedIndex("perm", "v1");

    const rules: PolicyRule<string>[] = [
      { id: "default", pattern: [null, null, null], value: "deny" },
      { id: "admin-all", pattern: ["1", null, null], value: "allow" },
      { id: "editor-read", pattern: ["2", "1", null], value: "allow" },
    ];

    // admin → allow
    const adminResult = engine.resolvePolicy([1, 3, 4], rules, wi.shape, "most-specific");
    expect(adminResult?.value).toBe("allow");

    // editor+read → allow
    const editorResult = engine.resolvePolicy([2, 1, 1], rules, wi.shape, "most-specific");
    expect(editorResult?.value).toBe("allow");

    // viewer → deny (기본)
    const viewerResult = engine.resolvePolicy([3, 1, 1], rules, wi.shape, "most-specific");
    expect(viewerResult?.value).toBe("deny");
  });

  it("2-level resolveRelation으로 type→instance 매칭한다", () => {
    const engine = new RelationalEngine(RBAC_SCHEMA);
    const relWi = engine.registry.getWeightedIndex("rel", "v1");

    // type-level: "user has role" → 허용하되 instance 규칙으로 위임
    // type-level: 그 외 → deny
    const typeRules: RelationTypeRule<string>[] = [
      {
        id: "default-deny",
        pattern: [null, null, null],
        effect: "deny",
      },
      {
        id: "user-has-role",
        pattern: ["2", "2", "2"],  // user=2, has=2, role=2
        effect: "allow_with_check",
        instanceRules: {
          indexId: "perm",
          versionId: "v1",
          rules: [
            { id: "perm-default", pattern: [null, null, null], value: "deny" },
            { id: "admin-all", pattern: ["1", null, null], value: "allow" },
            { id: "editor-read", pattern: ["2", "1", null], value: "allow" },
          ],
          strategy: "most-specific",
        },
      },
    ];

    // user has role + admin coords → type 매칭 후 instance에서 allow
    const result = engine.resolveRelation(
      [2, 2, 2], relWi.shape, typeRules, "most-specific",
      [1, 3, 4],  // admin=1, delete=3, users=4
    );
    expect(result).not.toBeNull();
    expect(result!.value).toBe("allow");
    expect(result!.instanceLevel).not.toBeNull();

    // user has role + viewer coords → type 매칭 후 instance에서 deny
    const viewerResult = engine.resolveRelation(
      [2, 2, 2], relWi.shape, typeRules, "most-specific",
      [3, 1, 1],  // viewer=3, read=1, dashboard=1
    );
    expect(viewerResult!.value).toBe("deny");

    // "group belongs_to resource" → type-level deny (instance 없음)
    const groupResult = engine.resolveRelation(
      [4, 4, 5], relWi.shape, typeRules, "most-specific",
    );
    expect(groupResult!.value).toBe("deny");
    expect(groupResult!.instanceLevel).toBeUndefined();
  });

  it("detectConflicts로 규칙 충돌을 탐지한다", () => {
    const engine = new RelationalEngine(RBAC_SCHEMA);
    const wi = engine.registry.getWeightedIndex("perm", "v1");

    const rules: PolicyRule<string>[] = [
      { id: "admin-all", pattern: ["1", null, null], value: "allow" },
      { id: "settings-deny", pattern: [null, null, "3"], value: "deny" },
    ];

    const conflicts = engine.detectConflicts(rules, wi.shape);
    // admin + any + settings → allow vs deny 충돌
    expect(conflicts.length).toBeGreaterThan(0);
  });
});

// ── cross-index 합성 질의 ──

describe("RelationalEngine — cross-index", () => {
  const INDEX_REF_SCHEMA: MetaRegistryInput = {
    dims: {
      format: {
        kind: { type: "string_enum" },
        snapshots: { fv1: { entries: ["pdf", "html"] } },
      },
      lang: {
        kind: { type: "string_enum" },
        snapshots: { lv1: { entries: ["ko", "en"] } },
      },
      quality_tier: {
        kind: { type: "index_ref", indexId: "doc_meta" },
        snapshots: { qtv1: { entries: [0, 2] } },
      },
    },
    indices: {
      doc_meta: {
        dims: ["format", "lang"],
        versions: { dmv1: { snapshots: { format: "fv1", lang: "lv1" } } },
      },
      article: {
        dims: ["quality_tier"],
        versions: { av1: { snapshots: { quality_tier: "qtv1" } } },
      },
    },
  };

  it("composeQuery로 target 조건 → source 범위를 합성한다", () => {
    const engine = new RelationalEngine(INDEX_REF_SCHEMA);

    // "format=pdf인 article"의 value 범위
    const ranges = engine.composeQuery(
      { indexId: "article", versionId: "av1" },
      "quality_tier",
      { format: "pdf", lang: null },
    );
    expect(ranges.length).toBeGreaterThan(0);
  });

  it("deepDecode로 index_ref 체인을 재귀 디코딩한다", () => {
    const engine = new RelationalEngine(INDEX_REF_SCHEMA);

    const articleCodec = engine.codec("article", "av1");
    const vv = articleCodec.encode({ quality_tier: 2 });

    const result = engine.deepDecode(vv);
    expect(result.layers.has("article")).toBe(true);
    expect(result.layers.has("doc_meta")).toBe(true);

    const docMeta = result.layers.get("doc_meta")!;
    expect(docMeta.format).toBe("html");
    expect(docMeta.lang).toBe("ko");
  });
});
