// @def.doc definition-catalog-spec

/**
 * ScopeRegistry — scope별 aspect 소비 관계 + 버전 관리
 *
 * 핵심 모델:
 *   - aspect pool: 전체 aspect의 글로벌 정의 (한 곳에)
 *   - scope: pool에서 일부 aspect를 소비
 *   - 같은 aspect를 여러 scope가 소비 가능 (N:M)
 *   - 소비 구성 변경 시 scope 버전 올림
 *
 * 주소 체계:
 *   scope:[scope-index]:[scope-version]:[local-address]
 *   로컬 주소 = aspect(scope 서브셋) × depth 경로 모델
 */

import { WeightedIndex } from 'weighted-index';
import type { DefScope, DefAspect, DefDepth } from './types.js';
import { DEF_SCOPE, DEF_ASPECT, DEF_DEPTH } from './vocabulary.js';
import { VALID_SCOPE_ASPECTS } from './taxonomy.js';

// ─── 타입 ────────────────────────────────────────────────

/** scope 버전 정의 — 이 버전에서 소비하는 aspect 목록 */
export interface ScopeVersionDef {
  readonly version: string;
  readonly consumes: readonly DefAspect[];
  readonly changelog?: string;
}

/** scope 등록 정보 */
export interface ScopeRegistryEntry {
  readonly scopeId: DefScope;
  readonly index: number; // scope의 1-based 인덱스
  readonly versions: readonly ScopeVersionDef[];
}

/** 경로 세그먼트 — scope 하나의 주소 공간 */
export interface ScopeSegment {
  readonly scopeId: DefScope;
  readonly version: string;
  readonly aspects: readonly DefAspect[];
  readonly shape: readonly number[]; // [aspects.length, depth.length]
  readonly addressOffset: number; // 전체 공간에서의 시작 위치
  readonly totalSize: number; // 이 세그먼트의 주소 수
  readonly wi: WeightedIndex;
}

/** 인코딩 결과 */
export interface ScopeAddress {
  readonly scopeIndex: number;
  readonly version: string;
  readonly localAddress: number;
  readonly globalAddress: number;
}

/** 디코딩 결과 */
export interface DecodedScopeAddress {
  readonly scope: DefScope;
  readonly version: string;
  readonly aspect: DefAspect;
  readonly depth: DefDepth;
  readonly localAddress: number;
  readonly globalAddress: number;
}

// ─── ScopeRegistry ───────────────────────────────────────

export class ScopeRegistry {
  private readonly entries: Map<DefScope, ScopeRegistryEntry> = new Map();
  private segments: ScopeSegment[] | null = null;

  constructor() {
    // VALID_SCOPE_ASPECTS에서 초기 v1 구성 파생
    const scopes = DEF_SCOPE.entries;
    for (let i = 0; i < scopes.length; i++) {
      const scopeId = scopes[i] as DefScope;
      const aspects = VALID_SCOPE_ASPECTS[scopeId];
      this.entries.set(scopeId, {
        scopeId,
        index: i + 1, // 1-based
        versions: [{ version: 'v1', consumes: [...aspects] }],
      });
    }
  }

  /** scope의 현재(최신) 버전 조회 */
  getLatestVersion(scopeId: DefScope): ScopeVersionDef {
    const entry = this.entries.get(scopeId);
    if (!entry) throw new Error(`scope "${scopeId}" 미등록`);
    return entry.versions[entry.versions.length - 1];
  }

  /** scope의 특정 버전 조회 */
  getVersion(scopeId: DefScope, version: string): ScopeVersionDef {
    const entry = this.entries.get(scopeId);
    if (!entry) throw new Error(`scope "${scopeId}" 미등록`);
    const v = entry.versions.find((v) => v.version === version);
    if (!v) throw new Error(`scope "${scopeId}" 버전 "${version}" 없음`);
    return v;
  }

  /** scope의 인덱스 조회 */
  getScopeIndex(scopeId: DefScope): number {
    const entry = this.entries.get(scopeId);
    if (!entry) throw new Error(`scope "${scopeId}" 미등록`);
    return entry.index;
  }

