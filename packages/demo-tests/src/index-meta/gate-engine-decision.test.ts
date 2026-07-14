// @def.boundary validation-layer-group
// @def.doc validation-layer-group

/**
 * GateEngine × decision prefix 연동 테스트
 *
 * decision_event (leaf, 4축)에 대해:
 * - 초기 상태: entries 채워진 부분 active, headroom은 open
 * - flow_type=custom 비활성화 → 해당 좌표 inactive
 * - checkGate로 상태 확인
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  InMemoryIndexMetaStore,
  InMemoryPrefixRegistry,
  InMemoryEntryFlagStore,
  InMemoryAddressStateStore,
  InMemoryAddressRangeCache,
  InMemoryVersionLifecycleStore,
  GateEngine,
  checkGate,
} from 'index-meta';
import { DEMO_CATALOG } from 'demo-snapshot';

const AT = '2026-03-25T00:00:00Z';

// decision_event: flow_type(16) × cognitive_phase(16) × evidence_kind(16) × confidence_band(8)
const DECISION_EVENT_PREFIX = 'decision_event';
const DECISION_EVENT_VERSION = 'v1';

// 축 정보를 DEMO_CATALOG에서 동적 파생
const FLOW_TYPE_ENTRIES = DEMO_CATALOG.axes.flow_type.versions.v1.entries;
const COGNITIVE_PHASE_ENTRIES = DEMO_CATALOG.axes.cognitive_phase.versions.v1.entries;
const EVIDENCE_KIND_ENTRIES = DEMO_CATALOG.axes.evidence_kind.versions.v1.entries;
const CONFIDENCE_BAND_ENTRIES = DEMO_CATALOG.axes.confidence_band.versions.v1.entries;

interface Ctx {
  metaStore: InMemoryIndexMetaStore;
  prefixRegistry: InMemoryPrefixRegistry;
  entryFlagStore: InMemoryEntryFlagStore;
  versionStore: InMemoryVersionLifecycleStore;
  addressStateStore: InMemoryAddressStateStore;
  addressRangeCache: InMemoryAddressRangeCache;
  engine: GateEngine;
}

function createCtx(): Ctx {
  const metaStore = new InMemoryIndexMetaStore();
  const prefixRegistry = new InMemoryPrefixRegistry();
  const entryFlagStore = new InMemoryEntryFlagStore();
  const versionStore = new InMemoryVersionLifecycleStore();
  const addressStateStore = new InMemoryAddressStateStore();
  const addressRangeCache = new InMemoryAddressRangeCache();
  const engine = new GateEngine({
    prefixRegistry,
    metaStore,
    entryFlagStore,
    versionLifecycleStore: versionStore,
    addressStateStore,
    addressRangeCache,
  });
  return {
    metaStore,
    prefixRegistry,
    entryFlagStore,
    versionStore,
    addressStateStore,
    addressRangeCache,
    engine,
  };
}

async function registerDecisionEventLeaf(ctx: Ctx): Promise<void> {
  // decision_event는 4축 leaf prefix
  // 좌표 = flow_type × cognitive_phase × evidence_kind × confidence_band
  // 각 축의 capacity를 구성 (DEMO_CATALOG 기준)
  const ftCap = 16; // flow_type capacity
  const cpCap = 16; // cognitive_phase capacity
  const ekCap = 16; // evidence_kind capacity
  const cbCap = 8; // confidence_band capacity
  const totalCapacity = ftCap * cpCap * ekCap * cbCap; // 32,768

  await ctx.prefixRegistry.register({
    prefix: DECISION_EVENT_PREFIX,
    versionId: DECISION_EVENT_VERSION,
    capacity: totalCapacity,
  });
  await ctx.metaStore.insertSchemaVersion({
    prefix: DECISION_EVENT_PREFIX,
    versionId: DECISION_EVENT_VERSION,
    capacity: totalCapacity,
    createdAt: AT,
  });

  // entries: 모든 조합이 아니라 축별로 등록
  // GateEngine은 차원별로 entries를 봄 — leaf prefix는 1차원으로 취급
  // 실제로는 축별 entries × capacity로 open/active가 결정됨
  // 단순화: 총 entries 수 = ft*cp*ek*cb 중 실제 사용되는 조합만
  const usedEntries =
    FLOW_TYPE_ENTRIES.length *
    COGNITIVE_PHASE_ENTRIES.length *
    EVIDENCE_KIND_ENTRIES.length *
    CONFIDENCE_BAND_ENTRIES.length;

  for (let i = 1; i <= usedEntries && i <= 100; i++) {
    await ctx.metaStore.insertEntry({
      prefix: DECISION_EVENT_PREFIX,
      versionId: DECISION_EVENT_VERSION,
      position: i,
      value: `decision_coord_${i}`,
      createdAt: AT,
    });
  }
}

describe('GateEngine × decision_event', () => {
  let ctx: Ctx;

  beforeEach(async () => {
    ctx = createCtx();
    await registerDecisionEventLeaf(ctx);
  });

  it('초기 상태: 등록된 entries는 active, headroom은 open', async () => {
    const specs = await ctx.engine.buildDimStateSpecs(
      DECISION_EVENT_PREFIX,
      DECISION_EVENT_VERSION,
    );

    // open specs가 있어야 함 (headroom이 큼)
    const openSpecs = specs.filter((s) => s.state === 'open');
    expect(openSpecs.length).toBeGreaterThan(0);

    // inactive는 없어야 함 (아직 비활성화 안 함)
    const inactiveSpecs = specs.filter((s) => s.state === 'inactive');
    expect(inactiveSpecs.length).toBe(0);
  });

  it('entry 비활성화 → inactive 상태 전환', async () => {
    // position 1을 비활성화 (예: flow_type=custom에 해당하는 좌표)
    await ctx.entryFlagStore.setFlag({
      prefix: DECISION_EVENT_PREFIX,
      versionId: DECISION_EVENT_VERSION,
      position: 1,
      status: 'inactive',
      updatedAt: AT,
    });

    const specs = await ctx.engine.buildDimStateSpecs(
      DECISION_EVENT_PREFIX,
      DECISION_EVENT_VERSION,
    );
    const inactiveSpecs = specs.filter((s) => s.state === 'inactive');
    expect(inactiveSpecs.length).toBe(1);
    expect(inactiveSpecs[0].coords).toContain('1');
  });

  it('recompute → AddressStateStore에 저장됨', async () => {
    await ctx.engine.recompute(DECISION_EVENT_PREFIX, DECISION_EVENT_VERSION);

    const cached = await ctx.addressStateStore.get(DECISION_EVENT_PREFIX, DECISION_EVENT_VERSION);
    expect(cached).toBeDefined();
    expect(cached!.computedAt).toBeDefined();
    // open ranges가 있어야 함 (headroom)
    expect(cached!.openRanges.length).toBeGreaterThan(0);
  });

  it('checkGate — active 좌표는 encode+decode 허용', async () => {
    await ctx.engine.recompute(DECISION_EVENT_PREFIX, DECISION_EVENT_VERSION);

    const cached = await ctx.addressStateStore.get(DECISION_EVENT_PREFIX, DECISION_EVENT_VERSION);
    expect(cached).toBeDefined();

    const result = checkGate(
      1, // active position
      cached!.reservedRanges,
      cached!.inactiveRanges,
      cached!.openRanges,
    );
    expect(result.state).toBe('active');
    expect(result.encode).toBe(true);
    expect(result.decode).toBe(true);
  });

  it('checkGate — 비활성화된 좌표는 buildDimStateSpecs에서 inactive로 표시됨', async () => {
    await ctx.entryFlagStore.setFlag({
      prefix: DECISION_EVENT_PREFIX,
      versionId: DECISION_EVENT_VERSION,
      position: 5,
      status: 'inactive',
      updatedAt: AT,
    });

    const specs = await ctx.engine.buildDimStateSpecs(
      DECISION_EVENT_PREFIX,
      DECISION_EVENT_VERSION,
    );
    const inactiveSpecs = specs.filter((s) => s.state === 'inactive');

    // flag 설정 후 inactive spec이 존재해야 함
    expect(inactiveSpecs.length).toBe(1);
    expect(inactiveSpecs[0].coords).toContain('5');

    // recompute 후 addressStateStore에 inactiveRanges 반영
    await ctx.engine.recompute(DECISION_EVENT_PREFIX, DECISION_EVENT_VERSION);
    const cached = await ctx.addressStateStore.get(DECISION_EVENT_PREFIX, DECISION_EVENT_VERSION);
    expect(cached).toBeDefined();
    expect(cached!.inactiveRanges.length).toBeGreaterThan(0);
  });

  it('decision prefix는 DEMO_CATALOG에 정의되어 있다', () => {
    const prefix = DEMO_CATALOG.prefixes[DECISION_EVENT_PREFIX];
    expect(prefix).toBeDefined();
    expect(prefix.dims.flow_type).toEqual({ kind: 'axis', axisId: 'flow_type' });
    expect(prefix.dims.cognitive_phase).toEqual({ kind: 'axis', axisId: 'cognitive_phase' });
    expect(prefix.dims.evidence_kind).toEqual({ kind: 'axis', axisId: 'evidence_kind' });
    expect(prefix.dims.confidence_band).toEqual({ kind: 'axis', axisId: 'confidence_band' });
  });
});
