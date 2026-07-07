import { execSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
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
  let totalUsageSurfaceManagedPackages: number | undefined;

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
    const signalsOutput = execSync("tsx scripts/discover-event-flow.ts", { encoding: "utf-8" });
    
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
    assert(false, "Signal Analysis: command completed successfully");
  }

  // 2. Verify arch:usage Accuracy
  try {
    const usageOutput = execSync("tsx scripts/analyze-package-usage.ts --json", { encoding: "utf-8" });
    const usage = JSON.parse(usageOutput);
    const usageManagedPackageScope = usage.managedPackageScope ?? "packages/*";
    totalUsageSurfaceManagedPackages = usage.totalSurfaceManagedPackages ?? usage.totalPackages;

    assert(usageManagedPackageScope === "packages/*",
           `Usage Analysis: managed package scope is packages/* (${usageManagedPackageScope})`);
    assert(totalUsageSurfaceManagedPackages === usage.totalPackages,
           `Usage Analysis: surface-managed package count matches total package count (${totalUsageSurfaceManagedPackages})`);

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

    const usefulnessOutput = execSync("node scripts/design-usefulness-audit.mjs --format json --all", { encoding: "utf-8" });
    const usefulness = JSON.parse(usefulnessOutput);
    const usefulnessPackages = Object.fromEntries(
      usefulness.packages.map((item: { name: string }) => [item.name, item]),
    ) as Record<string, { verdict: string; surfaceGroup: string; surfaceVerdict: string; surfaceScope: string }>;
    const usefulnessDocs = Object.fromEntries(
      usefulness.docs.map((item: { path: string }) => [item.path, item]),
    ) as Record<string, { verdict: string; sourceRefs: number; reasons: string[]; isProposalIndexDoc?: boolean; isTemplateDoc?: boolean }>;
    assert(usefulnessPackages["request-contract"]?.verdict === "quarantine"
           && usefulnessPackages["weighted-gpu"]?.verdict === "quarantine",
           "Usefulness Audit: no-promotion packages stay quarantine candidates");
    assert(usefulnessPackages["request-contract"]?.surfaceVerdict === "no-promotion"
           && usefulnessPackages["weighted-gpu"]?.surfaceVerdict === "no-promotion",
           "Usefulness Audit: quarantine candidates are derived from package surface manifest");
    const unassignedSurfaceManagedPackages = usefulness.packages
      .filter((item: { surfaceScope: string; surfaceVerdict: string }) =>
        item.surfaceScope === "surface-managed" && item.surfaceVerdict === "unassigned");
    assert(unassignedSurfaceManagedPackages.length === 0,
           `Usefulness Audit: surface-managed packages are not left unassigned (${unassignedSurfaceManagedPackages.map((item: { name: string }) => item.name).join(", ") || "ok"})`);
    assert(usefulness.summary.packageScopes?.["surface-managed"] === totalUsageSurfaceManagedPackages,
           `Usefulness Audit: surface-managed scope matches package surface scope (${usefulness.summary.packageScopes?.["surface-managed"]}/${totalUsageSurfaceManagedPackages})`);
    assert(usefulnessPackages["@qa-sdk-sim/enterprise-pm"]?.surfaceScope === "workspace-support"
           && usefulnessPackages["@qa-sdk/sim-gateway"]?.surfaceScope === "workspace-support"
           && usefulnessPackages["@qa-sdk/sim-gateway"]?.surfaceVerdict === "workspace-support"
           && usefulnessPackages["visbug"]?.surfaceScope === "workspace-support",
           "Usefulness Audit: simulation/vendor workspaces stay outside package surface promotion scope");
    assert(usefulnessPackages["taxonomy-engine"]?.surfaceGroup === "taxonomy-capability"
           && usefulnessPackages["data-structure-profile"]?.surfaceGroup === "profile-capability"
           && usefulnessPackages["@qa-sdk/viz-web"]?.surfaceGroup === "profile-capability"
           && usefulnessPackages["weighted-index"]?.surfaceGroup === "coordinate-kernel-capability"
           && usefulnessPackages["@qa-sdk/core"]?.surfaceGroup === "observability-runtime-capability"
           && usefulnessPackages["definition-catalog"]?.surfaceGroup === "definition-catalog-capability"
           && usefulnessPackages["decision-flow"]?.surfaceGroup === "decision-evidence-capability"
           && usefulnessPackages["@qa-sdk/spec-core"]?.surfaceGroup === "spec-analysis-capability"
           && usefulnessPackages["@qa-sdk/cli"]?.surfaceGroup === "governance-tooling"
           && usefulnessPackages["resource-policy-store"]?.surfaceGroup === "authorization-support-capability"
           && usefulnessPackages["motion-content"]?.surfaceGroup === "motion-authoring-capability"
           && usefulnessPackages["sim-service-catalog"]?.surfaceGroup === "simulation-contract-capability"
           && usefulnessPackages["viz-core"]?.surfaceGroup === "visual-analysis-capability"
           && usefulnessPackages["test-types"]?.surfaceGroup === "verification-suite-capability"
           && usefulnessPackages["@qa-sdk/platform-demo"]?.surfaceGroup === "demo-consumer-surfaces"
           && usefulnessPackages["request-contract"]?.surfaceGroup === "quarantine",
           "Usefulness Audit: packages expose separated feature groups");
    assert(usefulnessDocs["docs/proposals/README.md"]?.verdict === "keep"
           && usefulnessDocs["docs/proposals/README.md"]?.isProposalIndexDoc === true
           && usefulnessDocs["docs/proposals/README.md"]?.reasons.includes("proposal index"),
           "Usefulness Audit: proposal root README stays index doc");
    const proposalTemplateDocs = usefulness.docs
      .filter((item: { path: string }) => item.path.startsWith("docs/proposals/_template/"));
    assert(proposalTemplateDocs.length > 0
           && proposalTemplateDocs.every((item: { verdict: string; isTemplateDoc?: boolean; reasons: string[] }) =>
             item.verdict === "keep"
             && item.isTemplateDoc === true
             && item.reasons.includes("proposal template scaffold")),
           "Usefulness Audit: proposal templates stay scaffold docs");
    assert(usefulnessDocs["docs/specs/prefix-catalog/entity-prefix-group/prefix-service.spec.md"]?.verdict === "keep"
           && usefulnessDocs["docs/specs/prefix-catalog/entity-prefix-group/prefix-service.spec.md"]?.sourceRefs === 1,
           "Usefulness Audit: singular source refs with symbol suffix count as source evidence");
    assert(!usefulnessDocs["docs/specs/authorization-ontology/authorization-ontology-resource-lifecycle.spec.md"]?.reasons
      ?.some((reason) => reason.includes("missing source refs")),
           "Usefulness Audit: source refs with symbol suffix are resolved by file path");
    const skillCatalogDocs = usefulness.docs
      .filter((item: { path: string }) => item.path.startsWith("docs/specs/skill-catalog/"));
    const skillCatalogProveDocs = skillCatalogDocs
      .filter((item: { verdict: string }) => item.verdict === "prove");
    const skillCatalogDocsWithoutSourceRefs = skillCatalogDocs
      .filter((item: { sourceRefs: number }) => item.sourceRefs === 0);
    assert(skillCatalogDocs.length === 51
           && skillCatalogProveDocs.length === 0
           && skillCatalogDocsWithoutSourceRefs.length === 0,
           `Usefulness Audit: skill catalog docs are source-backed keep docs (${skillCatalogDocs.length} docs, prove=${skillCatalogProveDocs.length}, missingSources=${skillCatalogDocsWithoutSourceRefs.length})`);
    assert(usefulnessDocs["docs/specs/skill-catalog/claude-skill-group/skill-def-context.spec.md"]?.verdict === "keep"
           && usefulnessDocs["docs/specs/skill-catalog/claude-skill-group/skill-def-context.spec.md"]?.sourceRefs === 1,
           "Usefulness Audit: repo-local skill sources count as source evidence");
    const metaSemanticSourceBackedDocs = [
      "docs/specs/meta-semantic/meta-semantic-system.spec.md",
      "docs/specs/meta-semantic/meta-semantic-ir.spec.md",
      "docs/specs/meta-semantic/meta-semantic-ir/meta-semantic-ir-data.spec.md",
      "docs/specs/meta-semantic/meta-semantic-ir/meta-semantic-ir-module.spec.md",
      "docs/specs/meta-semantic/meta-semantic-ir/meta-semantic-ir-pipe.spec.md",
      "docs/specs/meta-semantic/meta-semantic-ir/meta-semantic-ir.rule.md",
      "docs/specs/meta-semantic/meta-semantic-ir/meta-semantic-scope.spec.md",
      "docs/specs/meta-semantic/meta-semantic-ir/meta-semantic-spacetime-uid.spec.md",
      "docs/specs/meta-semantic/algorithm/meta-semantic-extraction.spec.md",
      "docs/specs/meta-semantic/algorithm/meta-semantic-folding.spec.md",
      "docs/specs/meta-semantic/algorithm/meta-semantic-execution-semantics.spec.md",
    ];
    const metaSemanticSourceBackedGaps = metaSemanticSourceBackedDocs
      .filter((path) => usefulnessDocs[path]?.verdict !== "keep" || usefulnessDocs[path]?.sourceRefs === 0);
    assert(metaSemanticSourceBackedGaps.length === 0,
           `Usefulness Audit: meta-semantic IR/execution docs are source-backed keep docs (${metaSemanticSourceBackedGaps.join(", ") || "ok"})`);
    const pipeFlowCatalogDocs = usefulness.docs
      .filter((item: { path: string }) => item.path.startsWith("docs/specs/meta-semantic/pipe-impl/flows/"));
    const pipeConnectionCatalogDocs = usefulness.docs
      .filter((item: { path: string }) => item.path.startsWith("docs/specs/meta-semantic/pipe-impl/connections/"));
    const pipeVocabularyGaps = [...pipeFlowCatalogDocs, ...pipeConnectionCatalogDocs]
      .filter((item: { verdict: string; sourceRefs: number }) => item.verdict !== "keep" || item.sourceRefs === 0);
    assert(pipeFlowCatalogDocs.length === 29
           && pipeConnectionCatalogDocs.length === 8
           && pipeVocabularyGaps.length === 0,
           `Usefulness Audit: pipe flow/connection vocabulary docs are source-backed keep docs (flows=${pipeFlowCatalogDocs.length}, connections=${pipeConnectionCatalogDocs.length}, gaps=${pipeVocabularyGaps.length})`);
    const metaSemanticPipeModelDocs = [
      "docs/specs/meta-semantic/pipe-impl/model/data-object-binding.spec.md",
      "docs/specs/meta-semantic/pipe-impl/model/data-object-codegen.spec.md",
      "docs/specs/meta-semantic/pipe-impl/model/facet-code-lineage.spec.md",
      "docs/specs/meta-semantic/pipe-impl/model/facet-port-model.spec.md",
      "docs/specs/meta-semantic/pipe-impl/model/meta-semantic-data-contract.spec.md",
      "docs/specs/meta-semantic/pipe-impl/model/pipe-store-memory.spec.md",
      "docs/specs/meta-semantic/pipe-impl/model/pipe-types.spec.md",
      "docs/specs/meta-semantic/pipe-impl/model/prefix-path-summation.spec.md",
      "docs/specs/meta-semantic/pipe-impl/pipe-connection-catalog.spec.md",
      "docs/specs/meta-semantic/pipe-impl/pipe-flow-catalog.spec.md",
      "docs/specs/meta-semantic/pipe-impl/pipe-flow-visual-semantics.spec.md",
      "docs/specs/meta-semantic/pipe-impl/pipe-static-lineage.spec.md",
      "docs/specs/meta-semantic/pipe-impl/pipe-fold-lineage.spec.md",
      "docs/specs/meta-semantic/pipe-impl/pipe-graph-lineage-precision.spec.md",
      "docs/specs/meta-semantic/pipe-impl/pipe-reduce-lineage.spec.md",
      "docs/specs/meta-semantic/pipe-impl/test-name-tokens.spec.md",
      "docs/specs/meta-semantic/pipe-impl/transition-scope.spec.md",
    ];
    const metaSemanticPipeModelGaps = metaSemanticPipeModelDocs
      .filter((path) => usefulnessDocs[path]?.verdict !== "keep" || usefulnessDocs[path]?.sourceRefs === 0);
    assert(metaSemanticPipeModelGaps.length === 0,
           `Usefulness Audit: meta-semantic pipe model/lineage docs are source-backed keep docs (${metaSemanticPipeModelGaps.join(", ") || "ok"})`);
    const metaSemanticConceptDocs = [
      "docs/specs/meta-semantic/concepts/ms-concept-boundary.spec.md",
      "docs/specs/meta-semantic/concepts/ms-concept-branch-path.spec.md",
      "docs/specs/meta-semantic/concepts/ms-concept-contract-descent.spec.md",
      "docs/specs/meta-semantic/concepts/ms-concept-data-facets.spec.md",
      "docs/specs/meta-semantic/concepts/ms-concept-event.spec.md",
      "docs/specs/meta-semantic/concepts/ms-concept-folding.spec.md",
      "docs/specs/meta-semantic/concepts/ms-concept-pipe.spec.md",
      "docs/specs/meta-semantic/concepts/ms-concept-spacetime-uid.spec.md",
      "docs/specs/meta-semantic/concepts/ms-concept-verification-unit.spec.md",
    ];
    const metaSemanticConceptGaps = metaSemanticConceptDocs
      .filter((path) => usefulnessDocs[path]?.verdict !== "keep" || usefulnessDocs[path]?.sourceRefs === 0);
    assert(metaSemanticConceptGaps.length === 0,
           `Usefulness Audit: meta-semantic concept docs are source-backed keep docs (${metaSemanticConceptGaps.join(", ") || "ok"})`);
    const metaSemanticInterfaceDocs = [
      "docs/specs/meta-semantic/interface/cloud-event-bridge.spec.md",
      "docs/specs/meta-semantic/interface/event-track-codegen.spec.md",
      "docs/specs/meta-semantic/interface/meta-semantic-event-standard.spec.md",
    ];
    const metaSemanticInterfaceGaps = metaSemanticInterfaceDocs
      .filter((path) => usefulnessDocs[path]?.verdict !== "keep" || usefulnessDocs[path]?.sourceRefs === 0);
    assert(metaSemanticInterfaceGaps.length === 0,
           `Usefulness Audit: meta-semantic interface docs are source-backed keep docs (${metaSemanticInterfaceGaps.join(", ") || "ok"})`);
    const definitionManagementDocs = [
      "docs/specs/definition-catalog/definition-management.spec.md",
      "docs/specs/definition-catalog/definition-management/definition-mgmt-consistency-rules.spec.md",
      "docs/specs/definition-catalog/definition-management/definition-mgmt-coordinates.spec.md",
      "docs/specs/definition-catalog/definition-management/definition-mgmt-feedback-loop.spec.md",
      "docs/specs/definition-catalog/definition-management/definition-mgmt-graph-links.spec.md",
      "docs/specs/definition-catalog/definition-management/definition-mgmt-observability-model.spec.md",
      "docs/specs/definition-catalog/definition-management/definition-mgmt-observability-planes.spec.md",
      "docs/specs/definition-catalog/definition-management/definition-mgmt-reachable-path-registry.spec.md",
      "docs/specs/definition-catalog/definition-management/definition-mgmt-semantic-lint.spec.md",
      "docs/specs/definition-catalog/definition-management/definition-mgmt-state-tracking.spec.md",
      "docs/specs/definition-catalog/definition-management/definition-mgmt-verification-loop.spec.md",
    ];
    const definitionManagementGaps = definitionManagementDocs
      .filter((path) => usefulnessDocs[path]?.verdict !== "keep" || usefulnessDocs[path]?.sourceRefs === 0);
    assert(definitionManagementGaps.length === 0,
           `Usefulness Audit: definition management docs are source-backed keep docs (${definitionManagementGaps.join(", ") || "ok"})`);
    const definitionMetadataDocs = [
      "docs/specs/definition-catalog/definition-frontmatter-metadata-system.spec.md",
      "docs/specs/definition-catalog/definition-frontmatter-metadata-system.cases.md",
      "docs/specs/definition-catalog/definition-metadata-depth.spec.md",
      "docs/specs/definition-catalog/definition-metadata-id.spec.md",
      "docs/specs/definition-catalog/definition-metadata-intent-hierarchy.spec.md",
      "docs/specs/definition-catalog/definition-metadata-knowledge-kind.spec.md",
      "docs/specs/definition-catalog/definition-metadata-layer.spec.md",
      "docs/specs/definition-catalog/definition-metadata-lifecycle.spec.md",
      "docs/specs/definition-catalog/definition-metadata-links.spec.md",
      "docs/specs/definition-catalog/definition-metadata-owner-system.spec.md",
      "docs/specs/definition-catalog/definition-metadata-projection-plane.spec.md",
      "docs/specs/definition-catalog/definition-metadata-scope-aspect.spec.md",
      "docs/specs/definition-catalog/definition-metadata-source-map.spec.md",
      "docs/specs/definition-catalog/definition-metadata-tags.spec.md",
      "docs/specs/definition-catalog/definition-metadata-tier.spec.md",
      "docs/specs/definition-catalog/definition-metadata-type.spec.md",
    ];
    const definitionMetadataGaps = definitionMetadataDocs
      .filter((path) => usefulnessDocs[path]?.verdict !== "keep" || usefulnessDocs[path]?.sourceRefs === 0);
    assert(definitionMetadataGaps.length === 0,
           `Usefulness Audit: definition metadata docs are source-backed keep docs (${definitionMetadataGaps.join(", ") || "ok"})`);
    const definitionHarnessQualityDocs = [
      "docs/specs/definition-catalog/definition-harness.spec.md",
      "docs/specs/definition-catalog/definition-harness-architecture.spec.md",
      "docs/specs/definition-catalog/definition-harness/definition-harness-cli.spec.md",
      "docs/specs/definition-catalog/definition-harness/definition-harness-derive.spec.md",
      "docs/specs/definition-catalog/definition-harness/definition-harness-persistence.spec.md",
      "docs/specs/definition-catalog/definition-state-model.spec.md",
      "docs/specs/definition-catalog/definition-gate-fsm.spec.md",
      "docs/specs/definition-catalog/definition-gate-derivation.spec.md",
      "docs/specs/definition-catalog/definition-quality-gates.spec.md",
      "docs/specs/definition-catalog/definition-quality-contract.spec.md",
    ];
    const definitionHarnessQualityGaps = definitionHarnessQualityDocs
      .filter((path) => usefulnessDocs[path]?.verdict !== "keep" || usefulnessDocs[path]?.sourceRefs === 0);
    assert(definitionHarnessQualityGaps.length === 0,
           `Usefulness Audit: definition harness/quality docs are source-backed keep docs (${definitionHarnessQualityGaps.join(", ") || "ok"})`);

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
    assert(false, "Usage Analysis: command completed successfully and produced valid JSON");
  }

  // 3. Verify package surface coverage and feature separation
  try {
    const surfaceOutput = execSync("node scripts/report-package-surfaces.mjs --json", { encoding: "utf-8" });
    const report = JSON.parse(surfaceOutput);
    const managedPackageScope = report.managedPackageScope ?? "packages/*";
    const assignedSurfaceManagedPackages = report.assignedSurfaceManagedPackages ?? report.assignedPackages;
    const totalSurfaceManagedPackages = report.totalSurfaceManagedPackages ?? report.totalWorkspacePackages;

    assert(managedPackageScope === "packages/*",
           `Surface Report: managed package scope is packages/* (${managedPackageScope})`);
    assert(assignedSurfaceManagedPackages === totalSurfaceManagedPackages,
           `Surface Report: all surface-managed packages are assigned (${assignedSurfaceManagedPackages}/${totalSurfaceManagedPackages})`);
    assert(totalUsageSurfaceManagedPackages === undefined || totalUsageSurfaceManagedPackages === totalSurfaceManagedPackages,
           `Surface Report: usage and surface package counts agree (${totalUsageSurfaceManagedPackages ?? "unknown"}/${totalSurfaceManagedPackages})`);
    assert(Array.isArray(report.missing) && report.missing.length === 0,
           "Surface Report: no declared surface points at a missing package");
    assert(Array.isArray(report.duplicates) && report.duplicates.length === 0,
           "Surface Report: no package is assigned to multiple surfaces");
    assert(Array.isArray(report.unassigned) && report.unassigned.length === 0,
           "Surface Report: no surface-managed package is left without a surface");

    const surfaces = Object.fromEntries(
      report.surfaces.map((surface: { id: string; packages: string[] }) => [surface.id, surface.packages]),
    ) as Record<string, string[]>;
    const surfaceGroups = Object.fromEntries(
      report.surfaces.map((surface: { id: string; group: string }) => [surface.id, surface.group]),
    ) as Record<string, string>;
    const groupSummaries = Object.fromEntries(
      (report.groupSummaries ?? []).map((group: { id: string; surfaceCount: number; packageCount: number }) => [group.id, group]),
    ) as Record<string, { surfaceCount: number; packageCount: number }>;
    assert(Array.isArray(report.unknownSurfaceGroups) && report.unknownSurfaceGroups.length === 0,
           "Surface Report: every surface uses a known feature group");
    assert(Array.isArray(report.groupSummaries) && report.groupSummaries.length === report.surfaceGroups.length,
           "Surface Report: feature group summary covers every known group");
    assert(hasExactly(surfaces["taxonomy-tooling"], ["taxonomy-engine"]),
           "Surface Report: taxonomy-engine owns finite vocabulary tooling separately");
    assert(hasExactly(surfaces["taxonomy-decision-bridge"], ["taxonomy-decision-bridge"]),
           "Surface Report: taxonomy decision bridge is not folded into taxonomy-engine");
    assert(hasExactly(surfaces["taxonomy-preview-surfaces"], ["@qa-sdk/taxonomy-web"]),
           "Surface Report: taxonomy web preview is a consumer surface");
    assert(hasExactly(surfaces["profile-contract-tooling"], ["data-structure-profile"]),
           "Surface Report: data-structure-profile owns profile contracts separately");
    assert(hasExactly(surfaces["quality-evidence-ledgers"], ["quality-ledger", "review-ledger"]),
           "Surface Report: quality/review ledgers are evidence stores, not profile contracts");
    assert(hasExactly(surfaces["measurement-tooling"], ["@qa-sdk/bench"]),
           "Surface Report: bench remains measurement tooling");
    assert(hasExactly(surfaces["profile-preview-surfaces"], ["@qa-sdk/viz-web"]),
           "Surface Report: viz-web remains a profile/graph consumer preview");
    assert(hasExactly(surfaces["operational-ontology-runtime"], ["operational-ontology"]),
           "Surface Report: operational-ontology owns ontology runtime separately");
    assert(hasExactly(surfaces["operational-ontology-preview-surfaces"], ["@qa-sdk/operational-ontology-web"]),
           "Surface Report: operational ontology web remains an ontology consumer preview");
    assert(surfaceGroups["taxonomy-tooling"] === "taxonomy-capability"
           && surfaceGroups["taxonomy-decision-bridge"] === "taxonomy-capability"
           && surfaceGroups["taxonomy-preview-surfaces"] === "taxonomy-capability"
           && surfaceGroups["coordinate-kernel"] === "coordinate-kernel-capability"
           && surfaceGroups["observability-runtime"] === "observability-runtime-capability"
           && surfaceGroups["profile-contract-tooling"] === "profile-capability"
           && surfaceGroups["quality-evidence-ledgers"] === "profile-capability"
           && surfaceGroups["measurement-tooling"] === "profile-capability"
           && surfaceGroups["profile-preview-surfaces"] === "profile-capability"
           && surfaceGroups["operational-ontology-runtime"] === "operational-ontology-capability"
           && surfaceGroups["operational-ontology-preview-surfaces"] === "operational-ontology-capability"
           && surfaceGroups["definition-control-plane"] === "definition-catalog-capability"
           && surfaceGroups["decision-recording"] === "decision-evidence-capability"
           && surfaceGroups["spec-analysis-kernel"] === "spec-analysis-capability"
           && surfaceGroups["infra-governance-tooling"] === "governance-tooling"
           && surfaceGroups["authorization-support"] === "authorization-support-capability"
           && surfaceGroups["motion-authoring"] === "motion-authoring-capability"
           && surfaceGroups["simulation-contracts"] === "simulation-contract-capability"
           && surfaceGroups["visual-analysis-tools"] === "visual-analysis-capability"
           && surfaceGroups["verification-suites"] === "verification-suite-capability"
           && surfaceGroups["product-demo-surfaces"] === "demo-consumer-surfaces"
           && surfaceGroups["quarantine-candidates"] === "quarantine",
           "Surface Report: capability, consumer, governance, and quarantine feature groups stay separated");
    assert(groupSummaries["coordinate-kernel-capability"]?.surfaceCount === 1
           && groupSummaries["coordinate-kernel-capability"]?.packageCount === 9
           && groupSummaries["observability-runtime-capability"]?.surfaceCount === 1
           && groupSummaries["observability-runtime-capability"]?.packageCount === 21
           && groupSummaries["taxonomy-capability"]?.surfaceCount === 3
           && groupSummaries["taxonomy-capability"]?.packageCount === 3
           && groupSummaries["profile-capability"]?.surfaceCount === 4
           && groupSummaries["profile-capability"]?.packageCount === 5
           && groupSummaries["operational-ontology-capability"]?.surfaceCount === 2
           && groupSummaries["operational-ontology-capability"]?.packageCount === 2
           && groupSummaries["definition-catalog-capability"]?.surfaceCount === 1
           && groupSummaries["definition-catalog-capability"]?.packageCount === 9
           && groupSummaries["decision-evidence-capability"]?.surfaceCount === 1
           && groupSummaries["decision-evidence-capability"]?.packageCount === 8
           && groupSummaries["spec-analysis-capability"]?.surfaceCount === 1
           && groupSummaries["spec-analysis-capability"]?.packageCount === 11
           && groupSummaries["governance-tooling"]?.surfaceCount === 1
           && groupSummaries["governance-tooling"]?.packageCount === 13
           && groupSummaries["authorization-support-capability"]?.surfaceCount === 1
           && groupSummaries["authorization-support-capability"]?.packageCount === 2
           && groupSummaries["motion-authoring-capability"]?.surfaceCount === 1
           && groupSummaries["motion-authoring-capability"]?.packageCount === 4
           && groupSummaries["simulation-contract-capability"]?.surfaceCount === 1
           && groupSummaries["simulation-contract-capability"]?.packageCount === 6
           && groupSummaries["visual-analysis-capability"]?.surfaceCount === 1
           && groupSummaries["visual-analysis-capability"]?.packageCount === 5
           && groupSummaries["verification-suite-capability"]?.surfaceCount === 1
           && groupSummaries["verification-suite-capability"]?.packageCount === 5
           && groupSummaries["demo-consumer-surfaces"]?.surfaceCount === 1
           && groupSummaries["demo-consumer-surfaces"]?.packageCount === 8
           && groupSummaries["quarantine"]?.surfaceCount === 1
           && groupSummaries["quarantine"]?.packageCount === 2,
           "Surface Report: separated feature group summary stays stable");

    const manifestLabels = new Set(report.surfaces.map((surface: { id: string }) => surfaceLabel(surface.id)));
    const ruleRows = parseMarkdownTable(
      "docs/specs/system/package-surface-separation.rule.md",
      "| Surface | 기능군 | 판정 | 대표 패키지/그룹 | 승격 기준 |",
    );
    const packageRows = parseMarkdownTable(
      "docs/specs/system/system-packages.spec.md",
      "| Surface | 기능군 | 역할 | 대표 패키지 |",
    );
    const ruleByLabel = new Map(ruleRows.map((row) => [row[0], row]));
    const packageByLabel = new Map(packageRows.map((row) => [row[0], row]));
    const ruleMissing = [...manifestLabels].filter((label) => !ruleByLabel.has(label));
    const packageMissing = [...manifestLabels].filter((label) => !packageByLabel.has(label));
    const ruleExtras = [...ruleByLabel.keys()].filter((label) => !manifestLabels.has(label));
    const packageExtras = [...packageByLabel.keys()].filter((label) => !manifestLabels.has(label));
    const verdictMismatches = report.surfaces
      .map((surface: { id: string; verdict: string }) => {
        const label = surfaceLabel(surface.id);
        const expected = surface.verdict.replaceAll("-", " ");
        const actual = ruleByLabel.get(label)?.[2];
        return actual === expected ? null : `${label}: expected ${expected}, found ${actual ?? "missing"}`;
      })
      .filter(Boolean);
    const groupMismatches = report.surfaces
      .flatMap((surface: { id: string; group: string }) => {
        const label = surfaceLabel(surface.id);
        const expected = surface.group.replaceAll("-", " ");
        return [
          ruleByLabel.get(label)?.[1] === expected
            ? null
            : `${label} rule: expected ${expected}, found ${ruleByLabel.get(label)?.[1] ?? "missing"}`,
          packageByLabel.get(label)?.[1] === expected
            ? null
            : `${label} packages: expected ${expected}, found ${packageByLabel.get(label)?.[1] ?? "missing"}`,
        ];
      })
      .filter(Boolean);

    assert(ruleMissing.length === 0 && ruleExtras.length === 0,
           `Surface Docs: separation rule table matches manifest surfaces (${formatDiff(ruleMissing, ruleExtras)})`);
    assert(packageMissing.length === 0 && packageExtras.length === 0,
           `Surface Docs: system package table matches manifest surfaces (${formatDiff(packageMissing, packageExtras)})`);
    assert(groupMismatches.length === 0,
           `Surface Docs: feature groups match manifest (${groupMismatches.join("; ") || "ok"})`);
    assert(verdictMismatches.length === 0,
           `Surface Docs: separation rule verdicts match manifest (${verdictMismatches.join("; ") || "ok"})`);

    const taxonomyEntry = readFileSync("docs/specs/system/system-taxonomy.md", "utf-8");
    const profileEntry = readFileSync("docs/specs/system/system-profile.md", "utf-8");
    const operationalOntologyEntry = readFileSync("docs/specs/system/system-operational-ontology.md", "utf-8");
    const rootEntry = readFileSync("docs/specs/system/system-root.md", "utf-8");
    const taxonomySurfaceIds = [
      "taxonomy-tooling",
      "taxonomy-decision-bridge",
      "taxonomy-preview-surfaces",
    ];
    const profileSurfaceIds = [
      "profile-contract-tooling",
      "quality-evidence-ledgers",
      "measurement-tooling",
      "profile-preview-surfaces",
    ];
    const operationalOntologySurfaceIds = [
      "operational-ontology-runtime",
      "operational-ontology-preview-surfaces",
    ];
    assert(taxonomySurfaceIds.every((id) => taxonomyEntry.includes(id)),
           "Surface Docs: taxonomy capability has its own operator entry");
    assert(profileSurfaceIds.every((id) => profileEntry.includes(id)),
           "Surface Docs: profile capability has its own operator entry");
    assert(operationalOntologySurfaceIds.every((id) => operationalOntologyEntry.includes(id)),
           "Surface Docs: operational ontology capability has its own operator entry");
    assert(profileSurfaceIds.every((id) => !taxonomyEntry.includes(id))
           && taxonomySurfaceIds.slice(1).every((id) => !profileEntry.includes(id)),
           "Surface Docs: taxonomy and profile operator entries do not merge surfaces");
    assert(operationalOntologySurfaceIds.every((id) => !taxonomyEntry.includes(id) && !profileEntry.includes(id))
           && taxonomySurfaceIds.every((id) => !operationalOntologyEntry.includes(id))
           && profileSurfaceIds.every((id) => !operationalOntologyEntry.includes(id)),
           "Surface Docs: operational ontology entry does not merge taxonomy/profile surfaces");
    assert(rootEntry.includes("system-taxonomy")
           && rootEntry.includes("system-profile")
           && rootEntry.includes("system-operational-ontology"),
           "Surface Docs: system root links separate taxonomy, profile, and operational ontology entries");
  } catch (err) {
    console.error("Surface verification failed:", err);
    assert(false, "Surface Report: command completed successfully and produced valid JSON");
  }

  // 4. Verify generated prefix catalog docs match the generated prefix id surface.
  try {
    const prefixIds = readGeneratedPrefixIds();
    const expectedPrefixDocIds = prefixIds.map((id) => `prefix-${id}`);
    const prefixCatalogDocIds = collectDefinitionDocIds("docs/specs/prefix-catalog");
    const missingPrefixDocs = expectedPrefixDocIds.filter((id) => !prefixCatalogDocIds.has(id));
    const extraPrefixDocs = [...prefixCatalogDocIds]
      .filter((id) => id.startsWith("prefix-") && id !== "prefix-catalog-system" && !expectedPrefixDocIds.includes(id))
      .sort();
    const prefixCatalogRoot = readFileSync("docs/specs/prefix-catalog/prefix-catalog-system.md", "utf-8");
    const declaredPrefixCount = Number(prefixCatalogRoot.match(/- 총 (\d+)개 prefix/)?.[1] ?? NaN);

    assert(missingPrefixDocs.length === 0 && extraPrefixDocs.length === 0,
           `Prefix Catalog Docs: generated prefix docs match PREFIX_IDS (${formatDiff(missingPrefixDocs, extraPrefixDocs)})`);
    assert(declaredPrefixCount === prefixIds.length,
           `Prefix Catalog Docs: root prefix count matches PREFIX_IDS (${declaredPrefixCount}/${prefixIds.length})`);
    assert(prefixCatalogDocIds.has("state-prefix-group"),
           "Prefix Catalog Docs: state prefix group is documented");
  } catch (err) {
    console.error("Prefix catalog docs verification failed:", err);
    assert(false, "Prefix Catalog Docs: coverage scan completed successfully");
  }

  // 5. Verify arch:check (Boundary) Consistency
  try {
    const checkOutput = execSync("tsx scripts/check-dependency-boundaries.ts --json", { encoding: "utf-8" });
    const boundary = JSON.parse(checkOutput);
    const violationCount = Array.isArray(boundary.violations) ? boundary.violations.length : -1;

    assert(violationCount === 0, `Boundary Check: Detects no tier violations (found ${violationCount})`);
  } catch (err) {
    const output = typeof (err as { stdout?: unknown }).stdout === "string"
      ? (err as { stdout: string }).stdout
      : String((err as { stdout?: Buffer }).stdout ?? "");
    try {
      const boundary = JSON.parse(output);
      const violationCount = Array.isArray(boundary.violations) ? boundary.violations.length : -1;
      assert(violationCount === 0, `Boundary Check: Detects no tier violations (found ${violationCount})`);
    } catch {
      assert(false, "Boundary Check: produced parseable JSON");
    }
  }

  // 6. Verify package scripts don't bypass the pinned package manager or use external npx shims.
  try {
    const toolchainScriptViolations = findToolchainScriptViolations(["."]);
    assert(toolchainScriptViolations.length === 0,
           `Toolchain Scripts: root/workspace package scripts avoid bare pnpm/npx (${toolchainScriptViolations.slice(0, 5).join("; ") || "ok"})`);
    const automationToolchainViolations = findAutomationToolchainViolations();
    assert(automationToolchainViolations.length === 0,
           `Toolchain Scripts: active workflow/operator/Docker surfaces avoid bare pnpm/npx (${automationToolchainViolations.slice(0, 5).join("; ") || "ok"})`);
  } catch (err) {
    console.error("Toolchain script verification failed:", err);
    assert(false, "Toolchain Scripts: toolchain surface scan completed successfully");
  }

  console.log(chalk.bold.cyan(`\nVerification Complete: ${passedTests}/${totalTests} passed.\n`));
  
  if (passedTests < totalTests) {
    process.exit(1);
  }
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});

