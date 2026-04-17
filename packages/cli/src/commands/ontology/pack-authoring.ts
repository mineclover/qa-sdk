import {
  createOntologyPackScaffoldPlanFromCliArgs,
  hasOntologyPackScaffoldErrors,
  type OntologyPackScaffoldPlan,
} from "../../lib/ontology-pack-scaffold-plan.js";
import {
  writeOntologyPackScaffoldPlan,
  type OntologyPackScaffoldWriteSummary,
} from "../../lib/ontology-pack-scaffold-write.js";
import {
  validateOntologyPackFromRef,
  type OntologyPackValidateResult,
} from "../../lib/ontology-pack-validate.js";
import { parseFlags, printJson } from "./support.js";

const PACK_SCAFFOLD_USAGE =
  "Usage: qa-sdk ontology pack scaffold <pack-id> [--implementation-package <name>] [--package-root <path>] [--docs-dir <path>] [--test <path>] [--include-docs <rule,cases,test|all>] [--dry-run] [--write] [--json]";

const PACK_VALIDATE_USAGE =
  "Usage: qa-sdk ontology pack validate <pack-ref> [--json]";

export async function cmdPackScaffold(rest: string[]): Promise<void> {
  if (isHelpRequested(rest)) {
    printPackAuthoringContract();
    return;
  }

  const plan = createOntologyPackScaffoldPlanFromCliArgs(rest);
  const writeSummary = plan.mode === "write"
    ? await writeOntologyPackScaffoldPlan(plan)
    : undefined;
  if (plan.cli.json) {
    printJson(toPackScaffoldJsonOutput(plan, writeSummary));
  } else {
    printPackScaffoldPlanSummary(plan, writeSummary);
  }
  const diagnostics = writeSummary?.diagnostics ?? plan.diagnostics;
  if (hasOntologyPackScaffoldErrors(diagnostics)) {
    process.exitCode = 1;
  }
}

export async function cmdPackValidate(rest: string[]): Promise<void> {
  if (isHelpRequested(rest)) {
    printPackAuthoringContract();
    return;
  }

  const { positional, flags } = parseFlags(rest);
  const packRef = positional[0];
  if (!packRef) {
    console.error(PACK_VALIDATE_USAGE);
    process.exitCode = 1;
    return;
  }

  const result = await validateOntologyPackFromRef({ packRef });
  if (flags["json"] === "true") {
    printJson(result);
  } else {
    printPackValidateSummary(result);
  }
  if (!result.valid) {
    process.exitCode = 1;
  }
}

function isHelpRequested(rest: readonly string[]): boolean {
  return rest.includes("--help") || rest.includes("-h");
}

function printPackAuthoringContract(): void {
  console.log(
    [
      PACK_SCAFFOLD_USAGE,
      PACK_VALIDATE_USAGE,
      "",
      "Pack authoring contract:",
      "- OperationalOntologyPack is the canonical pack contract.",
      "- Scaffold is dry-run by default; file writes require explicit --write.",
      "- Write mode creates parent directories and refuses to overwrite existing files.",
      "- Scaffold preserves architecture-neutral identity/data/system separation; ECS can be modeled but is not required.",
      "- Required definition docs are spec/todo/plan; optional rule/cases/test docs require --include-docs.",
      "- Source-map candidates report generated implementation/test paths with def find-by-file guidance; no source comments are added by default.",
      "- Known-pack registration is reported as a candidate and is not applied automatically.",
      "- Validate resolves known pack ids through the known-pack resolver.",
      "- Validate file refs support .json pack objects or built .js/.mjs/.cjs modules exporting default or named pack.",
      "- Registry activation is out of scope for scaffold; use qa-sdk ontology registry activate-pack separately.",
    ].join("\n"),
  );
}

