// @def.doc definition-extraction

/**
 * 문서 본문에서 마커 기반 요약 추출
 *
 * 헤더에 ^marker를 붙이면 해당 섹션 전체가 추출 대상이 된다.
 * 작성자가 요약할 내용을 섹션으로 명시적으로 작성한다.
 *
 * 마커:
 *   ^purpose  — 이 문서의 목적 (섹션 분량)
 *   ^overview — 개요 수준에서 보여줄 핵심 사실 (섹션 분량)
 *
 * 사용법:
 *   ```markdown
 *   # Gate Service API 계약
 *
 *   ## 목적 ^purpose
 *
 *   RPC 엔드포인트 명세. 요청/응답 스키마와 에러 코드를 정의한다.
 *   모든 호출은 서비스 간 내부 전용이다.
 *
 *   ## 구성 ^overview
 *
 *   6개 RPC: check, classify, getState, recompute, cascadeRecompute, filterRanges
 *   에러 코드: NOT_FOUND, NOT_COMPUTED, STALE_CACHE
 *
 *   ## 엔드포인트
 *   ...상세...
 *   ```
 *
 * 추출:
 *   level="purpose"  → ^purpose 섹션 본문만
 *   level="overview" → ^purpose + ^overview 섹션 본문
 *   level="full"     → 전체 (마커 표기만 제거)
 */

/** 추출 수준 (표준 마커 기반) */
export type ExtractLevel = 'purpose' | 'overview' | 'full';

/** 표준 마커 유형 */
export type StandardMarker = 'purpose' | 'overview';

/**
 * 마커 유형.
 * purpose/overview가 표준이고, 그 외 자유 마커(constraint, state-def 등)도 허용.
 */
export type Marker = string;

/** 자유 마커를 포함하는 정규식: ^word 또는 ^word-word */
const MARKER_REGEX = /\s*\^([a-z][a-z0-9-]*)\s*$/;

/** 마커가 붙은 섹션 */
export interface MarkedSection {
  /** 헤더 텍스트 (마커 제거, ## 포함) */
  readonly header: string;
  /** 마커 유형 */
  readonly marker: Marker;
  /** 헤더의 레벨 (# = 1, ## = 2, ### = 3) */
  readonly level: number;
  /** 섹션 본문 (헤더 아래 ~ 다음 동급/상위 헤더 전까지) */
  readonly body: string;
  /** 헤더 줄 번호 (0-based) */
  readonly line: number;
}

/** 마커가 포함된 줄 1건 (하위 호환) */
export interface MarkedLine {
  readonly text: string;
  readonly marker: Marker;
  readonly line: number;
}

/**
 * 헤더의 레벨을 반환한다. 헤더가 아니면 0.
 */
