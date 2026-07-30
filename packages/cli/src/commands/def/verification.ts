// @def.boundary docs-control-plane
// @def.doc docs-control-plane

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { VerificationDefinitionBinding, VerificationSummary } from 'spec-tracker';
import type { DefDataSource } from 'definition-catalog';
import type { DataSourceOptions } from 'definition-data-source';
import {
  writeVerificationArtifactFile,
  writeVerificationBindingsFile,
} from '../../lib/spec-definition-verification.js';
import { closeDataSource } from '../../lib/data-source-runtime.js';
import { parseCsvFlag } from './shared.js';

type SourceFactory = (options: DataSourceOptions) => Promise<DefDataSource>;

function wantsJson(flags: Record<string, string>): boolean {
  return flags.json === 'true' || flags.json === '';
}

function printDiagnostic(message: string, json: boolean): void {
  if (json) {
    console.error(message);
  } else {
    console.log(message);
  }
}

/** Capture the definition snapshot used by the verification runner. */
export async function cmdVerificationBindings(
  root: string,
  flags: Record<string, string>,
  sourceOptions: DataSourceOptions,
  createSource: SourceFactory,
): Promise<void> {
  const specIds = parseCsvFlag(flags['spec-ids'] ?? flags['spec-id'], {
    bareFlagIsEmpty: true,
  });
  const outPath = flags.out;
  const capturedAt = flags['captured-at'] ?? flags['run-started-at'];
  if (specIds.length === 0 || !outPath || !capturedAt) {
    printDiagnostic(
      'Usage: qa-sdk def verification-bindings --spec-ids=<id1,id2> --out=<bindings.json> --captured-at=<ISO> [--json]',
      wantsJson(flags),
    );
    process.exitCode = 1;
    return;
  }

  let source: DefDataSource | undefined;
  try {
    source = await createSource(sourceOptions);
  } catch (error) {
    printDiagnostic(`[verification-bindings] ${(error as Error).message}`, wantsJson(flags));
    process.exitCode = 1;
    return;
  }

  try {
    const outputPath = resolve(root, outPath);
    const bindings = await writeVerificationBindingsFile(outputPath, source, specIds, {
      capturedAt,
    });
    const output = { out: outputPath, bindings };
    if (wantsJson(flags)) {
      console.log(JSON.stringify(output, null, 2));
    } else {
      console.log(`검증 binding 캡처: ${output.out}`);
      console.log(`bindings: ${bindings.length}`);
    }
  } catch (error) {
    printDiagnostic(`[verification-bindings] ${(error as Error).message}`, wantsJson(flags));
    process.exitCode = 1;
  } finally {
    closeDataSource(source);
  }
}

/** Package verification output and definition bindings into an immutable artifact. */
export async function cmdVerificationArtifact(
  root: string,
  flags: Record<string, string>,
): Promise<void> {
  const summaryPath = flags.summary;
  const outPath = flags.out;
  const runStartedAt = flags['run-started-at'];
  const runCompletedAt = flags['run-completed-at'];
  if (!summaryPath || !outPath || !runStartedAt || !runCompletedAt) {
    printDiagnostic(
      'Usage: qa-sdk def verification-artifact --summary=<VerificationSummary.json> --out=<artifact.json> --run-started-at=<ISO> --run-completed-at=<ISO> [--bindings=<bindings.json>] [--json]',
      wantsJson(flags),
    );
    process.exitCode = 1;
    return;
  }

  const readJson = (filePath: string): unknown =>
    JSON.parse(readFileSync(resolve(root, filePath), 'utf8')) as unknown;

  try {
    const summaryInput = readJson(summaryPath);
    if (
      typeof summaryInput !== 'object' ||
      summaryInput === null ||
      Array.isArray(summaryInput) ||
      !Array.isArray((summaryInput as { reports?: unknown }).reports)
    ) {
      throw new Error('summary must be an object with a reports array');
    }

    let bindings: Map<string, VerificationDefinitionBinding> | undefined;
    const bindingsPath = flags.bindings;
    if (bindingsPath) {
      const bindingsInput = readJson(bindingsPath);
      if (!Array.isArray(bindingsInput)) throw new Error('bindings must be an array');
      bindings = new Map();
      for (const [index, item] of bindingsInput.entries()) {
        if (typeof item !== 'object' || item === null || Array.isArray(item)) {
          throw new Error(`bindings[${index}] must be an object`);
        }
        const binding = item as VerificationDefinitionBinding;
        if (typeof binding.specId !== 'string' || binding.specId.trim().length === 0) {
          throw new Error(`bindings[${index}].specId must be non-empty`);
        }
        if (bindings.has(binding.specId)) {
          throw new Error(`duplicate binding specId: ${binding.specId}`);
        }
        bindings.set(binding.specId, binding);
      }
    }

    const outputPath = resolve(root, outPath);
    const artifact = await writeVerificationArtifactFile(outputPath, {
      runStartedAt,
      runCompletedAt,
      summary: summaryInput as VerificationSummary,
      ...(bindings ? { bindings } : {}),
    });
    if (wantsJson(flags)) {
      console.log(JSON.stringify({ out: outputPath, artifact }, null, 2));
    } else {
      console.log(`검증 아티팩트 생성: ${outputPath}`);
      console.log(`reports: ${artifact.reports.length}`);
    }
  } catch (error) {
    printDiagnostic(`[verification-artifact] ${(error as Error).message}`, wantsJson(flags));
    process.exitCode = 1;
  }
}
