import { scanAndClassify } from "../packages/package-classifier/src/pkg-classifier.js";
import { createSurfaceIndex } from "./package-surfaces.mjs";
import { resolve, join } from "node:path";
import { existsSync, readFileSync } from "node:fs";
import chalk from "chalk";

/**
 * Package Activity & Usage Analyzer
 *
 * 1. Missing Entrypoints: No conventional src/index.ts-style entry point.
 * 2. Zero Fan-In: No internal dependents, classified by package disposition.
 * 3. Dead Weight Candidates: Zero fan-in packages that still need evidence or archive decisions.
 * 4. Critical Infrastructure: High fan-in count.
 */

async function main() {
  const root = resolve(process.cwd());
  const pkgs = await scanAndClassify(root);
  const surfaceIndex = createSurfaceIndex();
  
  // 1. Dependency Mapping
  const fanInMap = new Map<string, string[]>(); // pkgName -> dependents
  pkgs.forEach(p => {
    p.deps.forEach(depName => {
      const dependents = fanInMap.get(depName) || [];
      dependents.push(p.displayName);
      fanInMap.set(depName, dependents);
    });
  });

  const missingEntrypoints: any[] = [];
  const entrypointGaps: any[] = [];
  const deadWeight: any[] = [];
  const zeroFanIn: any[] = [];
  const highUsage: any[] = [];
  const surfaceSummary = new Map<
    string,
    { total: number; highUsage: number; zeroFanIn: number; deadWeight: number; missingEntrypoints: number; entrypointGaps: number }
  >();

  for (const pkg of pkgs) {
    const pkgDir = pkg.dir.startsWith("/") ? pkg.dir : join(root, "packages", pkg.dir);
    const pkgJson = readPackageJson(pkgDir);
    const hasIndex = existsSync(join(pkgDir, "src/index.ts")) || 
                     existsSync(join(pkgDir, "src/main.ts")) ||
                     existsSync(join(pkgDir, "src/index.js"));
    
    const dependents = [
      ...(fanInMap.get(pkg.displayName) || []),
      ...(fanInMap.get(pkg.name) || []),
    ];
    const uniqueDependents = [...new Set(dependents)].sort();
    const usageCount = uniqueDependents.length;
    const surface = surfaceIndex.get(pkg.name) || surfaceIndex.get(pkg.displayName);
    const surfaceId = surface?.id ?? "unassigned";
    const verdict = surface?.verdict ?? "needs-decision";
    const summary = surfaceSummary.get(surfaceId) || {
      total: 0,
      highUsage: 0,
      zeroFanIn: 0,
      deadWeight: 0,
      missingEntrypoints: 0,
      entrypointGaps: 0,
    };
    summary.total += 1;
    surfaceSummary.set(surfaceId, summary);

    // A. Entrypoint Check
    if (!hasIndex) {
      const disposition = classifyMissingEntrypoint(pkg, pkgJson, pkgDir, verdict);
      const item = { id: pkg.displayName, tier: pkg.tier, surface: surfaceId, verdict, disposition };
      missingEntrypoints.push(item);
      summary.missingEntrypoints += 1;

      if (disposition === "entrypoint-gap") {
        entrypointGaps.push(item);
        summary.entrypointGaps += 1;
      }
    }

    // B. Usage Classification
    if (usageCount === 0) {
      const disposition = classifyZeroFanIn(pkg, pkgJson, verdict);
      const zeroFanInItem = { id: pkg.displayName, tier: pkg.tier, surface: surfaceId, verdict, disposition };
      zeroFanIn.push(zeroFanInItem);
      summary.zeroFanIn += 1;

      // Exclude consumers and core tools from dead weight candidates.
      if (pkg.tier !== "consumer" && !["sdk", "cli", "archi"].includes(pkg.displayName)) {
        if (disposition === "archive-candidate" || disposition === "needs-evidence") {
          deadWeight.push(zeroFanInItem);
          summary.deadWeight += 1;
        }
      }
    } else if (usageCount >= 3) {
      highUsage.push({ id: pkg.displayName, count: usageCount, tier: pkg.tier, surface: surfaceId, verdict, dependents: uniqueDependents });
      summary.highUsage += 1;
    }
  }

  const highUsageByCount = [...highUsage].sort((a, b) => b.count - a.count || a.id.localeCompare(b.id));
  const zeroFanInById = [...zeroFanIn].sort((a, b) => a.id.localeCompare(b.id));
  const deadWeightById = [...deadWeight].sort((a, b) => a.id.localeCompare(b.id));
  const missingEntrypointsById = [...missingEntrypoints].sort((a, b) => a.id.localeCompare(b.id));
  const entrypointGapsById = [...entrypointGaps].sort((a, b) => a.id.localeCompare(b.id));

  if (process.argv.includes("--json")) {
    console.log(JSON.stringify({
      totalPackages: pkgs.length,
      surfaces: [...surfaceSummary.entries()]
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([surface, stats]) => ({
          surface,
          ...stats,
          skeletons: stats.missingEntrypoints,
        })),
      highUsage: highUsageByCount,
      zeroFanIn: zeroFanInById,
      deadWeight: deadWeightById,
      missingEntrypoints: missingEntrypointsById,
      entrypointGaps: entrypointGapsById,
      skeletons: missingEntrypointsById,
    }, null, 2));
    return;
  }

  // ─── Reporting ─────────────────────────────────────────────────────────────

  console.log(chalk.bold.cyan("\n📊 Package Usage & Health Analysis Report\n"));

  console.log(chalk.bold.blue(`[0] Surface Summary`));
  [...surfaceSummary.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .forEach(([surface, stats]) => {
      console.log(
        `  ${chalk.cyan(surface.padEnd(28))} | Total: ${chalk.bold(stats.total)} | High: ${stats.highUsage} | Zero: ${stats.zeroFanIn} | Dead: ${stats.deadWeight} | Missing: ${stats.missingEntrypoints} | Gaps: ${stats.entrypointGaps}`,
      );
    });

  console.log(chalk.bold.green(`[1] Critical Infrastructure (High Usage: Fan-In >= 3)`));
  highUsageByCount.forEach(h => {
    console.log(`  🔥 ${chalk.yellow(h.id.padEnd(25))} | Count: ${chalk.bold(h.count)} | Tier: ${h.tier} | Surface: ${h.surface}`);
    // console.log(chalk.dim(`     Deps: ${h.dependents.join(", ")}`));
  });

  console.log(chalk.bold.magenta(`\n[2] Zero Fan-In Packages (Disposition)`));
  if (zeroFanInById.length > 0) {
    zeroFanInById.forEach(d => console.log(`  ◌ ${chalk.dim(d.id.padEnd(25))} | Tier: ${d.tier} | Surface: ${d.surface} | Verdict: ${d.verdict} | Disposition: ${d.disposition}`));
  } else {
    console.log("  (None found)");
  }

  console.log(chalk.bold.red(`\n[3] Dead Weight Candidates (Needs Evidence or Archive Decision)`));
  if (deadWeightById.length > 0) {
    deadWeightById.forEach(d => console.log(`  📦 ${chalk.dim(d.id.padEnd(25))} | Tier: ${d.tier} | Surface: ${d.surface} | Verdict: ${d.verdict} | Disposition: ${d.disposition}`));
  } else {
    console.log("  (None found)");
  }

  console.log(chalk.bold.yellow(`\n[4] Missing Conventional Entrypoints (Disposition)`));
  if (missingEntrypointsById.length > 0) {
    missingEntrypointsById.forEach(s => console.log(`  ◇ ${chalk.dim(s.id.padEnd(25))} | Tier: ${s.tier} | Surface: ${s.surface} | Verdict: ${s.verdict} | Disposition: ${s.disposition}`));
  } else {
    console.log("  (None found)");
  }

  console.log(chalk.bold.red(`\n[5] Entrypoint Gaps (Public/Library Surface Needs Review)`));
  if (entrypointGapsById.length > 0) {
    entrypointGapsById.forEach(s => console.log(`  💀 ${chalk.dim(s.id.padEnd(25))} | Tier: ${s.tier} | Surface: ${s.surface} | Verdict: ${s.verdict} | Disposition: ${s.disposition}`));
  } else {
    console.log("  (None found)");
  }

  console.log(chalk.cyan(`\nAnalysis complete. Total packages scanned: ${pkgs.length}\n`));
}

