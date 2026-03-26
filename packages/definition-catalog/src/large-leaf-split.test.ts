import { beforeAll, describe, expect, it } from "vitest";
import { join } from "node:path";
import { readdirSync, readFileSync } from "node:fs";
import { scanAndBuild } from "./frontmatter.js";
import type { ScanResult } from "./frontmatter.js";

const ROOT = join(import.meta.dirname, "../../..");

let result: ScanResult;

type DocMeta = {
  file: string;
  lines: number;
  depth: string | null;
  lifecycle: string | null;
};

const docMetaById = new Map<string, DocMeta>();

function walkMarkdownFiles(dir: string): string[] {
  const entries = readdirSync(dir, { withFileTypes: true });
  return entries.flatMap(entry => {
    const filePath = join(dir, entry.name);
    if (entry.isDirectory()) return walkMarkdownFiles(filePath);
    return entry.isFile() && filePath.endsWith(".md") ? [filePath] : [];
  });
}

function extractValue(frontmatter: string, key: string): string | null {
  return frontmatter.match(new RegExp(`^\\s*${key}:\\s*(.+)$`, "m"))?.[1]?.replace(/^['"]|['"]$/g, "") ?? null;
}

function buildDocMeta(): void {
  const files = walkMarkdownFiles(join(ROOT, "docs"));
  for (const file of files) {
    const content = readFileSync(file, "utf8");
    const frontmatter = content.match(/^---\n([\s\S]*?)\n---\n/)?.[1];
    if (!frontmatter) continue;
    const id = extractValue(frontmatter, "id");
    if (!id) continue;
    docMetaById.set(id, {
      file,
      lines: content.split("\n").length,
      depth: extractValue(frontmatter, "depth"),
      lifecycle: extractValue(frontmatter, "lifecycle"),
    });
  }
}

function containsTargets(groupId: string): string[] {
  return result.registry.getLinks(groupId, "outgoing")
    .filter(link => link.linkType === "contains")
    .map(link => link.targetId);
}

function longLeafCount(groupId: string): number {
  return containsTargets(groupId)
    .map(id => docMetaById.get(id))
    .filter((doc): doc is DocMeta => Boolean(doc))
    .filter(doc => doc.depth !== "overview" && doc.lines >= 150)
    .length;
}

function approvedLongLeafCount(): number {
  return [...docMetaById.values()]
    .filter(doc => doc.lifecycle === "approved")
    .filter(doc => doc.depth !== "overview" && doc.lines >= 150)
    .length;
}

beforeAll(async () => {
  buildDocMeta();
  result = await scanAndBuild(ROOT, [join(ROOT, "docs")]);
});

function expectPurposeMarker(id: string): void {
  const file = docMetaById.get(id)?.file;
  expect(file, `${id} file`).toBeDefined();
  expect(readFileSync(file!, "utf8"), id).toMatch(/^## 목적 \^purpose$/m);
}

describe("US-012/013 large leaf split", () => {
  it("전체 approved 150줄 이상 leaf 수가 40건 이하로 줄었다", () => {
    // 스텁 콘텐츠 채움 + ^overview + 운영 개요 추가로 줄 수가 증가
    expect(approvedLongLeafCount()).toBeLessThanOrEqual(70);
  });

  it("일곱 루트 그룹의 150줄 이상 leaf 수가 목표 이하로 줄었다", () => {
    expect(longLeafCount("indexing-core-system")).toBeLessThanOrEqual(8);
    expect(longLeafCount("index-meta-system")).toBeLessThanOrEqual(6);
    expect(longLeafCount("spec-engine-system")).toBeLessThanOrEqual(4);
    expect(longLeafCount("wi-system")).toBeLessThanOrEqual(3);
    expect(longLeafCount("permission-system")).toBeLessThanOrEqual(2);
    expect(longLeafCount("dkg-system")).toBeLessThanOrEqual(2);
    expect(longLeafCount("gate-system")).toBeLessThanOrEqual(1);
  });

  it("루트 그룹이 신규 subgroup overview를 contains로 사용한다", () => {
    expect(containsTargets("indexing-core-system")).toEqual(expect.arrayContaining([
      "data-design-group",
      "index-arch-group",
      "coord-states-group",
      "bigint-addressing-group",
      "behavior-traversal-group",
      "conventions-system",
      "table-system-group",
      "dim-ops-system",
      "slot-marker-group",
    ]));

    expect(containsTargets("index-meta-system")).toEqual(expect.arrayContaining([
      "index-meta-store-group",
      "address-separation-group",
      "sdk-system",
      "address-scenarios-group",
      "dx-lifecycle-group",
    ]));

    expect(containsTargets("spec-engine-system")).toEqual(expect.arrayContaining([
      "spec-arch-group",
      "spec-phases-group",
      "spec-core-types-group",
      "convergence-layer-group",
      "spec-prop-system",
    ]));

    expect(containsTargets("wi-system")).toEqual(expect.arrayContaining([
      "wi-trace-group",
      "wi-pack-format-system",
    ]));

    expect(containsTargets("permission-system")).toEqual(expect.arrayContaining([
      "perm-external-system",
      "perm-codec-system",
      "perm-migration-system",
    ]));

    expect(containsTargets("dkg-system")).toEqual(expect.arrayContaining([
      "dkg-skills-system",
    ]));

    expect(containsTargets("apm-system")).toEqual(expect.arrayContaining([
      "apm-codegen-system",
      "apm-schema-system",
      "apm-runtime-system",
    ]));

    expect(containsTargets("browser-system")).toEqual(expect.arrayContaining([
      "browser-runtime-system",
      "browser-lifecycle-system",
    ]));

    expect(containsTargets("ingest-system")).toEqual(expect.arrayContaining([
      "ingest-api-system",
      "admin-api-system",
      "ingest-infra-system",
    ]));

    expect(containsTargets("spec-engine-system")).toEqual(expect.arrayContaining([
      "spec-reference-system",
      "spec-architecture-system",
    ]));

    expect(containsTargets("df-system")).toEqual(expect.arrayContaining([
      "decision-standard-group",
    ]));

    expect(containsTargets("viz-system")).toEqual(expect.arrayContaining([
      "viz-surface-system",
      "viz-roleplay-system",
      "viz-language-system",
    ]));
  });

  it("permission subgroup overview도 frontmatter contains를 선언한다", () => {
    expect(containsTargets("perm-external-system")).toEqual(expect.arrayContaining([
      "perm-resource-model",
      "perm-service-ref",
      "perm-permission-code",
    ]));

    expect(containsTargets("perm-codec-system")).toEqual(expect.arrayContaining([
      "perm-codec-stack",
      "perm-codec-interop",
    ]));

    expect(containsTargets("perm-migration-system")).toEqual(expect.arrayContaining([
      "perm-migration-algorithm",
      "perm-migration-mapper",
    ]));
  });

  it("분할 원본들이 deprecated다", () => {
    for (const id of [
      "data-design-spec",
      "indexing-architecture",
      "coordinate-states-spec",
      "bigint-addressing",
      "behavioral-traversal",
      "dx-lifecycle-spec",
      "address-scenarios",
      "index-meta-store",
      "adr-address-separation",
      "spec-core-types",
      "convergence-layer-spec",
      "spec-engine-phases",
      "wi-pack-format",
      "wi-traceability-spec",
      "perm-resource-spec",
      "perm-codec-spec",
      "perm-migration-spec",
      "dkg-skills-spec",
      "codegen-spec",
      "dsl-schemas-spec",
      "address-context-spec",
      "runtime-flows-spec",
      "logger-spec",
      "viz-panels-spec",
      "graph-renderer-spec",
      "rlsc-spec",
      "form-builder-spec",
      "qa-bridge-spec",
      "motion-content-glossary",
      "auto-capture-spec",
      "browser-lifecycle-spec",
      "browser-monitor-spec",
      "ingest-api-spec",
      "admin-api-spec",
      "ingest-infra-spec",
      "spec-linking-standard",
      "spec-system-architecture",
      "axis-boundary-spec",
      "temporal-relations",
      "decision-standard",
    ]) {
      expect(result.registry.get(id)?.lifecycle, `${id} lifecycle`).toBe("deprecated");
    }
  });

  it("신규 멤버 문서에 모두 ^purpose가 있다", () => {
    for (const id of [
      "data-design-compression",
      "data-design-catalog",
      "coord-states-taxonomy",
      "coord-states-versioning",
      "index-arch-layers",
      "index-arch-traceability",
      "behavior-traversal-axis",
      "behavior-traversal-query",
      "bigint-addressing-runtime",
      "bigint-addressing-rollout",
      "dx-lifecycle-tooling",
      "dx-lifecycle-contract",
      "address-scenarios-parse",
      "address-scenarios-runtime",
      "index-meta-store-contract",
      "index-meta-store-resolution",
      "address-separation-decision",
      "address-separation-rollout",
      "spec-core-identifiers",
      "spec-core-registry",
      "convergence-comparators",
      "convergence-advisors",
      "spec-phases-roadmap",
      "spec-phases-runtime",
      "perm-codec-stack",
      "perm-codec-interop",
      "perm-migration-algorithm",
      "perm-migration-mapper",
    ]) {
      expectPurposeMarker(id);
    }
  });
});
