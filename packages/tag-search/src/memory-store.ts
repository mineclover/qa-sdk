// @def.boundary indexing-core-system
/* ------------------------------------------------------------------ */
/*  InMemoryTagStore — 개발/테스트용 인메모리 구현                       */
/*                                                                      */
/*  자료구조:                                                            */
/*    forward  : targetId → Set<tag>          (대상 → 태그)             */
/*    inverted : tag → Set<targetId>          (태그 → 대상, 역색인)     */
/*    meta     : targetId → { kind, createdAt }                         */
/* ------------------------------------------------------------------ */

import type { TagStore } from "./port.js";
import type {
  TagTarget,
  TagQuery,
  TagSearchResult,
  TagSummary,
} from "./types.js";
import { normalizeTag } from "./types.js";

interface TargetMeta {
  kind: TagTarget;
  /** 최초 태그 부착 시점 */
  createdAt: string;
}

export class InMemoryTagStore implements TagStore {
  /** targetId → tags */
  private forward = new Map<string, Set<string>>();
  /** tag → targetIds (역색인) */
  private inverted = new Map<string, Set<string>>();
  /** targetId → 메타 */
  private meta = new Map<string, TargetMeta>();

  /* ---- 쓰기 ---- */

  async attach(
    targetId: string,
    targetKind: TagTarget,
    tags: string[],
  ): Promise<void> {
    const normalized = tags.map(normalizeTag).filter(Boolean);
    if (normalized.length === 0) return;

    if (!this.forward.has(targetId)) {
      this.forward.set(targetId, new Set());
    }
    if (!this.meta.has(targetId)) {
      this.meta.set(targetId, {
        kind: targetKind,
        createdAt: new Date().toISOString(),
      });
    }

    // eslint-disable-next-line typescript/no-non-null-assertion -- 직전에 .has() 확인 후 .set()으로 보장
    const fwd = this.forward.get(targetId)!;
    for (const tag of normalized) {
      fwd.add(tag);
      if (!this.inverted.has(tag)) {
        this.inverted.set(tag, new Set());
      }
      // eslint-disable-next-line typescript/no-non-null-assertion -- 직전에 .has() 확인 후 .set()으로 보장
      this.inverted.get(tag)!.add(targetId);
    }
  }

  async detach(targetId: string, tags: string[]): Promise<void> {
    const fwd = this.forward.get(targetId);
    if (!fwd) return;

    for (const raw of tags) {
      const tag = normalizeTag(raw);
      fwd.delete(tag);
      this.inverted.get(tag)?.delete(targetId);
      // 역색인에서 빈 셋 정리
      if (this.inverted.get(tag)?.size === 0) {
        this.inverted.delete(tag);
      }
    }

    // 태그가 모두 제거된 대상 정리
    if (fwd.size === 0) {
      this.forward.delete(targetId);
      this.meta.delete(targetId);
    }
  }

  async detachAll(targetId: string): Promise<void> {
    const fwd = this.forward.get(targetId);
    if (!fwd) return;

    for (const tag of fwd) {
      this.inverted.get(tag)?.delete(targetId);
      if (this.inverted.get(tag)?.size === 0) {
        this.inverted.delete(tag);
      }
    }

    this.forward.delete(targetId);
    this.meta.delete(targetId);
  }

  /* ---- 읽기 ---- */

  async getTags(targetId: string): Promise<string[]> {
    const fwd = this.forward.get(targetId);
    return fwd ? [...fwd].toSorted() : [];
  }

  async search(query: TagQuery): Promise<TagSearchResult[]> {
    const {
      tags,
      operator = "OR",
      targetKind,
      timeRange,
      limit = 100,
      offset = 0,
    } = query;

    const normalized = tags.map(normalizeTag).filter(Boolean);
    if (normalized.length === 0) return [];

    // 역색인으로 후보 수집
    let candidateIds: Set<string>;

    if (operator === "AND") {
      // 모든 태그를 가진 대상만 (교집합)
      const sets = normalized
        .map((t) => this.inverted.get(t))
        .filter((s): s is Set<string> => s != null);

      if (sets.length < normalized.length) return []; // 존재하지 않는 태그 포함

      candidateIds = intersect(sets);
    } else {
      // 하나라도 가진 대상 (합집합)
      candidateIds = new Set<string>();
      for (const tag of normalized) {
        const ids = this.inverted.get(tag);
        if (ids) {
          for (const id of ids) candidateIds.add(id);
        }
      }
    }

    // 필터링 + 결과 조립
    const results: TagSearchResult[] = [];

    for (const targetId of candidateIds) {
      const m = this.meta.get(targetId);
      if (!m) continue;

      // targetKind 필터
      if (targetKind && m.kind !== targetKind) continue;

      // 시간 범위 필터
      if (timeRange) {
        if (timeRange.from && m.createdAt < timeRange.from) continue;
        if (timeRange.to && m.createdAt > timeRange.to) continue;
      }

      const allTags = [...(this.forward.get(targetId) ?? [])].toSorted();
      const matchedTags = normalized.filter((t) => allTags.includes(t));

      results.push({
        targetId,
        targetKind: m.kind,
        matchedTags,
        allTags,
      });
    }

    // 페이지네이션
    return results.slice(offset, offset + limit);
  }

  async listTags(targetKind?: TagTarget): Promise<TagSummary[]> {
    const counts = new Map<string, number>();

    for (const [tag, ids] of this.inverted) {
      if (!targetKind) {
        counts.set(tag, ids.size);
        continue;
      }
      // targetKind 필터 적용
      let c = 0;
      for (const id of ids) {
        if (this.meta.get(id)?.kind === targetKind) c++;
      }
      if (c > 0) counts.set(tag, c);
    }

    return [...counts.entries()]
      .map(([tag, count]) => ({ tag, count }))
      .toSorted((a, b) => b.count - a.count || a.tag.localeCompare(b.tag));
  }

  async count(): Promise<number> {
    return this.inverted.size;
  }
}

/* ---- 유틸 ---- */

/** Set 교집합 */
function intersect(sets: Set<string>[]): Set<string> {
  if (sets.length === 0) return new Set();

  // 가장 작은 셋부터 순회 (최적화)
  const sorted = [...sets].toSorted((a, b) => a.size - b.size);
  const [first, ...rest] = sorted;

  const result = new Set<string>();
  for (const id of first) {
    if (rest.every((s) => s.has(id))) {
      result.add(id);
    }
  }
  return result;
}