function hasExactly(actual: string[] | undefined, expected: string[]): boolean {
  return Array.isArray(actual)
    && actual.length === expected.length
    && expected.every((item) => actual.includes(item));
}

function surfaceLabel(id: string): string {
  return id
    .split("-")
    .map((part, index) => index === 0 ? `${part[0]?.toUpperCase() ?? ""}${part.slice(1)}` : part)
    .join(" ");
}

function parseMarkdownTable(path: string, headerLine: string): string[][] {
  const lines = readFileSync(path, "utf-8").split(/\r?\n/);
  const start = lines.findIndex((line) => line.trim() === headerLine);
  if (start < 0) return [];

  const rows: string[][] = [];
  for (let index = start + 2; index < lines.length; index++) {
    const line = lines[index].trim();
    if (!line.startsWith("|")) break;
    rows.push(line
      .replace(/^\|/, "")
      .replace(/\|$/, "")
      .split("|")
      .map((cell) => cell.trim()));
  }
  return rows;
}

function formatDiff(missing: string[], extras: string[]): string {
  const parts = [
    missing.length > 0 ? `missing=${missing.join(", ")}` : "",
    extras.length > 0 ? `extra=${extras.join(", ")}` : "",
  ].filter(Boolean);
  return parts.join("; ") || "ok";
}

