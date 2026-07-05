import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";
import chalk from "chalk";

/**
 * Analysis OS Verification Suite
 * 
 * 정적 코드 실측치와 분석 도구의 출력값을 비교하여 정확성을 체크한다.
 */

async function main() {
  console.log(chalk.bold.cyan("\n🧪 Verifying Analysis System Accuracy...\n"));

  let totalTests = 0;
  let passedTests = 0;

  function assert(condition: boolean, message: string) {
    totalTests++;
    if (condition) {
      passedTests++;
      console.log(`${chalk.green("✓")} ${message}`);
    } else {
      console.log(`${chalk.red("✗")} ${message}`);
    }
  }

  // 1. Verify arch:signals Accuracy
  try {
    const signalsOutput = execSync("npx tsx scripts/discover-event-flow.ts", { encoding: "utf-8" });
    
    // 실측 기반 체크: core 패키지는 반드시 'error' 신호와 연결되어 있어야 함
    assert(signalsOutput.includes("core") && signalsOutput.includes("error"), 
           "Signal Analysis: 'core' package linked with 'error' signal");
    
    // 실측 기반 체크: 'page_view'는 최소 2개 이상의 패키지와 연결되어야 함 (refined check)
    const pageViewMatch = signalsOutput.match(/page_view <-> Linked with: ([^ \n]+(,[^ \n]+)*)/);
    const linkedPkgsCount = pageViewMatch ? pageViewMatch[1].split(",").length : 0;
    assert(linkedPkgsCount >= 2, 
           `Signal Analysis: 'page_view' has valid connectivity (${linkedPkgsCount} peers)`);
  } catch (err) {
    console.error("Signal verification failed:", err);
    assert(false, "Signal Analysis: command completed successfully");
  }

  // 2. Verify arch:usage Accuracy
  try {
    const usageOutput = execSync("npx tsx scripts/analyze-package-usage.ts --json", { encoding: "utf-8" });
    const usage = JSON.parse(usageOutput);

    // index-meta가 Critical Infrastructure 상위에 있는지 확인
    const topUsage = usage.highUsage.slice(0, 5);
    assert(topUsage.some((item: { id: string }) => item.id === "index-meta"),
           "Usage Analysis: 'index-meta' correctly identified as Critical Infrastructure");

    // zero fan-in은 dead weight가 아니라 disposition으로 분리되어야 함
    const zeroFanIn = Object.fromEntries(
      usage.zeroFanIn.map((item: { id: string }) => [item.id, item]),
    ) as Record<string, { disposition: string }>;
    assert(zeroFanIn["address-index"]?.disposition === "kept-library",
           "Usage Analysis: 'address-index' correctly classified as zero fan-in kept library");
    assert(zeroFanIn["cli"]?.disposition === "standalone-tool",
           "Usage Analysis: CLI packages with bin entrypoints are standalone tools");
    assert(Array.isArray(usage.deadWeight) && usage.deadWeight.length === 0,
           "Usage Analysis: dead weight only contains unresolved evidence candidates");
    const archiveCandidates = Object.fromEntries(
      usage.archiveCandidates.map((item: { id: string }) => [item.id, item]),
    ) as Record<string, { disposition: string }>;
    assert(Array.isArray(usage.archiveCandidates) && usage.archiveCandidates.length === 2,
           "Usage Analysis: archive candidates are tracked separately from dead weight");
    assert(archiveCandidates["request-contract"]?.disposition === "archive-candidate"
           && archiveCandidates["weighted-gpu"]?.disposition === "archive-candidate",
           "Usage Analysis: no-promotion packages remain in the archive decision queue");

    // missing entrypoints는 실제 public entrypoint gap과 분리되어야 함
    const missingEntrypoints = Object.fromEntries(
      usage.missingEntrypoints.map((item: { id: string }) => [item.id, item]),
    ) as Record<string, { disposition: string }>;
    assert(Array.isArray(usage.entrypointGaps) && usage.entrypointGaps.length === 0,
           "Usage Analysis: entrypoint gaps only contains unresolved public/library gaps");
    assert(missingEntrypoints["decode-service"]?.disposition === "runtime-service",
           "Usage Analysis: service packages without src/index.ts are runtime services");
    assert(missingEntrypoints["taxonomy-web"]?.disposition === "browser-app",
           "Usage Analysis: Vite packages without src/index.ts are browser apps");
    assert(missingEntrypoints["shop-web"]?.disposition === "browser-app",
           "Usage Analysis: static web packages without src/index.ts are browser apps");
    assert(missingEntrypoints["weighted-wasm"]?.disposition === "wasm-package",
           "Usage Analysis: wasm packages use wasm/js entrypoints instead of src/index.ts");
  } catch (err) {
    console.error("Usage verification failed:", err);
    assert(false, "Usage Analysis: command completed successfully and produced valid JSON");
  }

  // 3. Verify package surface coverage and feature separation
  try {
    const surfaceOutput = execSync("node scripts/report-package-surfaces.mjs --json", { encoding: "utf-8" });
    const report = JSON.parse(surfaceOutput);

    assert(report.assignedPackages === report.totalWorkspacePackages,
           `Surface Report: all workspace packages are assigned (${report.assignedPackages}/${report.totalWorkspacePackages})`);
    assert(Array.isArray(report.missing) && report.missing.length === 0,
           "Surface Report: no declared surface points at a missing package");
    assert(Array.isArray(report.duplicates) && report.duplicates.length === 0,
           "Surface Report: no package is assigned to multiple surfaces");
    assert(Array.isArray(report.unassigned) && report.unassigned.length === 0,
           "Surface Report: no workspace package is left without a surface");

    const surfaces = Object.fromEntries(
      report.surfaces.map((surface: { id: string; packages: string[] }) => [surface.id, surface.packages]),
    ) as Record<string, string[]>;
    assert(hasExactly(surfaces["taxonomy-tooling"], ["taxonomy-engine"]),
           "Surface Report: taxonomy-engine owns finite vocabulary tooling separately");
    assert(hasExactly(surfaces["taxonomy-decision-bridge"], ["taxonomy-decision-bridge"]),
           "Surface Report: taxonomy decision bridge is not folded into taxonomy-engine");
    assert(hasExactly(surfaces["taxonomy-preview-surfaces"], ["@qa-sdk/taxonomy-web"]),
           "Surface Report: taxonomy web preview is a consumer surface");
    assert(hasExactly(surfaces["profile-contract-tooling"], ["data-structure-profile"]),
           "Surface Report: data-structure-profile owns profile contracts separately");
    assert(hasExactly(surfaces["quality-evidence-ledgers"], ["quality-ledger", "review-ledger"]),
           "Surface Report: quality/review ledgers are evidence stores, not profile contracts");
    assert(hasExactly(surfaces["measurement-tooling"], ["@qa-sdk/bench"]),
           "Surface Report: bench remains measurement tooling");
    assert(hasExactly(surfaces["profile-preview-surfaces"], ["@qa-sdk/viz-web"]),
           "Surface Report: viz-web remains a profile/graph consumer preview");

    const manifestLabels = new Set(report.surfaces.map((surface: { id: string }) => surfaceLabel(surface.id)));
    const ruleRows = parseMarkdownTable(
      "docs/specs/system/package-surface-separation.rule.md",
      "| Surface | 판정 | 포함 패키지 | 승격 기준 |",
    );
    const packageRows = parseMarkdownTable(
      "docs/specs/system/system-packages.spec.md",
      "| Surface | 역할 | 대표 패키지 |",
    );
    const ruleByLabel = new Map(ruleRows.map((row) => [row[0], row]));
    const packageByLabel = new Map(packageRows.map((row) => [row[0], row]));
    const ruleMissing = [...manifestLabels].filter((label) => !ruleByLabel.has(label));
    const packageMissing = [...manifestLabels].filter((label) => !packageByLabel.has(label));
    const ruleExtras = [...ruleByLabel.keys()].filter((label) => !manifestLabels.has(label));
    const packageExtras = [...packageByLabel.keys()].filter((label) => !manifestLabels.has(label));
    const verdictMismatches = report.surfaces
      .map((surface: { id: string; verdict: string }) => {
        const label = surfaceLabel(surface.id);
        const expected = surface.verdict.replaceAll("-", " ");
        const actual = ruleByLabel.get(label)?.[1];
        return actual === expected ? null : `${label}: expected ${expected}, found ${actual ?? "missing"}`;
      })
      .filter(Boolean);

    assert(ruleMissing.length === 0 && ruleExtras.length === 0,
           `Surface Docs: separation rule table matches manifest surfaces (${formatDiff(ruleMissing, ruleExtras)})`);
    assert(packageMissing.length === 0 && packageExtras.length === 0,
           `Surface Docs: system package table matches manifest surfaces (${formatDiff(packageMissing, packageExtras)})`);
    assert(verdictMismatches.length === 0,
           `Surface Docs: separation rule verdicts match manifest (${verdictMismatches.join("; ") || "ok"})`);
  } catch (err) {
    console.error("Surface verification failed:", err);
    assert(false, "Surface Report: command completed successfully and produced valid JSON");
  }

  // 4. Verify arch:check (Boundary) Consistency
  try {
    const checkOutput = execSync("npx tsx scripts/check-dependency-boundaries.ts --json", { encoding: "utf-8" });
    const boundary = JSON.parse(checkOutput);
    const violationCount = Array.isArray(boundary.violations) ? boundary.violations.length : -1;

    assert(violationCount === 0, `Boundary Check: Detects no tier violations (found ${violationCount})`);
  } catch (err) {
    const output = typeof (err as { stdout?: unknown }).stdout === "string"
      ? (err as { stdout: string }).stdout
      : String((err as { stdout?: Buffer }).stdout ?? "");
    try {
      const boundary = JSON.parse(output);
      const violationCount = Array.isArray(boundary.violations) ? boundary.violations.length : -1;
      assert(violationCount === 0, `Boundary Check: Detects no tier violations (found ${violationCount})`);
    } catch {
      assert(false, "Boundary Check: produced parseable JSON");
    }
  }

  console.log(chalk.bold.cyan(`\nVerification Complete: ${passedTests}/${totalTests} passed.\n`));
  
  if (passedTests < totalTests) {
    process.exit(1);
  }
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});

