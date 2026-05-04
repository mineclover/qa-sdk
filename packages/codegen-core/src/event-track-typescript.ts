/**
 * event-track-typescript.ts — Event Catalog → 타입 안전 Track 코드 생성.
 *
 * 순수 함수. I/O 없음. 파일 내용 배열을 반환.
 *
 * 생성 파일:
 *   event-keys.ts       — EventKey 리터럴 유니온 + 카테고리별 그룹
 *   event-payloads.ts   — 이벤트별 payload 인터페이스 + EventPayloadMap
 *   track-functions.ts  — 이벤트별 타입 안전 track 함수
 *   index.ts            — barrel export
 */

import { createHash } from "node:crypto";
import { toPascal } from "./naming.js";

// ── 입력 타입 (event-catalog 비의존) ──────────────────

/** 이벤트 정의 (CoreEventDef 호환) */
export interface EventDef {
  event_key: string;
  event_version: string;
  category: string;
  channel: string[];
  display_name: string;
  description: string;
  auto_collectable: boolean;
}

/** 페이로드 필드 타입 */
export type FieldType = "string" | "number" | "boolean" | "string[]";

/** 페이로드 필드 정의 */
export interface FieldDef {
  name: string;
  required: boolean;
  type: FieldType;
  description: string;
}

/** 페이로드 가이드 (PayloadFieldGuide 호환) */
export interface PayloadGuide {
  event_key: string;
  fields: FieldDef[];
}

/** 이벤트→prefix 매핑 (EventPrefixMapping 호환) */
export interface EventMapping {
  event_key: string;
  domain: string;
  prefixes: Array<{
    prefixId: string;
    dims: Record<string, { kind: string; value?: string; contextKey?: string; payloadKey?: string }>;
    condition?: string;
  }>;
}

// ── 출력 타입 ─────────────────────────────────────────

export interface TrackCodegenFile {
  readonly path: string;
  readonly content: string;
}

export interface TrackCodegenResult {
  readonly files: readonly TrackCodegenFile[];
  readonly contentHash: string;
}

export interface TrackCodegenOptions {
  /** event-catalog import 경로 (기본: "event-catalog") */
  eventCatalogImport?: string;
  /** timestamp 오버라이드 (테스트용) */
  timestamp?: string;
}

// ── Hash ──────────────────────────────────────────────

function computeHash(events: readonly EventDef[], mappings: readonly EventMapping[]): string {
  const parts: string[] = [];
  for (const e of [...events].toSorted((a, b) => a.event_key.localeCompare(b.event_key))) {
    parts.push(`${e.event_key}:${e.event_version}:${e.category}`);
  }
  for (const m of [...mappings].toSorted((a, b) => a.event_key.localeCompare(b.event_key))) {
    parts.push(`${m.event_key}:${m.domain}:${m.prefixes.map(p => p.prefixId).join(",")}`);
  }
  return createHash("sha256").update(parts.join("|")).digest("hex").slice(0, 12);
}

// ── Header ────────────────────────────────────────────

function header(hash: string, timestamp: string): string {
  return [
    `// Generated from Event Catalog (hash: ${hash}) at ${timestamp.slice(0, 19)}`,
    `// !! 자동 생성 파일 — 직접 수정 금지 !!`,
    ``,
  ].join("\n");
}

// ── 네이밍 ────────────────────────────────────────────

/** "cart.add" → "CartAdd" */
function eventKeyToPascal(eventKey: string): string {
  return eventKey
    .split(".")
    .map(part => toPascal(part.replace(/-/g, "_")))
    .join("");
}

/** "cart.add" → "trackCartAdd" */
function eventKeyToFnName(eventKey: string): string {
  return `track${eventKeyToPascal(eventKey)}`;
}

/** FieldType → TypeScript 타입 */
function fieldTypeToTs(ft: FieldType): string {
  switch (ft) {
    case "string": return "string";
    case "number": return "number";
    case "boolean": return "boolean";
    case "string[]": return "string[]";
  }
}

