# §6 coordinate-storage.rule 자동화 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `coordinate-storage.rule.md` 위반을 PR 단계에서 자동 검출하는 정적 분석을 `def validate`에 추가한다. Drizzle schema 파일에서 `address` 컬럼을 가진 테이블을 식별하고 `(prefix_id, version, address)` 복합 PK를 강제. opt-out은 명시적 주석으로만.

**Architecture:**
- 신규 모듈 `packages/definition-catalog/src/coordinate-storage-check.ts` — `packages/*/src/**/*.ts`에서 Drizzle 테이블 선언을 AST 없이 정규식 + 라인 스캐너로 검출 (현 `code-references.ts`와 동일 수준의 가벼운 분석).
- `validate.ts`에 새 issue type `coordinate-storage-violation` 추가, `validateGraph` 호출 직후 또는 `cmdValidate` 단계에서 함께 실행.
- 위반 = `error` (CI gate 실패). exemption은 `// @def.coord-storage-exempt: <사유>` 주석 1줄로 인정.
- false positive 최소화: `address` 컬럼명이 사용된 모든 테이블이 좌표 저장은 아님 — 휴리스틱은 보수적으로(아래 §검출 휴리스틱).
- PR 체크리스트는 별도 PR template으로 안내 (필수 아님).

**Tech Stack:**
- 기존 `definition-catalog` 모듈 — node:fs 직접 스캔, 정규식 매칭, AST 의존 없음
- vitest, TypeScript ES2023

---

## 검출 휴리스틱

`address` 컬럼명만으로는 false positive가 많으므로 다음 모든 조건 충족 시에만 "좌표 저장 후보"로 판정:

1. **Drizzle 테이블 선언 안에 있는 컬럼**: `sqliteTable(...)`, `pgTable(...)`, `mysqlTable(...)` 호출의 두 번째 인자(컬럼 객체) 안에서
2. **이름이 `address` 또는 `packed_*`**: `address` 또는 `packedKey`/`packedAddress` 같은 명확한 좌표 저장 시그널
3. **타입이 `integer` 또는 `text` (packed string)**: `boolean` 등은 제외
4. **prefix 시그널 존재**: 같은 테이블 안에 `prefix_id`/`prefixId` 컬럼이 있거나 `packedKey`라는 이름이 명시적

위 4 조건 충족 → "좌표 저장 후보"로 분류 → 다음 검증 적용:

- **검증 1**: 테이블에 `version` 컬럼이 있어야 한다
- **검증 2**: 복합 PK 또는 UNIQUE 제약에 `prefix_id`(또는 `prefixId`) + `version` + (`address` 또는 `packed_key`)가 모두 포함되어야 한다
- **검증 3**: `prefix_id`만 PK인 단일 컬럼 PK는 허용 (집계 테이블 — `key_observation_prefixes` 같은 패턴)이지만 `version` 컬럼이 있어야 한다

**Exemption**: 테이블 선언 직전 줄에 `// @def.coord-storage-exempt: <reason>` 주석이 있으면 검사 통과. 사유는 100자 이내, 비어 있으면 안 됨.

---

## File Structure

### 새로 만드는 파일

| 경로 | 책임 |
|---|---|
| `packages/definition-catalog/src/coordinate-storage-check.ts` | Drizzle 스키마 스캐너 + 위반 분석 |
| `packages/definition-catalog/src/coordinate-storage-check.test.ts` | 휴리스틱·exemption·통합 테스트 |
| `docs/proposals/auth-model-implementation-backlog/coordinate-storage-pr-checklist.md` | PR 작성자용 체크리스트 (PR template으로 옵션 promote) |

### 수정하는 파일

| 경로 | 변경 |
|---|---|
| `packages/definition-catalog/src/validate.ts` | `ValidationIssue.type`에 `coordinate-storage-violation` 추가 + `validateGraph` 끝 부분에 새 검사 호출 |
| `packages/definition-catalog/src/index.ts` | `coordinate-storage-check` 모듈 public export (CLI에서 직접 사용 가능하도록) |
| `packages/cli/src/commands/def.ts` | `cmdValidate`가 코드 스캔용 옵션 (`--with-code-checks` 또는 기본 활성화) — 위반 시 errors 카운트에 포함되어 게이트 실패 |
| `docs/specs/system/coordinate-storage.rule.md` | §5 검증 섹션에 자동화 적용 명시 |
| `.github/workflows/def-gate.yml` | `def validate` 호출이 본 검사를 자동 포함 (코드 변경 없음, 단 doc-only 변경에서도 실행됨을 확인) |

