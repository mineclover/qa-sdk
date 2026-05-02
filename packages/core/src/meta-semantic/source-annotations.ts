// @def.boundary qa-sdk-core-system
// @def.doc qa-sdk-core-system

/**
 * Source Annotations — 소스 코드 JSDoc에서 prefix 메타데이터 추출
 *
 * Phase 1-3: @table_ref — drizzle schema 테이블에서 prefix dim 출처 추출
 * Phase 2-1: @axis — enum/const 선언에서 axis entries 추출
 *
 * 패턴:
 *   /** @table_ref cart_event.actor, auth_event.actor *​/
 *   export const members = sqliteTable("members", { ... });
 *
 *   /** @axis cart_action @version v1 *​/
 *   export const CART_ACTIONS = ["add", "remove", "update_qty", "clear"] as const;
 */

// ── Table Ref Annotation ────────────────────────────

export interface TableRefAnnotation {
  /** 테이블 식별자 (export const 이름 또는 sqliteTable 첫 번째 인자) */
  tableId: string;
  /** prefix.dim 참조 목록 (예: "cart_event.actor") */
  refs: string[];
  /** 소스 파일 경로 */
  filePath: string;
  /** 줄 번호 */
  line: number;
}

/**
 * 소스 코드에서 @table_ref 어노테이션을 추출한다.
 *
 * 패턴: JSDoc 또는 // 주석에 @table_ref prefix.dim, prefix.dim, ...
 * 바로 다음 줄의 export 선언에서 이름 추출.
 */
export function extractTableRefAnnotations(source: string, filePath: string): TableRefAnnotation[] {
  const results: TableRefAnnotation[] = [];
  const lines = source.split("\n");

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const match = line.match(/@table_ref\s+(.+)/);
    if (!match) continue;

    const refs = match[1]
      .replace(/\*\/\s*$/, "") // JSDoc 닫는 태그 제거
      .split(",")
      .map(r => r.trim())
      .filter(Boolean);

    // 다음 비빈줄에서 테이블 이름 추출
    const tableId = findNextExportName(lines, i + 1);
    if (tableId && refs.length > 0) {
      results.push({ tableId, refs, filePath, line: i + 1 });
    }
  }

  return results;
}

// ── Axis Annotation ─────────────────────────────────

export interface AxisAnnotation {
  /** axis ID (예: "cart_action") */
  axisId: string;
  /** 버전 (예: "v1") */
  version: string;
  /** 추출된 entries */
  entries: string[];
  /** 소스 파일 경로 */
  filePath: string;
  /** 줄 번호 */
  line: number;
}

/**
 * 소스 코드에서 @axis 어노테이션을 추출한다.
 *
 * 패턴: JSDoc에 @axis <axisId> @version <version>
 * 바로 다음 const/enum 선언에서 entries 추출.
 */
export function extractAxisAnnotations(source: string, filePath: string): AxisAnnotation[] {
  const results: AxisAnnotation[] = [];
  const lines = source.split("\n");

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const match = line.match(/@axis\s+([\w-]+)(?:\s+@version\s+([\w.]+))?/);
    if (!match) continue;

    const axisId = match[1];
    const version = match[2] ?? "v1";

    // 다음 줄들에서 entries 추출
    const entries = findNextEntries(lines, i + 1);
    if (entries.length > 0) {
      results.push({ axisId, version, entries, filePath, line: i + 1 });
    }
  }

  return results;
}

// ── 내부 유틸 ─────────────────────────────────────────

/** 다음 export 선언에서 이름을 추출한다 */
function findNextExportName(lines: string[], startLine: number): string | null {
  for (let i = startLine; i < Math.min(startLine + 5, lines.length); i++) {
    const line = lines[i].trim();
    if (!line || line.startsWith("*") || line.startsWith("//")) continue;

    // export const NAME = sqliteTable("name", ...)
    const constMatch = line.match(/export\s+const\s+(\w+)/);
    if (constMatch) return constMatch[1];

    // export enum NAME { ... }
    const enumMatch = line.match(/export\s+enum\s+(\w+)/);
    if (enumMatch) return enumMatch[1];

    break;
  }
  return null;
}

/** 다음 const/enum 선언에서 entries(문자열 배열)를 추출한다 */
function findNextEntries(lines: string[], startLine: number): string[] {
  // JSDoc 닫기 + export 선언까지 수집
  let block = "";
  for (let i = startLine; i < Math.min(startLine + 20, lines.length); i++) {
    block += lines[i] + "\n";
    // 세미콜론 또는 }로 선언이 끝나면 중단
    if (lines[i].includes(";") || lines[i].includes("}")) break;
  }

  // const NAME = ["a", "b", "c"] as const 패턴
  const arrayMatch = block.match(/\[([^\]]+)\]/);
  if (arrayMatch) {
    return arrayMatch[1]
      .split(",")
      .map(e => e.replace(/["'`\s]/g, "").trim())
      .filter(Boolean);
  }

  // enum NAME { A = "a", B = "b" } 패턴
  const enumEntries: string[] = [];
  const enumRe = /=\s*["'`]([^"'`]+)["'`]/g;
  let m: RegExpExecArray | null;
  while ((m = enumRe.exec(block)) !== null) {
    enumEntries.push(m[1]);
  }
  return enumEntries;
}
