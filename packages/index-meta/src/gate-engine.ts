/**
 * GateEngine — release / flag 변경 시 AddressStateStore 자동 재계산 (PositionEngine Phase 3)
 *
 * ── 역할 ────────────────────────────────────────────────────────────────────
 *
 * 1. DimStateSpec[] 생성: entry/flag 상태에서 inactive·open 좌표를 추출
 * 2. computeStateRanges 호출 → reserved/inactive/open 구간 계산
 * 3. AddressStateStore에 저장 + AddressRangeCache 무효화
 * 4. cascade: leaf 변경 → getReverseRefs로 composite까지 전파
 *
 * ── Decorator ────────────────────────────────────────────────────────────────
 *
 * GateAwareVersionLifecycleStore: release() 후 자동 재계산
 * GateAwareEntryFlagStore:        flexible 모드 setFlag() 후 자동 재계산
 */

import type { PrefixRegistry, PrefixRegistryRecord } from "./prefix-registry.js";
import type { IndexMetaStore } from "./index-meta-store.js";
import type { EntryFlagStore, EntryFlagRecord } from "./entry-flag-store.js";
import type {
  VersionLifecycleStore,
  VersionRecord,
  VersionStatus,
  DeactivationMode,
} from "./version-lifecycle.js";
import type { AddressStateStore } from "./invalid-range-store.js";
import type { AddressRangeCache } from "./address-range-cache.js";
import type { DimStateSpec } from "./invalid-ranges.js";
import { computeStateRanges, positionsToConstraint } from "./invalid-ranges.js";

// ── 의존성 번들 ─────────────────────────────────────────────

export interface GateEngineDeps {
  readonly prefixRegistry: PrefixRegistry;
  readonly metaStore: IndexMetaStore;
  readonly entryFlagStore: EntryFlagStore;
  readonly versionLifecycleStore: VersionLifecycleStore;
  readonly addressStateStore: AddressStateStore;
  readonly addressRangeCache: AddressRangeCache;
}

// ── GateEngine ──────────────────────────────────────────────

export class GateEngine {
  private readonly _deps: GateEngineDeps;

  constructor(deps: GateEngineDeps) {
    this._deps = deps;
  }

  /**
   * prefix·versionId의 DimStateSpec[] 생성.
   *
   * leaf:      dimIndex=0, 자신의 entry/flag에서 inactive·open 추출.
   * composite: 각 dim의 leaf ref에서 dimIndex별 specs 수집.
   */
  async buildDimStateSpecs(prefix: string, versionId: string): Promise<DimStateSpec[]> {
    const record = await this._deps.prefixRegistry.getRecord(prefix, versionId);
    if (!record) return [];

    if (!record.refs || record.refs.length === 0) {
      // leaf prefix
      return this._buildLeafSpecs(prefix, versionId, 0, record.capacity);
    }

    // composite prefix — 각 dim의 leaf ref에서 specs 수집
    const specs: DimStateSpec[] = [];
    for (let i = 0; i < record.refs.length; i++) {
      const ref = record.refs[i]!;
      const dimSpecs = await this._buildLeafSpecs(ref.prefix, ref.versionId, i, ref.capacity);
      specs.push(...dimSpecs);

      // CON-006: refEntries 바운딩 — ref.capacity가 참조 prefix의 전체 capacity보다 작으면
      // refEntries로 바운딩된 것. 참조 prefix의 전체 공간에서 refEntries 밖의 position은 reserved.
      const refRecord = await this._deps.prefixRegistry.getRecord(ref.prefix, ref.versionId);
      if (refRecord && ref.capacity < refRecord.capacity) {
        // ref.capacity = refEntries.length (바운딩됨)
        // refRecord.capacity = 참조 prefix 전체 capacity
        // refEntries 이후 position(ref.capacity ~ refRecord.capacity-1)은 여기서 이미 shape 밖이므로 자동 제외.
        // 단, 이 dim의 shape가 ref.capacity이므로 추가 처리 불필요.
      } else if (refRecord && ref.capacity === refRecord.capacity) {
        // refEntries 미정의 — 전체 공간이 열려 있음.
        // 참조 prefix의 실제 entries만 유효하고, 나머지는 reserved.
        const refEntries = await this._deps.metaStore.getEntries(ref.prefix, ref.versionId);
        const filledPositions = new Set(refEntries.map(e => e.position));
        const reservedPositions: number[] = [];
        for (let pos = 1; pos <= ref.capacity; pos++) {
          if (!filledPositions.has(pos)) {
            reservedPositions.push(pos);
          }
        }
        if (reservedPositions.length > 0) {
          const coords = positionsToConstraint(reservedPositions);
          if (coords) {
            specs.push({
              dimIndex: i,
              state: "reserved",
              coords,
              reason: `prefix_ref(${ref.prefix}:${ref.versionId}) refEntries 미정의 — 미사용 position reserved (CON-006)`,
            });
          }
        }
      }
    }
    return specs;
  }

  /**
   * prefix·versionId의 게이트 상태를 (재)계산하고 저장한다.
   *
   * 1. buildDimStateSpecs → specs
   * 2. computeStateRanges(shape, specs) → reserved/inactive/open
   * 3. AddressStateStore.save
   * 4. AddressRangeCache.deleteAll (stale 가능성)
   */
  async recompute(prefix: string, versionId: string): Promise<void> {
    const shape = await this._deps.prefixRegistry.getShape(prefix, versionId);
    if (!shape) return;

    const specs = await this.buildDimStateSpecs(prefix, versionId);
    const { reservedRanges, inactiveRanges, openRanges } = computeStateRanges(shape, specs);

    await this._deps.addressStateStore.save({
      prefix,
      versionId,
      specs,
      reservedRanges,
      inactiveRanges,
      openRanges,
      computedAt: new Date().toISOString(),
    });

    await this._deps.addressRangeCache.deleteAll(prefix, versionId);
  }