---

## Task 0: baseline 검증

- [ ] **Step 1: 현재 def validate 통과 확인**

```bash
cd /Users/junwoobang/workflow/qa-sdk && pnpm --filter @qa-sdk/cli build && pnpm --filter @qa-sdk/cli def sync && pnpm --filter @qa-sdk/cli def validate
```

Expected: errors=0 (warnings 일부 가능). 실패 시 main이 깨진 상태이므로 stop.

- [ ] **Step 2: 영향 범위 — 현재 'address' + 'sqliteTable' 사용 테이블 enumerate**

```bash
cd /Users/junwoobang/workflow/qa-sdk && grep -rn "sqliteTable\|pgTable" packages/*/src --include="*.ts" -l 2>/dev/null
```

기록: 스캔 대상이 될 파일 목록. 본 plan 완료 후 모두 위반 없이 통과해야 한다 (또는 명시적 exemption).

특히 §4 plan이 이미 끝났다면 `key_observations`/`key_observation_prefixes`는 위반 0이어야 함. §4 plan이 아직이라면 본 plan 실행 시 위반 검출됨 (정상 동작) — exemption 추가 또는 §4를 먼저 완료.

---

## Task 1: 검출 모듈 — 단위 휴리스틱 테스트 먼저

**Files:**
- Create: `packages/definition-catalog/src/coordinate-storage-check.test.ts`
- Create: `packages/definition-catalog/src/coordinate-storage-check.ts` (Step 5에서)

- [ ] **Step 1: 테스트 작성 — 휴리스틱 단위 검증**

`packages/definition-catalog/src/coordinate-storage-check.test.ts`:

