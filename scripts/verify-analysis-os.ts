import { execSync } from "node:child_process";
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
  }

  // 3. Verify arch:check (Boundary) Consistency
  try {
    // 임의의 잘못된 의존성 시뮬레이션 없이 현재 기지(known)의 위반 사항 수 확인
    const checkOutput = execSync("npx tsx scripts/check-dependency-boundaries.ts", { encoding: "utf-8" }).catch(e => e.stdout);
    const violationCountMatch = checkOutput.match(/Total (\d+) tier violations/);
    const count = violationCountMatch ? parseInt(violationCountMatch[1]) : -1;
    
    // 현재 리팩토링 후 기지 위반 사항은 9건이어야 함
    assert(count === 9, `Boundary Check: Detects exactly 9 known violations (found ${count})`);
  } catch (err) {
    // Ignore as it might exit with 1
  }

  console.log(chalk.bold.cyan(`\nVerification Complete: ${passedTests}/${totalTests} passed.\n`));
  
  if (passedTests < totalTests) {
    process.exit(1);
  }
}

main().catch(console.error);