// ── 생성기 ────────────────────────────────────────────

/**
 * Event Catalog 데이터로부터 타입 안전 Track 코드를 생성한다.
 *
 * 입력:
 *   - events: 이벤트 정의 목록
 *   - mappings: 이벤트→prefix 매핑 목록
 *   - payloadGuides: 이벤트별 페이로드 필드 가이드
 *
 * 출력:
 *   - event-keys.ts: EventKey 유니온 + 카테고리별 그룹
 *   - event-payloads.ts: 이벤트별 payload 인터페이스
 *   - track-functions.ts: track 함수들 + 제네릭 track()
 *   - index.ts: barrel export
 */
export function generateTrackCode(
  events: readonly EventDef[],
  mappings: readonly EventMapping[],
  payloadGuides: readonly PayloadGuide[],
  options?: TrackCodegenOptions,
): TrackCodegenResult {
  const hash = computeHash(events, mappings);
  const ts = options?.timestamp ?? new Date().toISOString();
  const h = header(hash, ts);

  const mappingSet = new Set(mappings.map(m => m.event_key));
  const guideMap = new Map(payloadGuides.map(g => [g.event_key, g]));

  // 매핑이 있는 이벤트만 track 함수 생성 (매핑 없으면 prefix 바인딩 불가)
  const trackableEvents = events.filter(e => mappingSet.has(e.event_key));
  const sorted = [...trackableEvents].toSorted((a, b) => a.event_key.localeCompare(b.event_key));
  const sortedMappings = [...mappings]
    .filter(m => trackableEvents.some(e => e.event_key === m.event_key))
    .toSorted((a, b) => a.event_key.localeCompare(b.event_key));

  // 카테고리 그룹
  const categories = new Map<string, EventDef[]>();
  for (const e of sorted) {
    const arr = categories.get(e.category) ?? [];
    arr.push(e);
    categories.set(e.category, arr);
  }

  const files: TrackCodegenFile[] = [
    { path: "event-keys.ts", content: genEventKeys(h, sorted, categories) },
    { path: "event-payloads.ts", content: genEventPayloads(h, sorted, guideMap) },
    { path: "event-mappings.ts", content: genEventMappings(h, sortedMappings) },
    { path: "track-functions.ts", content: genTrackFunctions(h, sorted, guideMap, options) },
    { path: "index.ts", content: genIndex(h, sorted) },
  ];

  return { files, contentHash: hash };
}

// ── event-keys.ts ─────────────────────────────────────

function genEventKeys(
  h: string,
  events: EventDef[],
  categories: Map<string, EventDef[]>,
): string {
  const lines: string[] = [h];

  // 전체 유니온
  lines.push(`/** 추적 가능한 이벤트 키 (매핑 보유) */`);
  lines.push(`export type EventKey =`);
  for (let i = 0; i < events.length; i++) {
    const sep = i < events.length - 1 ? "" : ";";
    lines.push(`  | "${events[i].event_key}"${sep}`);
  }
  lines.push(``);

  // 카테고리별 유니온
  for (const [cat, evts] of [...categories.entries()].toSorted((a, b) => a[0].localeCompare(b[0]))) {
    lines.push(`/** ${cat} 카테고리 이벤트 */`);
    lines.push(`export type ${toPascal(cat)}EventKey =`);
    for (let i = 0; i < evts.length; i++) {
      const sep = i < evts.length - 1 ? "" : ";";
      lines.push(`  | "${evts[i].event_key}"${sep}`);
    }
    lines.push(``);
  }

  // const 목록
  lines.push(`/** 전체 이벤트 키 목록 */`);
  lines.push(`export const EVENT_KEYS: readonly EventKey[] = [`);
  for (const e of events) {
    lines.push(`  "${e.event_key}",`);
  }
  lines.push(`] as const;`);

  return lines.join("\n") + "\n";
}

// ── event-payloads.ts ─────────────────────────────────

