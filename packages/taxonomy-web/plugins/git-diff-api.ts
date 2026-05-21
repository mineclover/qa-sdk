import type { Plugin } from "vite";
import { execSync } from "node:child_process";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { parse, diff, migrationPlan } from "taxonomy-engine";
import type { DiffResult, MigrationPlan } from "taxonomy-engine";

export type GitDiffResponse = {
  diff: DiffResult;
  migration: MigrationPlan;
};

export function computeFileDiff(opts: {
  repoRoot: string;
  file: string;
  base: string;
}): GitDiffResponse | undefined {
  const absPath = join(opts.repoRoot, opts.file);
  if (!existsSync(absPath)) return undefined;

  let baseText: string | undefined;
  try {
    baseText = execSync(`git show ${opts.base}:${opts.file}`, {
      cwd: opts.repoRoot,
      encoding: "utf8",
      stdio: ["pipe", "pipe", "pipe"],
    });
  } catch {
    return undefined;
  }
  const currentText = readFileSync(absPath, "utf8");

  const baseIR = parse(baseText);
  const currentIR = parse(currentText);
  if ("error" in baseIR || "error" in currentIR) return undefined;

  return {
    diff: diff(baseIR.ir, currentIR.ir),
    migration: migrationPlan(baseIR.ir, currentIR.ir),
  };
}

export function gitDiffApiPlugin(repoRoot: string): Plugin {
  return {
    name: "taxonomy-web:git-diff-api",
    configureServer(server) {
      server.middlewares.use("/api/git-diff", (req, res, next) => {
        if (req.method !== "GET") {
          next();
          return;
        }
        const url = new URL(req.url ?? "/", "http://localhost");
        const file = url.searchParams.get("file");
        const base = url.searchParams.get("base") ?? "main";
        if (!file) {
          res.statusCode = 400;
          res.end("file query required");
          return;
        }
        const result = computeFileDiff({ repoRoot, file, base });
        res.setHeader("Content-Type", "application/json");
        res.end(JSON.stringify(result ?? null));
      });
    },
  };
}
