import type { Plugin } from "vite";
import { existsSync, readFileSync } from "node:fs";
import { isAbsolute, resolve } from "node:path";
import { parseDecisionFile, type DecisionFile } from "taxonomy-decision-bridge";

export type DecisionResponse =
  | { kind: "found"; file: DecisionFile }
  | { kind: "missing"; resolvedPath: string }
  | { kind: "external"; reason: string };

export function loadDecision(opts: {
  repoRoot: string;
  yamlFile: string; // 좌표 yaml의 repo-relative path (decisionLink 해소 기준 디렉토리)
  decisionLink: string;
}): DecisionResponse {
  if (
    opts.decisionLink.startsWith("http://") ||
    opts.decisionLink.startsWith("https://")
  ) {
    return { kind: "external", reason: "외부 URL — fetch 안 함" };
  }
  if (opts.decisionLink.startsWith("decision-flow://")) {
    return { kind: "external", reason: "decision-flow:// — Stage 3 미지원" };
  }
  if (opts.decisionLink.startsWith("tax:")) {
    return { kind: "external", reason: "tax: ref — registry 통한 해소 필요" };
  }
  const yamlAbsDir = resolve(opts.repoRoot, opts.yamlFile, "..");
  const resolvedPath = isAbsolute(opts.decisionLink)
    ? opts.decisionLink
    : resolve(yamlAbsDir, opts.decisionLink);
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