function genEventPayloads(
  h: string,
  events: EventDef[],
  guideMap: Map<string, PayloadGuide>,
): string {
  const lines: string[] = [h];

  // 이벤트별 payload 인터페이스
  for (const e of events) {
    const guide = guideMap.get(e.event_key);
    const name = `${eventKeyToPascal(e.event_key)}Payload`;

    lines.push(`/** ${e.display_name} — ${e.description} */`);
    lines.push(`export interface ${name} {`);

    if (guide && guide.fields.length > 0) {
      for (const f of guide.fields) {
        const opt = f.required ? "" : "?";
        lines.push(`  /** ${f.description} */`);
        lines.push(`  ${f.name}${opt}: ${fieldTypeToTs(f.type)};`);
      }
    } else {
      lines.push(`  [key: string]: unknown;`);
    }

    lines.push(`}`);
    lines.push(``);
  }

  // EventPayloadMap
  lines.push(`/** 이벤트 키 → payload 타입 매핑 */`);
  lines.push(`export interface EventPayloadMap {`);
  for (const e of events) {
    lines.push(`  "${e.event_key}": ${eventKeyToPascal(e.event_key)}Payload;`);
  }
  lines.push(`}`);

  return lines.join("\n") + "\n";
}

// ── track-functions.ts ────────────────────────────────

function genTrackFunctions(
  h: string,
  events: EventDef[],
  guideMap: Map<string, PayloadGuide>,
  options?: TrackCodegenOptions,
): string {
  const importPath = options?.eventCatalogImport ?? "event-catalog";
  const lines: string[] = [h];

  // import 선언
  lines.push(`import type { EventKey } from "./event-keys.js";`);
  lines.push(`import type { EventPayloadMap } from "./event-payloads.js";`);
  lines.push(``);

  // Tracker 인터페이스 (event-catalog 비의존)
  lines.push(`/** track 함수가 사용하는 최소 인터페이스 */`);
  lines.push(`export interface Tracker {`);
  lines.push(`  track(eventKey: string, payload?: Record<string, unknown>): void;`);
  lines.push(`}`);
  lines.push(``);

  // 이벤트별 track 함수
  for (const e of events) {
    const fnName = eventKeyToFnName(e.event_key);
    const payloadType = `${eventKeyToPascal(e.event_key)}Payload`;
    const guide = guideMap.get(e.event_key);
    const hasRequired = guide?.fields.some(f => f.required) ?? false;
    const payloadOpt = hasRequired ? "" : "?";

    lines.push(`/** ${e.display_name} — ${e.description} */`);
    lines.push(`export function ${fnName}(tracker: Tracker, payload${payloadOpt}: ${payloadType}): void {`);
    lines.push(`  tracker.track("${e.event_key}", payload as Record<string, unknown>);`);
    lines.push(`}`);
    lines.push(``);
  }

  // 제네릭 typed track
  lines.push(`/** 타입 안전 범용 track — 이벤트 키에 맞는 payload 타입 강제 */`);
  lines.push(`export function track<K extends EventKey>(`);
  lines.push(`  tracker: Tracker,`);
  lines.push(`  eventKey: K,`);
  lines.push(`  payload?: EventPayloadMap[K],`);
  lines.push(`): void {`);
  lines.push(`  tracker.track(eventKey, payload as Record<string, unknown>);`);
  lines.push(`}`);

  return lines.join("\n") + "\n";
}

// ── event-mappings.ts ─────────────────────────────────

