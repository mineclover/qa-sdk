import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";

import type { OntologyAddressModel } from "operational-ontology/allocation";

import { buildActivationEvidenceRegistryRecord } from "../../lib/activation-evidence-registry.js";
import { resolveKnownOntologyPack } from "../../lib/known-ontology-packs.js";
import { appendProgrammingArtifactRegistryRecord } from "../../lib/programming-artifact-registry.js";
import { getQaSdkDir } from "../../lib/qa-dir.js";

const DEFAULT_REGISTRY_ACTIVATION_STORE_FILE = join(
  getQaSdkDir(),
  "ontology-registry.sqlite",
);
const REGISTRY_ACTIVATE_PACK_USAGE =
  "Usage: qa-sdk ontology registry activate-pack <pack-id> [--store <path>] [--ontology-id <id>] [--namespace <namespace>] [--owner <owner>] [--version <versionId>] [--address-model product|sum] [--prefix <taxonomyId>=<prefix>] [--output <file>] [--artifact-registry <file>] [--json]";
const REGISTRY_ACTIVATE_PACK_VALUE_FLAGS = new Set([
  "store",
  "ontology-id",
  "namespace",
  "owner",
  "version",
  "address-model",
  "prefix",
  "output",
  "artifact-registry",
]);
const REGISTRY_ACTIVATE_PACK_BOOLEAN_FLAGS = new Set(["json"]);
const REGISTRY_ACTIVATE_PACK_ALLOWED_FLAGS = new Set([
  ...REGISTRY_ACTIVATE_PACK_VALUE_FLAGS,
  ...REGISTRY_ACTIVATE_PACK_BOOLEAN_FLAGS,
]);
const REGISTRY_ACTIVATE_PACK_SUPPORTED_FLAGS = Object.freeze(
  [...REGISTRY_ACTIVATE_PACK_ALLOWED_FLAGS].map((flag) => `--${flag}`).sort(),
);
const EMPTY_ACTIVATION_SMOKE_CHECK_SUMMARY = Object.freeze({
  allocationCount: 0,
  passedAllocationCount: 0,
  failedAllocationCount: 0,
  checkCount: 0,
  passedCheckCount: 0,
  failedCheckCount: 0,
  byAllocationId: {},
});

interface ActivationCliError {
  readonly code: string;
  readonly message: string;
  readonly packId?: string;
  readonly supportedPackIds?: readonly string[];
  readonly details?: unknown;
}

interface ParsedRegistryActivatePackArgs {
  readonly positional: readonly string[];
  readonly flags: Record<string, string>;
  readonly prefixByTaxonomyId: Record<string, string>;
  readonly errors: readonly ActivationCliError[];
}

interface ActivationResultSummary {
  readonly status: string;
  readonly packId: string;
  readonly ontologyId: string;
  readonly allocationSummaries: readonly unknown[];
  readonly smokeCheckSummary: {
    readonly allocationCount: number;
    readonly passedAllocationCount: number;
    readonly failedAllocationCount: number;
    readonly checkCount: number;
    readonly passedCheckCount: number;
    readonly failedCheckCount: number;
  };
  readonly warnings: readonly { readonly code?: string; readonly message: string }[];
  readonly errors: readonly { readonly code?: string; readonly message: string }[];
}

interface ActivationEvidenceAppendSuccess {
  readonly appendStatus: "appended";
  readonly registryPath: string;
  readonly recordId: string;
  readonly recordRef: string;
  readonly recordCount: number;
}

interface ActivationEvidenceAppendFailure {
  readonly appendStatus: "failed";
  readonly registryPath: string;
  readonly recordId: string;
  readonly recordRef: string;
  readonly recordCount: null;
  readonly error: ActivationCliError;
}

type ActivationEvidenceAppendSummary =
  | ActivationEvidenceAppendSuccess
  | ActivationEvidenceAppendFailure;

