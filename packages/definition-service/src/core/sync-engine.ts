// @def.doc definition-service

/**
 * 동기화 엔진 — 해시 + 마커 추출 + DocRecord 조립
 *
 * HTTP/DB 무관한 순수 로직.
 * scanAndBuild 결과에서 DocRecord를 만들고,
 * body hash를 계산하여 변경 여부를 판별할 수 있게 한다.
 */

import { createHash } from 'node:crypto';
import { extractByMarker, type DefinitionEntry } from 'definition-catalog';
import type { DocRecord } from './types.js';
import { computeDocumentAddress } from './compute-address.js';

type CoordinateKey = 'scope' | 'aspect' | 'depth';

function requireCoordinatePart(entry: DefinitionEntry, key: CoordinateKey): string {
  const value = entry[key];
  if (!value) {
    throw new Error(`definition "${entry.id}" is missing required def.${key}`);
  }
  return value;
}

/** body 문자열의 SHA-256 해시 */
export function hashBody(body: string): string {
  return createHash('sha256').update(body).digest('hex');
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
    purpose: toVal(extractByMarker(body, 'purpose').text),
    intent: toVal(extractByMarker(body, 'intent').text),
    context: toVal(extractByMarker(body, 'context').text),
    caveat: toVal(extractByMarker(body, 'caveat').text),
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
  const scope = requireCoordinatePart(entry, 'scope');
  const aspect = requireCoordinatePart(entry, 'aspect');
  const depth = requireCoordinatePart(entry, 'depth');
  const address = entry.serialized ?? computeDocumentAddress(scope, aspect, depth);
  // prefix_schema 문서의 target_prefix 자동 추론: prefix-<id> → <id>
  const targetPrefix =
    aspect === 'prefix_schema' && entry.id.startsWith('prefix-')
      ? entry.id.slice('prefix-'.length)
      : undefined;

  return {
    docId: entry.id,
    title: entry.title,
    docType: entry.type,
    knowledgeKind: entry.knowledgeKind,
    level: entry.level,
    tier: entry.tier,
    scope,
    aspect,
    depth,
    lifecycle: entry.lifecycle,
    layer: entry.layer,
    tags: entry.tags ? [...entry.tags] : [],
    links,
    svc: entry.serviceId,
    docVersion: entry.version,
    revision: entry.revision,
    address: address ?? undefined,
    targetPrefix,
    version: 0, // upsert가 결정
    bodyHash: hashBody(body),
    ...markers,
    gate: entry.gate,
    syncedAt: new Date().toISOString(),
    sourcePath,
  };
}
