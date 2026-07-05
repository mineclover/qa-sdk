export const SURFACES = [
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

export function displayNameOf(packageName) {
  return packageName.replace(/^@[^/]+\//, "");
}

export function createSurfaceIndex(surfaces = SURFACES) {
  const index = new Map();
  for (const surface of surfaces) {
    for (const packageName of surface.packages) {
      const value = {
        id: surface.id,
        verdict: surface.verdict,
      };
      index.set(packageName, value);
      index.set(displayNameOf(packageName), value);
    }
  }
  return index;
}
