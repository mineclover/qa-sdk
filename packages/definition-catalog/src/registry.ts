/**
 * 정의 레지스트리 (Definition Registry)
 *
 * 문서 메타데이터를 좌표 기반으로 등록, 조회, 관계 관리하는 인메모리 레지스트리.
 * 등록 시 scope-aspect 유효성 검증 + 좌표 자동 계산.
 */

import type {
  DefScope,
  DefAspect,
  DefDepth,
  DefLifecycle,
  LinkType,
  DefinitionEntry,
  DefinitionEntryInput,
  DefinitionEntryPatch,
  DefinitionLink,
  DefinitionFilter,
  DefinitionStats,
} from "./types.js";
import { validateScopeAspect } from "./taxonomy.js";
import { encodeDocument, serializeDocumentAddress, encodeLink } from "./observe.js";

// ─── 레지스트리 인터페이스 ────────────────────────────────

export interface DefinitionRegistry {
  /** 문서 등록 (좌표 자동 계산 + scope-aspect 검증) */
  register(input: DefinitionEntryInput): DefinitionEntry;

  /** 문서 수정 (좌표 재계산) */
  update(id: string, patch: DefinitionEntryPatch): DefinitionEntry;

  /** ID로 조회 */
  get(id: string): DefinitionEntry | undefined;

  /** 삭제 */
  remove(id: string): boolean;

  /** 관계 등록 */
  link(sourceId: string, targetId: string, linkType: LinkType): DefinitionLink;

  /** 관계 삭제 */
  unlink(sourceId: string, targetId: string, linkType: LinkType): boolean;

  /** 관계 조회 */
  getLinks(id: string, direction?: "outgoing" | "incoming" | "both"): readonly DefinitionLink[];

  /** scope로 필터 */
  findByScope(scope: DefScope): readonly DefinitionEntry[];

  /** aspect로 필터 */
  findByAspect(aspect: DefAspect): readonly DefinitionEntry[];

  /** lifecycle로 필터 */
  findByLifecycle(lifecycle: DefLifecycle): readonly DefinitionEntry[];

  /** 좌표 주소로 조회 */
  findByAddress(address: number): DefinitionEntry | undefined;

  /** 복합 필터 */
  query(filter: DefinitionFilter): readonly DefinitionEntry[];

  /** 전체 목록 */
  all(): readonly DefinitionEntry[];

  /** 통계 */
  stats(): DefinitionStats;
}

// ─── 인메모리 구현 ───────────────────────────────────────

/** 관계 키 생성 */
function linkKey(sourceId: string, targetId: string, linkType: LinkType): string {
  return `${sourceId}|${targetId}|${linkType}`;
}

/**
 * 인메모리 정의 레지스트리.
 *
 * - Map<id, DefinitionEntry> 기반
 * - 등록 시 scope-aspect 유효성 검증
 * - 좌표 자동 계산 (encodeDocument)
 * - 관계를 별도 Map으로 관리
 */
export class MemoryDefinitionRegistry implements DefinitionRegistry {
  private readonly entries = new Map<string, DefinitionEntry>();
  private readonly links = new Map<string, DefinitionLink>();
  private readonly addressIndex = new Map<number, string>(); // address → id

  register(input: DefinitionEntryInput): DefinitionEntry {
    if (this.entries.has(input.id)) {
      throw new Error(`이미 등록된 ID: "${input.id}"`);
    }

    // scope-aspect 유효성 검증
    validateScopeAspect(input.scope, input.aspect);

    // 좌표 계산
    const address = encodeDocument({
      scope: input.scope,
      aspect: input.aspect,
      depth: input.depth,
      lifecycle: input.lifecycle,
    });
    const serialized = serializeDocumentAddress(address);

    const entry: DefinitionEntry = { ...input, address, serialized };
    this.entries.set(entry.id, entry);
    this.addressIndex.set(address, entry.id);

    return entry;
  }

  update(id: string, patch: DefinitionEntryPatch): DefinitionEntry {
    const existing = this.entries.get(id);
    if (!existing) {
      throw new Error(`등록되지 않은 ID: "${id}"`);
    }

    // depth나 lifecycle이 변경되면 좌표 재계산
    const depth = patch.depth ?? existing.depth;
    const lifecycle = patch.lifecycle ?? existing.lifecycle;
    const needsReencode = patch.depth !== undefined || patch.lifecycle !== undefined;

    let address = existing.address;
    let serialized = existing.serialized;

    if (needsReencode) {
      // 이전 주소 인덱스 제거
      if (existing.address !== undefined) {
        this.addressIndex.delete(existing.address);
      }

      address = encodeDocument({
        scope: existing.scope,
        aspect: existing.aspect,
        depth,
        lifecycle,
      });
      serialized = serializeDocumentAddress(address);
      this.addressIndex.set(address, id);
    }

    const updated: DefinitionEntry = {
      ...existing,
      ...patch,
      depth,
      lifecycle,
      address,
      serialized,
      updatedAt: new Date().toISOString(),
    };

    this.entries.set(id, updated);
    return updated;
  }

