import type { Plugin } from "vite";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  parseDecisionFile,
  resolveDecisionLink,
  type DecisionFile,
} from "taxonomy-decision-bridge";

const DECISIONS_DIR = "docs/decisions";

export type DecisionResponse =
  | { kind: "found"; file: DecisionFile }
  | { kind: "missing"; resolvedPath: string }
  | { kind: "external"; reason: string };

export function loadDecision(opts: {
  repoRoot: string;
  yamlFile: string; // 좌표 yaml의 repo-relative path (decisionLink 해소 기준 디렉토리)
  decisionLink: string;
}): DecisionResponse {
  const resolved = resolveDecisionLink({
    link: opts.decisionLink,
    yamlAbsDir: resolve(opts.repoRoot, opts.yamlFile, ".."),
    decisionsDir: resolve(opts.repoRoot, DECISIONS_DIR),
  });
  if (resolved.kind === "external" || resolved.kind === "unsupported") {
    return { kind: "external", reason: resolved.reason };
  }
  const resolvedPath = resolved.absPath;
  if (!existsSync(resolvedPath)) {
    return { kind: "missing", resolvedPath };
  }
  try {
    const file = parseDecisionFile(readFileSync(resolvedPath, "utf8"));
    return { kind: "found", file };
  } catch (e) {
    return { kind: "missing", resolvedPath: `parse 실패: ${(e as Error).message}` };
  }
}

export function decisionApiPlugin(repoRoot: string): Plugin {
  return {
    name: "taxonomy-web:decision-api",
    configureServer(server) {
      server.middlewares.use("/api/decision", (req, res, next) => {
        if (req.method !== "GET") {
          next();
          return;
        }
        const url = new URL(req.url ?? "/", "http://localhost");
        const yamlFile = url.searchParams.get("yamlFile");
        const decisionLink = url.searchParams.get("decisionLink");
        if (!yamlFile || !decisionLink) {
          res.statusCode = 400;
          res.end("yamlFile + decisionLink 쿼리 파라미터 필수");
          return;
        }
        const result = loadDecision({ repoRoot, yamlFile, decisionLink });
        res.setHeader("Content-Type", "application/json");
        res.end(JSON.stringify(result));
      });
    },
  };
}
