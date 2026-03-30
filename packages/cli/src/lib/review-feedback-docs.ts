import { existsSync, readFileSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import {
  createDataSource,
  type DataSourceOptions,
} from "definition-data-source";
import type { DefDataSource, DefDoc } from "definition-catalog";
import type { FeedbackRelatedDoc } from "review-ledger";

const SVC_ALIASES: Record<string, string[]> = {
  cli: ["qa-sdk-cli"],
  "shop-web": ["shopping-web"],
  "definition-catalog": ["definition-service"],
  "definition-client": ["definition-service"],
  "motion-content": ["motion-workspace-service"],
  "motion-workspace": ["motion-workspace-service"],
  "motion-workspace-client": ["motion-workspace-service"],
  "motion-content-editor": ["motion-workspace-service"],
  "review-ledger": ["review-ledger"],
};

export async function resolveRelatedDocsForFiles(
  cwd: string,
  filePaths: readonly string[],
  options: DataSourceOptions = {},
): Promise<Record<string, FeedbackRelatedDoc[]>> {
  let source: DefDataSource | null = null;
  try {
    source = await createDataSource(options);
  } catch {
    return {};
  }

  try {
    if (!source) return {};
    const activeSource = source;
    const result: Record<string, FeedbackRelatedDoc[]> = {};
    for (const filePath of filePaths) {
      result[filePath] = await resolveRelatedDocsForFile(cwd, filePath, activeSource);
    }
    return result;
  } finally {
    if ("close" in source && typeof source.close === "function") {
      (source as { close(): void }).close();
    }
  }
}

export async function resolveRelatedDocsForFile(
  cwd: string,
  filePath: string,
  source: DefDataSource,
): Promise<FeedbackRelatedDoc[]> {
  const root = cwd;
  const absPath = resolve(root, filePath);
  const relPath = relative(root, absPath);

  const match = relPath.match(/^packages\/([^/]+)\//);
  if (!match) {
    return [];
  }

  const pkgDir = match[1]!;
  const pkgJsonPath = join(root, "packages", pkgDir, "package.json");
  let pkgName = pkgDir;
  if (existsSync(pkgJsonPath)) {
    try {
      const pkg = JSON.parse(readFileSync(pkgJsonPath, "utf-8"));
      pkgName = (pkg.name as string ?? pkgDir).replace(/^@qa-sdk\//, "");
    } catch {
      // keep pkgDir
    }
  }

  const candidates = new Set([pkgDir, pkgName, ...(SVC_ALIASES[pkgDir] ?? [])]);
  const docs: DefDoc[] = [];

  for (const svc of candidates) {
    const found = await source.list({ svc, limit: 100 });
    for (const doc of found) {
      if (!docs.some((existing) => existing.docId === doc.docId)) {
        docs.push(doc);
      }
    }
  }

  // svc 매칭이 약한 문서(예: review-ledger-spec)는 docId/title/sourcePath에서 패키지 힌트로 보강
  const packageHints = new Set([
    pkgDir,
    pkgName,
    pkgDir.replaceAll("-", "_"),
    pkgName.replaceAll("-", "_"),
  ]);
  const allDocs = await source.list({ limit: 2000 });
  for (const doc of allDocs) {
    const haystacks = [
      doc.docId,
      doc.title ?? "",
      doc.sourcePath ?? "",
    ].map((value) => value.toLowerCase());
    const matched = [...packageHints].some((hint) =>
      haystacks.some((value) => value.includes(hint.toLowerCase())),
    );
    if (matched && !docs.some((existing) => existing.docId === doc.docId)) {
      docs.push(doc);
    }
  }

  const fileName = relPath.split("/").pop()?.replace(/\.tsx?$/, "") ?? "";
  const fileHints = fileName.split(/[-_.]/).filter((hint) => hint.length > 2);

  return docs
    .map((doc) => {
      const fileHintMatch = fileHints.some((hint) => doc.docId.includes(hint));
      return {
        docId: doc.docId,
        scope: doc.scope,
        aspect: doc.aspect,
        depth: doc.depth,
        reason: fileHintMatch ? "file-hint" as const : "service-scope" as const,
        ...(doc.purpose ? { purpose: doc.purpose } : {}),
      };
    })
    .toSorted((left, right) => {
      const leftScore = left.reason === "file-hint" ? 1 : 0;
      const rightScore = right.reason === "file-hint" ? 1 : 0;
      if (leftScore !== rightScore) return rightScore - leftScore;
      return left.docId.localeCompare(right.docId);
    })
    .slice(0, 8);
}
