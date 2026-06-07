import { scanAndClassify, type ClassifiedPackage } from "../packages/package-classifier/src/pkg-classifier.js";
import { resolve, join, basename } from "node:path";
import { existsSync, statSync } from "node:fs";
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

  for (const pkg of pkgs) {
    const pkgDir = pkg.dir.startsWith("/") ? pkg.dir : join(root, "packages", pkg.dir);
    const hasIndex = existsSync(join(pkgDir, "src/index.ts")) || 
                     existsSync(join(pkgDir, "src/main.ts")) ||
                     existsSync(join(pkgDir, "src/index.js"));
    
    const dependents = fanInMap.get(pkg.name) || fanInMap.get(`@qa-sdk/${pkg.displayName}`) || [];
    const usageCount = dependents.length;

    // A. Skeleton Check
    if (!hasIndex) {
      skeletons.push({ id: pkg.displayName, tier: pkg.tier });
    }

    // B. Usage Classification
    if (usageCount === 0) {
      // Exclude consumers and core tools from dead weight
      if (pkg.tier !== "consumer" && !["sdk", "cli", "archi"].includes(pkg.displayName)) {
        deadWeight.push({ id: pkg.displayName, tier: pkg.tier });
      }
    } else if (usageCount >= 3) {
      highUsage.push({ id: pkg.displayName, count: usageCount, tier: pkg.tier, dependents });
    }
  }

  // ─── Reporting ─────────────────────────────────────────────────────────────

  console.log(chalk.bold.cyan("\n📊 Package Usage & Health Analysis Report\n"));

  console.log(chalk.bold.green(`[1] Critical Infrastructure (High Usage: Fan-In >= 3)`));
  highUsage.sort((a, b) => b.count - a.count).forEach(h => {
    console.log(`  🔥 ${chalk.yellow(h.id.padEnd(25))} | Count: ${chalk.bold(h.count)} | Tier: ${h.tier}`);
    // console.log(chalk.dim(`     Deps: ${h.dependents.join(", ")}`));
  });

  console.log(chalk.bold.red(`\n[2] Dead Weight (Library/Bridge with 0 dependents)`));
  if (deadWeight.length > 0) {
    deadWeight.forEach(d => console.log(`  📦 ${chalk.dim(d.id.padEnd(25))} | Tier: ${d.tier}`));
  } else {
    console.log("  (None found)");
  }

  console.log(chalk.bold.yellow(`\n[3] Skeletons (Missing src/index.ts entry point)`));
  if (skeletons.length > 0) {
    skeletons.forEach(s => console.log(`  💀 ${chalk.dim(s.id.padEnd(25))} | Tier: ${s.tier}`));
  } else {
    console.log("  (None found)");
  }

  console.log(chalk.cyan(`\nAnalysis complete. Total packages scanned: ${pkgs.length}\n`));
}

main().catch(console.error);
