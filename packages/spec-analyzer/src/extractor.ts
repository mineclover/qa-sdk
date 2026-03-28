/**
 * 마크다운에서 선언 심볼을 추출한다.
 *
 * ^api-surface, ^inputs 등 계약 마커 섹션의 코드 블록에서
 * 엔드포인트, 함수, 타입, 클래스를 추출한다.
 */
import type { DeclaredSymbol, SymbolKind } from "./types.js";

/** HTTP method 패턴: GET /path, POST /path 등 */
const ENDPOINT_RE = /^\s*(GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS)\s+(\/\S+)/gm;

/** 함수 시그니처: functionName(args) 또는 functionName<T>(args) */
const FUNCTION_RE = /^\s*(\w+)\s*(?:<[^>]*>)?\s*\(/gm;

/** interface/type/class 정의 */
const TYPE_RE = /^\s*(?:export\s+)?(?:interface|type|class)\s+(\w+)/gm;

function extractFromCodeBlock(code: string, specId: string, marker?: string): DeclaredSymbol[] {
  const symbols: DeclaredSymbol[] = [];
  const seen = new Set<string>();

  // 엔드포인트
  for (const match of code.matchAll(ENDPOINT_RE)) {
    const name = `${match[1]} ${match[2]}`;
    if (!seen.has(name)) {
      seen.add(name);
      symbols.push({ name, kind: "endpoint", marker, specId });
    }
  }

  // 타입/클래스 (함수보다 먼저 — 같은 이름이면 타입 우선)
  for (const match of code.matchAll(TYPE_RE)) {
    const name = match[1]!;
    if (!seen.has(name)) {
      seen.add(name);
      const kind: SymbolKind = code.includes(`class ${name}`) ? "class" : "type";
      symbols.push({ name, kind, marker, specId });
    }
  }

  // 함수 (타입/클래스와 겹치지 않는 것만)
  for (const match of code.matchAll(FUNCTION_RE)) {
    const name = match[1]!;
    // 예약어 제외
    if (["if", "for", "while", "switch", "return", "new", "throw", "catch", "import", "export", "readonly"].includes(name)) continue;
    if (!seen.has(name)) {
      seen.add(name);
      symbols.push({ name, kind: "function", marker, specId });
    }
  }

  return symbols;
}

/** 마크다운에서 마커 섹션의 코드 블록을 추출한다 */
function extractMarkerCodeBlocks(markdown: string): { marker: string; code: string }[] {
  const results: { marker: string; code: string }[] = [];
  const markerSectionRe = /^##\s+.*?\^(\S+)\s*$/gm;
  const codeBlockRe = /```(?:typescript|ts)?\s*\n([\s\S]*?)```/g;

  const sections: { marker: string; start: number; end: number }[] = [];
  for (const match of markdown.matchAll(markerSectionRe)) {
    sections.push({
      marker: match[1]!,
      start: match.index!,
      end: markdown.length,
    });
  }
  // 각 섹션의 끝 = 다음 섹션의 시작
  for (let i = 0; i < sections.length - 1; i++) {
    sections[i]!.end = sections[i + 1]!.start;
  }

  for (const section of sections) {
    const sectionText = markdown.slice(section.start, section.end);
    for (const codeMatch of sectionText.matchAll(codeBlockRe)) {
      results.push({ marker: section.marker, code: codeMatch[1]! });
    }
  }

  return results;
}

/**
 * 마크다운 문서에서 선언된 심볼을 추출한다.
 */
export function extractDeclarations(markdown: string, specId: string): DeclaredSymbol[] {
  const blocks = extractMarkerCodeBlocks(markdown);
  const symbols: DeclaredSymbol[] = [];
  for (const { marker, code } of blocks) {
    symbols.push(...extractFromCodeBlock(code, specId, marker));
  }
  return symbols;
}
