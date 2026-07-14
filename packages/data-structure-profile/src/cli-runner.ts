import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { toBenchReportInput, toQualityLedgerRunInputs } from './adapters.js';
import { assessDpmReadiness } from './dpm.js';
import { compileLineage } from './lineage.js';
import { measureProfile } from './measurement.js';
import { parseProfile } from './parse.js';
import { parseProfileTaxonomy } from './taxonomy.js';
import { validateProfile } from './validate.js';
import type { DataStructureProfile, TaxonomyVocabulary, ValidationReport } from './types.js';

export type DataStructureProfileCliIo = {
  cwd?: string;
  readText?: (path: string) => string;
  writeStdout?: (text: string) => void;
  writeStderr?: (text: string) => void;
};

type ParsedArgs = {
  command?: string;
  profilePath?: string;
  taxonomyPath?: string;
  adapter?: string;
  failOnWarning: boolean;
  help: boolean;
};

const HELP = `
data-structure-profile — fixture runner for Data Structure Profile artifacts

Usage:
  data-structure-profile validate <profile.yaml> [--taxonomy <taxonomy.yaml>] [--adapter quality-ledger] [--fail-on-warning]
  data-structure-profile compile <profile.yaml>
  data-structure-profile measure <profile.yaml> [--adapter bench]
  data-structure-profile dpm-readiness <profile.yaml>

Outputs:
  JSON is written to stdout. Errors and usage are written to stderr.
`.trim();

export async function runDataStructureProfileCli(
  argv: readonly string[],
  io: DataStructureProfileCliIo = {},
): Promise<number> {
  const parsed = parseCliArgs(argv);
  const writeStdout = io.writeStdout ?? ((text) => process.stdout.write(text));
  const writeStderr = io.writeStderr ?? ((text) => process.stderr.write(text));

  try {
    if (parsed.help) {
      writeStdout(`${HELP}\n`);
      return 0;
    }

    if (!isKnownCommand(parsed.command) || !parsed.profilePath) {
      writeStderr(`${HELP}\n`);
      return 1;
    }

    const profile = readProfile(parsed.profilePath, io);
    const taxonomy = parsed.taxonomyPath ? readTaxonomy(parsed.taxonomyPath, io) : undefined;

    switch (parsed.command) {
      case 'validate':
        return runValidate(profile, taxonomy, parsed, writeStdout);
      case 'compile':
        writeJson(writeStdout, compileLineage(profile));
        return 0;
      case 'measure':
        writeJson(
          writeStdout,
          parsed.adapter === 'bench'
            ? toBenchReportInput(measureProfile(profile))
            : measureProfile(profile),
        );
        return 0;
      case 'dpm-readiness': {
        const report = assessDpmReadiness(profile);
        writeJson(writeStdout, report);
        return report.diagnostics.some((diagnostic) => diagnostic.severity === 'error') ? 1 : 0;
      }
    }
    writeStderr(`${HELP}\n`);
    return 1;
  } catch (error) {
    writeStderr(`${error instanceof Error ? error.message : String(error)}\n`);
    return 1;
  }
}

function runValidate(
  profile: DataStructureProfile,
  taxonomy: TaxonomyVocabulary | undefined,
  parsed: ParsedArgs,
  writeStdout: (text: string) => void,
): number {
  const report = validateProfile(profile, { taxonomy });
  writeJson(
    writeStdout,
    parsed.adapter === 'quality-ledger'
      ? toQualityLedgerRunInputs(report, {
          docVersion: profile.version,
          command: commandForReport(report),
        })
      : report,
  );

  if (report.status === 'fail') return 1;
  if (parsed.failOnWarning && report.status !== 'pass') return 1;
  return 0;
}

function parseCliArgs(argv: readonly string[]): ParsedArgs {
  const parsed: ParsedArgs = {
    command: argv[0],
    profilePath: argv[1],
    failOnWarning: false,
    help: argv.includes('--help') || argv.includes('-h'),
  };

  for (let index = 2; index < argv.length; index += 1) {
    const token = argv[index];
    switch (token) {
      case '--taxonomy':
        parsed.taxonomyPath = readOptionValue(argv, index, token);
        index += 1;
        break;
      case '--adapter':
        parsed.adapter = readOptionValue(argv, index, token);
        index += 1;
        break;
      case '--fail-on-warning':
        parsed.failOnWarning = true;
        break;
      default:
        throw new Error(`Unknown option: ${token}`);
    }
  }

  return parsed;
}

function readOptionValue(argv: readonly string[], index: number, option: string): string {
  const value = argv[index + 1];
  if (!value || value.startsWith('--')) {
    throw new Error(`${option} requires a value.`);
  }
  return value;
}

function isKnownCommand(
  command: string | undefined,
): command is NonNullable<ParsedArgs['command']> {
  return (
    command === 'validate' ||
    command === 'compile' ||
    command === 'measure' ||
    command === 'dpm-readiness'
  );
}

function readProfile(path: string, io: DataStructureProfileCliIo): DataStructureProfile {
  return parseProfile(readPath(path, io));
}

function readTaxonomy(path: string, io: DataStructureProfileCliIo): TaxonomyVocabulary {
  return parseProfileTaxonomy(readPath(path, io));
}

function readPath(path: string, io: DataStructureProfileCliIo): string {
  const cwd = io.cwd ?? process.cwd();
  const absolutePath = resolve(cwd, path);
  const readText = io.readText ?? ((targetPath: string) => readFileSync(targetPath, 'utf8'));
  return readText(absolutePath);
}

function writeJson(writeStdout: (text: string) => void, value: unknown): void {
  writeStdout(`${JSON.stringify(value, null, 2)}\n`);
}

function commandForReport(report: ValidationReport): string {
  return `data-structure-profile validate ${report.profile}`;
}
