// @def.boundary indexing-core-system
/* ------------------------------------------------------------------ */
/*  tag-search 핵심 타입                                               */
/*  좌표계(coordinate)와 독립 — ID 참조만으로 기존 엔티티에 태그 부착    */
/* ------------------------------------------------------------------ */

/** 태그를 부착할 수 있는 대상 종류 */
export type TagTarget =
  | 'record' // EventRecord.log_id
  | 'trace' // trace_id
  | 'session' // qa_session_id
  | 'prefix' // prefix id (카탈로그 메타 태깅)
  | 'service'; // service name

/** 하나의 태그 부착 */
export interface TagAttachment {
  /** 대상 엔티티 ID */
  targetId: string;
  /** 대상 종류 */
  targetKind: TagTarget;
  /** 태그 문자열 (소문자, 트림 정규화) */
  tag: string;
  /** 부착 시점 ISO-8601 */
  createdAt: string;
}

/** 검색 쿼리 */
export interface TagQuery {
  /** 검색할 태그 목록 */
  tags: string[];
  /** AND: 모든 태그 포함, OR: 하나라도 포함 (기본 OR) */
  operator?: 'AND' | 'OR';
  /** 대상 종류 필터 */
  targetKind?: TagTarget;
  /** 시간 범위 필터 (createdAt 기준) */
  timeRange?: { from?: string; to?: string };
  /** 최대 결과 수 (기본 100) */
  limit?: number;
  /** 오프셋 (페이지네이션) */
  offset?: number;
}

/** 검색 결과 한 건 */
export interface TagSearchResult {
  targetId: string;
  targetKind: TagTarget;
  /** 쿼리에 매치된 태그 */
  matchedTags: string[];
  /** 대상에 부착된 전체 태그 */
  allTags: string[];
}

/** 태그 통계 */
export interface TagSummary {
  tag: string;
  count: number;
}

/** 태그 정규화: 소문자 + 트림 + 연속 공백 제거 */
export function normalizeTag(raw: string): string {
  return raw.trim().toLowerCase().replace(/\s+/g, '-');
}