function readGeneratedPrefixIds(): string[] {
  const text = readFileSync("packages/demo-types/src/prefix-ids.ts", "utf-8");
  const match = text.match(/export const PREFIX_IDS = \[([\s\S]*?)\] as const;/);
  if (!match) return [];
  return [...match[1].matchAll(/"([^"]+)"/g)].map((item) => item[1]);
}

function collectDefinitionDocIds(root: string): Set<string> {
  const ids = new Set<string>();
  for (const path of walkMarkdownFiles(root)) {
    const id = readFileSync(path, "utf-8").match(/^\s*id:\s*(\S+)/m)?.[1];
    if (id) ids.add(id);
  }
  return ids;
}

function walkMarkdownFiles(root: string): string[] {
  const files: string[] = [];
  if (!existsSync(root)) return files;

  for (const entry of readdirSync(root)) {
    const path = join(root, entry);
    const stats = statSync(path);
    if (stats.isDirectory()) {
      files.push(...walkMarkdownFiles(path));
    } else if (entry.endsWith(".md")) {
      files.push(path);
    }
  }

  return files;
}

function findToolchainScriptViolations(roots: string[]): string[] {
  const packageJsonFiles = roots.flatMap((root) => walkPackageJsonFiles(root));
  const violations: string[] = [];

  for (const path of packageJsonFiles) {
    const manifest = JSON.parse(readFileSync(path, "utf-8")) as { scripts?: Record<string, string> };
    for (const [scriptName, command] of Object.entries(manifest.scripts ?? {})) {
      if (usesBarePnpm(command) || usesNpx(command)) {
        violations.push(`${path}#${scriptName}`);
      }
    }
  }

  return violations;
}

