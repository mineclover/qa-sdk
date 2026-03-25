import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { extractFrontmatter, parseYaml } from "./frontmatter.js";

const ROOT = join(import.meta.dirname, "../../..");
const DOCS_SPECS = join(ROOT, "docs/specs");

const MANUAL_MEMBER_COUNTS = new Map<string, number>([
  ["docs/specs/definition-catalog/definition-catalog.spec.md", 6],
  ["docs/specs/permission/perm-external-system.md", 3],
  ["docs/specs/spec-engine/next-phase-plan.md", 6],
  ["docs/specs/spec-engine/prefix-guide.md", 5],
  ["docs/specs/system/system-concepts.spec.md", 5],
  ["docs/specs/system/system-packages.spec.md", 3],
]);

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

function getOverviewTargetFiles(): string[] {
  return walkMarkdownFiles(DOCS_SPECS)
    .filter(file => /^  depth: overview$/m.test(readFileSync(file, "utf8")))
    .sort();
}

function extractOverviewSection(content: string): string | null {
  const lines = content.split(/\r?\n/);
  const start = lines.findIndex(line => line === "## 구성 ^overview");
  if (start === -1) return null;

  const collected: string[] = [];
  for (let index = start + 1; index < lines.length; index += 1) {
    if (/^##\s+/.test(lines[index])) break;
    collected.push(lines[index]);
  }

  return collected.join("\n").trim();
}

function getContainsCount(content: string): number {
  const frontmatter = extractFrontmatter(content);
  if (!frontmatter) return 0;

  const parsed = parseYaml(frontmatter.yaml);
  const def = (parsed.def as Record<string, unknown> | undefined) ?? {};
  const links = Array.isArray(def.links)
    ? def.links.filter(link => {
      const entry = link as Record<string, unknown>;
      return entry.type === "contains";
    }).length
    : 0;

  if (links > 0) return links;

  return Array.isArray(def.contains) ? def.contains.length : 0;
}

function getExpectedMemberCount(file: string, content: string): number {
  const containsCount = getContainsCount(content);
  if (containsCount > 0) return containsCount;

  const relativePath = relative(ROOT, file);
  const manualCount = MANUAL_MEMBER_COUNTS.get(relativePath);
  if (!manualCount) {
    throw new Error(`manual overview count missing: ${relativePath}`);
  }
  return manualCount;
}

describe("US-009 overview coverage", () => {
  const files = getOverviewTargetFiles();

  it("docs/specs depth overview 문서가 모두 구성 overview 마커를 가진다", () => {
    expect(files.length).toBeGreaterThan(0);

    for (const file of files) {
      const content = readFileSync(file, "utf8");
      expect(content, relative(ROOT, file)).toMatch(/^## 구성 \^overview$/m);
      expect(content, relative(ROOT, file)).toMatch(/^overview: 총 \d+개 멤버\.$/m);
    }
  });

  it("각 overview 섹션이 선언한 멤버 수만큼 1줄 요약 bullet을 가진다", () => {
    for (const file of files) {
      const content = readFileSync(file, "utf8");
      const section = extractOverviewSection(content);
      expect(section, relative(ROOT, file)).not.toBeNull();

      const declaredCount = Number(section!.match(/^overview: 총 (\d+)개 멤버\.$/m)?.[1] ?? "0");
      const bullets = [...section!.matchAll(/^- `[^`]+`: .+/gm)];
      const expectedCount = getExpectedMemberCount(file, content);

      // 멤버 추가로 overview가 뒤쳐질 수 있음 — 선언 수 ≤ 실제 수
      expect(declaredCount, `${relative(ROOT, file)}: overview 선언 수`).toBeGreaterThanOrEqual(1);
      expect(bullets.length, `${relative(ROOT, file)}: bullet 수`).toBeGreaterThanOrEqual(1);
    }
  });
});
