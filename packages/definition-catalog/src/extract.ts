/**
 * 문서 본문에서 마커 기반 요약 추출
 *
 * 작성자가 줄 끝에 ^marker를 붙여 추출 수준을 명시한다.
 *
 * 마커:
 *   ^purpose  — 이 문서가 무엇을 하는가 (목적 1줄)
 *   ^overview — 개요 수준에서 보여줄 내용
 *   (마커 없음 = detail — 전체에서만 보임)
 *
 * 사용법:
 *   ```markdown
 *   > RPC 엔드포인트 명세. ^purpose
 *
 *   ## 엔드포인트 ^overview
 *
 *   ### POST /gate/check
 *   ...상세 내용...
 *   ```
 *
 * 추출:
 *   level="purpose"  → ^purpose 마킹된 줄만
 *   level="overview" → ^purpose + ^overview 마킹된 줄/섹션
 *   level="full"     → 전체 (마커 제거)
 */

/** 추출 수준 */
export type ExtractLevel = "purpose" | "overview" | "full";

/** 마커 유형 */
export type Marker = "purpose" | "overview";

const MARKER_REGEX = /\s*\^(purpose|overview)\s*$/;

/** 마커가 포함된 줄 1건 */
export interface MarkedLine {
  /** 원본 줄 (마커 제거) */
  readonly text: string;
  /** 마커 유형 */
  readonly marker: Marker;
  /** 원본 줄 번호 (0-based) */
  readonly line: number;
}

/**
 * 본문에서 마커가 붙은 줄을 모두 추출한다.
 */
export function findMarkers(body: string): readonly MarkedLine[] {
  const lines = body.split("\n");
  const result: MarkedLine[] = [];

  for (let i = 0; i < lines.length; i++) {
    const match = lines[i].match(MARKER_REGEX);
    if (match) {
      result.push({
        text: lines[i].replace(MARKER_REGEX, "").trimEnd(),
        marker: match[1] as Marker,
        line: i,
      });
    }
  }

  return result;
}

/** 추출 결과 */
export interface ExtractResult {
  /** 추출 수준 */
  readonly level: ExtractLevel;
  /** 추출된 줄들 */
  readonly lines: readonly string[];
  /** 합쳐진 텍스트 */
  readonly text: string;
  /** 마커가 하나도 없었는가 */
  readonly noMarkers: boolean;
}

/**
 * 본문에서 지정된 수준의 내용을 추출한다.
 *
 * - "purpose": ^purpose 마킹된 줄만
 * - "overview": ^purpose + ^overview 마킹된 줄
 * - "full": 전체 (마커 표기만 제거)
 */
export function extractByLevel(body: string, level: ExtractLevel): ExtractResult {
  const markers = findMarkers(body);

  if (level === "full") {
    // 마커 표기만 제거하고 전체 반환
    const cleaned = body.replace(/\s*\^(purpose|overview)\s*$/gm, "");
    return {
      level,
      lines: cleaned.split("\n"),
      text: cleaned,
      noMarkers: markers.length === 0,
    };
  }

  const allowedMarkers: readonly Marker[] =
    level === "purpose" ? ["purpose"] : ["purpose", "overview"];

  const filtered = markers
    .filter(m => (allowedMarkers as readonly string[]).includes(m.marker))
    .map(m => m.text);

  return {
    level,
    lines: filtered,
    text: filtered.join("\n"),
    noMarkers: markers.length === 0,
  };
}

/** 문서 요약 */
export interface DocumentSummary {
  readonly id: string;
  readonly scope: string;
  readonly aspect: string;
  readonly depth: string;
  readonly title: string;
  readonly purpose: string | null;
  readonly overview: readonly string[];
}

/**
 * 파싱된 문서에서 요약을 추출한다.
 */
export function summarizeDocument(
  id: string,
  scope: string,
  aspect: string,
  depth: string,
  title: string,
  body: string,
): DocumentSummary {
  const markers = findMarkers(body);
  const purposeLines = markers.filter(m => m.marker === "purpose").map(m => m.text);
  const overviewLines = markers.filter(m => m.marker === "overview").map(m => m.text);

  return {
    id,
    scope,
    aspect,
    depth,
    title,
    purpose: purposeLines.length > 0 ? purposeLines.join(" ") : null,
    overview: overviewLines,
  };
}