export async function cmdRegistryActivatePack(rest: string[]): Promise<void> {
  const { positional, flags, prefixByTaxonomyId, errors } =
    parseRegistryActivatePackArgs(rest);
  const json = flags["json"] === "true";
  const packId = positional[0];

  if (!packId) {
    await printActivationCliErrors(
      [
        {
          code: "missing-pack-id",
          message: REGISTRY_ACTIVATE_PACK_USAGE,
        },
      ],
      json,
      flags["output"],
    );
    return;
  }
  if (errors.length > 0) {
    await printActivationCliErrors(
      errors,
      json,
      flags["output"],
      {
        packId,
        ontologyId: flags["ontology-id"],
      },
    );
    return;
  }
  if (flags["artifact-registry"] && !flags["output"]) {
    await printActivationCliErrors(
      [toActivationEvidenceOutputRequiredError()],
      json,
      undefined,
      {
        packId,
        ontologyId: flags["ontology-id"] ?? packId,
      },
    );
    return;
  }

  const addressModelResult = parseActivationAddressModel(flags["address-model"]);
  if (!addressModelResult.ok) {
    await printActivationCliErrors(
      [addressModelResult.error],
      json,
      flags["output"],
      {
        packId,
        ontologyId: flags["ontology-id"],
      },
    );
    return;
  }

  const packResolution = resolveKnownOntologyPack(packId);
  if (!packResolution.ok) {
    await printActivationCliErrors(
      [packResolution.error],
      json,
      flags["output"],
      {
        packId,
        ontologyId: flags["ontology-id"] ?? packId,
      },
    );
    return;
  }

  try {
    const { createLocalOntologyActivationRuntime } = await import(
      "@qa-sdk/registry-service/ontology-local-runtime"
    );
    const runtime = await createLocalOntologyActivationRuntime({
      storePath: getRegistryActivationStorePath(flags),
    });

    try {
      const result = await runtime.activationHelper.activateOntologyPack(
        packResolution.pack,
        {
          ontologyId: flags["ontology-id"],
          namespace: flags["namespace"],
          owner: flags["owner"],
          versionId: flags["version"],
          addressModel: addressModelResult.addressModel,
          prefixByTaxonomyId: hasRecordEntries(prefixByTaxonomyId)
            ? prefixByTaxonomyId
            : undefined,
        },
      );

      const outputWrite = await writeJsonPayloadFile(flags["output"], result);
      if (!outputWrite.ok) {
        await printActivationCliErrors(
          [outputWrite.error],
          json,
          undefined,
          {
            packId,
            ontologyId: flags["ontology-id"] ?? packId,
          },
        );
        return;
      }

      let activationEvidence: ActivationEvidenceAppendSummary | undefined;
      if (result.status === "succeeded" && flags["artifact-registry"]) {
        const record = buildActivationEvidenceRegistryRecord({
          activationResult: result,
          resolvedOutputPath: outputWrite.outputPath,
          commandContext: {
            packId,
            knownPackImportRef: knownOntologyPackImportRef(packResolution.packId),
          },
        });

        try {
          const appendResult = await appendProgrammingArtifactRegistryRecord(
            flags["artifact-registry"],
            record,
          );
          activationEvidence = {
            appendStatus: "appended",
            registryPath: appendResult.registryPath,
            recordId: appendResult.record.artifactId,
            recordRef: appendResult.record.artifactRef,
            recordCount: appendResult.recordCount,
          };
        } catch {
          activationEvidence = {
            appendStatus: "failed",
            registryPath: resolve(flags["artifact-registry"]),
            recordId: record.artifactId,
            recordRef: record.artifactRef,
            recordCount: null,
            error: toActivationEvidenceRegistryAppendError(),
          };
        }
      }

      const printableResult = activationEvidence
        ? withActivationEvidence(result, activationEvidence)
        : result;

      if (json) {
        printJson(printableResult);
      } else {
        printActivationSummary(
          result,
          runtime.storePath,
          outputWrite.outputPath,
          activationEvidence,
        );
      }

      if (
        result.status !== "succeeded" ||
        activationEvidence?.appendStatus === "failed"
      ) {
        process.exitCode = 1;
      }
    } finally {
      runtime.close();
    }
  } catch {
    await printActivationCliErrors(
      [toActivationRuntimeError()],
      json,
      flags["output"],
      {
        packId,
        ontologyId: flags["ontology-id"] ?? packId,
      },
    );
  }
}

function getRegistryActivationStorePath(flags: Record<string, string>): string {
  return flags["store"] ?? DEFAULT_REGISTRY_ACTIVATION_STORE_FILE;
}

