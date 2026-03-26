import { beforeAll, describe, expect, it } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { basename, join } from "node:path";
import { collectQualityStats } from "../scripts/quality-report.mjs";
import { scanAndBuild } from "./frontmatter.js";
import type { ScanResult } from "./frontmatter.js";
import { KNOWN_TAGS, TIER_TAGS, isKnownTag } from "./taxonomy.js";

const ROOT = join(import.meta.dirname, "../../..");
const DOCS_DIR = join(ROOT, "docs");

function walkMarkdownFiles(dir: string): string[] {
  const files: string[] = [];

  for (const entry of readdirSync(dir)) {
    const fullPath = join(dir, entry);
    const info = statSync(fullPath);

    if (info.isDirectory()) {
      files.push(...walkMarkdownFiles(fullPath));
      continue;
    }

    if (entry.endsWith(".md")) files.push(fullPath);
  }

  return files;
}

function countTaggedDocs(dir: string) {
  const files = walkMarkdownFiles(dir);
  const tagged = files.filter(filePath => /^\s*tags:/m.test(readFileSync(filePath, "utf-8")));
  return { total: files.length, tagged: tagged.length };
}

let result: ScanResult;

beforeAll(async () => {
  result = await scanAndBuild(ROOT, [DOCS_DIR]);
});

describe("tier 태그 레지스트리", () => {
  it("모든 tier 태그가 KNOWN_TAGS에 포함된다", () => {
    expect(TIER_TAGS.length).toBeGreaterThan(0);
    for (const tag of TIER_TAGS) {
      expect(KNOWN_TAGS).toContain(tag);
      expect(isKnownTag(tag)).toBe(true);
    }
  });
});

describe("문서 태그 커버리지", () => {
  it("approved 문서 기준 tags 누락이 없다", () => {
    const stats = collectQualityStats(ROOT);
    expect(stats.tagsMissingDocs.length).toBe(0);
  });

  it("docs/ 전체 태그 커버리지가 50% 이상이다", () => {
    const { total, tagged } = countTaggedDocs(DOCS_DIR);
    expect(total).toBeGreaterThan(0);
    expect(tagged / total).toBeGreaterThanOrEqual(0.5);
  });
});

describe("관심사 태그 회귀", () => {
  it("perm-*/rbac/auth 문서에는 security 태그가 있다", () => {
    const securityTargets = result.registry.all().filter(entry => {
      if (entry.lifecycle !== "approved") return false;
      const ref = entry.ref ?? "";
      const name = basename(ref);
      // perm-migration-* 은 migration concern이지 security가 아님
      if (entry.id.includes("migration")) return false;
      // 자동 생성 prefix 문서는 concern 태그 대상이 아님
      if (entry.tags?.includes("generated")) return false;
      return name.startsWith("perm-") || name.includes("rbac") || entry.serviceId === "auth";
    });

    expect(securityTargets.length).toBeGreaterThan(0);
    for (const entry of securityTargets) {
      expect(entry.tags ?? [], `${entry.id}에 security 태그 없음`).toContain("security");
    }
  });

  it("bench-*/benchmark/acceleration 문서에는 performance 태그가 있다", () => {
    const performanceTargets = result.registry.all().filter(entry => {
      if (entry.lifecycle !== "approved") return false;
      const name = basename(entry.ref ?? "");
      return name.startsWith("bench-") || name.includes("benchmark") || name.includes("acceleration");
    });

    expect(performanceTargets.length).toBeGreaterThan(0);
    for (const entry of performanceTargets) {
      expect(entry.tags ?? [], `${entry.id}에 performance 태그 없음`).toContain("performance");
    }
  });

  it("logger/metrics/monitoring 문서에는 observability 태그가 있다", () => {
    const observabilityTargets = result.registry.all().filter(entry => {
      if (entry.lifecycle !== "approved") return false;
      return /logger|metrics|monitoring/.test(basename(entry.ref ?? ""));
    });

    expect(observabilityTargets.length).toBeGreaterThan(0);
    for (const entry of observabilityTargets) {
      expect(entry.tags ?? [], `${entry.id}에 observability 태그 없음`).toContain("observability");
    }
  });
});