```ts
// @def.boundary definition-catalog-spec
// @def.doc coordinate-storage

import { describe, expect, it } from "vitest";

import {
  parseDrizzleTables,
  checkCoordinateStorage,
  type CoordStorageViolation,
  type ScannedTable,
} from "./coordinate-storage-check.js";

describe("parseDrizzleTables", () => {
  it("sqliteTable 선언과 컬럼 추출", () => {
    const code = `
      import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

      export const events = sqliteTable("events", {
        eventId: text("event_id").primaryKey(),
        prefixId: text("prefix_id").notNull(),
        version: text("version").notNull(),
        address: integer("address").notNull(),
      });
    `;
    const tables = parseDrizzleTables("events.ts", code);
    expect(tables).toHaveLength(1);
    expect(tables[0].name).toBe("events");
    expect(tables[0].columnNames).toEqual(
      expect.arrayContaining(["eventId", "prefixId", "version", "address"]),
    );
  });

  it("pgTable도 검출", () => {
    const code = `
      import { integer, pgTable, text } from "drizzle-orm/pg-core";
      export const t = pgTable("t", {
        id: text("id").primaryKey(),
        address: integer("address"),
      });
    `;
    const tables = parseDrizzleTables("t.ts", code);
    expect(tables).toHaveLength(1);
    expect(tables[0].dialect).toBe("pg");
  });

  it("exempt 주석이 있으면 isExempt=true + reason 추출", () => {
    const code = `
      // @def.coord-storage-exempt: legacy table, scheduled for migration
      export const legacy = sqliteTable("legacy", {
        address: integer("address").notNull(),
      });
    `;
    const tables = parseDrizzleTables("legacy.ts", code);
    expect(tables[0].isExempt).toBe(true);
    expect(tables[0].exemptReason).toBe("legacy table, scheduled for migration");
  });

  it("exempt 사유 비어있으면 isExempt=false (사유 강제)", () => {
    const code = `
      // @def.coord-storage-exempt:
      export const t = sqliteTable("t", {
        address: integer("address").notNull(),
      });
    `;
    const tables = parseDrizzleTables("t.ts", code);
    expect(tables[0].isExempt).toBe(false);
  });
});

describe("checkCoordinateStorage — 위반 분류", () => {
  it("좌표 저장 후보 + version + 복합 PK = 위반 없음", () => {
    const tables: ScannedTable[] = [{
      filePath: "ok.ts",
      name: "events",
      dialect: "sqlite",
      columnNames: ["prefixId", "version", "address"],
      compositePkColumns: ["prefixId", "version", "address"],
      hasUniqueOnCoord: false,
      isExempt: false,
      lineNumber: 1,
    }];
    expect(checkCoordinateStorage(tables)).toEqual([]);
  });

  it("address 있는데 version 없음 → missing-version", () => {
    const tables: ScannedTable[] = [{
      filePath: "bad.ts",
      name: "events",
      dialect: "sqlite",
      columnNames: ["prefixId", "address"],
      compositePkColumns: ["prefixId", "address"],
      hasUniqueOnCoord: false,
      isExempt: false,
      lineNumber: 1,
    }];
    const violations = checkCoordinateStorage(tables);
    expect(violations).toHaveLength(1);
    expect(violations[0].kind).toBe("missing-version");
  });

  it("address 있는데 prefix 시그널 없음 → not-coord-storage (스킵)", () => {
    // address 컬럼이 있지만 prefix_id도 packed_key도 없음 → 좌표 저장 아님
    const tables: ScannedTable[] = [{
      filePath: "addr.ts",
      name: "ip_log",
      dialect: "sqlite",
      columnNames: ["id", "address", "city"],  // 'address' = IP/주소 등
      compositePkColumns: ["id"],
      hasUniqueOnCoord: false,
      isExempt: false,
      lineNumber: 1,
    }];
    expect(checkCoordinateStorage(tables)).toEqual([]);
  });

  it("packedKey + prefixId 있는데 PK가 단일 packed_key → missing-composite-pk", () => {
    const tables: ScannedTable[] = [{
      filePath: "obs.ts",
      name: "observations",
      dialect: "sqlite",
      columnNames: ["packedKey", "prefixId", "version"],
      compositePkColumns: ["packedKey"],  // 위반: version·prefix가 PK에 없음
      hasUniqueOnCoord: false,
      isExempt: false,
      lineNumber: 1,
    }];
    const violations = checkCoordinateStorage(tables);
    expect(violations).toHaveLength(1);
    expect(violations[0].kind).toBe("missing-composite-pk");
  });

  it("UNIQUE 제약으로 (prefix_id, version, packed_key) 보장 → 통과", () => {
    const tables: ScannedTable[] = [{
      filePath: "obs.ts",
      name: "observations",
      dialect: "sqlite",
      columnNames: ["packedKey", "prefixId", "version"],
      compositePkColumns: ["packedKey"],
      hasUniqueOnCoord: true,
      isExempt: false,
      lineNumber: 1,
    }];
    expect(checkCoordinateStorage(tables)).toEqual([]);
  });

  it("isExempt=true는 모든 검사 우회", () => {
    const tables: ScannedTable[] = [{
      filePath: "legacy.ts",
      name: "legacy",
      dialect: "sqlite",
      columnNames: ["packedKey"],  // 정상이면 위반인데
      compositePkColumns: ["packedKey"],
      hasUniqueOnCoord: false,
      isExempt: true,
      exemptReason: "운영 데이터 보존, 2026Q3 이행 예정",
      lineNumber: 1,
    }];
    expect(checkCoordinateStorage(tables)).toEqual([]);
  });

  it("aggregate 테이블 (prefix_id PK + version 컬럼) → 통과", () => {
    // key_observation_prefixes 패턴
    const tables: ScannedTable[] = [{
      filePath: "agg.ts",
      name: "prefix_aggregates",
      dialect: "sqlite",
      columnNames: ["prefixId", "version", "distinctKeys", "totalCount"],
      compositePkColumns: ["prefixId", "version"],
      hasUniqueOnCoord: false,
      isExempt: false,
      lineNumber: 1,
    }];
    expect(checkCoordinateStorage(tables)).toEqual([]);
  });
});
```

- [ ] **Step 2: 테스트 실행 → 실패**

```bash
cd /Users/junwoobang/workflow/qa-sdk/packages/definition-catalog && pnpm test -- coordinate-storage-check
```

Expected: FAIL — 모듈 없음.

---

## Task 2: 검출 모듈 구현

**Files:**
- Create: `packages/definition-catalog/src/coordinate-storage-check.ts`
- Modify: `packages/definition-catalog/src/index.ts`

정규식 + 라인 단위 스캔으로 Drizzle 테이블 추출. AST 미사용 (의존 추가 회피, code-references와 동일 패턴).

- [ ] **Step 1: 모듈 구현**

`packages/definition-catalog/src/coordinate-storage-check.ts`:

```ts
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

import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const TABLE_DECL_RE = /\b(sqliteTable|pgTable|mysqlTable)\s*\(\s*"([^"]+)"\s*,\s*\{/g;
const COLUMN_RE = /^\s*([a-zA-Z_][\w$]*)\s*:\s*\w+\s*\(/gm;
const COMPOSITE_PK_RE = /primaryKey\s*\(\s*\{\s*columns:\s*\[([^\]]+)\]/;
const UNIQUE_RE = /uniqueIndex\s*\(\s*"[^"]*"\s*\)\s*\.\s*on\s*\(([^)]+)\)/g;
const EXEMPT_RE = /\/\/\s*@def\.coord-storage-exempt:\s*(.*)$/;

const PREFIX_COL_NAMES = new Set(["prefixId", "prefix_id", "prefix"]);
const VERSION_COL_NAMES = new Set(["version", "ver"]);
const ADDR_COL_NAMES = new Set(["address", "addr"]);
const PACKED_COL_NAMES = new Set(["packedKey", "packed_key", "packedAddress", "packed_address"]);

const IGNORED_DIRS = new Set([
  "node_modules", "dist", ".git", ".next", ".turbo", "coverage", "synced", "__mocks__",
]);

export type DrizzleDialect = "sqlite" | "pg" | "mysql";

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
  | "missing-version"
  | "missing-composite-pk"
  | "missing-prefix";

export interface CoordStorageViolation {
  filePath: string;
  tableName: string;
  lineNumber: number;
  kind: CoordStorageViolationKind;
  message: string;
}

function dialectFromKeyword(kw: string): DrizzleDialect {
  if (kw === "pgTable") return "pg";
  if (kw === "mysqlTable") return "mysql";
  return "sqlite";
}

/**
 * 테이블 선언 직전 줄에 @def.coord-storage-exempt 주석이 있는지 검사.
 * 줄 번호 기준 1줄 위까지만 본다 (블록 위 주석은 별도 처리 안 함).
 */
function findExemptAt(lines: string[], declLineIdx: number): { isExempt: boolean; reason?: string } {
  // 직전 줄부터 거슬러 올라가며 빈 줄·import문은 건너뛰지 않고, 정확히 인접한 주석만 봄
  for (let i = declLineIdx - 1; i >= 0; i--) {
    const line = lines[i].trim();
    if (line === "") continue;
    if (!line.startsWith("//")) break;  // 주석 블록 끝
    const m = EXEMPT_RE.exec(line);
    if (m && m[1].trim() !== "") {
      return { isExempt: true, reason: m[1].trim() };
    }
    break;  // 다른 주석이면 스킵
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
      if (ch === "{") depth++;
      else if (ch === "}") depth--;
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
    // 단순화: ); 까지 추가 200자 추출
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
      const cols = um[1].split(",").map((c) => c.trim().replace(/^t\./, ""));
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
        kind: "missing-version",
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
        kind: "missing-composite-pk",
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
    try { entries = readdirSync(dir); } catch { continue; }
    for (const name of entries) {
      if (IGNORED_DIRS.has(name)) continue;
      const p = join(dir, name);
      let st;
      try { st = statSync(p); } catch { continue; }
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
  const rootDirs = opts.rootDirs ?? [join(repoRoot, "packages")];
  const allViolations: CoordStorageViolation[] = [];

  for (const root of rootDirs) {
    for (const file of walkTsFiles(root)) {
      let source: string;
      try { source = readFileSync(file, "utf8"); } catch { continue; }
      // 빠른 스킵: drizzle-orm을 import 안 하면 패스
      if (!source.includes("sqliteTable") && !source.includes("pgTable") && !source.includes("mysqlTable")) {
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
```

- [ ] **Step 2: index.ts에 export 추가**

`packages/definition-catalog/src/index.ts` 끝에:

```ts
export {
  parseDrizzleTables,
  checkCoordinateStorage,
  scanCoordinateStorage,
  type CoordStorageViolation,
  type CoordStorageViolationKind,
  type CoordStorageScanOptions,
  type ScannedTable,
  type DrizzleDialect,
} from "./coordinate-storage-check.js";
```

- [ ] **Step 3: 테스트 실행 → 통과**

```bash
cd /Users/junwoobang/workflow/qa-sdk/packages/definition-catalog && pnpm test -- coordinate-storage-check
```

Expected: 12 tests PASS (parse 4 + check 8 — 정확한 카운트는 실행 시 확인).

- [ ] **Step 4: typecheck**

