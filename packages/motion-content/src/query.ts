// @def.boundary motion-content-system
import type {
  MotionCaptionCue,
  MotionCompositionDef,
  MotionItemKind,
  MotionLayerDef,
  MotionSequenceDef,
  MotionTimeSpan,
  MotionTransitionDef,
  SequenceLayerSlot,
} from "./model.js";
import type { MotionTransitionWindow } from "./types.js";
import { clamp, endMs } from "./utils.js";

export function findSequenceById(
  composition: MotionCompositionDef,
  sequenceId: string,
): MotionSequenceDef | undefined {
  return composition.sequences.find((sequence) => sequence.id === sequenceId);
}

export function findLayerById(
  composition: MotionCompositionDef,
  layerId: string,
): MotionLayerDef | undefined {
  return composition.layers.find((layer) => layer.id === layerId);
}

export function findCaptionById(
  composition: MotionCompositionDef,
  captionId: string,
): MotionCaptionCue | undefined {
  return composition.captions.find((caption) => caption.id === captionId);
}

export function findTransitionById(
  composition: MotionCompositionDef,
  transitionId: string,
): MotionTransitionDef | undefined {
  return composition.transitions.find((transition) => transition.id === transitionId);
}

/** kind 기반 제네릭 TimeSpan 조회 */
export function findTimeSpanById(
  composition: MotionCompositionDef,
  kind: MotionItemKind,
  id: string,
): MotionTimeSpan | undefined {
  switch (kind) {
    case "layer": return findLayerById(composition, id);
    case "sequence": return findSequenceById(composition, id);
    case "caption": return findCaptionById(composition, id);
  }
}

/** Sequence의 layer 슬롯을 반환한다.
 *  layers가 있으면 stagger 패턴 적용 후 반환.
 *  layers가 없으면 layerIds에서 offsetMs 없는 슬롯을 생성 */
export function getSequenceLayerSlots(
  sequence: MotionSequenceDef,
): readonly SequenceLayerSlot[] {
  if (!sequence.layers || sequence.layers.length === 0) {
    return sequence.layerIds.map((layerId, index) => ({ layerId, zIndex: index }));
  }
  if (!sequence.stagger) return sequence.layers;
  // stagger 패턴 적용: 개별 slot에 offsetMs가 명시되어 있으면 유지, 없으면 파생
  const { startOffsetMs, intervalMs } = sequence.stagger;
  return sequence.layers.map((slot, index) => ({
    ...slot,
    offsetMs: slot.offsetMs ?? startOffsetMs + index * intervalMs,
  }));
}

/** Layer의 실효 startMs를 결정한다.
 *  - slot.offsetMs 있으면 상대 좌표: sequence.startMs + offsetMs
 *  - slot.offsetMs 없으면 절대 좌표: layer.startMs */
export function resolveLayerStartMs(
  sequence: MotionSequenceDef,
  slot: SequenceLayerSlot,
  layer: MotionLayerDef,
): number {
  return slot.offsetMs !== undefined
    ? sequence.startMs + slot.offsetMs
    : layer.startMs;
}

/** Composition 전체에서 각 layer의 실효 startMs를 빌드한다.
 *  상대좌표(offsetMs) layer는 sequence.startMs + offsetMs로 계산.
 *  어떤 sequence에도 slot으로 바인딩되지 않은 layer는 layer.startMs(절대) 사용 */
export function buildResolvedLayerStartMap(
  composition: MotionCompositionDef,
): ReadonlyMap<string, number> {
  const result = new Map<string, number>();
  // 기본값: 절대 좌표
  for (const layer of composition.layers) {
    result.set(layer.id, layer.startMs);
  }
  // 상대 좌표 오버라이드
  for (const seq of composition.sequences) {
    for (const slot of getSequenceLayerSlots(seq)) {
      if (slot.offsetMs !== undefined) {
        result.set(slot.layerId, seq.startMs + slot.offsetMs);
      }
    }
  }
  return result;
}

export function resolveMotionTransitionWindow(
  composition: MotionCompositionDef,
  transition: MotionTransitionDef,
): MotionTransitionWindow {
  const boundaryMs = clamp(
    findSequenceById(composition, transition.toSequenceId)?.startMs ?? composition.durationMs,
    0,
    composition.durationMs,
  );
  const fromSequence = findSequenceById(composition, transition.fromSequenceId);
  const maxDurationMs = fromSequence
    ? boundaryMs <= endMs(fromSequence)
      ? Math.max(0, boundaryMs - fromSequence.startMs)
      : 0
    : boundaryMs;
  const durationMs = clamp(transition.durationMs, 0, maxDurationMs);
  return {
    boundaryMs,
    startMs: Math.max(0, boundaryMs - durationMs),
    durationMs,
    maxDurationMs,
  };
}
