import { describe, expect, it } from 'vitest';
import { createPromoGridComposition } from './presets.js';
import {
  buildResolvedLayerStartMap,
  getSequenceLayerSlots,
  resolveLayerStartMs,
  findLayerById,
  findSequenceById,
} from './query.js';
import { applyMotionEditorCommand, createMotionEditorState } from './state.js';
import { resolveMotionComposition } from './model.js';
import { createMotionDebugSnapshot, resolveMotionAssetSnapshots } from './snapshot.js';

const composition = createPromoGridComposition();

describe('SequenceLayerSlot 좌표계', () => {
  describe('getSequenceLayerSlots', () => {
    it('layers가 있으면 슬롯을 그대로 반환한다', () => {
      const seq = findSequenceById(composition, 'cards')!;
      const slots = getSequenceLayerSlots(seq);

      expect(slots).toHaveLength(3);
      expect(slots[0]).toMatchObject({ layerId: 'card-a', offsetMs: 150, role: 'content' });
      expect(slots[1]).toMatchObject({ layerId: 'card-b', offsetMs: 420, role: 'content' });
      expect(slots[2]).toMatchObject({ layerId: 'card-c', offsetMs: 690, role: 'content' });
    });

    it('layers가 없으면 layerIds에서 offsetMs 없는 슬롯을 생성한다', () => {
      const seq = { ...findSequenceById(composition, 'cards')!, layers: undefined };
      const slots = getSequenceLayerSlots(seq);

      expect(slots).toHaveLength(3);
      expect(slots[0]).toMatchObject({ layerId: 'card-a' });
      expect(slots[0].offsetMs).toBeUndefined();
    });
  });

  describe('resolveLayerStartMs', () => {
    it('상대 좌표: sequence.startMs + offsetMs', () => {
      const seq = findSequenceById(composition, 'cards')!;
      const slot = getSequenceLayerSlots(seq)[0]; // card-a, offsetMs: 150
      const layer = findLayerById(composition, 'card-a')!;

      expect(resolveLayerStartMs(seq, slot, layer)).toBe(1700 + 150);
    });

    it('절대 좌표: offsetMs 없으면 layer.startMs', () => {
      const seq = findSequenceById(composition, 'cards')!;
      const absoluteSlot = { layerId: 'card-a' };
      const layer = findLayerById(composition, 'card-a')!;

      expect(resolveLayerStartMs(seq, absoluteSlot, layer)).toBe(layer.startMs);
    });
  });

  describe('buildResolvedLayerStartMap', () => {
    it('상대 좌표 layer는 sequence 기준으로 계산된다', () => {
      const map = buildResolvedLayerStartMap(composition);

      // cards sequence: startMs=1700, card-a offsetMs=150
      expect(map.get('card-a')).toBe(1700 + 150);
      expect(map.get('card-b')).toBe(1700 + 420);
      expect(map.get('card-c')).toBe(1700 + 690);
    });

    it('intro sequence의 상대 좌표도 올바르게 계산된다', () => {
      const map = buildResolvedLayerStartMap(composition);

      // intro sequence: startMs=0, chip offsetMs=0
      expect(map.get('chip')).toBe(0);
      expect(map.get('headline')).toBe(120);
      expect(map.get('subline')).toBe(360);
    });
  });

  describe('sequence 이동 시 상대좌표 layer 자동 추적', () => {
    it('sequence.startMs를 변경하면 상대좌표 layer의 실효 startMs가 따라간다', () => {
      const state = createMotionEditorState(composition);

      // cards sequence를 1700 → 2000으로 이동
      const next = applyMotionEditorCommand(state, {
        type: 'update-item-timing',
        itemKind: 'sequence',
        itemId: 'cards',
        startMs: 2000,
        durationMs: 2800,
      });

      const map = buildResolvedLayerStartMap(next.composition);

      // card-a: 2000 + 150 = 2150 (기존 1850에서 자동 이동)
      expect(map.get('card-a')).toBe(2000 + 150);
      expect(map.get('card-b')).toBe(2000 + 420);
      expect(map.get('card-c')).toBe(2000 + 690);
    });
  });

  describe('snapshot에서 상대좌표 반영', () => {
    it('상대좌표 layer가 올바른 시점에 active로 판정된다', () => {
      const resolved = resolveMotionComposition(composition);
      const assets = resolveMotionAssetSnapshots(resolved);

      // card-a의 실효 startMs = 1700 + 150 = 1850
      // time 1860 → card-a는 active
      const snapshot = createMotionDebugSnapshot(resolved, 1860, assets);
      expect(snapshot.activeLayerIds).toContain('card-a');

      // time 1840 → card-a는 아직 미시작
      const before = createMotionDebugSnapshot(resolved, 1840, assets);
      expect(before.activeLayerIds).not.toContain('card-a');
    });
  });

  describe('역할 기반 필터링', () => {
    it('슬롯에서 role별로 layer를 필터링할 수 있다', () => {
      const seq = findSequenceById(composition, 'intro')!;
      const slots = getSequenceLayerSlots(seq);

      const accents = slots.filter((s) => s.role === 'accent');
      const contents = slots.filter((s) => s.role === 'content');

      expect(accents).toHaveLength(1);
      expect(accents[0].layerId).toBe('chip');
      expect(contents).toHaveLength(2);
    });
  });
});
