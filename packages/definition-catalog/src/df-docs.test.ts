/**
 * Decision Flow 시스템 문서 링크 검증
 *
 * df-system이 포함하는 10개 멤버 문서를 스캔하고,
 * 멤버 간 횡방향 링크와 contains 구성이 유지되는지 확인한다.
 */

import { describe, it, expect, beforeAll } from "vitest";
import { join } from "node:path";
import { scanAndBuild } from "./frontmatter.js";
import type { ScanResult } from "./frontmatter.js";

const ROOT = join(import.meta.dirname, "../../..");

let result: ScanResult;

const DF_MEMBER_IDS = [
  "df-axis-model",
  "df-observation-space",
  "df-vector-analysis",
  "df-constraint",
  "df-state-model",
  "df-serialization",
  "df-causal-mapping",
  "decision-standard",
  "df-narrative",
  "axis-decision-guide",
];

const DF_IDS = [
  "df-system",
  ...DF_MEMBER_IDS,
];

beforeAll(async () => {
  result = await scanAndBuild(ROOT, [join(ROOT, "docs")]);
});

describe("decision-flow 문서 등록", () => {
  it("11건 모두 등록된다 (그룹 1 + 멤버 10)", () => {
    for (const id of DF_IDS) {
      expect(result.registry.get(id), `${id} 미등록`).toBeDefined();
    }
  });

  it("파싱 에러 없음", () => {
    const dfErrors = result.errors.filter(e =>
      e.file.includes("/decision-flow/")
      || e.file.endsWith("/spec-engine/decision-standard.md")
      || e.file.endsWith("/guides/axis-decision-guide.md"),
    );
    expect(dfErrors).toEqual([]);
  });
});

describe("df-system 그룹 조립", () => {
  it("contains 멤버 10건", () => {
    const links = result.registry.getLinks("df-system", "outgoing")
      .filter(l => l.linkType === "contains");
    expect(links.length).toBeGreaterThanOrEqual(10);
  });
});

describe("link 연결", () => {
  it("df-system 멤버 10건 모두 outgoing links가 있다", () => {
    for (const id of DF_MEMBER_IDS) {
      expect(result.registry.getLinks(id, "outgoing").length, `${id} links 없음`).toBeGreaterThan(0);
    }
  });

  it("df-vector-analysis → df-observation-space (depends_on)", () => {
    const links = result.registry.getLinks("df-vector-analysis", "outgoing");
    expect(links.some(l => l.targetId === "df-observation-space" && l.linkType === "depends_on")).toBe(true);
  });

  it("df-serialization → df-observation-space (depends_on)", () => {
    const links = result.registry.getLinks("df-serialization", "outgoing");
    expect(links.some(l => l.targetId === "df-observation-space" && l.linkType === "depends_on")).toBe(true);
  });

  it("df-causal-mapping → df-state-model (depends_on)", () => {
    const links = result.registry.getLinks("df-causal-mapping", "outgoing");
    expect(links.some(l => l.targetId === "df-state-model" && l.linkType === "depends_on")).toBe(true);
  });

  it("df-axis-model → axis-decision-guide (depends_on)", () => {
    const links = result.registry.getLinks("df-axis-model", "outgoing");
    expect(links.some(l => l.targetId === "axis-decision-guide" && l.linkType === "depends_on")).toBe(true);
  });

  it("df-constraint → df-vector-analysis (constrains)", () => {
    const links = result.registry.getLinks("df-constraint", "outgoing");
    expect(links.some(l => l.targetId === "df-vector-analysis" && l.linkType === "constrains")).toBe(true);
  });

  it("df-constraint → df-causal-mapping (constrains)", () => {
    const links = result.registry.getLinks("df-constraint", "outgoing");
    expect(links.some(l => l.targetId === "df-causal-mapping" && l.linkType === "constrains")).toBe(true);
  });

  it("df-state-model → df-constraint (depends_on)", () => {
    const links = result.registry.getLinks("df-state-model", "outgoing");
    expect(links.some(l => l.targetId === "df-constraint" && l.linkType === "depends_on")).toBe(true);
  });

  it("decision-standard → df-axis-model (constrains)", () => {
    const links = result.registry.getLinks("decision-standard", "outgoing");
    expect(links.some(l => l.targetId === "df-axis-model" && l.linkType === "constrains")).toBe(true);
  });

  it("decision-standard → df-observation-space (constrains)", () => {
    const links = result.registry.getLinks("decision-standard", "outgoing");
    expect(links.some(l => l.targetId === "df-observation-space" && l.linkType === "constrains")).toBe(true);
  });

  it("df-narrative → df-state-model (depends_on)", () => {
    const links = result.registry.getLinks("df-narrative", "outgoing");
    expect(links.some(l => l.targetId === "df-state-model" && l.linkType === "depends_on")).toBe(true);
  });

  it("axis-decision-guide → decision-standard (refines)", () => {
    const links = result.registry.getLinks("axis-decision-guide", "outgoing");
    expect(links.some(l => l.targetId === "decision-standard" && l.linkType === "refines")).toBe(true);
  });
});
