/**
 * 동기화 엔진 — 해시 + 마커 추출 + DocRecord 조립
 *
 * HTTP/DB 무관한 순수 로직.
 * scanAndBuild 결과에서 DocRecord를 만들고,
 * body hash를 계산하여 변경 여부를 판별할 수 있게 한다.
 */

import { createHash } from "node:crypto";
import { extractByMarker, type DefinitionEntry } from "definition-catalog";
import type { DocRecord } from "./types.js";

/** body 문자열의 SHA-256 해시 */
export function hashBody(body: string): string {
  return createHash("sha256").update(body).digest("hex");
}

/**
 * markdown body에서 마커 섹션을 추출한다.
 * 빈 문자열이면 undefined 반환 (DB에 null 저장 의도).
 */
export function extractMarkers(body: string): {
  purpose?: string;
  intent?: string;
  context?: string;
  caveat?: string;
} {
  const toVal = (text: string) => text || undefined;
  return {
    purpose: toVal(extractByMarker(body, "purpose").text),
    intent: toVal(extractByMarker(body, "intent").text),
    context: toVal(extractByMarker(body, "context").text),
    caveat: toVal(extractByMarker(body, "caveat").text),
  };
}

/**
 * frontmatter 이후 body를 추출한다.
 */
export function extractBody(content: string): string {
  const match = content.match(/^---\r?\n[\s\S]*?\r?\n---\r?\n?([\s\S]*)$/);
  return match ? match[1] : content;
}

/**
 * DefinitionEntry + body + links → DocRecord 조립
 */
export function buildDocRecord(
  entry: DefinitionEntry,
  body: string,
  links: { target: string; type: string }[],
  sourcePath: string,
): DocRecord {
  const markers = extractMarkers(body);
  return {
    docId: entry.id,
    scope: entry.scope,
    aspect: entry.aspect,
    depth: entry.depth,
    lifecycle: entry.lifecycle,
    layer: entry.layer,
    tags: entry.tags ? [...entry.tags] : [],
    links,
    svc: entry.serviceId,
    version: 0, // upsert가 결정
    bodyHash: hashBody(body),
    ...markers,
    syncedAt: new Date().toISOString(),
    sourcePath,
  };
}
