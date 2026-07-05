import { scanAndClassify } from "../packages/package-classifier/src/pkg-classifier.js";
import { createSurfaceIndex } from "./package-surfaces.mjs";
import { resolve, join } from "node:path";
import { existsSync } from "node:fs";
import chalk from "chalk";

/**
 * Package Activity & Usage Analyzer
 * 
 * 1. Skeletons: No entry points.
 * 2. Dead Weight: No internal dependents.
 * 3. Critical Infrastructure: High fan-in count.
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

  const skeletons: any[] = [];
  const deadWeight: any[] = [];
  const highUsage: any[] = [];
  const surfaceSummary = new Map<string, { total: number; highUsage: number; deadWeight: number; skeletons: number }>();

  for (const pkg of pkgs) {
    const pkgDir = pkg.dir.startsWith("/") ? pkg.dir : join(root, "packages", pkg.dir);
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
      deadWeight: 0,
      skeletons: 0,
    };
    summary.total += 1;
    surfaceSummary.set(surfaceId, summary);

    // A. Skeleton Check
    if (!hasIndex) {
      skeletons.push({ id: pkg.displayName, tier: pkg.tier, surface: surfaceId, verdict });
      summary.skeletons += 1;
    }

    // B. Usage Classification
    if (usageCount === 0) {
      // Exclude consumers and core tools from dead weight
      if (pkg.tier !== "consumer" && !["sdk", "cli", "archi"].includes(pkg.displayName)) {
        deadWeight.push({ id: pkg.displayName, tier: pkg.tier, surface: surfaceId, verdict });
        summary.deadWeight += 1;
      }
    } else if (usageCount >= 3) {
      highUsage.push({ id: pkg.displayName, count: usageCount, tier: pkg.tier, surface: surfaceId, verdict, dependents: uniqueDependents });
      summary.highUsage += 1;
    }
  }

  if (process.argv.includes("--json")) {
    console.log(JSON.stringify({
      totalPackages: pkgs.length,
      surfaces: [...surfaceSummary.entries()]
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([surface, stats]) => ({ surface, ...stats })),
      highUsage,
      deadWeight,
      skeletons,
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
        `  ${chalk.cyan(surface.padEnd(28))} | Total: ${chalk.bold(stats.total)} | High: ${stats.highUsage} | Dead: ${stats.deadWeight} | Skeleton: ${stats.skeletons}`,
      );
    });

  console.log(chalk.bold.green(`[1] Critical Infrastructure (High Usage: Fan-In >= 3)`));
  highUsage.sort((a, b) => b.count - a.count).forEach(h => {
    console.log(`  🔥 ${chalk.yellow(h.id.padEnd(25))} | Count: ${chalk.bold(h.count)} | Tier: ${h.tier} | Surface: ${h.surface}`);
    // console.log(chalk.dim(`     Deps: ${h.dependents.join(", ")}`));
  });

  console.log(chalk.bold.red(`\n[2] Dead Weight (Library/Bridge with 0 dependents)`));
  if (deadWeight.length > 0) {
    deadWeight.forEach(d => console.log(`  📦 ${chalk.dim(d.id.padEnd(25))} | Tier: ${d.tier} | Surface: ${d.surface} | Verdict: ${d.verdict}`));
  } else {
    console.log("  (None found)");
  }

  console.log(chalk.bold.yellow(`\n[3] Skeletons (Missing src/index.ts entry point)`));
  if (skeletons.length > 0) {
    skeletons.forEach(s => console.log(`  💀 ${chalk.dim(s.id.padEnd(25))} | Tier: ${s.tier} | Surface: ${s.surface} | Verdict: ${s.verdict}`));
  } else {
    console.log("  (None found)");
  }

  console.log(chalk.cyan(`\nAnalysis complete. Total packages scanned: ${pkgs.length}\n`));
}

main().catch(console.error);