  get(id: string): DefinitionEntry | undefined {
    return this.entries.get(id);
  }

  remove(id: string): boolean {
    const entry = this.entries.get(id);
    if (!entry) return false;

    // 주소 인덱스에서 제거
    if (entry.address !== undefined) {
      this.addressIndex.delete(entry.address);
    }

    // 관련 관계 제거
    for (const [key, link] of this.links) {
      if (link.sourceId === id || link.targetId === id) {
        this.links.delete(key);
      }
    }

    this.entries.delete(id);
    return true;
  }

  link(sourceId: string, targetId: string, lt: LinkType): DefinitionLink {
    const source = this.entries.get(sourceId);
    const target = this.entries.get(targetId);
    if (!source) throw new Error(`출발 문서 미등록: "${sourceId}"`);
    if (!target) throw new Error(`도착 문서 미등록: "${targetId}"`);

    const key = linkKey(sourceId, targetId, lt);
    if (this.links.has(key)) {
      return this.links.get(key)!;
    }

    // def_link 좌표: 출발 문서의 scope × aspect × link_type
    const address = encodeLink({
      scope: source.scope,
      aspect: source.aspect,
      linkType: lt,
    });

    const defLink: DefinitionLink = { sourceId, targetId, linkType: lt, address };
    this.links.set(key, defLink);
    return defLink;
  }

  unlink(sourceId: string, targetId: string, lt: LinkType): boolean {
    return this.links.delete(linkKey(sourceId, targetId, lt));
  }

  getLinks(id: string, direction: "outgoing" | "incoming" | "both" = "both"): readonly DefinitionLink[] {
    const result: DefinitionLink[] = [];
    for (const link of this.links.values()) {
      if (direction === "outgoing" && link.sourceId === id) result.push(link);
      else if (direction === "incoming" && link.targetId === id) result.push(link);
      else if (direction === "both" && (link.sourceId === id || link.targetId === id)) result.push(link);
    }
    return result;
  }

  findByScope(scope: DefScope): readonly DefinitionEntry[] {
    return [...this.entries.values()].filter(e => e.scope === scope);
  }

  findByAspect(aspect: DefAspect): readonly DefinitionEntry[] {
    return [...this.entries.values()].filter(e => e.aspect === aspect);
  }

  findByLifecycle(lifecycle: DefLifecycle): readonly DefinitionEntry[] {
    return [...this.entries.values()].filter(e => e.lifecycle === lifecycle);
  }

  findByAddress(address: number): DefinitionEntry | undefined {
    const id = this.addressIndex.get(address);
    return id ? this.entries.get(id) : undefined;
  }

  query(filter: DefinitionFilter): readonly DefinitionEntry[] {
    return [...this.entries.values()].filter(e => {
      if (filter.scope && e.scope !== filter.scope) return false;
      if (filter.aspect && e.aspect !== filter.aspect) return false;
      if (filter.depth && e.depth !== filter.depth) return false;
      if (filter.lifecycle && e.lifecycle !== filter.lifecycle) return false;
      if (filter.tags && filter.tags.length > 0) {
        if (!e.tags || !filter.tags.every(t => e.tags!.includes(t))) return false;
      }
      return true;
    });
  }

  all(): readonly DefinitionEntry[] {
    return [...this.entries.values()];
  }

  stats(): DefinitionStats {
    const byScope = { ui: 0, feature: 0, flow: 0, state: 0, constraint: 0, data: 0, interface: 0 } as Record<DefScope, number>;
    const byLifecycle = { draft: 0, review: 0, approved: 0, deprecated: 0, archived: 0 } as Record<DefLifecycle, number>;
    const byDepth = { overview: 0, specification: 0, implementation: 0, validation: 0 } as Record<DefDepth, number>;

    for (const e of this.entries.values()) {
      byScope[e.scope]++;
      byLifecycle[e.lifecycle]++;
      byDepth[e.depth]++;
    }

    return {
      totalEntries: this.entries.size,
      totalLinks: this.links.size,
      byScope,
      byLifecycle,
      byDepth,
    };
  }
}
