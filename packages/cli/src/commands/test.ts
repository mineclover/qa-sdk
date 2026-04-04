/**
 * qa-sdk test — TestScenario 하네스 CLI.
 *
 * scan:    스펙 frontmatter tests: 선언 → declared 상태 upsert
 * assign:  모듈화 체크 → B 좌표 부여 → assigned
 * scaffold: 테스트 스텁 파일 생성
 * status:  생명주기 현황 매트릭스
 * report:  커버리지 매트릭스
 */

import { join, resolve, dirname } from "node:path";
import { existsSync, mkdirSync, writeFileSync, readdirSync, readFileSync } from "node:fs";
import { SqliteTestScenarioStore } from "test-scenario-store";
import type { TestKind, TestScope } from "test-scenario-store";
import { getQaSdkDir } from "../lib/qa-dir.js";
import { extractFrontmatter, parseYaml } from "definition-catalog";

const VALID_KINDS = new Set<string>([
  "unit", "ui-logic", "ui", "db-transaction",
  "data-exchange", "auth-flow", "e2e", "simulation",
]);
const VALID_SCOPES = new Set<string>(["single", "pair", "multi", "system"]);

// ── 파싱 유틸 (테스트 가능한 순수 함수) ──────────────────

export interface ParsedTestDeclaration {
  aCoord: string;
  specAddress: string;
  kind: TestKind;
  scope: TestScope;
  intent: string;
  primarySvc: string;
  participants: string[];
}

export function parseTestsDeclaration(
  raw: unknown[],
  specAddress: string,
): ParsedTestDeclaration[] {
  const results: ParsedTestDeclaration[] = [];
  for (const item of raw) {
    if (typeof item !== "object" || item === null) continue;
    const obj = item as Record<string, unknown>;
    const kind = obj["kind"] as string | undefined;
    if (!kind || !VALID_KINDS.has(kind)) continue;

    const scope = (obj["scope"] as string | undefined) ?? "single";
    const intent = (obj["intent"] as string | undefined) ?? "";
    const primarySvc = (obj["module"] as string | undefined) ?? "";
    const participants = Array.isArray(obj["participants"])
      ? (obj["participants"] as string[])
      : [];

    results.push({
      aCoord: `${specAddress}/${kind}`,
      specAddress,
      kind: kind as TestKind,
      scope: VALID_SCOPES.has(scope) ? (scope as TestScope) : "single",
      intent,
      primarySvc,
      participants,
    });
  }
  return results;
}

// ── frontmatter 추출 (YAML-lite) ──────────────────────────

function extractFrontmatterTests(content: string): unknown[] {
  const yaml = extractFrontmatter(content);
  if (!yaml) return [];
  const parsed = parseYaml(yaml) as Record<string, unknown>;
  const tests = parsed["tests"];
  if (!Array.isArray(tests)) return [];
  return tests;
}

function extractSpecAddress(content: string): string | null {
  const yaml = extractFrontmatter(content);
  if (!yaml) return null;
  const parsed = parseYaml(yaml) as Record<string, unknown>;
  const address = parsed["address"];
  if (address !== undefined) return `def:${address}`;
  const id = parsed["id"];
  if (typeof id === "string") return `def:${id.trim()}`;
  return null;
}

// ── testScan ─────────────────────────────────────────────

export function testScan(opts: { dir?: string; db?: string }): void {
  const root = opts.dir ?? process.cwd();
  const docsDir = join(root, "docs");
  const dbPath = opts.db ?? join(getQaSdkDir(), "test-scenarios.sqlite");

  if (!existsSync(docsDir)) {
    console.error(`docs/ 디렉토리 없음: ${docsDir}`);
    process.exitCode = 1;
    return;
  }

  const store = new SqliteTestScenarioStore(dbPath);
  let declared = 0;

  function walk(dir: string): void {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const fullPath = join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(fullPath);
        continue;
      }
      if (!entry.name.endsWith(".spec.md")) continue;

      let content: string;
      try {
        content = readFileSync(fullPath, "utf-8");
      } catch {
        continue;
      }
      const specAddress = extractSpecAddress(content);
      if (!specAddress) continue;

      const rawTests = extractFrontmatterTests(content);
      if (rawTests.length === 0) continue;

      const parsed = parseTestsDeclaration(rawTests, specAddress);
      for (const p of parsed) {
        store.upsertDeclared(p);
        declared++;
      }
    }
  }

  walk(docsDir);
  console.log(`scan 완료: ${declared}개 선언됨`);
}

// ── testAssign ───────────────────────────────────────────

export function testAssign(opts: { aCoord?: string; force?: boolean; db?: string }): void {
  const dbPath = opts.db ?? join(getQaSdkDir(), "test-scenarios.sqlite");
  const store = new SqliteTestScenarioStore(dbPath);

  const targets = opts.aCoord
    ? [store.getByACoord(opts.aCoord)].filter(Boolean)
    : store.listByLifecycle("declared");

  if (targets.length === 0) {
    console.log("할당할 declared 시나리오 없음. qa-sdk test scan을 먼저 실행하세요.");
    return;
  }

  for (const scenario of targets) {
    if (!scenario) continue;

    const modulePath = scenario.primarySvc;
    const hasValidModule = modulePath.length > 0;
    let violation = false;

    if (!hasValidModule) {
      console.warn(`⚠ [${scenario.aCoord}] primarySvc 미선언 — 모듈 경로 추가 필요`);
      violation = true;
      if (!opts.force) {
        console.log("  --force로 강제 진행 가능");
        continue;
      }
    }

    const seq = store.nextSeq(scenario.kind, scenario.scope);
    const bCoord = `test_scenario:v1:${seq}`;
    const filePath = scenario.filePath ?? deriveFilePath(modulePath, scenario.kind);

    store.assign(scenario.aCoord, bCoord, filePath, violation);

    if (violation) {
      console.log(`⚠ ${scenario.aCoord} → ${bCoord} (convention_violation 마킹)`);
    } else {
      console.log(`✓ ${scenario.aCoord} → ${bCoord}`);
    }
  }
}