function parseRegistryActivatePackArgs(args: string[]): ParsedRegistryActivatePackArgs {
  const positional: string[] = [];
  const flags: Record<string, string> = {};
  const prefixByTaxonomyId: Record<string, string> = {};
  const errors: ActivationCliError[] = [];

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index]!;
    if (!arg.startsWith("--")) {
      positional.push(arg);
      continue;
    }

    const { key, inlineValue } = splitCliFlag(arg);
    const next = args[index + 1];

    if (!REGISTRY_ACTIVATE_PACK_ALLOWED_FLAGS.has(key)) {
      if (inlineValue === undefined && next && !next.startsWith("--")) {
        index += 1;
      }
      errors.push({
        code: "invalid-cli-flag",
        message: `Invalid flag "--${key}" for ontology registry activate-pack.`,
        details: {
          flag: `--${key}`,
          supportedFlags: REGISTRY_ACTIVATE_PACK_SUPPORTED_FLAGS,
        },
      });
      continue;
    }

    let value: string | undefined;
    if (REGISTRY_ACTIVATE_PACK_BOOLEAN_FLAGS.has(key)) {
      value = inlineValue ?? "true";
    } else if (inlineValue !== undefined) {
      value = inlineValue;
    } else if (next && !next.startsWith("--")) {
      value = next;
      index += 1;
    } else {
      errors.push({
        code: "missing-flag-value",
        message: `Missing value for --${key}.`,
        details: { flag: `--${key}` },
      });
      continue;
    }

    if (key === "prefix") {
      const parsed = parsePrefixOverrideFlag(value);
      if (parsed.ok) {
        prefixByTaxonomyId[parsed.taxonomyId] = parsed.prefix;
      } else {
        errors.push(parsed.error);
      }
      continue;
    }

    flags[key] = value;
  }

  return { positional, flags, prefixByTaxonomyId, errors };
}

function splitCliFlag(arg: string): { key: string; inlineValue?: string } {
  const raw = arg.slice(2);
  const separatorIndex = raw.indexOf("=");
  if (separatorIndex < 0) {
    return { key: raw };
  }
  return {
    key: raw.slice(0, separatorIndex),
    inlineValue: raw.slice(separatorIndex + 1),
  };
}

function parsePrefixOverrideFlag(
  value: string,
):
  | { ok: true; taxonomyId: string; prefix: string }
  | { ok: false; error: ActivationCliError } {
  const separatorIndex = value.indexOf("=");
  const taxonomyId = separatorIndex >= 0 ? value.slice(0, separatorIndex).trim() : "";
  const prefix = separatorIndex >= 0 ? value.slice(separatorIndex + 1).trim() : "";

  if (!taxonomyId || !prefix) {
    return {
      ok: false,
      error: {
        code: "invalid-prefix-override",
        message: `Invalid --prefix value "${value}". Expected <taxonomyId>=<prefix>.`,
        details: { value },
      },
    };
  }

  return { ok: true, taxonomyId, prefix };
}

function parseActivationAddressModel(
  value: string | undefined,
):
  | { ok: true; addressModel?: OntologyAddressModel }
  | { ok: false; error: ActivationCliError } {
  if (!value) {
    return { ok: true };
  }
  if (value === "product" || value === "sum") {
    return { ok: true, addressModel: value };
  }
  return {
    ok: false,
    error: {
      code: "invalid-address-model",
      message: `Invalid --address-model value "${value}". Expected product or sum.`,
      details: { value, supportedValues: ["product", "sum"] },
    },
  };
}

function hasRecordEntries(record: Record<string, string>): boolean {
  return Object.keys(record).length > 0;
}

function buildActivationCliFailureResult(
  errors: readonly ActivationCliError[],
  context: {
    readonly packId?: string;
    readonly ontologyId?: string;
  } = {},
) {
  return {
    status: "failed",
    packId: context.packId ?? null,
    ontologyId: context.ontologyId ?? context.packId ?? null,
    namespaceSummary: null,
    allocationSummaries: [],
    syncSummariesByAllocationId: {},
    smokeCheckSummary: EMPTY_ACTIVATION_SMOKE_CHECK_SUMMARY,
    warnings: [],
    errors: errors.map((error) => ({
      level: "error",
      phase: "cli",
      ...error,
    })),
  };
}

function toActivationRuntimeError(): ActivationCliError {
  return {
    code: "activation-runtime-error",
    message:
      "Ontology activation failed before a structured helper result was produced.",
  };
}

function toActivationOutputWriteError(outputPath: string): ActivationCliError {
  return {
    code: "activation-output-write-error",
    message: `Activation output could not be written to ${outputPath}.`,
    details: { outputPath: resolve(outputPath) },
  };
}

function toActivationEvidenceOutputRequiredError(): ActivationCliError {
  return {
    code: "activation-evidence-output-required",
    message:
      "Activation evidence registry append requires --output <file> so the registry record can reference a materialized sidecar.",
    details: {
      requiredFlag: "--output",
      dependentFlag: "--artifact-registry",
    },
  };
}

