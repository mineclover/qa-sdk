// @def.boundary qa-sdk-core-system
// @def.doc qa-sdk-core-system

/**
 * AST 파서 포트 — 코드에서 구조적 사실을 추출하는 추상 계층.
 *
 * "판단은 LLM, 사실은 파서" 원칙의 파서 측.
 * 실제 TypeScript Compiler API 의존은 구현체에서.
 * 테스트 시 mock 교체 가능.
 */

// ── 구조적 사실 타입 ──────────────────────────────────

/** 파일 내 함수/메서드 목록 */
export interface FunctionInfo {
  /** 함수 식별자 (클래스.메서드 또는 함수명) */
  readonly id: string;
  readonly filePath: string;
  readonly line: number;
  readonly kind: "function" | "method" | "arrow";
  /** 입력 파라미터 타입 */
  readonly params: readonly ParamInfo[];
  /** 반환 타입 (문자열) */
  readonly returnType: string;
  /** 함수 앞 주석 (마커 힌트 추출용) */
  readonly leadingComment: string;
  /** 함수 본문 코드 (LLM 판단 입력용) */
  readonly body: string;
}

export interface ParamInfo {
  readonly name: string;
  readonly type: string;
  readonly optional: boolean;
}

/** 함수 내 조건문 (분기 후보) */
export interface ConditionalInfo {
  /** 소속 함수 ID */
  readonly functionId: string;
  readonly line: number;
  readonly kind: "if" | "switch" | "ternary" | "logical-or" | "nullish-coalesce";
  /** 조건식 텍스트 */
  readonly conditionText: string;
  /** switch의 case 수 또는 if/else 분기 수 */
  readonly branchCount: number;
  /** 각 분기의 라벨 (switch: case 값, if: 조건 설명) */
  readonly branchLabels: readonly string[];
}

/** 타입 정보 (enum/union 멤버 수 세기 등) */
export interface TypeInfo {
  readonly name: string;
  readonly kind: "enum" | "union" | "interface" | "type-alias";
  /** enum 멤버 수 또는 union 멤버 수 */
  readonly memberCount: number;
  /** 멤버 라벨 */
  readonly members: readonly string[];
}

/** 파일 하나의 구조적 사실 전체 */
export interface FileStructure {
  readonly filePath: string;
  readonly functions: readonly FunctionInfo[];
  readonly conditionals: readonly ConditionalInfo[];
  readonly types: readonly TypeInfo[];
  /** import된 모듈 목록 */
  readonly imports: readonly string[];
}

// ── 파서 포트 ─────────────────────────────────────────

/**
 * AST 파서 추상 포트.
 *
 * 구현체: TypeScript Compiler API 기반 (packages/codegen-core 또는 별도)
 * 테스트: mock 구현체로 교체
 */
export interface ParserPort {
  /** 파일 하나의 구조적 사실을 추출한다 */
  parseFile(filePath: string, source: string): FileStructure;
}

// ── Mock 파서 (테스트용) ──────────────────────────────

/**
 * 정규식 기반 간이 파서 — 테스트와 프로토타이핑용.
 * 정확도는 낮지만 TypeScript 의존 없이 동작.
 */