  /** scope에 새 버전 추가 (aspect 소비 변경) */
  addVersion(scopeId: DefScope, version: ScopeVersionDef): void {
    const entry = this.entries.get(scopeId);
    if (!entry) throw new Error(`scope "${scopeId}" 미등록`);

    // 중복 버전 체크
    if (entry.versions.some((v) => v.version === version.version)) {
      throw new Error(`scope "${scopeId}" 버전 "${version.version}" 이미 존재`);
    }

    // aspect pool에 있는지 검증
    for (const aspect of version.consumes) {
      if (!DEF_ASPECT.entries.includes(aspect)) {
        throw new Error(`aspect "${aspect}"는 pool에 없음`);
      }
    }

    // append-only
    const updated: ScopeRegistryEntry = {
      ...entry,
      versions: [...entry.versions, version],
    };
    this.entries.set(scopeId, updated);
    this.segments = null; // 캐시 무효화
  }

  // ─── 경로 모델 인코딩 ──────────────────────────────────

  /** 전체 세그먼트 구축 (최신 버전 기준) */
  buildSegments(): readonly ScopeSegment[] {
    if (this.segments) return this.segments;

    const depthCount = DEF_DEPTH.entries.length;
    const result: ScopeSegment[] = [];
    let offset = 0;

    for (const scopeId of DEF_SCOPE.entries) {
      const entry = this.entries.get(scopeId as DefScope);
      if (!entry) continue;

      const latest = entry.versions[entry.versions.length - 1];
      const aspectCount = latest.consumes.length;
      // aspect 0개 scope (예: decision)는 좌표 공간에 차지하지 않고 segments에서 제외.
      // 단일 단위 문서이므로 주소 인코딩 없이 metadata로만 활용.
      if (aspectCount === 0) continue;

      const shape = [aspectCount, depthCount] as const;
      const totalSize = aspectCount * depthCount;
      const wi = new WeightedIndex([...shape], ['aspect', 'depth']);

      result.push({
        scopeId: scopeId as DefScope,
        version: latest.version,
        aspects: latest.consumes,
        shape,
        addressOffset: offset,
        totalSize,
        wi,
      });

      offset += totalSize;
    }

    this.segments = result;
    return result;
  }

  /** 특정 버전으로 세그먼트 구축 */
  buildSegmentForVersion(scopeId: DefScope, version: string): ScopeSegment {
    const v = this.getVersion(scopeId, version);
    const depthCount = DEF_DEPTH.entries.length;
    const aspectCount = v.consumes.length;
    if (aspectCount === 0) {
      throw new Error(
        `scope "${scopeId}"는 aspect 0개 (segment 구축 불가). 단일 단위 문서 scope는 좌표 인코딩 대상이 아님.`,
      );
    }
    const shape = [aspectCount, depthCount] as const;

    // offset 계산: 이 scope 이전의 모든 세그먼트 크기 합
    const segments = this.buildSegments();
    const idx = segments.findIndex((s) => s.scopeId === scopeId);
    const offset = idx >= 0 ? segments[idx].addressOffset : 0;

    return {
      scopeId,
      version,
      aspects: v.consumes,
      shape,
      addressOffset: offset,
      totalSize: aspectCount * depthCount,
      wi: new WeightedIndex([...shape], ['aspect', 'depth']),
    };
  }

  /** 인코딩: scope + aspect + depth → 주소 */
  encode(scopeId: DefScope, aspect: DefAspect, depth: DefDepth): ScopeAddress {
    const segments = this.buildSegments();
    const segment = segments.find((s) => s.scopeId === scopeId);
    if (!segment) throw new Error(`scope "${scopeId}" 세그먼트 없음`);

    const aspectIdx = segment.aspects.indexOf(aspect);
    if (aspectIdx === -1) {
      throw new Error(
        `scope "${scopeId}" v${segment.version}에서 aspect "${aspect}" 미소비. ` +
          `소비 중: [${segment.aspects.join(', ')}]`,
      );
    }

    const depthIdx = DEF_DEPTH.entries.indexOf(depth);
    if (depthIdx === -1) throw new Error(`depth "${depth}" 없음`);

    const localAddress = segment.wi.encode([aspectIdx + 1, depthIdx + 1]);
    const globalAddress = segment.addressOffset + localAddress;

    return {
      scopeIndex: this.getScopeIndex(scopeId),
      version: segment.version,
      localAddress,
      globalAddress,
    };
  }

