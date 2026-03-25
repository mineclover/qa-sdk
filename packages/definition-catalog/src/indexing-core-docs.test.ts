/**
 * Indexing Core 시스템 문서 링크 검증
 *
 * indexing-core-system overview가 contains로 선언한 20개 멤버 문서를 스캔하고,
 * 멤버 간 횡방향 링크와 핵심 의존 관계가 유지되는지 확인한다.
 */

import { describe, it, expect, beforeAll } from "vitest";
import { join } from "node:path";
import { scanAndBuild } from "./frontmatter.js";
import type { ScanResult } from "./frontmatter.js";

const ROOT = join(import.meta.dirname, "../../..");

let result: ScanResult;

const INDEXING_CORE_MEMBER_IDS = [
  "coord-foundation",
  "data-design-group",
  "index-arch-group",
  "schema-layer-spec",
  "dsl-bundle-spec",
  "conventions-system",
  "table-system-group",
  "event-schema-spec",
  "signal-model-spec",
  "coord-states-group",
  "bigint-addressing-group",
  "acceleration-spec",
  "coord-patterns",
  "behavior-traversal-group",
  "version-operations",
  "dim-ops-system",
  "layout-sim-formats",
  "ontology-eval",
  "slot-marker-group",
  "adr-merge-dedup",
];

const INDEXING_CORE_IDS = [
  "indexing-core-system",
  ...INDEXING_CORE_MEMBER_IDS,
];

const INDEXING_CORE_SPLIT_SOURCE_IDS = [
  "data-design-spec",
  "indexing-architecture",
  "coordinate-states-spec",
  "bigint-addressing",
  "behavioral-traversal",
];

beforeAll(async () => {
  result = await scanAndBuild(ROOT, [join(ROOT, "docs")]);
});

describe("indexing-core-system 문서 등록", () => {
  it("21건 모두 등록된다 (그룹 1 + 멤버 20)", () => {
    for (const id of INDEXING_CORE_IDS) {
      expect(result.registry.get(id), `${id} 미등록`).toBeDefined();
    }
  });

  it("파싱 에러 없음", () => {
    const indexingErrors = result.errors.filter(e =>
      e.file.includes("/specs/indexing/")
      || e.file.includes("/specs/indexing-core-system/"),
    );
    expect(indexingErrors).toEqual([]);
  });

  it("분할 원본 5건은 deprecated로 남아 있다", () => {
    for (const id of INDEXING_CORE_SPLIT_SOURCE_IDS) {
      expect(result.registry.get(id)?.lifecycle, `${id} lifecycle`).toBe("deprecated");
    }
  });
});

describe("indexing-core-system 그룹 조립", () => {
  it("contains 멤버 20건", () => {
    const links = result.registry.getLinks("indexing-core-system", "outgoing")
      .filter(l => l.linkType === "contains");
    expect(links.length).toBeGreaterThanOrEqual(20);
  });
});

describe("link 연결", () => {
  it("멤버 20건 모두 outgoing links가 있다", () => {
    for (const id of INDEXING_CORE_MEMBER_IDS) {
      if (id === "coord-foundation") continue; // 기반 원리는 의존 없음
      expect(result.registry.getLinks(id, "outgoing").length, `${id} links 없음`).toBeGreaterThan(0);
    }
  });

  it("coord-foundation을 depends_on 하는 멤버가 8건 이상이다", () => {
    const incoming = result.registry.getLinks("coord-foundation", "incoming");
    const dependents = incoming
      .filter(l => l.linkType === "depends_on")
      .map(l => l.sourceId);

    expect(dependents.length).toBeGreaterThanOrEqual(8);
    expect(dependents).toContain("data-design-spec");
    expect(dependents).toContain("coordinate-states-spec");
    expect(dependents).toContain("version-operations");
  });



  it("dsl-bundle-spec → dimension-operations (depends_on)", () => {
    const links = result.registry.getLinks("dsl-bundle-spec", "outgoing");
    expect(links.some(l => l.targetId === "dimension-operations" && l.linkType === "depends_on")).toBe(true);
  });

  it("signal-model-spec → dsl-bundle-spec (depends_on)", () => {
    const links = result.registry.getLinks("signal-model-spec", "outgoing");
    expect(links.some(l => l.targetId === "dsl-bundle-spec" && l.linkType === "depends_on")).toBe(true);
  });

  it("layout-sim-formats → bigint-addressing (depends_on)", () => {
    const links = result.registry.getLinks("layout-sim-formats", "outgoing");
    expect(links.some(l => l.targetId === "bigint-addressing" && l.linkType === "depends_on")).toBe(true);
  });

  it("indexing-conventions → acceleration-spec (constrains)", () => {
    const links = result.registry.getLinks("indexing-conventions", "outgoing");
    expect(links.some(l => l.targetId === "acceleration-spec" && l.linkType === "constrains")).toBe(true);
  });

  it("indexing-conventions → slot-marker-spec (constrains)", () => {
    const links = result.registry.getLinks("indexing-conventions", "outgoing");
    expect(links.some(l => l.targetId === "slot-marker-spec" && l.linkType === "constrains")).toBe(true);
  });

  it("adr-merge-dedup → dimension-operations (constrains)", () => {
    const links = result.registry.getLinks("adr-merge-dedup", "outgoing");
    expect(links.some(l => l.targetId === "dimension-operations" && l.linkType === "constrains")).toBe(true);
  });
});
