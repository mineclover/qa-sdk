// @def.doc definition-catalog-spec

/**
 * Indexing Core 시스템 문서 링크 검증
 *
 * indexing-core-system overview가 contains/refs로 선언한 구조 문서를 스캔하고,
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

beforeAll(async () => {
  result = await scanAndBuild(ROOT, [join(ROOT, "docs")]);
});

describe("indexing-core-system 문서 등록", () => {
  it("그룹 + 멤버 모두 등록된다", () => {
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
});

describe("indexing-core-system 그룹 조립", () => {
  it("structural 멤버 13건 이상", () => {
    const links = result.registry.getLinks("indexing-core-system", "outgoing")
      .filter(l => l.linkType === "contains" || l.linkType === "refs");
    expect(links.length).toBeGreaterThanOrEqual(13);
  });
});

describe("link 연결", () => {
  it("대부분 멤버에 outgoing links가 있다", () => {
    let withLinks = 0;
    for (const id of INDEXING_CORE_MEMBER_IDS) {
      if (id === "coord-foundation") continue;
      if (result.registry.getLinks(id, "outgoing").length > 0) withLinks++;
    }
    // 20개 중 coord-foundation 제외 19개 중 대부분에 링크가 있어야
    expect(withLinks).toBeGreaterThanOrEqual(15);
  });

  it("coord-foundation을 depends_on 하는 멤버가 8건 이상이다", () => {
    const incoming = result.registry.getLinks("coord-foundation", "incoming");
    const dependents = incoming
      .filter(l => l.linkType === "depends_on")
      .map(l => l.sourceId);
    expect(dependents.length).toBeGreaterThanOrEqual(8);
  });

  it("dsl-bundle-spec에 outgoing depends_on이 있다", () => {
    const links = result.registry.getLinks("dsl-bundle-spec", "outgoing")
      .filter(l => l.linkType === "depends_on");
    expect(links.length).toBeGreaterThan(0);
  });

  it("signal-model-spec → dsl-bundle-spec (depends_on)", () => {
    const links = result.registry.getLinks("signal-model-spec", "outgoing");
    expect(links.some(l => l.targetId === "dsl-bundle-spec" && l.linkType === "depends_on")).toBe(true);
  });
});
