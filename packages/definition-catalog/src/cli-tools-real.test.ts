import { beforeAll, describe, expect, it } from "vitest";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

import { topdown, context, bottomup } from "./cli-tools.js";
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
});

describe("definition-catalog CLI tools", () => {
  it("system-root topdown은 모든 contains 멤버의 purpose를 조립한다", async () => {
    const text = await topdown(ROOT, "system-root");
    const members = result.registry.getLinks("system-root", "outgoing")
      .filter(link => link.linkType === "contains")
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
  });

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
  });

  it("record-spec bottomup은 US-007 이전 baseline보다 더 넓은 blast radius를 보여준다", async () => {
    const text = await bottomup(ROOT, "record-spec");
    const blastRadius = Number(text.match(/blast radius: (\d+)건/)?.[1] ?? "0");

    expect(blastRadius).toBeGreaterThan(PRE_US007_RECORD_SPEC_BLAST_RADIUS);
    expect(text).toContain("## 그룹 영향");
    expect(text).toContain("apm-system");
    expect(text).toContain("browser-system");
    expect(text).toContain("viz-system");
    expect(text).toContain("guides-system");
  });
});