function walkPackageJsonFiles(root: string): string[] {
  const files: string[] = [];
  if (!existsSync(root)) return files;

  for (const entry of readdirSync(root)) {
    if ([
      ".git",
      ".claude",
      "node_modules",
      "dist",
      "build",
      "coverage",
      ".turbo",
      ".next",
      ".vite",
    ].includes(entry)) continue;
    const path = join(root, entry);
    const stats = statSync(path);
    if (stats.isDirectory()) {
      files.push(...walkPackageJsonFiles(path));
    } else if (entry === "package.json") {
      files.push(path);
    }
  }

  return files;
}

function usesBarePnpm(command: string): boolean {
  const tokens = commandTokens(command);
  return tokens.some((token, index) => token === "pnpm" && tokens[index - 1] !== "corepack");
}

function usesNpx(command: string): boolean {
  return commandTokens(command).includes("npx");
}

function commandTokens(command: string): string[] {
  return command
    .split(/\s+/)
    .filter(Boolean)
    .map((token) => token.replace(/^["']+|["']+$/g, ""));
}

function findAutomationToolchainViolations(): string[] {
  const files = [
    ".github/workflows/visbug-bridge-e2e.yml",
    "scripts/maintenance.sh",
    "scripts/setup.sh",
    "scripts/publish-local.sh",
    "scripts/serve-registry.sh",
    "scripts/serve-demo.sh",
    "scripts/find-unused-candidates.ts",
    "scripts/sim-smoke-full.ts",
    "packages/cli/scripts/run-vitest.mjs",
    "Dockerfile.gateway",
    "Dockerfile.ingest-server",
    "Dockerfile.nestjs",
    "Dockerfile.services",
    "Dockerfile.static",
    "docker-compose.yml",
  ];
  const violations: string[] = [];

  for (const path of files) {
    if (!existsSync(path)) continue;
    const lines = readFileSync(path, "utf-8").split(/\r?\n/);
    lines.forEach((line, index) => {
      if (line.includes("npx")) {
        violations.push(`${path}:${index + 1}:npx`);
      }
      if (usesBarePnpmInAutomationLine(path, line)) {
        violations.push(`${path}:${index + 1}:pnpm`);
      }
    });
  }

  return violations;
}

function usesBarePnpmInAutomationLine(path: string, line: string): boolean {
  const trimmed = line.trim();
  if (trimmed === "" || trimmed.startsWith("#") || trimmed.startsWith("//") || trimmed.startsWith("*")) {
    return false;
  }
  if (!/\bpnpm\b/.test(trimmed)) return false;
  if (/\bcorepack\s+pnpm\b/.test(trimmed)) return false;
  if (path.endsWith("sim-smoke-full.ts")) {
    return /cmd:\s*["']pnpm["']/.test(trimmed);
  }
  if (path.endsWith("find-unused-candidates.ts")) {
    return /execFileSync\(["']pnpm["']/.test(trimmed);
  }
  if (path.endsWith("run-vitest.mjs")) {
    return /spawn\(["']pnpm["']/.test(trimmed);
  }
  if (path.startsWith("Dockerfile.")) {
    return /\bRUN\s+pnpm\b|\b&&\s*pnpm\b|\|\|\s*pnpm\b|;\s*pnpm\b/.test(trimmed);
  }
  if (/docker-compose.*\.ya?ml$/.test(path)) {
    return /^\s*pnpm\b/.test(trimmed);
  }
  return true;
}
