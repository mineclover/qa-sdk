import { scanAndClassify, type ClassifiedPackage } from "../packages/package-classifier/src/pkg-classifier.js";
import { resolve, join } from "node:path";
import { existsSync, readdirSync } from "node:fs";

async function main() {
  const root = resolve(process.cwd());
  const pkgs = await scanAndClassify(root);
  const pkgMap = new Map<string, ClassifiedPackage>(pkgs.map(p => [p.name, p]));
  
  // 1. Reverse Dependency Map
  const dependentsMap = new Map<string, string[]>();
  pkgs.forEach(p => {
    p.deps.forEach(depName => {
      const deps = dependentsMap.get(depName) || [];
      deps.push(p.displayName);
      dependentsMap.set(depName, deps);
    });
  });

  const skeletons: string[] = [];
  const deadWeight: string[] = [];

  for (const pkg of pkgs) {
    // Note: pkg.dir might need join(root, 'packages') or similar depending on classifier output
    const pkgDir = pkg.dir.startsWith("/") ? pkg.dir : join(root, "packages", pkg.dir);
    const hasIndex = existsSync(join(pkgDir, "src/index.ts")) || existsSync(join(pkgDir, "src/main.ts"));
    
    // Check for "Ghost" packages (No implementation)
    if (!hasIndex) {
      skeletons.push(`${pkg.displayName} (Missing src/index.ts)`);
      continue;
    }

    // Check for "Dead Weight" (0 internal dependents)
    // We exclude 'consumer' tier (apps/services/tests) as they are intended to be leaf nodes.
    const dependents = dependentsMap.get(pkg.name) || [];
    if (dependents.length === 0 && pkg.tier !== "consumer" && pkg.displayName !== "sdk" && pkg.displayName !== "cli") {
      deadWeight.push(pkg.displayName);
    }
  }

  console.log("\n💀 [Skeletons] Packages missing implementation entry points:");
  skeletons.forEach(s => console.log(`  - ${s}`));
  if (skeletons.length === 0) console.log("  (None found)");

  console.log("\n📦 [Dead Weight] Library/Bridge packages with 0 internal dependents:");
  deadWeight.forEach(d => console.log(`  - ${d}`));
  if (deadWeight.length === 0) console.log("  (None found)");
}

main().catch(console.error);
