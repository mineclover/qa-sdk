/**
 * Reverse Sync — DB 메타데이터를 마크다운 frontmatter에 기록
 *
 * SSOT 방향: DB → file (메타데이터), file → DB (본문/마커)
 * 파일의 id + address는 유지, 나머지 필드를 DB 값으로 덮어씀.
 */

import { join } from "node:path";
import { writeFrontmatterToFile, type DbMetadata } from "definition-catalog";
import type { DocStore } from "../core/interfaces.js";

export interface ReverseSyncResult {
  total: number;
  updated: number;
  skipped: number;
  errors: string[];
}

/**
 * DB에 저장된 모든 문서의 메타데이터를 파일 frontmatter로 역동기화한다.
 *
 * 처리 흐름:
 * 1. docStore.list()로 전체 문서 목록 조회
 * 2. 각 문서의 source_path로 파일 위치 결정
 * 3. writeFrontmatterToFile()로 frontmatter 갱신
 */
export async function syncDbToFiles(
  rootDir: string,
  docStore: DocStore,
): Promise<ReverseSyncResult> {
  const result: ReverseSyncResult = {
    total: 0,
    updated: 0,
    skipped: 0,
    errors: [],
  };

  const docs = docStore.list();
  result.total = docs.length;

  for (const doc of docs) {
    if (!doc.sourcePath) {
      result.skipped++;
      continue;
    }

    const filePath = join(rootDir, doc.sourcePath);
    const metadata: DbMetadata = {
      scope: doc.scope,
      aspect: doc.aspect,
      depth: doc.depth,
      lifecycle: doc.lifecycle,
      layer: doc.layer,
      tags: doc.tags,
      links: doc.links,
      svc: doc.svc,
    };

    try {
      const changed = await writeFrontmatterToFile(filePath, metadata);
      if (changed) {
        result.updated++;
      } else {
        result.skipped++;
      }
    } catch (err) {
      result.errors.push(
        `${doc.docId}: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  return result;
}