function headingLevel(line: string): number {
  const match = line.match(/^(#{1,6})\s/);
  return match ? match[1].length : 0;
}

function isFenceToggle(line: string): boolean {
  const trimmed = line.trimStart();
  return trimmed.startsWith('```') || trimmed.startsWith('~~~');
}

/**
 * 본문에서 마커가 붙은 섹션을 모두 추출한다.
 *
 * 헤더에 ^marker가 있으면, 그 헤더 아래의 본문을
 * 다음 동급/상위 헤더가 나올 때까지 수집한다.
 */
export function findMarkedSections(body: string): readonly MarkedSection[] {
  const lines = body.split('\n');
  const result: MarkedSection[] = [];
  let inFence = false;

  for (let i = 0; i < lines.length; i++) {
    if (isFenceToggle(lines[i])) {
      inFence = !inFence;
      continue;
    }
    if (inFence) continue;

    const match = lines[i].match(MARKER_REGEX);
    if (!match) continue;

    const marker = match[1] as Marker;
    const header = lines[i].replace(MARKER_REGEX, '').trimEnd();
    const level = headingLevel(header);

    // 헤더가 아닌 줄에 마커가 붙은 경우 (레거시 호환: 줄 자체를 본문으로)
    if (level === 0) {
      result.push({ header: '', marker, level: 0, body: header, line: i });
      continue;
    }

    // 섹션 본문 수집: 다음 동급/상위 헤더 전까지
    const bodyLines: string[] = [];
    let inSectionFence = false;
    for (let j = i + 1; j < lines.length; j++) {
      if (isFenceToggle(lines[j])) {
        inSectionFence = !inSectionFence;
        bodyLines.push(lines[j]);
        continue;
      }

      const nextLevel = inSectionFence ? 0 : headingLevel(lines[j]);
      if (nextLevel > 0 && nextLevel <= level) break; // 동급 또는 상위 헤더
      bodyLines.push(lines[j]);
    }

    // 앞뒤 빈 줄 제거
    while (bodyLines.length > 0 && bodyLines[0].trim() === '') bodyLines.shift();
    while (bodyLines.length > 0 && bodyLines[bodyLines.length - 1].trim() === '') bodyLines.pop();

    result.push({ header, marker, level, body: bodyLines.join('\n'), line: i });
  }

  return result;
}

/**
 * 하위 호환: 줄 단위 마커도 찾는다.
 */
export function findMarkers(body: string): readonly MarkedLine[] {
  const lines = body.split('\n');
  const result: MarkedLine[] = [];
  for (let i = 0; i < lines.length; i++) {
    const match = lines[i].match(MARKER_REGEX);
    if (match) {
      result.push({
        text: lines[i].replace(MARKER_REGEX, '').trimEnd(),
        marker: match[1] as Marker,
        line: i,
      });
    }
  }
  return result;
}

/** 추출 결과 */
export interface ExtractResult {
  readonly level: ExtractLevel;
  /** 추출된 섹션들 */
  readonly sections: readonly MarkedSection[];
  /** 합쳐진 텍스트 */
  readonly text: string;
  /** 마커가 하나도 없었는가 */
  readonly noMarkers: boolean;
}

/**
 * 본문에서 지정된 수준의 내용을 추출한다.
 *
 * - "purpose": ^purpose 섹션 본문
 * - "overview": ^purpose + ^overview 섹션 본문
 * - "full": 전체 (마커 표기만 제거)
 */
export function extractByLevel(body: string, level: ExtractLevel): ExtractResult {
  const allSections = findMarkedSections(body);

  if (level === 'full') {
    const cleaned = body.replace(/\s*\^([a-z][a-z0-9-]*)\s*$/gm, '');
    return {
      level,
      sections: allSections,
      text: cleaned,
      noMarkers: allSections.length === 0,
    };
  }

  const allowedMarkers: readonly Marker[] =
    level === 'purpose' ? ['purpose'] : ['purpose', 'overview'];

  const filtered = allSections.filter((s) =>
    (allowedMarkers as readonly string[]).includes(s.marker),
  );

  const text = filtered.map((s) => s.body).join('\n\n');

  return {
    level,
    sections: filtered,
    text,
    noMarkers: allSections.length === 0,
  };
}

/**
 * 특정 마커 이름으로 섹션을 추출한다.
 *
 * extractByMarker(body, "constraint") → ^constraint 섹션 본문
 * extractByMarker(body, "state-def") → ^state-def 섹션 본문
 *
 * 표준 마커(purpose, overview)와 자유 마커 모두 사용 가능.
 */
export function extractByMarker(body: string, ...markers: string[]): ExtractResult {
  const allSections = findMarkedSections(body);
  const filtered = allSections.filter((s) => markers.includes(s.marker));
  const text = filtered.map((s) => s.body).join('\n\n');

  return {
    level: 'full',
    sections: filtered,
    text,
    noMarkers: allSections.length === 0,
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
  const sections = findMarkedSections(body);
  const purposeSections = sections.filter((s) => s.marker === 'purpose');
  const overviewSections = sections.filter((s) => s.marker === 'overview');

  return {
    id,
    scope,
    aspect,
    depth,
    title,
    purpose: purposeSections.length > 0 ? purposeSections.map((s) => s.body).join('\n\n') : null,
    overview: overviewSections.map((s) => s.body),
  };
}