function toActivationEvidenceRegistryAppendError(): ActivationCliError {
  return {
    code: "activation-evidence-registry-append-error",
    message:
      "Activation evidence could not be appended to the artifact registry.",
  };
}

async function writeJsonPayloadFile(
  outputPath: string | undefined,
  payload: unknown,
): Promise<
  | { ok: true; outputPath?: string }
  | { ok: false; error: ActivationCliError }
> {
  if (!outputPath) {
    return { ok: true };
  }

  try {
    const resolvedOutputPath = resolve(outputPath);
    await mkdir(dirname(resolvedOutputPath), { recursive: true });
    await writeFile(resolvedOutputPath, `${toPrettyJson(payload)}\n`, "utf8");
    return { ok: true, outputPath: resolvedOutputPath };
  } catch {
    return { ok: false, error: toActivationOutputWriteError(outputPath) };
  }
}

async function printActivationCliErrors(
  errors: readonly ActivationCliError[],
  json: boolean,
  outputPath?: string,
  context?: {
    readonly packId?: string;
    readonly ontologyId?: string;
  },
): Promise<void> {
  const result = buildActivationCliFailureResult(errors, context);
  const outputWrite = await writeJsonPayloadFile(outputPath, result);
  if (json) {
    printJson(
      outputWrite.ok
        ? result
        : buildActivationCliFailureResult([...errors, outputWrite.error], context),
    );
  } else {
    for (const error of errors) {
      console.error(`${error.code}: ${error.message}`);
    }
    if (!outputWrite.ok) {
      console.error(`${outputWrite.error.code}: ${outputWrite.error.message}`);
    }
  }
  process.exitCode = 1;
}

function printActivationSummary(
  result: ActivationResultSummary,
  storePath: string,
  outputPath?: string,
  activationEvidence?: ActivationEvidenceAppendSummary,
): void {
  console.log(`Ontology pack activation: ${result.packId}`);
  console.log(`  status: ${result.status}`);
  console.log(`  ontologyId: ${result.ontologyId}`);
  console.log(`  store: ${storePath}`);
  if (outputPath) {
    console.log(`  output: ${outputPath}`);
  }
  if (activationEvidence) {
    console.log(`  activation evidence registry: ${activationEvidence.registryPath}`);
    console.log(`  activation evidence record: ${activationEvidence.recordId}`);
    if (activationEvidence.appendStatus === "appended") {
      console.log(`  activation evidence records: ${activationEvidence.recordCount}`);
    } else {
      console.log(`  activation evidence append: failed`);
      console.log(
        `  activation evidence error: ${activationEvidence.error.code}: ${activationEvidence.error.message}`,
      );
    }
  }
  console.log(`  allocations: ${result.allocationSummaries.length}`);
  console.log(
    `  smoke: ${result.smokeCheckSummary.passedCheckCount}/${result.smokeCheckSummary.checkCount} checks passed (${result.smokeCheckSummary.passedAllocationCount}/${result.smokeCheckSummary.allocationCount} allocations)`,
  );
  if (result.warnings.length > 0) {
    console.log(`  warnings: ${result.warnings.length}`);
    for (const warning of result.warnings) {
      console.log(`    - ${warning.code ? `${warning.code}: ` : ""}${warning.message}`);
    }
  }
  if (result.errors.length > 0) {
    console.log(`  errors: ${result.errors.length}`);
    for (const error of result.errors) {
      console.log(`    - ${error.code ? `${error.code}: ` : ""}${error.message}`);
    }
  }
  console.log("  action hints:");
  if (result.status === "succeeded") {
    console.log("    - Use --json when another tool needs the activation payload.");
    console.log(`    - Reuse --store ${storePath} for follow-up registry checks.`);
  } else {
    console.log("    - Re-run with --json to inspect structured errors.");
    console.log("    - Fix the listed activation errors before using this pack downstream.");
  }
}

function withActivationEvidence<T extends object>(
  result: T,
  activationEvidence: ActivationEvidenceAppendSummary,
): T & { activationEvidence: ActivationEvidenceAppendSummary } {
  return {
    ...result,
    activationEvidence,
  };
}

function knownOntologyPackImportRef(packId: string): string | undefined {
  if (packId === "programming-artifact-ontology") {
    return "operational-ontology/programming-artifacts";
  }
  if (packId === "authorization-ontology") {
    return "authorization-ontology";
  }
  return undefined;
}

function printJson(data: unknown): void {
  console.log(toPrettyJson(data));
}

function toPrettyJson(data: unknown): string {
  return JSON.stringify(data, null, 2);
}