```bash
cd /Users/junwoobang/workflow/qa-sdk/packages/definition-catalog && pnpm typecheck
```

Expected: 에러 없음.

- [ ] **Step 5: 커밋**

```bash
cd /Users/junwoobang/workflow/qa-sdk && git add packages/definition-catalog/src && git commit -m "$(cat <<'EOF'
feat(definition-catalog): coordinate-storage.rule 자동 검출 모듈

Drizzle 스키마 정규식 스캔. 좌표 저장 후보(address+prefix)에 대해
version 컬럼·복합 PK·UNIQUE 검증. exempt 주석으로 opt-out.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: 통합 테스트 — 실제 packages/ 스캔

**Files:**
- Create: `packages/definition-catalog/src/coordinate-storage-check.integration.test.ts`

실제 `packages/` 디렉토리를 스캔해 §4 plan 적용 후 위반 0이 되는지 확인. (만약 §4 plan이 미적용이면 본 테스트가 검출하는 위반이 §4의 정확한 대상이어야 함.)

- [ ] **Step 1: 통합 테스트 작성**

`packages/definition-catalog/src/coordinate-storage-check.integration.test.ts`:

```ts
// @def.boundary definition-catalog-spec
// @def.doc coordinate-storage

import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

import { scanCoordinateStorage } from "./coordinate-storage-check.js";

describe("coordinate-storage 자동 검출 — packages/ 통합 스캔", () => {
  const REPO_ROOT = resolve(__dirname, "../../..");

  it("packages/ 전체에 위반이 없거나, 모든 위반은 명시적 exempt 또는 backlog에 등록되어 있다", () => {
    const violations = scanCoordinateStorage({ repoRoot: REPO_ROOT });

    // 위반이 있다면 콘솔에 상세 출력 (CI에서 진단 도움)
    if (violations.length > 0) {
      console.log("[coord-storage 위반]");
      for (const v of violations) {
        console.log(`  ${v.filePath}:${v.lineNumber} (${v.tableName}) — ${v.kind}: ${v.message}`);
      }
    }

    // 본 테스트는 §4 plan 완료 후 통과해야 한다.
    // §4 plan 미완료 시: key_observations + key_observation_prefixes 위반 발생 → 본 테스트는 정상 fail.
    expect(violations).toEqual([]);
  });
});
```

- [ ] **Step 2: 테스트 실행**

```bash
cd /Users/junwoobang/workflow/qa-sdk/packages/definition-catalog && pnpm test -- coordinate-storage-check.integration
```

**예상 시나리오 분기**:

- §4 plan 적용 완료 상태 → PASS (위반 0)
- §4 plan 미적용 상태 → FAIL with `key_observations`/`key_observation_prefixes` 위반 출력

후자라면 본 plan은 검출 모듈은 완성됐지만 통합 테스트는 §4 완료 전까지 보류 상태. 두 가지 선택:

1. **§4를 먼저 완료** — 권장 (의존 그래프상 §4가 본 plan의 검출 정확성 검증)
2. **임시 exempt 주석을 §4 대상 테이블에 추가** — fallback. 이 경우 PR 메시지에 §4 backlog 명시.

본 plan은 옵션 1을 가정하고 진행. 그렇지 않으면 다음 step 전에 §4 plan 우선 실행.

- [ ] **Step 3: 커밋**

```bash
cd /Users/junwoobang/workflow/qa-sdk && git add packages/definition-catalog/src && git commit -m "$(cat <<'EOF'
test(definition-catalog): coordinate-storage 통합 스캔 — packages/ 전체 검증

§4 plan(ingest version 분리) 적용 완료 시 위반 0 검증.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 4: `validate.ts`에 `coordinate-storage-violation` issue type 통합

**Files:**
- Modify: `packages/definition-catalog/src/validate.ts`

`validateGraph`는 문서 그래프 전용이지만 `def validate` CLI는 코드 차원 검사도 합칠 수 있음. `validateGraph` 시그니처에 `codeChecks` 옵션 추가, `cmdValidate`가 호출 시 `scanCoordinateStorage` 결과를 issues에 합산.

- [ ] **Step 1: ValidationIssue.type에 새 항목 추가**

`packages/definition-catalog/src/validate.ts` line 24-39 수정:

