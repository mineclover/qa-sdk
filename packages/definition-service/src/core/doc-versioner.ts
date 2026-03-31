/**
 * 문서 버전 관리 — 변경 감지 + 버전 증가 + changeType 판별
 *
 * HTTP/DB 무관한 순수 로직. DocStore 구현체가 이 함수를 호출한다.
 */

import type { DocRecord, DocHistoryRecord } from "./types.js";

/** 버전 판정 결과 */
export interface VersionDecision {
  action: "created" | "updated" | "unchanged";
  version: number;
  changeType: DocHistoryRecord["changeType"];
}

/**
 * 기존 문서와 새 문서를 비교하여 버전 결정을 내린다.
 *
 * - body_hash 동일 + 마커 동일 → unchanged
 * - body_hash 동일 + 마커 변경 → marker_edit (버전 +1)
 * - body_hash 변경 → updated (버전 +1)
 * - 기존 없음 → created (버전 1)
 */
export function decideVersion(
  existing: DocRecord | null,
  incoming: DocRecord,
): VersionDecision {
  if (!existing) {
    return { action: "created", version: 1, changeType: "created" };
  }

  // body_hash + 마커 + 파일 유래 메타데이터 동일 → unchanged
  if (
    existing.bodyHash === incoming.bodyHash &&
    markersMatch(existing, incoming) &&
    metadataMatch(existing, incoming)
  ) {
    return { action: "unchanged", version: existing.version, changeType: "updated" };
  }

  // 구조적 변경 없이 마커만 바뀜
  if (isMarkerOnlyChange(existing, incoming)) {
    return { action: "updated", version: existing.version + 1, changeType: "marker_edit" };
  }

  // 본문 또는 메타데이터 변경
  return { action: "updated", version: existing.version + 1, changeType: "updated" };
}

/** 마커 필드(purpose/intent/context/caveat)가 동일한지 */
export function markersMatch(a: DocRecord, b: DocRecord): boolean {
  return (
    a.purpose === b.purpose &&
    a.intent === b.intent &&
    a.context === b.context &&
    a.caveat === b.caveat
  );
}

/**
 * 구조(scope, aspect, depth, lifecycle, tags, links, bodyHash)는 동일하고
 * 마커만 변경된 경우를 판별한다.
 */
export function isMarkerOnlyChange(prev: DocRecord, next: DocRecord): boolean {
  return (
    prev.bodyHash === next.bodyHash &&
    metadataMatch(prev, next)
  );
}

function metadataMatch(prev: DocRecord, next: DocRecord): boolean {
  return (
    prev.title === next.title &&
    prev.docType === next.docType &&
    prev.knowledgeKind === next.knowledgeKind &&
    prev.level === next.level &&
    prev.scope === next.scope &&
    prev.aspect === next.aspect &&
    prev.depth === next.depth &&
    prev.lifecycle === next.lifecycle &&
    prev.layer === next.layer &&
    prev.svc === next.svc &&
    prev.docVersion === next.docVersion &&
    prev.revision === next.revision &&
    prev.targetPrefix === next.targetPrefix &&
    prev.address === next.address &&
    prev.sourcePath === next.sourcePath &&
    JSON.stringify(prev.tags) === JSON.stringify(next.tags) &&
    JSON.stringify(prev.links) === JSON.stringify(next.links) &&
    JSON.stringify(prev.gate ?? null) === JSON.stringify(next.gate ?? null)
  );
}
