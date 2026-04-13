#!/usr/bin/env node

import { spawn } from "node:child_process";

let forwardedArgs = process.argv.slice(2);
const hasExplicitSeparator = forwardedArgs[0] === "--";
if (hasExplicitSeparator) forwardedArgs = forwardedArgs.slice(1);

const knownModes = new Set(["--parallel", "--serial", "--slow"]);
const mode = hasExplicitSeparator && knownModes.has(forwardedArgs[0] ?? "")
  ? forwardedArgs.shift()
  : "--serial";
if (!hasExplicitSeparator && forwardedArgs[0] === "--parallel") forwardedArgs = forwardedArgs.slice(1);
if (forwardedArgs[0] === "--") forwardedArgs = forwardedArgs.slice(1);
const filters = forwardedArgs;

const SLOW_TEST_FILES = [
  "src/commands/git-conflicts.test.ts",
  "src/commands/def.test.ts",
  "src/commands/ontology.test.ts",
  "src/commands/dkg.e2e.test.ts",
  "src/commands/quality-smoke.e2e.test.ts",
  "src/commands/review.test.ts",
  "src/commands/git-scan.test.ts",
];

const args = [
  "vitest",
  "run",
  ...(mode !== "--parallel" ? ["--no-file-parallelism"] : []),
  ...(mode === "--slow" ? SLOW_TEST_FILES : []),
  ...filters,
];

const child = spawn("pnpm", ["exec", ...args], {
  cwd: new URL("..", import.meta.url),
  stdio: "inherit",
});

child.on("exit", (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }
  process.exit(code ?? 1);
});

child.on("error", (error) => {
  console.error(error);
  process.exit(1);
});
