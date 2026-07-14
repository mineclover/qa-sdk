// @def.boundary event-vocab-system
/**
 * track-codegen — 이벤트 카탈로그에서 타입 안전 track() 호출 코드 생성.
 *
 * EventPrefixMapping → TypeScript 함수 스텁 생성.
 * 런타임 autoTrack API의 보완 — 정적 타입 안전성 + 자동완성 제공.
 */

import type { EventPrefixMapping, EventPrefixEntry, DimSource } from './prefix-mapping.js';

// ── 설정 ──────────────────────────────────────────────

export interface TrackCodegenOptions {
  /** 생성 파일 상단 import 경로 (기본: "@qa-sdk/browser-sdk") */
  importFrom?: string;
  /** tracker 변수명 (기본: "qa") */
  trackerVar?: string;
  /** JSDoc 포함 여부 (기본: true) */
  jsdoc?: boolean;
  /** 타임스탬프 헤더 포함 여부 (기본: true) */
  header?: boolean;
}

// ── 코드 생성 ─────────────────────────────────────────

/**
 * EventPrefixMapping 배열에서 TypeScript track 함수 코드를 생성한다.
 *
 * 각 이벤트별로 타입 안전한 wrapper 함수를 생성:
 * ```ts
 * export function trackCartAdd(payload: { item_id: number }) {
 *   qa.track("cart.add", payload);
 * }
 * ```
 */
export function generateTrackCode(
  mappings: readonly EventPrefixMapping[],
  options?: TrackCodegenOptions,
): string {
  const {
    importFrom = '@qa-sdk/browser-sdk',
    trackerVar = 'qa',
    jsdoc = true,
    header = true,
  } = options ?? {};

  const lines: string[] = [];

  // 헤더
  if (header) {
    lines.push('/**');
    lines.push(` * 자동 생성된 track 함수 — 이벤트 카탈로그 기반`);
    lines.push(` * 생성 시각: ${new Date().toISOString()}`);
    lines.push(` * 직접 수정 금지 — event-catalog 매핑 변경 후 재생성`);
    lines.push(' */');
    lines.push('');
  }

  // import
  lines.push(`import type { AutoTracker } from "${importFrom}";`);
  lines.push('');

  // tracker 참조 주석
  lines.push(`// ${trackerVar}: AutoTracker 인스턴스를 외부에서 주입하세요`);
  lines.push(`// 예: const ${trackerVar} = createAutoTracker({ ... });`);
  lines.push('');

  // 이벤트별 함수 생성
  for (const mapping of mappings) {
    const funcName = eventKeyToFuncName(mapping.event_key);
    const payloadFields = extractPayloadFields(mapping.prefixes);

    if (jsdoc) {
      lines.push('/**');
      lines.push(` * ${mapping.event_key} 이벤트 추적`);
      lines.push(` * 도메인: ${mapping.domain}`);
      lines.push(` * prefix: ${mapping.prefixes.map((p) => p.prefixId).join(', ')}`);
      lines.push(' */');
    }

    if (payloadFields.length > 0) {
      lines.push(`export function ${funcName}(`);
      lines.push(`  ${trackerVar}: AutoTracker,`);
      lines.push(`  payload: { ${payloadFields.map((f) => `${f}: unknown`).join('; ')} },`);
      lines.push(`) {`);
      lines.push(`  ${trackerVar}.track("${mapping.event_key}", payload);`);
    } else {
      lines.push(`export function ${funcName}(`);
      lines.push(`  ${trackerVar}: AutoTracker,`);
      lines.push(`  payload?: Record<string, unknown>,`);
      lines.push(`) {`);
      lines.push(`  ${trackerVar}.track("${mapping.event_key}", payload ?? {});`);
    }
    lines.push('}');
    lines.push('');
  }

  return lines.join('\n');
}

/**
 * 이벤트 키에서 생성할 매핑 요약 정보를 반환한다 (코드 생성 없이 검사용).
 */
export function summarizeMappings(
  mappings: readonly EventPrefixMapping[],
): Array<{ eventKey: string; funcName: string; prefixes: string[]; payloadFields: string[] }> {
  return mappings.map((m) => ({
    eventKey: m.event_key,
    funcName: eventKeyToFuncName(m.event_key),
    prefixes: m.prefixes.map((p) => p.prefixId),
    payloadFields: extractPayloadFields(m.prefixes),
  }));
}

// ── 내부 유틸 ─────────────────────────────────────────

/** "cart.add" → "trackCartAdd" */
function eventKeyToFuncName(eventKey: string): string {
  const parts = eventKey.split('.');
  const camel = parts.map((p, i) => (i === 0 ? `track${capitalize(p)}` : capitalize(p))).join('');
  return camel;
}

function capitalize(s: string): string {
  return (
    s.charAt(0).toUpperCase() + s.slice(1).replace(/-(\w)/g, (_, c: string) => c.toUpperCase())
  );
}

/** prefix 매핑에서 payload 기반 dim 필드명 추출 */
function extractPayloadFields(prefixes: readonly EventPrefixEntry[]): string[] {
  const fields = new Set<string>();
  for (const prefix of prefixes) {
    for (const source of Object.values(prefix.dims)) {
      if (source.kind === 'payload') {
        fields.add(source.payloadKey);
      }
    }
  }
  return [...fields].toSorted();
}
