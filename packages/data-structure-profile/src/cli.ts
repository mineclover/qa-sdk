#!/usr/bin/env node

import { runDataStructureProfileCli } from "./cli-runner.js";

void runDataStructureProfileCli(process.argv.slice(2))
  .then((exitCode) => {
    process.exitCode = exitCode;
  })
  .catch((error: unknown) => {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  });