main().catch(console.error);

function readPackageJson(pkgDir: string): Record<string, any> {
  return JSON.parse(readFileSync(join(pkgDir, "package.json"), "utf8"));
}

function classifyZeroFanIn(
  pkg: { tier: string; displayName: string },
  pkgJson: Record<string, any>,
  verdict: string,
): string {
  if (verdict === "no-promotion") return "archive-candidate";
  if (["consumer-contract", "consumer-tooling", "test-only"].includes(verdict)) {
    return "standalone-contract";
  }
  if (pkgJson.private === true) return "standalone-app";
  if (pkgJson.bin) return "standalone-tool";

  const hasLibraryEntrypoint = Boolean(pkgJson.exports || pkgJson.main || pkgJson.module || pkgJson.bin);
  const scripts = pkgJson.scripts ?? {};
  const hasOperationalScript = ["start", "preview", "deploy", "deploy:local", "demo", "infra", "build:data", "test:e2e"].some(
    (script) => scripts[script],
  );
  if (hasOperationalScript) return "standalone-tool";

  if (["keep", "maintain", "keep-as-tooling", "conditional-keep"].includes(verdict) && hasLibraryEntrypoint) {
    return "kept-library";
  }

  if (pkg.tier === "consumer") return "standalone-app";
  return "needs-evidence";
}

function classifyMissingEntrypoint(
  pkg: { tier: string; displayName: string },
  pkgJson: Record<string, any>,
  pkgDir: string,
  verdict: string,
): string {
  if (["test-only", "consumer-contract"].includes(verdict)) return "test-or-contract-suite";

  const scripts = pkgJson.scripts ?? {};
  const hasScript = (...names: string[]) => names.some((name) => scripts[name]);

  if (hasScript("build:wasm") || existsSync(join(pkgDir, "Cargo.toml")) || String(pkgJson.main ?? "").startsWith("js/")) {
    return "wasm-package";
  }

  if (
    existsSync(join(pkgDir, "index.html"))
    || existsSync(join(pkgDir, "public/index.html"))
    || existsSync(join(pkgDir, "src/App.tsx"))
    || existsSync(join(pkgDir, "vite.config.ts"))
    || hasScript("preview", "build:data")
  ) {
    return "browser-app";
  }

  if (
    existsSync(join(pkgDir, "src/server.ts"))
    || existsSync(join(pkgDir, "server.ts"))
    || existsSync(join(pkgDir, "src/worker.ts"))
    || existsSync(join(pkgDir, "worker.ts"))
    || hasScript("start", "deploy", "deploy:prod", "dev:worker")
  ) {
    return "runtime-service";
  }

  if (
    existsSync(join(pkgDir, "playwright.config.ts"))
    || existsSync(join(pkgDir, "vitest.config.ts"))
    || existsSync(join(pkgDir, "tests"))
    || hasScript("test:e2e", "test:ui", "test:headed")
  ) {
    return "test-or-contract-suite";
  }

  if (pkgJson.private === true && pkg.tier === "consumer") return "private-consumer";
  return "entrypoint-gap";
}
