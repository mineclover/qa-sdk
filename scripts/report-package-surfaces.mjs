#!/usr/bin/env node
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";

const SURFACES = [
  {
    id: "coordinate-kernel",
    verdict: "keep",
    packages: ["weighted-index", "bit-index", "index-meta", "permission-engine", "address-index"],
  },
  {
    id: "observability-runtime",
    verdict: "maintain",
    packages: [
      "@qa-sdk/core",
      "@qa-sdk/sdk",
      "@qa-sdk/browser",
      "@qa-sdk/ingest-server",
      "@qa-sdk/registry-service",
      "@qa-sdk/store",
      "@qa-sdk/event-catalog",
      "@qa-sdk/logger",
      "@qa-sdk/pino",
      "@qa-sdk/codec",
      "@qa-sdk/browser-codec",
      "@qa-sdk/codec-proto",
    ],
  },
  {
    id: "definition-control-plane",
    verdict: "keep",
    packages: [
      "definition-catalog",
      "@qa-sdk/definition-service",
      "@qa-sdk/definition-client",
      "definition-data-source",
      "doc-envelope",
      "ontology-pack-validate",
    ],
  },
  {
    id: "taxonomy-tooling",
    verdict: "keep-as-tooling",
    packages: ["taxonomy-engine", "taxonomy-decision-bridge", "@qa-sdk/taxonomy-web"],
  },
  {
    id: "profile-contract-tooling",
    verdict: "keep-as-contract-tool",
    packages: ["data-structure-profile", "quality-ledger", "@qa-sdk/bench", "@qa-sdk/viz-web"],
  },
  {
    id: "decision-recording",
    verdict: "conditional-keep",
    packages: ["decision-flow", "decision-flow-store", "@qa-sdk/decision-service", "dkg"],
  },
  {
    id: "product-demo-surfaces",
    verdict: "consumer-only",
    packages: [
      "@qa-sdk/platform-demo",
      "@qa-sdk/shop-web",
      "@qa-sdk/roleplay-web",
      "@qa-sdk/viteplus-sdk-smoke",
      "weighted-index-explorer",
      "@qa-sdk/operational-ontology-web",
      "@qa-sdk/registry-ui",
    ],
  },
  {
    id: "quarantine-candidates",
    verdict: "no-promotion",
    packages: ["request-contract", "weighted-gpu"],
  },
];

const root = resolve(process.cwd());
const packagesDir = join(root, "packages");
const workspacePackages = new Map();

for (const dir of readdirSync(packagesDir)) {
  const packageJsonPath = join(packagesDir, dir, "package.json");
  if (!existsSync(packageJsonPath)) continue;
  const pkg = JSON.parse(readFileSync(packageJsonPath, "utf8"));
  const name = pkg.name ?? dir;
  workspacePackages.set(name, { dir, name });
  workspacePackages.set(name.replace(/^@[^/]+\//, ""), { dir, name });
}

const assignments = new Map();
const missing = [];

for (const surface of SURFACES) {
  for (const pkgName of surface.packages) {
    const pkg = workspacePackages.get(pkgName);
    if (!pkg) {
      missing.push({ surface: surface.id, pkgName });
      continue;
    }
    const current = assignments.get(pkg.name);
    if (current) {
      current.surfaces.push(surface.id);
    } else {
      assignments.set(pkg.name, {
        name: pkg.name,
        dir: pkg.dir,
        surfaces: [surface.id],
      });
    }
  }
}

const duplicates = [...assignments.values()].filter((assignment) => assignment.surfaces.length > 1);

if (process.argv.includes("--json")) {
  console.log(JSON.stringify({
    surfaces: SURFACES,
    assignedPackages: assignments.size,
    missing,
    duplicates,
  }, null, 2));
} else {
  console.log("Package Surface Report");
  console.log(`  workspace packages assigned: ${assignments.size}`);
  for (const surface of SURFACES) {
    console.log(`\n[${surface.id}] ${surface.verdict}`);
    for (const pkgName of surface.packages) {
      const pkg = workspacePackages.get(pkgName);
      const marker = pkg ? "ok" : "missing";
      console.log(`  ${marker.padEnd(7)} ${pkgName}`);
    }
  }
}

if (missing.length > 0 || duplicates.length > 0) {
  if (missing.length > 0) {
    console.error("\nMissing packages:");
    for (const item of missing) {
      console.error(`  ${item.surface}: ${item.pkgName}`);
    }
  }
  if (duplicates.length > 0) {
    console.error("\nDuplicate surface assignments:");
    for (const item of duplicates) {
      console.error(`  ${item.name}: ${item.surfaces.join(", ")}`);
    }
  }
  process.exit(1);
}
