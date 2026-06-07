import { scanAndClassify, type ClassifiedPackage } from "../packages/package-classifier/src/pkg-classifier.js";
import { resolve } from "node:path";

const TIER_ORDER: Record<string, number> = {
  "consumer": 5,
  "bridge": 4,
  "logic": 3,
  "kernel": 2,
  "foundation": 1,
};

async function main() {
  const root = resolve(process.cwd());
  const pkgs = await scanAndClassify(root);
  const pkgMap = new Map<string, ClassifiedPackage>(pkgs.map(p => [p.displayName, p]));

  let violations = 0;

  for (const pkg of pkgs) {
    const currentTierRank = TIER_ORDER[pkg.tier] || 0;
    
    for (const depName of pkg.deps) {
      const dep = pkgMap.get(depName);
      if (!dep) continue;

      const depTierRank = TIER_ORDER[dep.tier] || 0;

      // Higher tier cannot be imported by lower tier (Inversion)
      // Exception: same tier is allowed.
      if (depTierRank > currentTierRank) {
        console.error(`❌ [Tier Violation] "${pkg.displayName}" (${pkg.tier}) cannot depend on "${dep.displayName}" (${dep.tier})`);
        violations++;
      }
    }
  }

  if (violations > 0) {
    console.error(`\nTotal ${violations} tier violations found.`);
    process.exit(1);
  } else {
    console.log("✅ No tier violations found.");
  }
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
