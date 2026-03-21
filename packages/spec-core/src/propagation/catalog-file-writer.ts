/**
 * catalog-file-writer — Catalog 객체 → TypeScript 파일 기록.
 *
 * 기존 파일과 비교하여 변경 없으면 기록하지 않는다 (빌드 캐시 보존).
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { dirname } from "node:path";
import type { Catalog } from "@qa-sdk/core";
import { serializeCatalogToTs, type WriterOptions } from "./catalog-writer.js";

export interface FileWriterOptions extends WriterOptions {
  /** true면 content만 생성하고 파일에 기록하지 않음 */
  readonly dryRun?: boolean;
}

export interface FileWriterResult {
  /** 실제 파일에 기록했는지 여부 */
  readonly written: boolean;
  /** 생성된 TypeScript 소스 */
  readonly content: string;
}

/**
 * Catalog를 TypeScript 파일로 기록한다.
 *
 * - 기존 파일과 내용이 동일하면 기록을 건너뛴다 (빌드 캐시 보존)
 * - dryRun이면 content만 반환
 * - 디렉터리가 없으면 자동 생성
 */
export function writeCatalogFile(
  catalog: Catalog,
  filePath: string,
  options?: FileWriterOptions,
): FileWriterResult {
  const content = serializeCatalogToTs(catalog, options);

  if (options?.dryRun) {
    return { written: false, content };
  }

  // 기존 파일과 비교
  if (existsSync(filePath)) {
    try {
      const existing = readFileSync(filePath, "utf-8");
      // Generated 날짜를 제외하고 비교 (날짜만 달라져도 캐시를 깨지 않기 위해)
      if (stripGeneratedDate(existing) === stripGeneratedDate(content)) {
        return { written: false, content };
      }
    } catch {
      // 읽기 실패 시 새로 기록
    }
  }

  // 디렉터리 생성
  const dir = dirname(filePath);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }

  writeFileSync(filePath, content, "utf-8");
  return { written: true, content };
}

/** Generated 날짜 주석을 제거하여 순수 내용만 비교 */
function stripGeneratedDate(source: string): string {
  return source.replace(/\* Generated: \d{4}-\d{2}-\d{2}/, "* Generated: DATE");
}
