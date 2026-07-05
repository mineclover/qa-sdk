import { execFileSync } from "node:child_process";

/**
 * Compatibility shim for the old unused-package scan.
 *
 * Keep package usage heuristics in analyze-package-usage.ts so zero fan-in,
 * dead weight, and entrypoint dispositions do not drift across scripts.
 */

const output = execFileSync("npx", ["tsx", "scripts/analyze-package-usage.ts", ...process.argv.slice(2)], {
  encoding: "utf8",
  stdio: ["ignore", "pipe", "inherit"],
});

process.stdout.write(output);
