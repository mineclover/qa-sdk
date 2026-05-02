// @def.boundary spec-engine-system
// @def.doc spec-engine-system

/**
 * StateStore — 축(axis) 기반 상태 저장소.
 *
 * context_id + resource_id 별로 축의 현재 entry 값을 저장한다.
 * 별도 slot vocabulary 없이 DEMO_CATALOG 축이 곧 상태 키.
 */

// ── 인터페이스 ───────────────────────────────────────────

export interface StateStore {
  /** 특정 context+resource의 축 값 읽기 */
  get(contextId: string, resourceId: string, axis: string): string | null;

  /** 축 값 설정 */
  set(contextId: string, resourceId: string, axis: string, value: string): void;

  /** 축 값 제거 */
  unset(contextId: string, resourceId: string, axis: string): void;

  /** 특정 context+resource의 전체 축 스냅샷 */
  snapshot(contextId: string, resourceId: string): Record<string, string>;

  /** 전체 초기화 */
  clear(): void;
}

// ── InMemoryStateStore ───────────────────────────────────

function storeKey(contextId: string, resourceId: string): string {
  return `${contextId}\0${resourceId}`;
}

export class InMemoryStateStore implements StateStore {
  private readonly data = new Map<string, Map<string, string>>();

  get(contextId: string, resourceId: string, axis: string): string | null {
    const entry = this.data.get(storeKey(contextId, resourceId));
    if (!entry) return null;
    return entry.get(axis) ?? null;
  }

  set(contextId: string, resourceId: string, axis: string, value: string): void {
    const key = storeKey(contextId, resourceId);
    let entry = this.data.get(key);
    if (!entry) {
      entry = new Map();
      this.data.set(key, entry);
    }
    entry.set(axis, value);
  }

  unset(contextId: string, resourceId: string, axis: string): void {
    const entry = this.data.get(storeKey(contextId, resourceId));
    if (!entry) return;
    entry.delete(axis);
    if (entry.size === 0) this.data.delete(storeKey(contextId, resourceId));
  }

  snapshot(contextId: string, resourceId: string): Record<string, string> {
    const entry = this.data.get(storeKey(contextId, resourceId));
    if (!entry) return {};
    return Object.fromEntries(entry);
  }

  clear(): void {
    this.data.clear();
  }
}