  /** 디코딩: 전역 주소 → scope + aspect + depth */
  decode(globalAddress: number): DecodedScopeAddress {
    const segments = this.buildSegments();

    for (const segment of segments) {
      const segEnd = segment.addressOffset + segment.totalSize;
      if (globalAddress >= segment.addressOffset && globalAddress < segEnd) {
        const localAddress = globalAddress - segment.addressOffset;
        const coords = segment.wi.decode(localAddress);
        const aspect = segment.aspects[coords[0] - 1];
        const depth = DEF_DEPTH.entries[coords[1] - 1] as DefDepth;

        return {
          scope: segment.scopeId,
          version: segment.version,
          aspect,
          depth,
          localAddress,
          globalAddress,
        };
      }
    }

    throw new Error(`전역 주소 ${globalAddress}에 해당하는 세그먼트 없음`);
  }

  /** 직렬화: scope:index:version:localAddress */
  serialize(addr: ScopeAddress): string {
    return `scope:${addr.scopeIndex}:${addr.version}:${addr.localAddress}`;
  }

  /** 파싱 */
  parse(serialized: string): ScopeAddress | null {
    const match = serialized.match(/^scope:(\d+):([^:]+):(\d+)$/);
    if (!match) return null;
    const scopeIndex = Number(match[1]);
    const version = match[2];
    const localAddress = Number(match[3]);

    // scopeIndex → globalAddress 역산
    const segments = this.buildSegments();
    const segment = segments.find((s) => this.getScopeIndex(s.scopeId) === scopeIndex);
    if (!segment) return null;

    return {
      scopeIndex,
      version,
      localAddress,
      globalAddress: segment.addressOffset + localAddress,
    };
  }

  // ─── 조회 ─────────────────────────────────────────────

  /** 전체 주소 공간 크기 (최신 버전 기준) */
  totalAddressSpace(): number {
    const segments = this.buildSegments();
    return segments.reduce((sum, s) => sum + s.totalSize, 0);
  }

  /** scope별 주소 범위 조회 */
  getAddressRange(scopeId: DefScope): { start: number; end: number } {
    const segments = this.buildSegments();
    const segment = segments.find((s) => s.scopeId === scopeId);
    if (!segment) throw new Error(`scope "${scopeId}" 세그먼트 없음`);
    return {
      start: segment.addressOffset,
      end: segment.addressOffset + segment.totalSize - 1,
    };
  }

  /** 특정 aspect를 소비하는 모든 scope 조회 */
  getScopesConsuming(aspect: DefAspect): readonly DefScope[] {
    const result: DefScope[] = [];
    for (const [scopeId, entry] of this.entries) {
      const latest = entry.versions[entry.versions.length - 1];
      if (latest.consumes.includes(aspect)) {
        result.push(scopeId);
      }
    }
    return result;
  }

  /** 통계 */
  stats(): {
    scopeCount: number;
    totalAspectSlots: number;
    totalAddressSpace: number;
    crossProductSpace: number;
    efficiency: number;
  } {
    const segments = this.buildSegments();
    const totalAspectSlots = segments.reduce((sum, s) => sum + s.aspects.length, 0);
    const totalAddressSpace = this.totalAddressSpace();
    const crossProductSpace = DEF_SCOPE.capacity * DEF_ASPECT.capacity * DEF_DEPTH.capacity;

    return {
      scopeCount: this.entries.size,
      totalAspectSlots,
      totalAddressSpace,
      crossProductSpace,
      efficiency: totalAddressSpace / crossProductSpace,
    };
  }
}
