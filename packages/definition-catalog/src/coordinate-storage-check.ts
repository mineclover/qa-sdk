// @def.boundary definition-catalog-spec
// @def.doc coordinate-storage

/**
 * coordinate-storage.rule 자동 검출.
 *
 * Drizzle 스키마(`sqliteTable`/`pgTable`/`mysqlTable`) 선언을 정규식·라인 스캔으로
 * 식별하고, 좌표 저장 후보가 (prefix_id, version, address) 복합 PK를 갖는지 검증한다.
 *
 * AST 미사용 — code-references.ts와 동일한 가벼운 분석 수준.
 */

import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const TABLE_DECL_RE = /\b(sqliteTable|pgTable|mysqlTable)\s*\(\s*"([^"]+)"\s*,\s*\{/g;
const COLUMN_RE = /^\s*([a-zA-Z_][\w$]*)\s*:\s*\w+\s*\(/gm;
const COMPOSITE_PK_RE = /primaryKey\s*\(\s*\{\s*columns:\s*\[([^\]]+)\]/;
const UNIQUE_RE = /uniqueIndex\s*\(\s*"[^"]*"\s*\)\s*\.\s*on\s*\(([^)]+)\)/g;
const EXEMPT_RE = /\/\/\s*@def\.coord-storage-exempt:\s*(.*)$/;

const PREFIX_COL_NAMES = new Set(['prefixId', 'prefix_id', 'prefix']);
const VERSION_COL_NAMES = new Set(['version', 'ver']);
const ADDR_COL_NAMES = new Set(['address', 'addr']);
const PACKED_COL_NAMES = new Set(['packedKey', 'packed_key', 'packedAddress', 'packed_address']);

const IGNORED_DIRS = new Set([
  'node_modules',
  'dist',
  '.git',
  '.next',
  '.turbo',
  'coverage',
  'synced',
  '__mocks__',
]);

export type DrizzleDialect = 'sqlite' | 'pg' | 'mysql';

export interface ScannedTable {
  filePath: string;
  name: string;
  dialect: DrizzleDialect;
  columnNames: string[];
  /** primaryKey({ columns: [...] }) 안의 컬럼 이름들. 단일 PK일 땐 [컬럼명]. */
  compositePkColumns: string[];
  /** uniqueIndex가 (prefixId, version, packedKey/address)를 모두 포함하는지 */
  hasUniqueOnCoord: boolean;
  isExempt: boolean;
  exemptReason?: string;
  lineNumber: number;
}

export type CoordStorageViolationKind =
  | 'missing-version'
  | 'missing-composite-pk'
  | 'missing-prefix';

export interface CoordStorageViolation {
  filePath: string;
  tableName: string;
  lineNumber: number;
  kind: CoordStorageViolationKind;
  message: string;
}

function dialectFromKeyword(kw: string): DrizzleDialect {
  if (kw === 'pgTable') return 'pg';
  if (kw === 'mysqlTable') return 'mysql';
  return 'sqlite';
}

/**
 * 테이블 선언 직전 줄에 @def.coord-storage-exempt 주석이 있는지 검사.
 * 줄 번호 기준 1줄 위까지만 본다 (블록 위 주석은 별도 처리 안 함).
 */
function findExemptAt(
  lines: string[],
  declLineIdx: number,
): { isExempt: boolean; reason?: string } {
  // 직전 줄부터 거슬러 올라가며 빈 줄·import문은 건너뛰지 않고, 정확히 인접한 주석만 봄
  for (let i = declLineIdx - 1; i >= 0; i--) {
    const line = lines[i].trim();
    if (line === '') continue;
    if (!line.startsWith('//')) break; // 주석 블록 끝
    const m = EXEMPT_RE.exec(line);
    if (m && m[1].trim() !== '') {
      return { isExempt: true, reason: m[1].trim() };
    }
    break; // 다른 주석이면 스킵
  }
  return { isExempt: false };
}

/**
 * 한 파일에서 Drizzle 테이블 선언을 모두 추출.
 *
 * 매우 단순한 파서 — 다음 매개변수에 한해 정확:
 *   1) `xxxTable("name", { ... })` 패턴
 *   2) 컬럼은 `name: type(...)` 한 줄 선언
 *   3) primaryKey는 `(t) => [primaryKey({ columns: [...] }), ...]` 패턴
 *
 * 위 패턴 외의 표현은 누락 가능 (false negative). false positive는 없게 유지.
 */
export function parseDrizzleTables(filePath: string, source: string): ScannedTable[] {
  const lines = source.split(/\r?\n/);
  const tables: ScannedTable[] = [];

  // line offset 계산을 위해 매번 source 전체 검색 (작은 파일 가정)
  let m: RegExpExecArray | null;
  TABLE_DECL_RE.lastIndex = 0;
  while ((m = TABLE_DECL_RE.exec(source)) !== null) {
    const dialect = dialectFromKeyword(m[1]);
    const tableName = m[2];
    const declOffset = m.index;
    const declLineIdx = source.slice(0, declOffset).split(/\r?\n/).length - 1;

    // 컬럼 객체의 매칭되는 } 찾기 — 단순 brace 카운터 (문자열 안 brace는 무시)
    let depth = 1;
    let i = m.index + m[0].length;
    while (i < source.length && depth > 0) {
      const ch = source[i];
      if (ch === '{') depth++;
      else if (ch === '}') depth--;
      i++;
    }
    const colObjEnd = i;
    const colObjBody = source.slice(m.index + m[0].length, colObjEnd - 1);

    // 컬럼 이름 추출
    const columnNames: string[] = [];
    let cm: RegExpExecArray | null;
    COLUMN_RE.lastIndex = 0;
    while ((cm = COLUMN_RE.exec(colObjBody)) !== null) {
      columnNames.push(cm[1]);
    }

    // 테이블 선언 전체(컬럼 객체 + 인덱스 callback) 끝까지 본다
    // 패턴: `sqliteTable(..., (t) => [...])` 또는 `sqliteTable(..., {...})`
    // 단순화: ); 까지 추가 800자 추출
    const fullDecl = source.slice(m.index, Math.min(source.length, colObjEnd + 800));

    // 복합 PK 추출
    const compositePkColumns: string[] = [];
    const pkM = COMPOSITE_PK_RE.exec(fullDecl);
    if (pkM) {
      const inner = pkM[1];
      // t.colName 또는 colName 형식 모두 처리
      const colMatches = inner.matchAll(/\b(?:t\.)?([a-zA-Z_][\w$]*)\b/g);
      for (const x of colMatches) compositePkColumns.push(x[1]);
    } else {
      // 단일 PK — `.primaryKey()` 호출이 붙은 컬럼 찾기
      const singlePkRe = /(\w+):\s*\w+\([^)]*\)\.primaryKey\(\)/g;
      let pm: RegExpExecArray | null;
      while ((pm = singlePkRe.exec(colObjBody)) !== null) {
        compositePkColumns.push(pm[1]);
      }
    }

    // UNIQUE 제약에 (prefixId, version, address|packedKey)가 모두 들어가는지
    let hasUniqueOnCoord = false;
    UNIQUE_RE.lastIndex = 0;
    let um: RegExpExecArray | null;
    while ((um = UNIQUE_RE.exec(fullDecl)) !== null) {
      const cols = um[1].split(',').map((c) => c.trim().replace(/^[a-zA-Z_][\w$]*\./, ''));
      const hasPrefix = cols.some((c) => PREFIX_COL_NAMES.has(c));
      const hasVersion = cols.some((c) => VERSION_COL_NAMES.has(c));
      const hasAddr = cols.some((c) => ADDR_COL_NAMES.has(c) || PACKED_COL_NAMES.has(c));
      if (hasPrefix && hasVersion && hasAddr) {
        hasUniqueOnCoord = true;
        break;
      }
    }

    // exempt 주석
    const ex = findExemptAt(lines, declLineIdx);

    tables.push({
      filePath,
      name: tableName,
      dialect,
      columnNames,
      compositePkColumns,
      hasUniqueOnCoord,
      isExempt: ex.isExempt,
      exemptReason: ex.reason,
      lineNumber: declLineIdx + 1,
    });
  }

  return tables;
}

/**
 * 좌표 저장 후보 분류 + 위반 검사.
 */
export function checkCoordinateStorage(tables: readonly ScannedTable[]): CoordStorageViolation[] {
  const violations: CoordStorageViolation[] = [];

  for (const t of tables) {
    if (t.isExempt) continue;

    const hasAddr = t.columnNames.some((c) => ADDR_COL_NAMES.has(c));
    const hasPacked = t.columnNames.some((c) => PACKED_COL_NAMES.has(c));
    const hasPrefix = t.columnNames.some((c) => PREFIX_COL_NAMES.has(c));
    const hasVersion = t.columnNames.some((c) => VERSION_COL_NAMES.has(c));

    // 좌표 저장 후보 조건:
    //   - (address 또는 packedKey) AND (prefix_id 컬럼 존재)
    //   - 또는 packedKey 단독 (prefix가 packed_key 안에 인코딩된 패턴)
    const isCoordCandidate = hasPrefix && (hasAddr || hasPacked);
    if (!isCoordCandidate) continue;

    if (!hasVersion) {
      violations.push({
        filePath: t.filePath,
        tableName: t.name,
        lineNumber: t.lineNumber,
        kind: 'missing-version',
        message: `테이블 '${t.name}'은 좌표 저장 후보이나 'version' 컬럼이 없음 — coordinate-storage.rule §1.1`,
      });
      continue;
    }

    // 복합 PK 또는 UNIQUE 검증
    const pkSet = new Set(t.compositePkColumns);
    const pkHasPrefix = [...pkSet].some((c) => PREFIX_COL_NAMES.has(c));
    const pkHasVersion = [...pkSet].some((c) => VERSION_COL_NAMES.has(c));
    const pkHasAddr = [...pkSet].some((c) => ADDR_COL_NAMES.has(c) || PACKED_COL_NAMES.has(c));

    const pkOk = pkHasPrefix && pkHasVersion && pkHasAddr;

    // 집계 테이블 예외: address/packedKey 컬럼이 없고 (prefix_id, version)만 PK인 경우
    const isAggregateTable = !hasAddr && !hasPacked && pkHasPrefix && pkHasVersion;

    if (!pkOk && !t.hasUniqueOnCoord && !isAggregateTable) {
      violations.push({
        filePath: t.filePath,
        tableName: t.name,
        lineNumber: t.lineNumber,
        kind: 'missing-composite-pk',
        message: `테이블 '${t.name}'은 좌표 저장이지만 PK/UNIQUE에 (prefix_id, version, address|packed_key) 미포함 — coordinate-storage.rule §2.1`,
      });
    }
  }

  return violations;
}

/**
 * 디렉토리 트리 재귀 스캔.
 */
function* walkTsFiles(rootDir: string): Generator<string> {
  if (!existsSync(rootDir)) return;
  const stack: string[] = [rootDir];
  while (stack.length > 0) {
    const dir = stack.pop()!;
    let entries: string[];
    try {
      entries = readdirSync(dir);
    } catch {
      continue;
    }
    for (const name of entries) {
      if (IGNORED_DIRS.has(name)) continue;
      const p = join(dir, name);
      let st;
      try {
        st = statSync(p);
      } catch {
        continue;
      }
      if (st.isDirectory()) stack.push(p);
      else if (/\.(ts|mts|cts)$/.test(name) && !/\.(test|spec)\.[cm]?[jt]s$/.test(name)) {
        yield p;
      }
    }
  }
}

export interface CoordStorageScanOptions {
  rootDirs?: readonly string[];
  /** repo 루트 — 결과 path를 상대경로로 출력하기 위함 */
  repoRoot?: string;
}

/**
 * 지정된 루트들을 스캔해 모든 위반 수집.
 */
export function scanCoordinateStorage(opts: CoordStorageScanOptions = {}): CoordStorageViolation[] {
  const repoRoot = opts.repoRoot ?? process.cwd();
  const rootDirs = opts.rootDirs ?? [join(repoRoot, 'packages')];
  const allViolations: CoordStorageViolation[] = [];

  for (const root of rootDirs) {
    for (const file of walkTsFiles(root)) {
      let source: string;
      try {
        source = readFileSync(file, 'utf8');
      } catch {
        continue;
      }
      // 빠른 스킵: drizzle-orm을 import 안 하면 패스
      if (
        !source.includes('sqliteTable') &&
        !source.includes('pgTable') &&
        !source.includes('mysqlTable')
      ) {
        continue;
      }
      const relPath = relative(repoRoot, file);
      const tables = parseDrizzleTables(relPath, source);
      const violations = checkCoordinateStorage(tables);
      allViolations.push(...violations);
    }
  }

  return allViolations;
}
