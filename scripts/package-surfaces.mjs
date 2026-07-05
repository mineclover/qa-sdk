export const MANAGED_PACKAGE_SCOPE = "packages/*";

export const SURFACE_GROUPS = [
  {
    id: "runtime-core",
    description: "coordinate math and observability runtime packages that production flows can depend on directly",
  },
  {
    id: "definition-governance",
    description: "definition, decision, spec, and architecture governance packages",
  },
  {
    id: "taxonomy-capability",
    description: "finite vocabulary tooling, adapters, and taxonomy-only preview consumers",
  },
  {
    id: "profile-capability",
    description: "profile contract tooling, evidence adapters, measurement, and profile-only preview consumers",
  },
  {
    id: "domain-support",
    description: "domain-specific support, authoring, simulation, and analysis packages",
  },
  {
    id: "consumer-verification",
    description: "demo, smoke, and test surfaces that consume other capabilities",
  },
  {
    id: "quarantine",
    description: "packages with local evidence but no product-surface promotion",
  },
];

export const SURFACES = [
  {
    id: "coordinate-kernel",
    group: "runtime-core",
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
    group: "runtime-core",
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
    group: "definition-governance",
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
    group: "taxonomy-capability",
    verdict: "keep-as-tooling",
    packages: ["taxonomy-engine"],
  },
  {
    id: "taxonomy-decision-bridge",
    group: "taxonomy-capability",
    verdict: "keep-as-bridge",
    packages: ["taxonomy-decision-bridge"],
  },
  {
    id: "taxonomy-preview-surfaces",
    group: "taxonomy-capability",
    verdict: "consumer-only",
    packages: ["@qa-sdk/taxonomy-web"],
  },
  {
    id: "profile-contract-tooling",
    group: "profile-capability",
    verdict: "keep-as-contract-tool",
    packages: ["data-structure-profile"],
  },
  {
    id: "quality-evidence-ledgers",
    group: "profile-capability",
    verdict: "maintain",
    packages: ["quality-ledger", "review-ledger"],
  },
  {
    id: "measurement-tooling",
    group: "profile-capability",
    verdict: "keep-as-tooling",
    packages: ["@qa-sdk/bench"],
  },
  {
    id: "profile-preview-surfaces",
    group: "profile-capability",
    verdict: "consumer-only",
    packages: ["@qa-sdk/viz-web"],
  },
  {
    id: "decision-recording",
    group: "definition-governance",
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
    group: "definition-governance",
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
    group: "definition-governance",
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
    group: "domain-support",
    verdict: "maintain",
    packages: ["audit-recorder-store", "resource-policy-store"],
  },
  {
    id: "motion-authoring",
    group: "domain-support",
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
    group: "domain-support",
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
    group: "domain-support",
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
    group: "consumer-verification",
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
    group: "consumer-verification",
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
    group: "quarantine",
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
        group: surface.group,
        verdict: surface.verdict,
      };
      index.set(packageName, value);
      index.set(displayNameOf(packageName), value);
    }
  }
  return index;
}