```ts
  readonly type:
    | "broken-link" | "circular-ref" | "self-ref" | "orphan"
    | "missing-purpose" | "short-purpose"
    | "multi-parent" | "contains-depth-violation"
    | "level-violation"
    | "broken-code-reference"
    | "invalid-code-boundary"
    | "ambiguous-code-boundary"
    | "inconsistent-code-boundary"
    | "duplicate-coordinate"
    | "system-contains-system"
    | "invalid-lifecycle-ref"
    | "invalid-type-classification"
    | "missing-owner-system"
    | "invalid-hierarchy-classification"
    | "owner-root-mismatch"
    | "coordinate-storage-violation";
```

- [ ] **Step 2: `validateGraph`에 옵션 인자 추가**

```ts
export interface ValidateGraphOptions {
  /** true면 packages/ 스캔으로 coordinate-storage 위반도 검사 */
  includeCoordStorageCheck?: boolean;
  /** scan 루트 (기본 process.cwd()/packages) */
  repoRoot?: string;
}

export function validateGraph(
  registry: MemoryDefinitionRegistry,
  options: ValidateGraphOptions = {},
): ValidationResult {
  // ... 기존 로직

  // 함수 끝 부분, errors/warnings 집계 직전에 추가:
  if (options.includeCoordStorageCheck) {
    const { scanCoordinateStorage } = require("./coordinate-storage-check.js");
    const coordViolations = scanCoordinateStorage({ repoRoot: options.repoRoot });
    for (const v of coordViolations) {
      issues.push({
        severity: "error",
        type: "coordinate-storage-violation",
        docId: `${v.filePath}:${v.lineNumber}`,
        message: `[${v.tableName}] ${v.message}`,
      });
    }
  }

  // 기존 errors/warnings 집계
  const errors = issues.filter((i) => i.severity === "error").length;
  const warnings = issues.filter((i) => i.severity === "warning").length;
  return { issues, errors, warnings, passed: errors === 0 };
}
```

**주의**: ESM에서 `require`는 사용 불가. 대신 top-level static import:

```ts
import { scanCoordinateStorage } from "./coordinate-storage-check.js";
```

순환 의존 위험 없는지 확인. `coordinate-storage-check.ts`는 `validate.ts`를 import하지 않으므로 OK.

- [ ] **Step 3: 기존 `validateGraph` 호출처 점검**

```bash
cd /Users/junwoobang/workflow/qa-sdk && grep -rn "validateGraph(" packages --include="*.ts" | grep -v test | grep -v ".d.ts"
```

호출처 목록 확인. 추가 인자가 optional이므로 기존 호출은 수정 불필요. CLI(`cmdValidate`)에서만 옵션 추가.

- [ ] **Step 4: typecheck**

```bash
cd /Users/junwoobang/workflow/qa-sdk && pnpm --filter definition-catalog typecheck
```

Expected: 에러 없음.

- [ ] **Step 5: 기존 validate 테스트 회귀 확인**

```bash
cd /Users/junwoobang/workflow/qa-sdk && pnpm --filter definition-catalog test
```

Expected: 모두 통과 (옵션 추가는 backward-compat).

- [ ] **Step 6: 커밋**

