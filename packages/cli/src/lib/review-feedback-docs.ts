// @def.boundary docs-control-plane
// @def.doc docs-control-plane

import { relative, resolve } from "node:path";
import {
  createDataSource,
  type DataSourceOptions,
} from "definition-data-source";
import type { DefDataSource } from "definition-catalog";
import type { FeedbackRelatedDoc } from "review-ledger";

export async function resolveRelatedDocsForFiles(
  cwd: string,
  filePaths: readonly string[],
  options: DataSourceOptions = {},
): Promise<Record<string, FeedbackRelatedDoc[]>> {
  let source: DefDataSource | null = null;
  try {
    source = await createDataSource({
      ...options,
      rootDir: cwd,
    });
  } catch {
    return {};
  }

  try {
    if (!source) return {};
    if (source.mode === "scan") return {};
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
  if (source.mode === "scan") return [];

  const normalizedPath = relative(cwd, resolve(cwd, filePath)).replaceAll("\\", "/");
  const mapping = await source.resolveByFile(normalizedPath);
  if (mapping.kind !== "unique") {
    return [];
  }

  if (mapping.supportingDocs.length === 1) {
    const doc = mapping.supportingDocs[0]!;
    return [{
      docId: doc.docId,
      scope: doc.scope,
      aspect: doc.aspect,
      depth: doc.depth,
      reason: "file-hint",
      ...(doc.purpose ? { purpose: doc.purpose } : {}),
    }];
  }

  return [{
    docId: mapping.anchor.docId,
    scope: mapping.anchor.scope,
    aspect: mapping.anchor.aspect,
    depth: mapping.anchor.depth,
    reason: "file-hint",
    ...(mapping.anchor.purpose ? { purpose: mapping.anchor.purpose } : {}),
  }];
}
