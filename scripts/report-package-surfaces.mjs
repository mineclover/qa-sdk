#!/usr/bin/env node
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";

const SURFACES = [
  {
    id: "coordinate-kernel",
    verdict: "keep",
    packages: [
      "weighted-index",
      "bit-index",
      "index-meta",
      "index-meta-workers",
      "permission-engine",
      "address-index",
      "tag-search",
      "weighted-ui",
      "weighted-wasm",
    ],
  },
  {
    id: "observability-runtime",
    verdict: "maintain",
    packages: [
      "@qa-sdk/apm",
      "@qa-sdk/core",
      "@qa-sdk/sdk",
      "@qa-sdk/browser",
      "@qa-sdk/ingest-server",
      "@qa-sdk/registry-service",
      "@qa-sdk/registry-client",
      "@qa-sdk/store",
      "@qa-sdk/event-catalog",
      "@qa-sdk/logger",
      "@qa-sdk/pino",
      "@qa-sdk/codec",
      "@qa-sdk/browser-codec",
      "@qa-sdk/codec-proto",
      "@qa-sdk/context",
      "@qa-sdk/engine",
      "@qa-sdk/decode-service",
      "@qa-sdk/gateway",
      "@qa-sdk/otel",
      "gate-service",
      "query-service",
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
      "@qa-sdk/docs-explorer",
      "deterministic-label-registry",
      "ralph-tui-integration",
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
    packages: [
      "data-structure-profile",
      "quality-ledger",
      "review-ledger",
      "@qa-sdk/bench",
      "@qa-sdk/viz-web",
    ],
  },
  {
    id: "decision-recording",
    verdict: "conditional-keep",
    packages: [
      "decision-flow",
      "decision-flow-store",
      "@qa-sdk/decision-service",
      "dkg",
      "dkg-enrichment",
      "demo-dkg-config",
      "operational-ontology",
      "authorization-ontology",
      "work-domain",
    ],
  },
  {
    id: "spec-analysis-kernel",
    verdict: "keep",
    packages: [
      "@qa-sdk/spec-core",
      "@qa-sdk/convergence",
      "spec-schema",
      "spec-transition",
      "spec-tracker",
      "spec-analyzer",
      "snapshot-io",
      "codegen-core",
      "data-object-codegen",
      "demo-snapshot",
      "demo-types",
    ],
  },
  {
    id: "infra-governance-tooling",
    verdict: "maintain",
    packages: [
      "@qa-sdk/cli",
      "@qa-sdk/archi",
      "@qa-sdk/scaffold",
      "@qa-sdk/nest-service-kit",
      "package-classifier",
      "cli-command",
      "config-loader",
      "git-utils",
      "infra-engine",
      "infra-env-kit",
      "db-bootstrap",
      "db-traffic-control",
      "pipe-store-sqlite",
    ],
  },
  {
    id: "authorization-support",
    verdict: "maintain",
    packages: ["audit-recorder-store", "resource-policy-store"],
  },
  {
    id: "motion-authoring",
    verdict: "conditional-keep",
    packages: [
      "motion-content",
      "motion-workspace",
      "motion-workspace-client",
      "@qa-sdk/motion-workspace-service",
    ],
  },
  {
    id: "simulation-contracts",
    verdict: "consumer-contract",
    packages: [
      "sim-decision-view",
      "sim-identifier-grammar",
      "sim-internal-network",
      "sim-outbox-view",
      "sim-service-catalog",
      "@qa-sdk/simulation-tests",
    ],
  },
  {
    id: "visual-analysis-tools",
    verdict: "consumer-tooling",
    packages: [
      "canvas-viewport",
      "@qa-sdk/viz-3d",
      "viz-core",
      "visbug-bridge",
      "rlsc-analysis",
    ],
  },
  {
    id: "verification-suites",
    verdict: "test-only",
    packages: [
      "test-types",
      "@qa-sdk/demo-tests",
      "@qa-sdk/e2e",
      "@qa-sdk/facet-tests",
      "test-scenario-store",
    ],
  },
  {
    id: "product-demo-surfaces",
    verdict: "consumer-only",
    packages: [
      "@qa-sdk/authorization-monitor-web",
      "@qa-sdk/platform-demo",
      "@qa-sdk/platform-demo-api",
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
const workspacePackageRows = [];

for (const dir of readdirSync(packagesDir)) {
  const packageJsonPath = join(packagesDir, dir, "package.json");
  if (!existsSync(packageJsonPath)) continue;
  const pkg = JSON.parse(readFileSync(packageJsonPath, "utf8"));
  const name = pkg.name ?? dir;
  const row = { dir, name };
  workspacePackageRows.push(row);
  workspacePackages.set(name, row);
  workspacePackages.set(name.replace(/^@[^/]+\//, ""), row);
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
const unassigned = workspacePackageRows
  .filter((pkg) => !assignments.has(pkg.name))
  .sort((a, b) => a.name.localeCompare(b.name));

if (process.argv.includes("--json")) {
  console.log(JSON.stringify({
    surfaces: SURFACES,
    totalWorkspacePackages: workspacePackageRows.length,
    assignedPackages: assignments.size,
    missing,
    duplicates,
    unassigned,
  }, null, 2));
} else {
  console.log("Package Surface Report");
  console.log(`  workspace packages assigned: ${assignments.size}/${workspacePackageRows.length}`);
  for (const surface of SURFACES) {
    console.log(`\n[${surface.id}] ${surface.verdict}`);
    for (const pkgName of surface.packages) {
      const pkg = workspacePackages.get(pkgName);
      const marker = pkg ? "ok" : "missing";
      console.log(`  ${marker.padEnd(7)} ${pkgName}`);
    }
  }
  if (unassigned.length > 0) {
    console.log("\n[unassigned] needs surface decision");
    for (const pkg of unassigned) {
      console.log(`  missing ${pkg.name}`);
    }
  }
}

if (missing.length > 0 || duplicates.length > 0 || unassigned.length > 0) {
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
  if (unassigned.length > 0) {
    console.error("\nUnassigned workspace packages:");
    for (const item of unassigned) {
      console.error(`  ${item.name}`);
    }
  }
  process.exit(1);
}
