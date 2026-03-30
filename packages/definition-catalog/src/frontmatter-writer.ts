/**
 * Frontmatter Writer — DB 메타데이터를 마크다운 frontmatter로 직렬화
 *
 * SSOT 방향: DB가 메타데이터 소유자, 파일의 frontmatter는 읽기 전용 캐시.
 * - 파일 소유: id, address, 커스텀 필드 (def 블록 밖의 frontmatter 필드)
 * - DB 소유: scope, aspect, depth, lifecycle, layer, tags, links, svc
 *
 * 병합 전략: def 블록의 DB 소유 필드만 덮어쓰고, 나머지는 보존.
 */

import { readFile, writeFile } from "node:fs/promises";
import { extractFrontmatter, parseYaml } from "./frontmatter.js";

/** DB에서 받아올 메타데이터 */
export interface DbMetadata {
  readonly version?: string;
  readonly revision?: number;
  readonly level?: string;
  readonly scope: string;
  readonly aspect: string;
  readonly depth: string;
  readonly lifecycle: string;
  readonly layer?: string;
  readonly tags?: readonly string[];
  readonly links?: readonly { target: string; type: string }[];
  readonly svc?: string;
  /** 좌표 주소 — scope×aspect×depth로 계산 */
  readonly address?: string;
}

/** DB 소유 필드 목록 — 이 필드만 덮어씀 */
const DB_OWNED_FIELDS = new Set([
  "address", "version", "revision", "level", "scope", "aspect", "depth", "lifecycle", "layer", "svc", "tags", "links",
]);

/**
 * 기존 YAML frontmatter에서 def 블록의 DB 소유 필드만 교체하고 나머지 보존.
 *
 * 처리:
 * 1. 기존 frontmatter를 줄 단위로 파싱
 * 2. def: 블록 내 DB 소유 필드를 DB 값으로 교체
 * 3. def: 블록 밖의 커스텀 필드(source: 등)는 그대로 유지
 * 4. id, address는 파일 값 유지
 */
export function mergeFrontmatter(
  existingYaml: string,
  metadata: DbMetadata,
): string {
  const lines = existingYaml.split("\n");
  const result: string[] = [];

  // DB 소유 필드를 먼저 직렬화
  const dbLines: string[] = [];
  if (metadata.address) dbLines.push(`  address: ${metadata.address}`);
  if (metadata.version) dbLines.push(`  version: ${metadata.version}`);
  if (metadata.revision !== undefined) dbLines.push(`  revision: ${metadata.revision}`);
  if (metadata.level) dbLines.push(`  level: ${metadata.level}`);
  dbLines.push(`  scope: ${metadata.scope}`);
  dbLines.push(`  aspect: ${metadata.aspect}`);
  dbLines.push(`  depth: ${metadata.depth}`);
  dbLines.push(`  lifecycle: ${metadata.lifecycle}`);
  if (metadata.layer) dbLines.push(`  layer: ${metadata.layer}`);
  if (metadata.svc) dbLines.push(`  svc: ${metadata.svc}`);
  if (metadata.tags && metadata.tags.length > 0) {
    dbLines.push(`  tags: [${metadata.tags.join(", ")}]`);
  }
  if (metadata.links && metadata.links.length > 0) {
    dbLines.push("  links:");
    for (const link of metadata.links) {
      dbLines.push(`    - target: ${link.target}`);
      dbLines.push(`      type: ${link.type}`);
    }
  }

  let inDef = false;
  let defFieldsWritten = false;
  let skippingDbField = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    // def: 블록 시작 감지
    if (trimmed === "def:" && !inDef) {
      inDef = true;
      result.push(line);
      continue;
    }

    if (inDef) {
      const indent = line.length - line.trimStart().length;

      // def 블록 끝 (indent 0인 다른 키 또는 빈 줄)
      if (indent === 0 && trimmed !== "" && !trimmed.startsWith("#")) {
        // def 블록 끝나기 전에 DB 필드 삽입
        if (!defFieldsWritten) {
          result.push(...dbLines);
          defFieldsWritten = true;
        }
        inDef = false;
        skippingDbField = false;
        result.push(line);
        continue;
      }

      // def 블록 내 indent 2 키
      if (indent === 2) {
        const keyMatch = trimmed.match(/^(\w+):/);
        if (keyMatch) {
          const key = keyMatch[1];
          if (DB_OWNED_FIELDS.has(key)) {
            // DB 소유 필드 → 스킵 (나중에 DB 값으로 교체)
            skippingDbField = key === "links" || key === "tags";
            // id 바로 뒤에 DB 필드 삽입 (첫 DB 소유 필드 만날 때)
            if (!defFieldsWritten) {
              result.push(...dbLines);
              defFieldsWritten = true;
            }
            continue;
          }
          // 파일 소유 필드 (id, address 등) → 유지
          skippingDbField = false;
          result.push(line);
          continue;
        }
      }

      // indent 4+ (links 하위 항목 등)
      if (indent >= 4 && skippingDbField) {
        continue; // DB 소유 블록의 하위 줄 스킵
      }

      // 기타 줄 (빈 줄, 주석 등) 유지
      skippingDbField = false;
      result.push(line);
      continue;
    }

    // def 블록 밖의 줄은 모두 유지
    result.push(line);
  }

  // def 블록이 파일 끝까지 이어진 경우
  if (inDef && !defFieldsWritten) {
    result.push(...dbLines);
  }

  return result.join("\n");
}

/**
 * 마크다운 파일의 frontmatter를 DB 메타데이터로 업데이트 (병합 방식)
 *
 * - id, address, 커스텀 필드: 파일 값 유지
 * - scope, aspect, depth, lifecycle, layer, tags, links, svc: DB 값으로 교체
 * - body: 변경 없음
 *
 * @returns 변경 여부 (true: 파일 수정됨)
 */
export async function writeFrontmatterToFile(
  filePath: string,
  metadata: DbMetadata,
): Promise<boolean> {
  const content = await readFile(filePath, "utf-8");
  const parsed = extractFrontmatter(content);
  if (!parsed) return false;

  const yaml = parseYaml(parsed.yaml);
  const def = yaml["def"] as Record<string, unknown> | undefined;
  if (!def || !def["id"]) return false;

  const newYaml = mergeFrontmatter(parsed.yaml, metadata);
  const newContent = `---\n${newYaml}\n---\n${parsed.body}`;

  if (newContent === content) return false;

  await writeFile(filePath, newContent, "utf-8");
  return true;
}