export function createRegexParser(): ParserPort {
  return {
    parseFile(filePath: string, source: string): FileStructure {
      const lines = source.split("\n");
      const functions: FunctionInfo[] = [];
      const conditionals: ConditionalInfo[] = [];
      const types: TypeInfo[] = [];
      const imports: string[] = [];

      // import 추출
      for (const line of lines) {
        const importMatch = line.match(/import\s.*from\s+["']([^"']+)["']/);
        if (importMatch) imports.push(importMatch[1]);
      }

      // 함수 추출
      const funcRe = /^(\s*)(export\s+)?(async\s+)?function\s+(\w+)\s*\(([^)]*)\)(?:\s*:\s*([^\s{]+))?\s*\{/gm;
      let fm: RegExpExecArray | null;
      while ((fm = funcRe.exec(source)) !== null) {
        const line = source.slice(0, fm.index).split("\n").length;
        const id = fm[4];
        const params = parseParams(fm[5]);
        const returnType = fm[6] ?? "void";
        const leadingComment = extractLeadingComment(lines, line - 1);
        const body = extractBody(source, fm.index + fm[0].length - 1);

        functions.push({ id, filePath, line, kind: "function", params, returnType, leadingComment, body });

        // 함수 내 조건문
        conditionals.push(...extractConditionals(id, body, line));
      }

      // 메서드 추출
      const methodRe = /^\s+(async\s+)?(\w+)\s*\(([^)]*)\)(?:\s*:\s*([^\s{]+))?\s*\{/gm;
      let mm: RegExpExecArray | null;
      while ((mm = methodRe.exec(source)) !== null) {
        const line = source.slice(0, mm.index).split("\n").length;
        const id = mm[2];
        if (id === "if" || id === "for" || id === "while" || id === "switch" || id === "constructor") continue;
        const params = parseParams(mm[3]);
        const returnType = mm[4] ?? "void";
        const leadingComment = extractLeadingComment(lines, line - 1);
        const body = extractBody(source, mm.index + mm[0].length - 1);

        functions.push({ id, filePath, line, kind: "method", params, returnType, leadingComment, body });
        conditionals.push(...extractConditionals(id, body, line));
      }

      // enum/union 추출
      const enumRe = /enum\s+(\w+)\s*\{([^}]+)\}/g;
      let em: RegExpExecArray | null;
      while ((em = enumRe.exec(source)) !== null) {
        const members = em[2].split(",").map(m => m.trim().split(/\s*=/)[0]).filter(Boolean);
        types.push({ name: em[1], kind: "enum", memberCount: members.length, members });
      }

      const unionRe = /type\s+(\w+)\s*=\s*([^;]+);/g;
      let um: RegExpExecArray | null;
      while ((um = unionRe.exec(source)) !== null) {
        if (um[2].includes("|")) {
          const members = um[2].split("|").map(m => m.trim().replace(/^["']|["']$/g, "")).filter(Boolean);
          types.push({ name: um[1], kind: "union", memberCount: members.length, members });
        }
      }

      return { filePath, functions, conditionals, types, imports };
    },
  };
}

// ── 파싱 헬퍼 ─────────────────────────────────────────

function parseParams(raw: string): ParamInfo[] {
  if (!raw.trim()) return [];
  return raw.split(",").map(p => {
    const parts = p.trim().split(/\s*:\s*/);
    const name = parts[0].replace("?", "").trim();
    const optional = parts[0].includes("?");
    const type = parts[1] ?? "unknown";
    return { name, type, optional };
  });
}

function extractLeadingComment(lines: string[], endLine: number): string {
  const commentLines: string[] = [];
  for (let i = endLine - 1; i >= Math.max(0, endLine - 15); i--) {
    const line = lines[i].trim();
    if (line.startsWith("*") || line.startsWith("/**") || line.startsWith("//") || line.startsWith("*/")) {
      commentLines.unshift(lines[i]);
    } else {
      break;
    }
  }
  return commentLines.join("\n");
}

function extractBody(source: string, openBrace: number): string {
  let depth = 1;
  let i = openBrace + 1;
  while (i < source.length && depth > 0) {
    if (source[i] === "{") depth++;
    else if (source[i] === "}") depth--;
    i++;
  }
  return source.slice(openBrace + 1, i - 1);
}

function extractConditionals(functionId: string, body: string, baseLine: number): ConditionalInfo[] {
  const result: ConditionalInfo[] = [];
  const bodyLines = body.split("\n");

  for (let i = 0; i < bodyLines.length; i++) {
    const line = bodyLines[i].trim();

    // if/else if 체인
    if (/^if\s*\(/.test(line)) {
      const condMatch = line.match(/^if\s*\((.+?)\)/);
      let branchCount = 2; // if + else
      // else if 카운트
      for (let j = i + 1; j < bodyLines.length; j++) {
        if (/^\s*}\s*else\s+if\s*\(/.test(bodyLines[j])) branchCount++;
        else if (/^\s*}\s*else\s*\{/.test(bodyLines[j])) break;
        else if (/^\s*}/.test(bodyLines[j]) && !/else/.test(bodyLines[j])) break;
      }
      result.push({
        functionId,
        line: baseLine + i,
        kind: "if",
        conditionText: condMatch?.[1] ?? "",
        branchCount,
        branchLabels: [],
      });
    }

    // switch — i행 이후의 body만 검색 (O(L²) → O(L))
    if (/^switch\s*\(/.test(line)) {
      const rest = bodyLines.slice(i).join("\n");
      const caseCount = rest.match(/\bcase\s+/g)?.length ?? 0;
      const hasDefault = /\bdefault\s*:/.test(rest);
      const labels = [...rest.matchAll(/case\s+["']?([^:"']+)["']?\s*:/g)].map(m => m[1].trim());
      result.push({
        functionId,
        line: baseLine + i,
        kind: "switch",
        conditionText: line.match(/switch\s*\((.+?)\)/)?.[1] ?? "",
        branchCount: caseCount + (hasDefault ? 1 : 0),
        branchLabels: labels,
      });
    }
  }

  return result;
}
