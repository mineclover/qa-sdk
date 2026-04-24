// @def.doc definition-catalog-spec

import { beforeAll, describe, expect, it } from "vitest";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

import { topdown, context, bottomup, boundary, boundaryContext } from "./cli-tools.js";
import { scanAndBuild, extractFrontmatter } from "./frontmatter.js";
import { extractByLevel } from "./extract.js";
import type { ScanResult } from "./frontmatter.js";

const ROOT = join(import.meta.dirname, "../../..");
const PRE_US007_RECORD_SPEC_BLAST_RADIUS = 7;

let result: ScanResult;
let bodies: Map<string, string>;

beforeAll(async () => {
  result = await scanAndBuild(ROOT, [join(ROOT, "docs")]);
  bodies = new Map();

  for (const entry of result.registry.all()) {
    if (!entry.ref) continue;
    const content = await readFile(join(ROOT, entry.ref), "utf-8");
    const frontmatter = extractFrontmatter(content);
    if (frontmatter) bodies.set(entry.id, frontmatter.body);
  }
}, 60_000);

describe("definition-catalog CLI tools", () => {
  it("system-root topdown은 모든 contains 멤버의 purpose를 조립한다", async () => {
    const text = await topdown(ROOT, "system-root");
    const members = result.registry.getLinks("system-root", "outgoing")
      .filter(link => link.linkType === "contains" || link.linkType === "refs")
      .map(link => result.registry.get(link.targetId))
      .filter((entry): entry is NonNullable<typeof entry> => entry !== undefined);

    expect(members.length).toBeGreaterThanOrEqual(5); // 중간 계층 도입으로 직접 멤버 수 변동
    expect((text.match(/^## \[/gm) ?? []).length).toBe(members.length);

    for (const member of members) {
      expect(text).toContain(`## [${member.scope}] ${member.title}`);

      const purpose = extractByLevel(bodies.get(member.id) ?? "", "purpose").text
        .split("\n")[0]
        .trim();
      expect(purpose.length, `${member.id} purpose 없음`).toBeGreaterThan(0);
      expect(text).toContain(purpose);
    }
  }, 30_000);

  it("gate-api context는 소속/제약/의존/영향 범위를 모두 보여준다", async () => {
    const text = await context(ROOT, "gate-api");
    const blastRadius = Number(text.match(/blast radius: (\d+)건/)?.[1] ?? "0");

    expect(text).toContain("# 컨텍스트: Gate Service API 계약");
    expect(text).toContain("## 소속");
    expect(text).toContain("gate-system");
    expect(text).toContain("## 적용되는 제약");
    expect(text).toContain("gate-constraint");
    expect(text).toContain("## 의존 대상");
    expect(text).toContain("gate-state-model");
    expect(text).toContain("gate-engine-func");
    expect(text).toContain("## 영향 범위");
    expect(blastRadius).toBeGreaterThan(0);
  }, 30_000);

  it("record-spec bottomup은 US-007 이전 baseline보다 더 넓은 blast radius를 보여준다", async () => {
    const text = await bottomup(ROOT, "record-spec");
    const blastRadius = Number(text.match(/blast radius: (\d+)건/)?.[1] ?? "0");

    expect(blastRadius).toBeGreaterThan(PRE_US007_RECORD_SPEC_BLAST_RADIUS);
    expect(text).toContain("## 그룹 영향");
    // record-spec(data → business)에서 같은 business layer 그룹에 영향
    expect(text).toContain("ingest-system");
    // layer 전파 규칙: business → interaction 직접 영향 없음 (binding 경유 필요)
    // viz-system(ui → interaction)은 binding 문서 없이는 직접 도달하지 않음
  }, 30_000);

  it("viteplus playbook boundary는 구조와 direct coupling만 요약한다", async () => {
    const text = await boundary(ROOT, "viteplus-playbook-template-implementation");

    expect(text).toContain("# 바운더리: Vite+ Playbook Template 구현");
    expect(text).toContain("## 구조");
    expect(text).toContain("## 직접 결합");
    expect(text).toContain("### outgoing");
    expect(text).toContain("sdk-usage-guide");
    expect(text).toContain("browser-monitor-operations");
    expect(text).toContain("### incoming");
    expect(text).toContain("viteplus-playbook-template-flow");
    expect(text).toContain("viteplus-canonical-review-implementation");
  }, 30_000);

  it("boundaryContext는 concerns와 impact를 함께 요약한다", async () => {
    const text = await boundaryContext(ROOT, "viteplus-playbook-template-implementation");

    expect(text).toContain("# 바운더리: Vite+ Playbook Template 구현");
    expect(text).toContain("## concerns");
    expect(text).toContain("## impact");
    expect(text).toContain("blast radius:");
  }, 30_000);
});