function genEventMappings(
  h: string,
  mappings: EventMapping[],
): string {
  const lines: string[] = [h];

  lines.push(`import type { EventKey } from "./event-keys.js";`);
  lines.push(``);

  // DimSource 타입 (인라인 — event-catalog 비의존)
  lines.push(`export type DimSource =`);
  lines.push(`  | { kind: "fixed"; value: string }`);
  lines.push(`  | { kind: "context"; contextKey: string }`);
  lines.push(`  | { kind: "payload"; payloadKey: string; fallback?: string };`);
  lines.push(``);

  lines.push(`export interface PrefixDimMapping {`);
  lines.push(`  prefixId: string;`);
  lines.push(`  dims: Record<string, DimSource>;`);
  lines.push(`  condition?: string;`);
  lines.push(`}`);
  lines.push(``);

  lines.push(`export interface EventMappingEntry {`);
  lines.push(`  event_key: EventKey;`);
  lines.push(`  domain: string;`);
  lines.push(`  prefixes: readonly PrefixDimMapping[];`);
  lines.push(`}`);
  lines.push(``);

  // 매핑 데이터
  lines.push(`/** 이벤트별 prefix 매핑 — createAutoTracker에 전달 가능 */`);
  lines.push(`export const EVENT_MAPPINGS: readonly EventMappingEntry[] = [`);

  for (const m of mappings) {
    lines.push(`  {`);
    lines.push(`    event_key: "${m.event_key}",`);
    lines.push(`    domain: "${m.domain}",`);
    lines.push(`    prefixes: [`);

    for (const p of m.prefixes) {
      lines.push(`      {`);
      lines.push(`        prefixId: "${p.prefixId}",`);
      if (p.condition) {
        lines.push(`        condition: "${p.condition}",`);
      }
      lines.push(`        dims: {`);

      for (const [dimLabel, source] of Object.entries(p.dims)) {
        const src = source as { kind: string; value?: string; contextKey?: string; payloadKey?: string; fallback?: string };
        if (src.kind === "fixed") {
          lines.push(`          ${dimLabel}: { kind: "fixed", value: "${src.value}" },`);
        } else if (src.kind === "context") {
          lines.push(`          ${dimLabel}: { kind: "context", contextKey: "${src.contextKey}" },`);
        } else if (src.kind === "payload") {
          const fb = src.fallback ? `, fallback: "${src.fallback}"` : "";
          lines.push(`          ${dimLabel}: { kind: "payload", payloadKey: "${src.payloadKey}"${fb} },`);
        }
      }

      lines.push(`        },`);
      lines.push(`      },`);
    }

    lines.push(`    ],`);
    lines.push(`  },`);
  }

  lines.push(`] as const;`);

  return lines.join("\n") + "\n";
}

// ── index.ts ──────────────────────────────────────────

function genIndex(h: string, events: EventDef[]): string {
  const lines: string[] = [h];

  lines.push(`export type { EventKey } from "./event-keys.js";`);
  lines.push(`export { EVENT_KEYS } from "./event-keys.js";`);

  // 카테고리별 EventKey 타입들도 re-export
  const cats = [...new Set(events.map(e => e.category))].toSorted();
  for (const cat of cats) {
    lines.push(`export type { ${toPascal(cat)}EventKey } from "./event-keys.js";`);
  }

  lines.push(``);
  lines.push(`export type { EventPayloadMap } from "./event-payloads.js";`);

  // payload 인터페이스 re-export
  const payloadNames = events.map(e => `${eventKeyToPascal(e.event_key)}Payload`);
  lines.push(`export type {`);
  for (const name of payloadNames) {
    lines.push(`  ${name},`);
  }
  lines.push(`} from "./event-payloads.js";`);

  lines.push(``);
  lines.push(`export { EVENT_MAPPINGS } from "./event-mappings.js";`);
  lines.push(`export type { DimSource, PrefixDimMapping, EventMappingEntry } from "./event-mappings.js";`);
  lines.push(``);
  lines.push(`export { track } from "./track-functions.js";`);
  lines.push(`export type { Tracker } from "./track-functions.js";`);

  // track 함수 re-export
  const fnNames = events.map(e => eventKeyToFnName(e.event_key));
  lines.push(`export {`);
  for (const fn of fnNames) {
    lines.push(`  ${fn},`);
  }
  lines.push(`} from "./track-functions.js";`);

  return lines.join("\n") + "\n";
}
