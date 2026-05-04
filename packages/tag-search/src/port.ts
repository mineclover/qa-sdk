// @def.boundary indexing-core-system
/* ------------------------------------------------------------------ */
/*  TagStore — 태그 저장/검색 포트 (드라이버 교체 가능)                  */
/* ------------------------------------------------------------------ */

import type {
  TagTarget,
  TagQuery,
  TagSearchResult,
  TagSummary,
} from "./types.js";

export interface TagStore {
  /** 대상에 태그 부착 (중복 무시) */
  attach(
    targetId: string,
    targetKind: TagTarget,
    tags: string[],
  ): Promise<void>;

  /** 대상에서 태그 제거 */
  detach(targetId: string, tags: string[]): Promise<void>;

  /** 대상의 모든 태그 제거 */
  detachAll(targetId: string): Promise<void>;

  /** 대상에 부착된 태그 조회 */
  getTags(targetId: string): Promise<string[]>;

  /** 태그 검색 (역색인) */
  search(query: TagQuery): Promise<TagSearchResult[]>;

  /** 태그 목록 + 사용 횟수 */
  listTags(targetKind?: TagTarget): Promise<TagSummary[]>;

  /** 전체 태그 수 */
  count(): Promise<number>;
}