  /**
   * 자신 + 이 prefix를 참조하는 composite까지 재귀적으로 재계산.
   */
  async cascadeRecompute(prefix: string, versionId: string): Promise<void> {
    await this.recompute(prefix, versionId);

    const reverseRefs = await this._deps.prefixRegistry.getReverseRefs(prefix, versionId);
    for (const ref of reverseRefs) {
      await this.cascadeRecompute(ref.prefix, ref.versionId);
    }
  }

  /**
   * release 후 호출. cascade 포함.
   */
  async recomputeOnRelease(prefix: string, versionId: string): Promise<void> {
    await this.cascadeRecompute(prefix, versionId);
  }

  /**
   * flexible 모드 flag 변경 후 호출.
   * strict 모드이면 아무 동작도 하지 않는다.
   */
  async recomputeOnFlagChange(prefix: string, versionId: string): Promise<void> {
    const ver = await this._deps.versionLifecycleStore.getVersion(prefix, versionId);
    if (!ver || ver.deactivationMode !== "flexible") return;

    await this.cascadeRecompute(prefix, versionId);
  }

  // ── 내부 ─────────────────────────────────────────────────

  /**
   * 단일 차원의 inactive·open specs 생성.
   *
   * @param prefix     leaf prefix
   * @param versionId  leaf version
   * @param dimIndex   composite 내 차원 인덱스 (leaf 단독이면 0)
   * @param capacity   이 차원의 capacity
   */
  private async _buildLeafSpecs(
    prefix: string,
    versionId: string,
    dimIndex: number,
    capacity: number,
  ): Promise<DimStateSpec[]> {
    const [inactivePositions, entries] = await Promise.all([
      this._deps.entryFlagStore.getInactivePositions(prefix, versionId),
      this._deps.metaStore.getEntries(prefix, versionId),
    ]);

    const filledPositions = new Set(entries.map((e) => e.position));
    const specs: DimStateSpec[] = [];

    // inactive: 채워져 있으나 비활성화된 position
    if (inactivePositions.length > 0) {
      const coords = positionsToConstraint(inactivePositions);
      if (coords) {
        specs.push({ dimIndex, state: "inactive", coords });
      }
    }

    // open: 아직 채워지지 않은 position (headroom)
    const openPositions: number[] = [];
    for (let pos = 1; pos <= capacity; pos++) {
      if (!filledPositions.has(pos)) {
        openPositions.push(pos);
      }
    }
    if (openPositions.length > 0) {
      const coords = positionsToConstraint(openPositions);
      if (coords) {
        specs.push({ dimIndex, state: "open", coords });
      }
    }

    return specs;
  }
}

// ── GateAwareVersionLifecycleStore ──────────────────────────

/**
 * VersionLifecycleStore decorator.
 * release() 후 GateEngine.recomputeOnRelease를 자동 호출한다.
 */
export class GateAwareVersionLifecycleStore implements VersionLifecycleStore {
  constructor(
    private readonly _inner: VersionLifecycleStore,
    private readonly _engine: GateEngine,
  ) {}

  async createDraft(
    prefix: string,
    versionId: string,
    baseVersionId: string | null,
    capacity: number,
    deactivationMode?: DeactivationMode,
  ): Promise<VersionRecord> {
    return this._inner.createDraft(prefix, versionId, baseVersionId, capacity, deactivationMode);
  }

  async release(prefix: string, versionId: string): Promise<void> {
    await this._inner.release(prefix, versionId);
    await this._engine.recomputeOnRelease(prefix, versionId);
  }

  async activate(prefix: string, versionId: string): Promise<void> {
    return this._inner.activate(prefix, versionId);
  }

  async deprecate(prefix: string, versionId: string): Promise<void> {
    return this._inner.deprecate(prefix, versionId);
  }

  async getActive(prefix: string): Promise<VersionRecord | null> {
    return this._inner.getActive(prefix);
  }

  async getVersion(prefix: string, versionId: string): Promise<VersionRecord | null> {
    return this._inner.getVersion(prefix, versionId);
  }

  async getVersions(prefix: string, status?: VersionStatus): Promise<VersionRecord[]> {
    return this._inner.getVersions(prefix, status);
  }
}

// ── GateAwareEntryFlagStore ─────────────────────────────────

/**
 * EntryFlagStore decorator.
 * flexible 모드에서 setFlag() 후 GateEngine.recomputeOnFlagChange를 자동 호출한다.
 */
export class GateAwareEntryFlagStore implements EntryFlagStore {
  constructor(
    private readonly _inner: EntryFlagStore,
    private readonly _engine: GateEngine,
  ) {}

  async setFlag(record: EntryFlagRecord): Promise<void> {
    await this._inner.setFlag(record);
    await this._engine.recomputeOnFlagChange(record.prefix, record.versionId);
  }

  async getFlag(prefix: string, versionId: string, position: number): Promise<EntryFlagRecord | null> {
    return this._inner.getFlag(prefix, versionId, position);
  }

  async getFlags(prefix: string, versionId: string): Promise<EntryFlagRecord[]> {
    return this._inner.getFlags(prefix, versionId);
  }

  async getInactivePositions(prefix: string, versionId: string): Promise<number[]> {
    return this._inner.getInactivePositions(prefix, versionId);
  }
}
