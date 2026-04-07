import { collectCodeReferences, parseDocument, scanAndBuild } from "definition-catalog";
import { readFileSync } from "node:fs";
import { join, relative } from "node:path";
import type { DocStore } from "../core/interfaces.js";
import { extractBody, buildDocRecord } from "../core/sync-engine.js";

export interface SyncResult {
  synced: number;
  unchanged: number;
  created: number;
  deleted: number;
  codeReferences: number;
  errors: string[];
}

/**
 * docs 디렉토리를 스캔하여 DB에 동기화한다.
 *
 * 1. scanAndBuild()로 마크다운 frontmatter 파싱
 * 2. 각 문서에서 body_hash 계산 + 마커 추출
 * 3. docStore.upsert()으로 변경 감지 + 이력 기록
 */
export async function syncDocsToDb(
  docsDir: string,
  rootDir: string,
  docStore: DocStore,
): Promise<SyncResult> {
  const result: SyncResult = { synced: 0, unchanged: 0, created: 0, deleted: 0, codeReferences: 0, errors: [] };

  let scanResult;
  try {
    scanResult = await scanAndBuild(rootDir, [join(rootDir, docsDir)]);
  } catch (err) {
    result.errors.push(`scanAndBuild 실패: ${err instanceof Error ? err.message : String(err)}`);
    return result;
  }

  // 파싱 에러 수집
  for (const e of scanResult.errors) {
    result.errors.push(`${e.file}: ${e.error}`);
  }
  for (const e of scanResult.linkErrors) {
    result.errors.push(`${e.source} -> ${e.target}: ${e.error}`);
  }

  // 레지스트리에 등록된 모든 문서 처리
  const registry = scanResult.registry;
  const allDocs = registry.all();
  const scannedDocIds = new Set(allDocs.map((entry) => entry.id));

  for (const entry of allDocs) {
    try {
      // 소스 파일 읽기 — entry.ref = baseDir 기준 상대 경로
      const sourcePath = entry.ref;
      if (!sourcePath) continue;

      const absPath = join(rootDir, sourcePath);
      let content: string;
      try {
        content = readFileSync(absPath, "utf-8");
      } catch {
        result.errors.push(`파일 읽기 실패: ${absPath}`);
        continue;
      }

      const body = extractBody(content);

      const parsed = parseDocument(content, absPath);
      const links = parsed.def.links
        ? parsed.def.links.map((link) => ({ target: link.target, type: link.type }))
        : [];

      const doc = buildDocRecord(entry, body, links, relative(rootDir, absPath));
      const { action } = docStore.upsert(doc, body);

      if (action === "unchanged") {
        result.unchanged++;
      } else if (action === "created") {
        result.created++;
      }
      result.synced++;
    } catch (err) {
      result.errors.push(
        `${entry.id}: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  for (const existing of docStore.list({ limit: 100000 })) {
    if (scannedDocIds.has(existing.docId)) continue;
    if (docStore.delete(existing.docId)) {
      result.deleted++;
    }
  }

  try {
    const codeReferences = collectCodeReferences(rootDir, { docsDir, codeDirs: ["packages"] });
    result.codeReferences = docStore.replaceCodeReferences(codeReferences);
  } catch (err) {
    result.errors.push(`code reference scan 실패: ${err instanceof Error ? err.message : String(err)}`);
  }

  return result;
}