function hasExactly(actual: string[] | undefined, expected: string[]): boolean {
  return Array.isArray(actual)
    && actual.length === expected.length
    && expected.every((item) => actual.includes(item));
}

function surfaceLabel(id: string): string {
  return id
    .split("-")
    .map((part, index) => index === 0 ? `${part[0]?.toUpperCase() ?? ""}${part.slice(1)}` : part)
    .join(" ");
}

function parseMarkdownTable(path: string, headerLine: string): string[][] {
  const lines = readFileSync(path, "utf-8").split(/\r?\n/);
  const start = lines.findIndex((line) => line.trim() === headerLine);
  if (start < 0) return [];

  const rows: string[][] = [];
  for (let index = start + 2; index < lines.length; index++) {
    const line = lines[index].trim();
    if (!line.startsWith("|")) break;
    rows.push(line
      .replace(/^\|/, "")
      .replace(/\|$/, "")
      .split("|")
      .map((cell) => cell.trim()));
  }
  return rows;
}

function formatDiff(missing: string[], extras: string[]): string {
  const parts = [
    missing.length > 0 ? `missing=${missing.join(", ")}` : "",
    extras.length > 0 ? `extra=${extras.join(", ")}` : "",
  ].filter(Boolean);
  return parts.join("; ") || "ok";
}
