import { describe, expect, it } from 'vitest';
import { createPromoGridComposition } from './presets.js';
import { resolveMotionComposition } from './model.js';
import { buildResolvedLayerStartMap, getSequenceLayerSlots } from './query.js';
import { serializeMotionComposition, parseMotionComposition } from './io.js';
import { createMotionDebugSnapshot, resolveMotionAssetSnapshots } from './snapshot.js';
import { endMs } from './utils.js';
import { applyMotionEditorCommand, createMotionEditorState } from './state.js';

const comp = createPromoGridComposition();

describe('콘텐츠 생성 파이프라인 리뷰', () => {
  describe('1. Layer 좌표 정합성 — layer.startMs와 slot resolved가 일치', () => {
    const startMap = buildResolvedLayerStartMap(comp);

    for (const layer of comp.layers) {
      it(`${layer.id}: layer.startMs(${layer.startMs}) === resolved(${startMap.get(layer.id)})`, () => {
        expect(startMap.get(layer.id)).toBe(layer.startMs);
      });
    }
  });

  describe('2. Sequence 슬롯 → layerIds 정합성', () => {
    for (const seq of comp.sequences) {
      it(`${seq.id}: layers 슬롯의 layerId 목록 === layerIds`, () => {
        const slotIds = seq.layers?.map((s) => s.layerId) ?? [];
        expect(slotIds).toEqual([...seq.layerIds]);
      });
    }
  });

  describe('3. 모든 layer가 composition duration 안에 있는지', () => {
    const startMap = buildResolvedLayerStartMap(comp);

    for (const layer of comp.layers) {
      it(`${layer.id}: endMs(${(startMap.get(layer.id) ?? 0) + layer.durationMs}) <= composition(${comp.durationMs})`, () => {
        const start = startMap.get(layer.id) ?? layer.startMs;
        expect(start + layer.durationMs).toBeLessThanOrEqual(comp.durationMs);
      });
    }
  });

  describe('4. Sequence 이동 시 상대좌표 layer 추적 검증', () => {
    it('cards sequence를 +500ms 이동 → 소속 layer들의 resolved startMs도 +500', () => {
      const state = createMotionEditorState(comp);
      const next = applyMotionEditorCommand(state, {
        type: 'update-item-timing',
        itemKind: 'sequence',
        itemId: 'cards',
        startMs: 2200, // 1700 → 2200 (+500)
        durationMs: 2800,
      });

      const map = buildResolvedLayerStartMap(next.composition);
      expect(map.get('card-a')).toBe(2200 + 150);
      expect(map.get('card-b')).toBe(2200 + 420);
      expect(map.get('card-c')).toBe(2200 + 690);
    });

    it('이동 후에도 snapshot이 올바른 시점에 layer를 active로 판정', () => {
      const state = createMotionEditorState(comp);
      const next = applyMotionEditorCommand(state, {
        type: 'update-item-timing',
        itemKind: 'sequence',
        itemId: 'cards',
        startMs: 2200,
        durationMs: 2800,
      });

      const resolved = resolveMotionComposition(next.composition);
      const assets = resolveMotionAssetSnapshots(resolved);

      // card-a: resolved startMs = 2200 + 150 = 2350
      const at2360 = createMotionDebugSnapshot(resolved, 2360, assets);
      expect(at2360.activeLayerIds).toContain('card-a');

      const at2340 = createMotionDebugSnapshot(resolved, 2340, assets);
      expect(at2340.activeLayerIds).not.toContain('card-a');
    });
  });

  describe('5. Serialize → Parse 라운드트립에서 슬롯 보존', () => {
    it('layers 슬롯이 JSON에 포함되고 파싱 후 보존된다', () => {
      const json = serializeMotionComposition(comp);
      const parsed = parseMotionComposition(json);

      const cardsSeq = parsed.sequences.find((s) => s.id === 'cards');
      expect(cardsSeq?.layers).toBeDefined();
      expect(cardsSeq?.layers).toHaveLength(3);
      // stagger 패턴 사용 — offsetMs는 JSON에 없고 stagger에서 파생
      expect(cardsSeq?.layers?.[0]).toMatchObject({ layerId: 'card-a', role: 'content' });
      expect(cardsSeq?.stagger).toMatchObject({ startOffsetMs: 150, intervalMs: 270 });
    });

    it('layers에서 layerIds가 자동 파생된다', () => {
      const json = serializeMotionComposition(comp);
      const parsed = parseMotionComposition(json);

      for (const seq of parsed.sequences) {
        if (seq.layers) {
          const slotIds = seq.layers.map((s) => s.layerId);
          expect([...seq.layerIds]).toEqual(slotIds);
        }
      }
    });
  });

  describe('6. 역할(role) 및 z-order 조회', () => {
    it('intro sequence에서 accent role을 필터링할 수 있다', () => {
      const seq = comp.sequences.find((s) => s.id === 'intro')!;
      const slots = getSequenceLayerSlots(seq);
      const accents = slots.filter((s) => s.role === 'accent');

      expect(accents).toHaveLength(1);
      expect(accents[0].layerId).toBe('chip');
    });

    it('cards sequence의 z-order가 배열 순서와 일치한다', () => {
      const seq = comp.sequences.find((s) => s.id === 'cards')!;
      const slots = getSequenceLayerSlots(seq);

      for (let i = 0; i < slots.length; i++) {
        expect(slots[i].zIndex).toBe(i);
      }
    });
  });

  describe('7. 전체 타임라인 무결성', () => {
    it('모든 시점에서 snapshot 생성이 에러 없이 동작한다', () => {
      const resolved = resolveMotionComposition(comp);
      const assets = resolveMotionAssetSnapshots(resolved);

      const timePoints = [0, 500, 1000, 1700, 2000, 3000, 4000, 4500, 5000, 6000, 6600];
      for (const t of timePoints) {
        const snapshot = createMotionDebugSnapshot(resolved, t, assets);
        expect(snapshot.timeMs).toBe(t);
      }
    });

    it('caption은 슬롯과 무관하게 절대 좌표로 동작한다', () => {
      const resolved = resolveMotionComposition(comp);
      const assets = resolveMotionAssetSnapshots(resolved);

      // cap-2: startMs=1820, durationMs=1040 → 1820~2860
      const at2000 = createMotionDebugSnapshot(resolved, 2000, assets);
      expect(at2000.activeCaptionId).toBe('cap-2');
    });
  });
});