```bash
cd /Users/junwoobang/workflow/qa-sdk && git add packages/definition-catalog/src/validate.ts && git commit -m "$(cat <<'EOF'
feat(definition-catalog): validateGraph에 coordinate-storage-check 옵션 통합

ValidationIssue 타입에 coordinate-storage-violation 추가.
includeCoordStorageCheck 옵션으로 packages/ 스캔 활성화.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 5: CLI `def validate`에서 자동 활성화

**Files:**
- Modify: `packages/cli/src/commands/def.ts`

`cmdValidate`가 `validateGraph`를 호출할 때 `includeCoordStorageCheck: true` 자동 전달. 옵션 플래그(`--no-code-checks`)로 비활성화 가능.

- [ ] **Step 1: cmdValidate 수정 (line ~1404, ~1619)**

`packages/cli/src/commands/def.ts`의 `cmdValidate` 함수 (또는 호출 지점):

```ts
async function cmdValidate(source: DefDataSource, options: { skipCodeChecks?: boolean } = {}): Promise<void> {
  const result = await source.validate({
    includeCoordStorageCheck: !options.skipCodeChecks,
    repoRoot: process.cwd(),
  });
  // ... 기존 출력 로직
}
```

**주의**: 위 시그니처 변경은 `DefDataSource.validate`의 contract 변경. `data-source.ts`의 인터페이스도 함께 갱신:

```ts
// packages/definition-catalog/src/data-source.ts
export interface DefDataSource {
  validate(options?: ValidateGraphOptions): Promise<ValidationResult>;
  // ... 기존 메서드
}
```

구현체(MemoryDataSource, HttpDataSource 등)도 옵션 통과 처리.

`HttpDataSource`는 def-svc API를 호출하므로 코드 스캔이 의미 없음 — 서버 사이드는 옵션 무시:

```ts
class HttpDataSource implements DefDataSource {
  async validate(_options?: ValidateGraphOptions) {
    // 서버에서는 코드 스캔 안 함 (서버는 docs/만 봄)
    const res = await this.fetch("/validate");
    return res;
  }
}
```

`MemoryDataSource`(local SQLite + 코드 스캔 가능)에서만 옵션을 `validateGraph`에 전달.

- [ ] **Step 2: CLI argv parsing — `--no-code-checks` 추가**

CLI 진입점에서 flag 추출. 기본은 활성화 (오작동 방지를 위해 명시 비활성화).

- [ ] **Step 3: typecheck + 빌드**

```bash
cd /Users/junwoobang/workflow/qa-sdk && pnpm --filter definition-catalog --filter @qa-sdk/cli build
```

Expected: 에러 없음.

- [ ] **Step 4: 실제 `def validate` 실행**

```bash
cd /Users/junwoobang/workflow/qa-sdk && node packages/cli/dist/index.js def validate
```

**기대 동작**:
- §4 plan 적용 완료 시: errors=0, warnings는 문서 그래프 워닝만
- §4 plan 미적용 시: errors >= 2 (key_observations + key_observation_prefixes)

후자라면 다음 두 옵션 중 선택:

1. §4 plan 먼저 실행 (권장)
2. `--no-code-checks` 옵션으로 임시 우회 + §4 플랜 우선순위 상향

- [ ] **Step 5: 커밋**

```bash
cd /Users/junwoobang/workflow/qa-sdk && git add packages/cli/src packages/definition-catalog/src && git commit -m "$(cat <<'EOF'
feat(cli): def validate가 coordinate-storage-check 자동 실행

기본 활성화. --no-code-checks로 비활성화 가능.
DefDataSource.validate가 ValidateGraphOptions 받음.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 6: rule 문서 갱신 + PR 체크리스트

**Files:**
- Modify: `docs/specs/system/coordinate-storage.rule.md`
- Create: `docs/proposals/auth-model-implementation-backlog/coordinate-storage-pr-checklist.md`

- [ ] **Step 1: rule §5 검증 섹션 갱신**

`docs/specs/system/coordinate-storage.rule.md` §5 추가:

```markdown
## 5. 검증

- 새 좌표 저장 스키마 PR은 본 규칙 참조 필수
- `def validate`가 자동 검출 — Drizzle 스키마에서 `address`/`packedKey` + `prefix_id`가 함께 있으면 좌표 저장 후보로 판정, `(prefix_id, version, address|packed_key)` 복합 PK/UNIQUE 강제. 위반은 CI gate 실패.
- opt-out: 테이블 선언 직전 `// @def.coord-storage-exempt: <사유>` 주석 1줄. 사유 비어있으면 인정 안 됨.
- 저장 스키마 변경 시 관련 ADR 또는 plan 문서 갱신
```

- [ ] **Step 2: PR 체크리스트 문서 작성**

`docs/proposals/auth-model-implementation-backlog/coordinate-storage-pr-checklist.md`:

```markdown
# 좌표 저장 PR 체크리스트

새 테이블이 좌표를 저장하는가? 다음을 확인:

- [ ] `prefix_id` + `version` + `address`(또는 `packed_key`) 컬럼이 모두 있는가
- [ ] PK 또는 UNIQUE 제약이 위 3 컬럼 조합인가
- [ ] `def validate` 통과 (coordinate-storage-violation 0건)
- [ ] 좌표 쓰기·읽기 코드가 `(prefix_id, version)`을 항상 명시하는가
- [ ] 좌표 저장이 아니라면 `// @def.coord-storage-exempt: <명확한 사유>` 추가

근거: `docs/specs/system/coordinate-storage.rule.md`
```

- [ ] **Step 3: def sync로 rule 변경 반영**

```bash
cd /Users/junwoobang/workflow/qa-sdk && pnpm --filter @qa-sdk/cli def sync
```

- [ ] **Step 4: 커밋**

```bash
cd /Users/junwoobang/workflow/qa-sdk && git add docs && git commit -m "$(cat <<'EOF'
docs(coordinate-storage): 자동 검출 정책 추가 + PR 체크리스트

