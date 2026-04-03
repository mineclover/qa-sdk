/**
 * 테스트 토큰 파생 — spec 문서 또는 소스 모듈에서 testName 토큰 추출.
 *
 * spec의 ^defines 섹션에서 함수 목록,
 * 소스 모듈의 export에서 함수명,
 * StepDataContract에서 facet 후보를 파생.
 */

import { readFileSync, existsSync, readdirSync, lstatSync } from "node:fs";
import { resolve, join } from "node:path";

// ── 타입 ──────────────────────────────────────────

export interface TestTokens {
  /** 소스 모듈명 */
  module: string;
  /** spec id */
  specId: string;
  /** spec ^defines에서 추출한 함수 목록 */
  functions: string[];
}

// ── spec에서 파생 ───────────────────────────────────

const SPEC_ROOT = "docs/specs";

/**
 * spec id에서 테스트 토큰을 파생한다.
 *
 * 1. spec 파일 탐색 ({id}.spec.md)
 * 2. ^defines 섹션에서 함수명 추출 (테이블의 backtick 코드)
 * 3. module명 파생 (id에서 공통 접두사 제거)
 */
export function deriveTestTokens(specId: string, rootDir = "."): TestTokens | null {
  const specFile = findSpecFile(specId, rootDir);
  if (!specFile) return null;

  const content = readFileSync(specFile, "utf8");
  const functions = extractFunctionsFromDefines(content);
  const module = deriveModuleName(specId);

  return { module, specId, functions };
}

/** spec 파일 탐색 — docs/specs/ 하위 재귀 */
function findSpecFile(specId: string, rootDir: string): string | null {
  const target = `${specId}.spec.md`;
  const specsDir = resolve(rootDir, SPEC_ROOT);
  if (!existsSync(specsDir)) return null;
  return findFileRecursive(specsDir, target);
}

function findFileRecursive(dir: string, target: string, depth = 0): string | null {
  if (depth > 8) return null; // 재귀 깊이 제한
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (entry === target) return full;
    const stat = lstatSync(full);
    if (stat.isDirectory() && !stat.isSymbolicLink()) {
      const found = findFileRecursive(full, target, depth + 1);
      if (found) return found;
    }
  }
  return null;
}

/** ^defines 섹션에서 backtick 함수명 추출 */
function extractFunctionsFromDefines(content: string): string[] {
  // ^defines 이후 ~ 다음 ## (h2) 또는 ^마커 이전까지 (### h3는 ^defines 내부이므로 포함)
  const definesMatch = content.match(/\^defines[\s\S]*?(?=\n## [^#]|\n\^[a-z]|$)/);
  if (!definesMatch) return [];

  // ^defines 내 API 테이블만 추출 (### 공개 API / ### 함수 같은 h3 ~ 다음 ### 까지)
  const section = definesMatch[0];
  const apiSection = section.match(/###.*(?:API|함수)[\s\S]*?(?=\n###|$)/)?.[0] ?? section;

  // backtick 함수명 추출 — 테이블 셀 내 `/` 구분 다중 함수도 캡처
  const fnPattern = /`(\w+)\s*(?:\([^)]*\))?`/g;
  const fns = new Set<string>();
  let m;
  while ((m = fnPattern.exec(apiSection)) !== null) {
    const name = m[1];
    // 타입명(대문자 시작), 상수(전부 대문자) 제외
    if (name && /^[a-z]/.test(name) && !/^[A-Z_]+$/.test(name)) {
      fns.add(name);
    }
  }
  return [...fns];
}

/** spec id에서 모듈명 파생 — meta-semantic- 접두사 제거 */
function deriveModuleName(specId: string): string {
  return specId.replace(/^meta-semantic-/, "");
}