function deriveFilePath(modulePath: string, kind: TestKind): string {
  const packageName = modulePath.replace(/^@qa-sdk\//, "").replace(/^workspace:/, "");
  const parts = packageName.split("/");
  if (parts.length >= 2) {
    return `packages/${parts[0]}/src/${parts.slice(1).join("/")}.${kind}.test.ts`;
  }
  return `packages/${packageName}/src/index.${kind}.test.ts`;
}

// ── testScaffold ─────────────────────────────────────────

export function testScaffold(opts: { bCoord?: string; mirror?: string; db?: string }): void {
  const dbPath = opts.db ?? join(getQaSdkDir(), "test-scenarios.sqlite");
  const store = new SqliteTestScenarioStore(dbPath);

  const targets = opts.bCoord
    ? [store.getById(opts.bCoord)].filter(Boolean)
    : store.listByLifecycle("assigned");

  for (const scenario of targets) {
    if (!scenario || !scenario.filePath) continue;

    const fullPath = resolve(process.cwd(), scenario.filePath);
    if (existsSync(fullPath)) {
      console.log(`skip (이미 존재): ${scenario.filePath}`);
      continue;
    }

    mkdirSync(dirname(fullPath), { recursive: true });
    writeFileSync(fullPath, generateTestStub(scenario.primarySvc, scenario.kind, scenario.intent), "utf-8");
    console.log(`생성: ${scenario.filePath}`);
  }
}

function generateTestStub(modulePath: string, kind: TestKind, intent: string): string {
  return `import { describe, it, expect } from "vitest";
// import { ... } from "${modulePath}";

// 의도: ${intent}
// 테스트 유형: ${kind}

describe("${intent}", () => {
  it("TODO: 테스트를 작성하세요", () => {
    // arrange
    // act
    // assert
    expect(true).toBe(true);
  });
});
`;
}

// ── testStatus ───────────────────────────────────────────

export function testStatus(opts: { db?: string }): void {
  const dbPath = opts.db ?? join(getQaSdkDir(), "test-scenarios.sqlite");
  const store = new SqliteTestScenarioStore(dbPath);
  const all = store.listAll();

  if (all.length === 0) {
    console.log("시나리오 없음. qa-sdk test scan을 먼저 실행하세요.");
    return;
  }

  const byLifecycle: Record<string, number> = {
    declared: 0, assigned: 0, collected: 0, verified: 0, archived: 0,
  };
  for (const s of all) {
    byLifecycle[s.lifecycle] = (byLifecycle[s.lifecycle] ?? 0) + 1;
  }

  console.log("\n테스트 시나리오 생명주기 현황");
  console.log("─".repeat(40));
  for (const [state, count] of Object.entries(byLifecycle)) {
    const bar = "█".repeat(count);
    console.log(`${state.padEnd(12)} ${String(count).padStart(4)}  ${bar}`);
  }
  console.log("─".repeat(40));
  console.log(`합계: ${all.length}개`);

  const violations = all.filter(s => s.conventionViolation);
  if (violations.length > 0) {
    console.log(`\n⚠ convention_violation: ${violations.length}개`);
    for (const v of violations) {
      console.log(`  ${v.aCoord} (${v.kind})`);
    }
  }
}

// ── testReport ───────────────────────────────────────────

const KINDS: TestKind[] = [
  "unit", "ui-logic", "ui", "db-transaction",
  "data-exchange", "auth-flow", "e2e", "simulation",
];

const LIFECYCLE_ICON: Record<string, string> = {
  declared: "·",
  assigned: "○",
  collected: "🔄",
  verified: "✅",
  archived: "—",
};

export function testReport(opts: { db?: string }): void {
  const dbPath = opts.db ?? join(getQaSdkDir(), "test-scenarios.sqlite");
  const store = new SqliteTestScenarioStore(dbPath);
  const all = store.listAll();

  if (all.length === 0) {
    console.log("시나리오 없음.");
    return;
  }

  const svcs = [...new Set(all.map(s => s.primarySvc))].sort();

  const colWidth = 10;
  const header = "서비스".padEnd(30) + KINDS.map(k => k.slice(0, colWidth - 1).padEnd(colWidth)).join("");
  console.log("\n" + header);
  console.log("─".repeat(header.length));

  for (const svc of svcs) {
    const scenarios = all.filter(s => s.primarySvc === svc);
    const cells = KINDS.map(kind => {
      const s = scenarios.find(x => x.kind === kind);
      return s ? (LIFECYCLE_ICON[s.lifecycle] ?? "?") : "-";
    });
    const row = svc.slice(-28).padEnd(30) + cells.map(c => c.padEnd(colWidth)).join("");
    console.log(row);
  }

  console.log("\n범례: ✅ verified  🔄 collected  ○ assigned  · declared  - 없음");
}