function printPackScaffoldPlanSummary(
  plan: OntologyPackScaffoldPlan,
  writeSummary?: OntologyPackScaffoldWriteSummary,
): void {
  const diagnostics = writeSummary?.diagnostics ?? plan.diagnostics;
  if (diagnostics.length > 0) {
    console.error(`diagnostics: ${diagnostics.length}`);
    for (const diagnostic of diagnostics) {
      const path = diagnostic.path ? ` ${diagnostic.path}` : "";
      console.error(`  - ${diagnostic.severity} ${diagnostic.code}:${path} ${diagnostic.message}`);
    }
  }

  console.log(`pack: ${plan.identity.packId || "(missing)"}`);
  console.log(`mode: ${plan.mode}`);
  console.log(`implementation package: ${plan.identity.package.implementationPackage}`);
  console.log(`package root: ${plan.identity.package.packageRoot}`);
  console.log(`component schema files: ${plan.componentSchemaFiles.length}`);
  for (const file of plan.componentSchemaFiles) {
    console.log(`  - ${file.path}`);
  }
  console.log(`system binding files: ${plan.systemBindingFiles.length}`);
  for (const file of plan.systemBindingFiles) {
    console.log(`  - ${file.path}`);
  }
  console.log(`test files: ${plan.testFiles.length}`);
  for (const file of plan.testFiles) {
    console.log(`  - ${file.path}`);
  }
  console.log(`docs family: ${plan.docs.familyId}`);
  console.log(`definition doc files: ${plan.definitionDocFiles.length}`);
  for (const file of plan.definitionDocFiles) {
    const required = file.required ? "required" : "optional";
    console.log(`  - ${file.path} (${required})`);
  }
  console.log(`source-map candidates: ${plan.sourceMapCandidates.length}`);
  for (const candidate of plan.sourceMapCandidates) {
    console.log(
      `  - ${candidate.sourcePath} -> ${candidate.docPath} (${candidate.sourceRole}; ${candidate.sourceFileKind}; ${candidate.candidateKind}; ${candidate.applyMode})`,
    );
  }
  console.log(`source-map frontmatter candidates: ${plan.sourceMapFrontmatterCandidates.length}`);
  for (const candidate of plan.sourceMapFrontmatterCandidates) {
    console.log(
      `  - ${candidate.docPath} (${candidate.targetKind}; ${candidate.candidateKind}; ${candidate.applyMode})`,
    );
  }
  console.log("def find-by-file guidance:");
  console.log(`  ${plan.sourceMapGuidance.summary}`);
  for (const command of plan.sourceMapGuidance.findByFileCommands) {
    console.log(`  - ${command}`);
  }
  console.log("docs graph guidance:");
  for (const command of plan.sourceMapGuidance.docsGraphCommands) {
    console.log(`  - ${command}`);
  }
  console.log(
    `known-pack candidate: ${plan.knownPackCandidate.targetPath} (manual; candidate only; not written)`,
  );
  console.log(
    `  - import { ${plan.knownPackCandidate.exportSymbolName} } from "${plan.knownPackCandidate.importPath}";`,
  );
  console.log(`  - registry entry: ${plan.knownPackCandidate.registryEntry}`);
  if (writeSummary) {
    console.log(`write status: ${writeSummary.status}`);
    console.log(`files written: ${writeSummary.writtenCount}`);
    if (writeSummary.blockedFiles.length > 0) {
      console.log("blocked existing files:");
      for (const file of writeSummary.blockedFiles) {
        console.log(`  - ${file.path}`);
      }
    }
  } else {
    console.log("files written: 0");
  }
}

function toPackScaffoldJsonOutput(
  plan: OntologyPackScaffoldPlan,
  writeSummary?: OntologyPackScaffoldWriteSummary,
): unknown {
  if (!writeSummary) return plan;
  return {
    ...plan,
    preview: {
      ...plan.preview,
      writesApplied: writeSummary.writesApplied,
    },
    writeSummary,
    diagnostics: writeSummary.diagnostics.length > 0
      ? writeSummary.diagnostics
      : plan.diagnostics,
  };
}

function printPackValidateSummary(result: OntologyPackValidateResult): void {
  console.log(`pack: ${result.packId ?? "(unresolved)"}`);
  console.log(`valid: ${result.valid ? "yes" : "no"}`);
  console.log(`resolution: ${result.resolution.kind}`);
  if (result.resolution.filePath) {
    console.log(`file: ${result.resolution.filePath}`);
  }
  if (result.resolution.knownPackId) {
    console.log(`known-pack id: ${result.resolution.knownPackId}`);
  }
  console.log(`runtime issues: ${result.runtime.issueCount}`);
  console.log(
    `component schema: ${result.componentSchema.counts.axes} axes, ` +
      `${result.componentSchema.counts.taxonomies} taxonomies, ` +
      `${result.componentSchema.counts.relationCategories} relation categories, ` +
      `${result.componentSchema.counts.traversals} traversals`,
  );
  console.log(
    `system bindings: ${result.systemBindings.counts.blueprints} blueprints, ` +
      `${result.systemBindings.counts.implementationRefs} implementation refs, ` +
      `${result.systemBindings.counts.verificationRefs} verification refs`,
  );
  console.log(
    `implementation files: ${result.readiness.implementationFiles.status} ` +
      `(${result.readiness.implementationFiles.checked.length} checked, ` +
      `${result.readiness.implementationFiles.missing.length} missing)`,
  );
  console.log(
    `test files: ${result.readiness.testFiles.status} ` +
      `(${result.readiness.testFiles.checked.length} checked, ` +
      `${result.readiness.testFiles.missing.length} missing)`,
  );
  console.log(
    `docs/source-map: ${result.readiness.docs.status}; ` +
      `${result.readiness.docs.matchingDocs.length} docs, ` +
      `${result.readiness.sourceMap.coveredRefs.length}/${result.readiness.sourceMap.checkedRefs.length} refs covered`,
  );

  if (result.issues.length === 0) return;
  console.log("issues:");
  for (const issue of result.issues) {
    console.log(
      `  - ${issue.level} ${issue.source} ${issue.code} ${issue.path}: ${issue.message}`,
    );
  }
}
