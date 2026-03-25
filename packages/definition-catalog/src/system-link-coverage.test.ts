/**
 * 남은 시스템 링크 일괄 연결 회귀 테스트
 *
 * US-007에서 보강한 그룹/하위 그룹의 contains 구성과
 * 대표 횡방향 링크, 전체 orphan 해소 상태를 고정한다.
 */

import { beforeAll, describe, expect, it } from "vitest";
import { join } from "node:path";
import { scanAndBuild } from "./frontmatter.js";
import type { ScanResult } from "./frontmatter.js";
import { collectQualityStats } from "../scripts/quality-report.mjs";

const ROOT = join(import.meta.dirname, "../../..");

let result: ScanResult;

beforeAll(async () => {
  result = await scanAndBuild(ROOT, [join(ROOT, "docs")]);
});

function hasLink(sourceId: string, targetId: string, linkType: string): boolean {
  return result.registry.getLinks(sourceId, "outgoing").some(link =>
    link.targetId === targetId && link.linkType === linkType,
  );
}

function containsCount(groupId: string): number {
  return result.registry.getLinks(groupId, "outgoing").filter(link => link.linkType === "contains").length;
}

describe("US-007 링크 커버리지", () => {
  it("approved 리프 문서에서 links 없는 문서가 0건이다", () => {
    const stats = collectQualityStats(ROOT);
    // coord-foundation은 의도적으로 links 없음 (기반 원리)
    const missing = stats.linksMissingLeafDocs.filter((d: any) => d.id !== "coord-foundation");
    expect(missing).toHaveLength(0);
  });

  it("신규 subgroup overview가 contains SSOT를 선언한다", () => {
    expect(containsCount("benchmark-system")).toBe(4);
    expect(containsCount("conventions-system")).toBe(3);
    expect(containsCount("dim-ops-system")).toBe(4);
    expect(containsCount("spec-prop-system")).toBe(4);
    expect(containsCount("sdk-system")).toBe(3);
    expect(containsCount("wi-trace-group")).toBe(3);
    expect(containsCount("df-narrative-group")).toBe(3);
  });

  it("대표 constraint/feature/data 링크가 유지된다", () => {
    expect(hasLink("permission-constraint", "perm-codec-spec", "constrains")).toBe(true);
    expect(hasLink("decode-deploy", "decode-api", "constrains")).toBe(true);
    expect(hasLink("query-rules", "registry-data-model", "depends_on")).toBe(true);
    expect(hasLink("registry-client-spec", "registry-events-spec", "depends_on")).toBe(true);
    expect(hasLink("dkg-skill-cascade", "dkg-skill-catalog", "depends_on")).toBe(true);
    expect(hasLink("wi-capacity-planning", "wi-pack-format-def", "depends_on")).toBe(true);
    expect(hasLink("cq-version-query", "registry-version-lifecycle", "depends_on")).toBe(true);
    expect(hasLink("browser-monitor-spec", "browser-lifecycle-spec", "depends_on")).toBe(true);
    expect(hasLink("convergence-layer-spec", "spec-core-types", "depends_on")).toBe(true);
    expect(hasLink("index-meta-sdk-spec", "table-schema-spec", "depends_on")).toBe(true);
    expect(hasLink("event-core-pattern", "graph-spec", "depends_on")).toBe(true);
    expect(hasLink("quickstart-guide", "system-data-flow", "refines")).toBe(true);
  });
});
