#!/usr/bin/env node
// @def.boundary sim-enterprise-pm
// @def.doc domain-slice-architecture
//
// Slice 의 OpenAPI fragment 를 contracts/openapi/src/domains/<slice>/spec.yaml 로
// promote 한다. simulations 환경 전용 (architecture-schematics 의 promote-openapi
// 는 json 만 지원).

import { existsSync, copyFileSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, isAbsolute, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const REPO_ROOT = resolve(__dirname, "..");
const DOMAINS_ROOT = resolve(REPO_ROOT, "contracts/openapi/src/domains");

function printUsage() {
  process.stdout.write(
    [
      "promote-openapi — promote a slice OpenAPI fragment into contracts/openapi/src/domains/<slice>/spec.yaml",
      "",
      "Usage:",
      "  node scripts/promote-openapi.mjs --fragment <path> --slice <name> [--force] [--dry-run]",
      "  node scripts/promote-openapi.mjs --help",
      "",
      "Options:",
      "  --fragment <path>   Path to the source fragment (.yaml/.yml). Required.",
      "  --slice <name>      Slice name; output goes to contracts/openapi/src/domains/<slice>/spec.yaml. Required.",
      "  --force             Overwrite an existing spec.yaml. Default: refuse.",
      "  --dry-run           Print intended action without writing.",
      "  --help              Show this help.",
      "",
    ].join("\n"),
  );
}

function parseArgs(argv) {
  const args = { fragment: null, slice: null, force: false, dryRun: false, help: false };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    switch (arg) {
      case "--help":
      case "-h":
        args.help = true;
        break;
      case "--force":
        args.force = true;
        break;
      case "--dry-run":
        args.dryRun = true;
        break;
      case "--fragment":
        args.fragment = argv[++i];
        break;
      case "--slice":
        args.slice = argv[++i];
        break;
      default:
        if (arg.startsWith("--fragment=")) args.fragment = arg.slice("--fragment=".length);
        else if (arg.startsWith("--slice=")) args.slice = arg.slice("--slice=".length);
        else throw new Error(`unknown argument: ${arg}`);
    }
  }
  return args;
}

function isValidSliceName(name) {
  return /^[a-z][a-z0-9-]*$/.test(name);
}

async function loadYamlIfAvailable() {
  try {
    const mod = await import("yaml");
    return mod;
  } catch {
    return null;
  }
}

async function main() {
  let args;
  try {
    args = parseArgs(process.argv.slice(2));
  } catch (err) {
    process.stderr.write(`${err instanceof Error ? err.message : String(err)}\n\n`);
    printUsage();
    process.exit(2);
  }

  if (args.help) {
    printUsage();
    process.exit(0);
  }

  if (!args.fragment || !args.slice) {
    process.stderr.write("error: --fragment and --slice are both required\n\n");
    printUsage();
    process.exit(2);
  }

  if (!isValidSliceName(args.slice)) {
    process.stderr.write(
      `error: invalid slice name "${args.slice}" (kebab-case, [a-z0-9-], must start with letter)\n`,
    );
    process.exit(2);
  }

  const fragmentPath = isAbsolute(args.fragment) ? args.fragment : resolve(process.cwd(), args.fragment);
  if (!existsSync(fragmentPath)) {
    process.stderr.write(`error: fragment not found: ${fragmentPath}\n`);
    process.exit(2);
  }

  const targetDir = join(DOMAINS_ROOT, args.slice);
  const targetPath = join(targetDir, "spec.yaml");
  const targetExists = existsSync(targetPath);

  if (targetExists && !args.force && !args.dryRun) {
    process.stderr.write(
      `error: target already exists: ${targetPath}\n` +
        "       pass --force to overwrite\n",
    );
    process.exit(1);
  }

  // optional structural sanity check via yaml parser (don't fail if unavailable)
  const yaml = await loadYamlIfAvailable();
  if (yaml) {
    try {
      const parsed = yaml.parse(readFileSync(fragmentPath, "utf-8"));
      if (parsed === null || typeof parsed !== "object") {
        process.stderr.write(`error: fragment does not parse as a YAML object\n`);
        process.exit(1);
      }
    } catch (err) {
      process.stderr.write(
        `error: fragment is not valid YAML: ${err instanceof Error ? err.message : String(err)}\n`,
      );
      process.exit(1);
    }
  }

  if (args.dryRun) {
    if (targetExists && !args.force) {
      process.stdout.write(
        `[dry-run] would refuse: target already exists: ${targetPath} (pass --force to overwrite)\n`,
      );
      process.exit(0);
    }
    process.stdout.write(
      `[dry-run] would promote ${fragmentPath} → ${targetPath}` +
        (args.force ? " (force)" : "") +
        "\n",
    );
    process.exit(0);
  }

  mkdirSync(targetDir, { recursive: true });

  // Prefer pass-through copy to preserve original formatting/comments.
  if (yaml) {
    // Re-parse + re-serialize would lose formatting. Use copy-based promotion.
    copyFileSync(fragmentPath, targetPath);
  } else {
    // Fallback: structural copy without re-serialise (keeps script useful without deps).
    const buf = readFileSync(fragmentPath);
    writeFileSync(targetPath, buf);
  }

  process.stdout.write(`promoted: ${targetPath}\n`);
}

main().catch((err) => {
  process.stderr.write(
    `error: ${err instanceof Error ? err.stack ?? err.message : String(err)}\n`,
  );
  process.exit(1);
});