rule §5에 def validate 자동화 명시. opt-out 주석 컨벤션 추가.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 7: 회귀·gate 검증

- [ ] **Step 1: 영향 패키지 빌드**

```bash
cd /Users/junwoobang/workflow/qa-sdk && pnpm --filter definition-catalog --filter @qa-sdk/cli build
```

- [ ] **Step 2: 영향 패키지 테스트**

```bash
cd /Users/junwoobang/workflow/qa-sdk && pnpm --filter definition-catalog --filter @qa-sdk/cli test
```

- [ ] **Step 3: 전체 def gate 시뮬**

```bash
cd /Users/junwoobang/workflow/qa-sdk && node packages/cli/dist/index.js def sync && node packages/cli/dist/index.js def validate
```

Expected: errors=0 (§4 plan 완료 가정).

- [ ] **Step 4: workflow-smoke 회귀**

```bash
cd /Users/junwoobang/workflow/qa-sdk && pnpm --filter @qa-sdk/cli test 2>&1 | tail -20
```

Expected: 전체 CLI 테스트 통과.

---

## Self-Review 체크리스트

- [ ] `parseDrizzleTables`가 sqliteTable/pgTable 모두 검출
- [ ] exempt 주석은 사유 필수, 사유 빈 칸은 인정 안 됨
- [ ] 'address' 컬럼만 있고 prefix가 없으면 좌표 저장 후보 아님 (false positive 회피)
- [ ] aggregate 테이블 (prefix+version PK, address 없음)은 통과
- [ ] UNIQUE 제약이 (prefix, version, addr) 충족하면 PK 미충족이어도 통과
- [ ] `def validate` errors에 coord-storage-violation 합산 (CI gate 실패 가능)
- [ ] HttpDataSource는 서버 측 의미 없는 코드 스캔 옵션 무시
- [ ] rule 문서 §5에 자동화 명시
- [ ] PR 체크리스트 문서 존재

---

## 알려진 한계 (false negative)

| 패턴 | 미검출 사유 | 대응 |
|---|---|---|
| `sqliteTable` 호출이 변수 분기·동적 생성 | 정규식 한계 | 수동 리뷰 또는 AST 기반 검사로 격상 (필요 시) |
| 컬럼 정의가 외부 helper로 묶임 (`...sharedCols`) | 컬럼 객체 직접 매핑이 아님 | helper 펼친 후 검사하는 분석기 추가 (현재 미지원) |
| 복합 PK가 `index().on()`로 흉내 (UNIQUE 아닌 INDEX) | INDEX는 PK 보장 아님 — 정확히 거부 | 의도된 — INDEX는 검증 통과로 안 봄 |
| ClickHouse·raw SQL 직접 작성 | Drizzle 외 스토리지 미지원 | clickhouse-schema.sql.ts 등은 별도 점검 (Task 8 defer) |

---

## Defer

| 작업 | 사유 | 재개 트리거 |
|---|---|---|
| ClickHouse raw SQL 검사 | Drizzle 외 — 별도 파서 필요 | ClickHouse 운영 도입 + 스키마 안정화 |
| AST 기반 분석으로 격상 | 현 정규식 휴리스틱이 false positive 0, false negative 일부 — 실제 누락 사례 발생 시 격상 검토 | 미검출 위반 사례 보고 |
| `address_context` JSON 사용 지점 검사 (event_records 등) | 별도 기준 (zod 스키마 사용) — §4에서 다룸 | §4 완료 |
| GitHub Actions PR template 자동 주입 | 본 plan은 docs로만 안내. 실제 `.github/PULL_REQUEST_TEMPLATE.md` 채택은 별도 결정 | 팀 협의 |

---

## 의존·후속

- **§4 Ingest audit**: 본 plan의 통합 테스트(Task 3)가 §4 완료를 가정. §4 미완료 상태에서 본 plan 실행 시 위반 검출되어 통합 테스트 fail (정상 동작이며 §4 우선 완료가 옳은 응답).
- **Phase 2 PG 이행**: PG 이행 후 `pgTable` 테이블이 본 검사 대상에 자연스럽게 포함됨. 추가 작업 없음.
- **Phase 4 시뮬 프로젝트**: 시뮬 프로젝트의 권한 테이블이 본 규칙을 따라야 함. plan 작성 단계에서 미리 적용하면 위반 없이 진행.
