#!/usr/bin/env node

import { spawn } from "node:child_process";

const forwardedArgs = process.argv.slice(2);
const filters = forwardedArgs[0] === "--" ? forwardedArgs.slice(1) : forwardedArgs;
const args = ["vitest", "run", "--no-file-parallelism", ...filters];

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
