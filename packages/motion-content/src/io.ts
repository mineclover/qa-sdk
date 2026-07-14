// @def.boundary motion-content-system
import type {
  MotionAssetDef,
  MotionCaptionCue,
  MotionCompositionDef,
  MotionCompositionDefV2,
  MotionLayerDef,
  MotionSceneDef,
  MotionSceneSequenceDef,
  MotionParameterDef,
  MotionSequenceDef,
  MotionStageTargetV1,
  MotionTargetDef,
  SceneLayerPlacement,
  MotionTransitionDef,
} from './model.js';
import { CONTENT_TYPE_AXIS, CONTENT_TYPE_IDS } from './content-types.js';

export const MOTION_COMPOSITION_SCHEMA_V1 = 'qa-sdk.motion-composition/v1';
export const MOTION_COMPOSITION_SCHEMA_V2 = 'qa-sdk.motion-composition/v2';

export interface MotionCompositionDocumentV1 {
  readonly schemaVersion: typeof MOTION_COMPOSITION_SCHEMA_V1;
  readonly composition: MotionCompositionDef;
}

export interface MotionCompositionDocumentV2 {
  readonly schemaVersion: typeof MOTION_COMPOSITION_SCHEMA_V2;
  readonly composition: MotionCompositionDefV2;
}

const MOTION_PARAMETER_TYPES = ['text', 'color', 'number', 'select'] as const;
const MOTION_CUE_KINDS = ['fade', 'slide-up', 'slide-left', 'slide-right', 'scale-pop'] as const;
const MOTION_TRANSITION_STYLES = ['crossfade', 'flash', 'lift'] as const;
const MOTION_CAPTION_TONES = ['neutral', 'accent', 'warning'] as const;
const MOTION_ASSET_TYPES = ['text', 'style'] as const;
const MOTION_STYLE_ASSET_PROPERTIES = ['background', 'color', 'borderColor'] as const;
const MOTION_STAGE_TARGET_KINDS = ['stage-node'] as const;

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function isString(value: unknown): value is string {
  return typeof value === 'string';
}

function isNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function hasOwn(record: Record<string, unknown>, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(record, key);
}

function describeValue(value: unknown): string {
  if (value === undefined) return 'undefined';
  if (value === null) return 'null';
  if (Array.isArray(value)) return 'array';
  return typeof value;
}

function formatPath(path: string, key: string): string {
  return `${path}.${key}`;
}

function pushMissingIssue(issues: string[], path: string, expected: string): void {
  issues.push(`${path}: 필수 ${expected} 필드가 없습니다.`);
}

function pushTypeIssue(issues: string[], path: string, expected: string, actual: unknown): void {
  issues.push(`${path}: ${expected}여야 하지만 ${describeValue(actual)}입니다.`);
}

function pushEnumIssue(
  issues: string[],
  path: string,
  expected: readonly string[],
  actual: unknown,
): void {
  issues.push(
    `${path}: ${expected.join(' | ')} 중 하나여야 하지만 ${JSON.stringify(actual)}입니다.`,
  );
}

function requireRecord(
  value: unknown,
  path: string,
  issues: string[],
): value is Record<string, unknown> {
  if (!isRecord(value)) {
    pushTypeIssue(issues, path, 'object', value);
    return false;
  }
  return true;
}

function requireString(
  record: Record<string, unknown>,
  key: string,
  path: string,
  issues: string[],
): string | null {
  if (!hasOwn(record, key)) {
    pushMissingIssue(issues, formatPath(path, key), 'string');
    return null;
  }
  const value = record[key];
  if (!isString(value)) {
    pushTypeIssue(issues, formatPath(path, key), 'string', value);
    return null;
  }
  return value;
}

function requireNumber(
  record: Record<string, unknown>,
  key: string,
  path: string,
  issues: string[],
): number | null {
  if (!hasOwn(record, key)) {
    pushMissingIssue(issues, formatPath(path, key), 'number');
    return null;
  }
  const value = record[key];
  if (!isNumber(value)) {
    pushTypeIssue(issues, formatPath(path, key), 'number', value);
    return null;
  }
  return value;
}

function requireEnum<T extends string>(
  record: Record<string, unknown>,
  key: string,
  path: string,
  issues: string[],
  expected: readonly T[],
): T | null {
  const value = requireString(record, key, path, issues);
  if (value === null) return null;
  if (!expected.includes(value as T)) {
    pushEnumIssue(issues, formatPath(path, key), expected, value);
    return null;
  }
  return value as T;
}

function requireArray(
  record: Record<string, unknown>,
  key: string,
  path: string,
  issues: string[],
): readonly unknown[] | null {
  if (!hasOwn(record, key)) {
    pushMissingIssue(issues, formatPath(path, key), 'array');
    return null;
  }
  const value = record[key];
  if (!Array.isArray(value)) {
    pushTypeIssue(issues, formatPath(path, key), 'array', value);
    return null;
  }
  return value;
}

function optionalNumber(
  record: Record<string, unknown>,
  key: string,
  path: string,
  issues: string[],
): void {
  if (!hasOwn(record, key) || record[key] === undefined) return;
  if (!isNumber(record[key])) {
    pushTypeIssue(issues, formatPath(path, key), 'number', record[key]);
  }
}

function optionalString(
  record: Record<string, unknown>,
  key: string,
  path: string,
  issues: string[],
): void {
  if (!hasOwn(record, key) || record[key] === undefined) return;
  if (!isString(record[key])) {
    pushTypeIssue(issues, formatPath(path, key), 'string', record[key]);
  }
}

function optionalEnum<T extends string>(
  record: Record<string, unknown>,
  key: string,
  path: string,
  issues: string[],
  expected: readonly T[],
): void {
  if (!hasOwn(record, key) || record[key] === undefined) return;
  if (!isString(record[key])) {
    pushTypeIssue(issues, formatPath(path, key), 'string', record[key]);
    return;
  }
  if (!expected.includes(record[key] as T)) {
    pushEnumIssue(issues, formatPath(path, key), expected, record[key]);
  }
}

function optionalStringArray(
  record: Record<string, unknown>,
  key: string,
  path: string,
  issues: string[],
): void {
  if (!hasOwn(record, key) || record[key] === undefined) return;
  const value = record[key];
  if (!Array.isArray(value)) {
    pushTypeIssue(issues, formatPath(path, key), 'array', value);
    return;
  }
  value.forEach((entry, index) => {
    if (!isString(entry)) {
      pushTypeIssue(issues, `${formatPath(path, key)}[${index}]`, 'string', entry);
    }
  });
}

function validateInlineCue(value: Record<string, unknown>, path: string, issues: string[]): void {
  requireEnum(value, 'kind', path, issues, MOTION_CUE_KINDS);
  requireNumber(value, 'durationMs', path, issues);
  optionalString(value, 'ease', path, issues);
  optionalNumber(value, 'amount', path, issues);
  optionalNumber(value, 'opacity', path, issues);
  optionalNumber(value, 'overlapMs', path, issues);
}

function validateCuePreset(value: unknown, path: string, issues: string[]): boolean {
  if (!requireRecord(value, path, issues)) return false;
  requireString(value, 'id', path, issues);
  requireString(value, 'label', path, issues);
  validateInlineCue(value, path, issues);
  return true;
}

/** CueRef 검증 — { preset: string } 또는 인라인 MotionCueDef */
function validateCueRef(value: unknown, path: string, issues: string[]): boolean {
  if (!requireRecord(value, path, issues)) return false;
  if (hasOwn(value, 'preset') && isString(value.preset)) {
    // preset 참조 — 참조 무결성은 composition 레벨에서 검증
    return true;
  }
  validateInlineCue(value, path, issues);
  return true;
}

function validateStageTarget(
  value: unknown,
  path: string,
  issues: string[],
): value is MotionStageTargetV1 {
  if (!requireRecord(value, path, issues)) return false;
  requireEnum(value, 'kind', path, issues, MOTION_STAGE_TARGET_KINDS);
  requireString(value, 'nodeId', path, issues);
  return true;
}

function validateParameter(
  value: unknown,
  path: string,
  issues: string[],
): value is MotionParameterDef {
  if (!requireRecord(value, path, issues)) return false;
  requireString(value, 'id', path, issues);
  requireString(value, 'label', path, issues);
  const type = requireEnum(value, 'type', path, issues, MOTION_PARAMETER_TYPES);
  if (!hasOwn(value, 'defaultValue')) {
    pushMissingIssue(issues, formatPath(path, 'defaultValue'), 'string 또는 number');
  } else {
    const defaultValue = value.defaultValue;
    if (!isString(defaultValue) && !isNumber(defaultValue)) {
      pushTypeIssue(issues, formatPath(path, 'defaultValue'), 'string 또는 number', defaultValue);
    }
    if (type === 'number' && !isNumber(defaultValue)) {
      pushTypeIssue(issues, formatPath(path, 'defaultValue'), 'number', defaultValue);
    }
    if ((type === 'text' || type === 'color' || type === 'select') && !isString(defaultValue)) {
      pushTypeIssue(issues, formatPath(path, 'defaultValue'), 'string', defaultValue);
    }
  }

  optionalNumber(value, 'min', path, issues);
  optionalNumber(value, 'max', path, issues);
  optionalNumber(value, 'step', path, issues);

  if (hasOwn(value, 'options') && value.options !== undefined) {
    if (!Array.isArray(value.options)) {
      pushTypeIssue(issues, formatPath(path, 'options'), 'array', value.options);
    } else {
      value.options.forEach((entry, index) => {
        const optionPath = `${formatPath(path, 'options')}[${index}]`;
        if (!requireRecord(entry, optionPath, issues)) return;
        requireString(entry, 'value', optionPath, issues);
        requireString(entry, 'label', optionPath, issues);
      });
    }
  } else if (type === 'select') {
    pushMissingIssue(issues, formatPath(path, 'options'), 'array');
  }

  return true;
}

function validateAsset(value: unknown, path: string, issues: string[]): value is MotionAssetDef {
  if (!requireRecord(value, path, issues)) return false;
  requireString(value, 'id', path, issues);
  const type = requireEnum(value, 'type', path, issues, MOTION_ASSET_TYPES);
  if (!hasOwn(value, 'target')) {
    pushMissingIssue(issues, formatPath(path, 'target'), 'object');
  } else {
    validateStageTarget(value.target, formatPath(path, 'target'), issues);
  }
  requireString(value, 'template', path, issues);
  if (type === 'style') {
    requireEnum(value, 'property', path, issues, MOTION_STYLE_ASSET_PROPERTIES);
  }
  return true;
}

/** 축 기반 콘텐츠 타입 검증 — CONTENT_TYPE_AXIS에서 파생 */
function validateLayerContent(value: unknown, path: string, issues: string[]): void {
  if (!requireRecord(value, path, issues)) return;
  const type = requireEnum(value, 'type', path, issues, CONTENT_TYPE_IDS);
  if (!type) return;

  const entry = CONTENT_TYPE_AXIS.find((e) => e.id === type);
  if (!entry) return;

  for (const prop of entry.properties) {
    if (prop.required) {
      if (prop.type === 'string') requireString(value, prop.key, path, issues);
      else if (prop.type === 'number') requireNumber(value, prop.key, path, issues);
    } else {
      if (prop.type === 'string') {
        if (prop.options) {
          optionalEnum(value, prop.key, path, issues, prop.options);
        } else {
          optionalString(value, prop.key, path, issues);
        }
      } else if (prop.type === 'number') {
        optionalNumber(value, prop.key, path, issues);
      }
      // boolean은 optional이면 별도 검증 생략 (JSON boolean은 자명)
    }
  }
}

function validateLayer(value: unknown, path: string, issues: string[]): value is MotionLayerDef {
  if (!requireRecord(value, path, issues)) return false;
  requireString(value, 'id', path, issues);
  requireString(value, 'label', path, issues);
  if (!hasOwn(value, 'target')) {
    pushMissingIssue(issues, formatPath(path, 'target'), 'object');
  } else {
    validateStageTarget(value.target, formatPath(path, 'target'), issues);
  }
  requireNumber(value, 'startMs', path, issues);
  requireNumber(value, 'durationMs', path, issues);

  if (hasOwn(value, 'content') && value.content !== undefined) {
    validateLayerContent(value.content, formatPath(path, 'content'), issues);
  }

  if (!hasOwn(value, 'enter')) {
    pushMissingIssue(issues, formatPath(path, 'enter'), 'object');
  } else {
    validateCueRef(value.enter, formatPath(path, 'enter'), issues);
  }

  if (hasOwn(value, 'exit') && value.exit !== undefined) {
    validateCueRef(value.exit, formatPath(path, 'exit'), issues);
  }

  return true;
}

const SEQUENCE_LAYER_SLOT_ROLES = ['background', 'content', 'overlay', 'accent'] as const;

function validateSequenceLayerSlot(value: unknown, path: string, issues: string[]): boolean {
  if (!requireRecord(value, path, issues)) return false;
  requireString(value, 'layerId', path, issues);
  optionalNumber(value, 'offsetMs', path, issues);
  optionalNumber(value, 'zIndex', path, issues);
  optionalEnum(value, 'role', path, issues, SEQUENCE_LAYER_SLOT_ROLES);
  return true;
}

function validateSequence(
  value: unknown,
  path: string,
  issues: string[],
): value is MotionSequenceDef {
  if (!requireRecord(value, path, issues)) return false;
  requireString(value, 'id', path, issues);
  requireString(value, 'title', path, issues);
  requireNumber(value, 'startMs', path, issues);
  requireNumber(value, 'durationMs', path, issues);

  // layers (슬롯 기반) 또는 layerIds (단순 참조) 중 하나 이상 필수
  const hasLayers = hasOwn(value, 'layers') && Array.isArray(value.layers);
  const hasLayerIds = hasOwn(value, 'layerIds') && Array.isArray(value.layerIds);

  if (hasLayers) {
    (value.layers as readonly unknown[]).forEach((entry, index) => {
      validateSequenceLayerSlot(entry, `${formatPath(path, 'layers')}[${index}]`, issues);
    });
  }

  if (hasLayerIds) {
    (value.layerIds as readonly unknown[]).forEach((entry, index) => {
      if (!isString(entry)) {
        pushTypeIssue(issues, `${formatPath(path, 'layerIds')}[${index}]`, 'string', entry);
      }
    });
  }

  if (!hasLayers && !hasLayerIds) {
    pushMissingIssue(issues, formatPath(path, 'layerIds'), 'array');
  }

  // stagger (선택)
  if (hasOwn(value, 'stagger') && value.stagger !== undefined) {
    const staggerPath = formatPath(path, 'stagger');
    if (requireRecord(value.stagger, staggerPath, issues)) {
      requireNumber(value.stagger, 'startOffsetMs', staggerPath, issues);
      requireNumber(value.stagger, 'intervalMs', staggerPath, issues);
    }
  }

  optionalStringArray(value, 'captionIds', path, issues);
  return true;
}

function validateCaption(
  value: unknown,
  path: string,
  issues: string[],
): value is MotionCaptionCue {
  if (!requireRecord(value, path, issues)) return false;
  requireString(value, 'id', path, issues);
  requireString(value, 'text', path, issues);
  requireNumber(value, 'startMs', path, issues);
  requireNumber(value, 'durationMs', path, issues);
  optionalEnum(value, 'tone', path, issues, MOTION_CAPTION_TONES);
  return true;
}

function validateTransitionParams(
  value: Record<string, unknown>,
  style: string,
  path: string,
  issues: string[],
): void {
  if (style === 'crossfade') {
    optionalNumber(value, 'brightness', path, issues);
  } else if (style === 'flash') {
    optionalString(value, 'glowColor', path, issues);
    optionalNumber(value, 'glowSize', path, issues);
  } else if (style === 'lift') {
    optionalNumber(value, 'liftY', path, issues);
  }
}

function validateTransition(
  value: unknown,
  path: string,
  issues: string[],
): value is MotionTransitionDef {
  if (!requireRecord(value, path, issues)) return false;
  requireString(value, 'id', path, issues);
  requireString(value, 'fromSequenceId', path, issues);
  requireString(value, 'toSequenceId', path, issues);
  const style = requireEnum(value, 'style', path, issues, MOTION_TRANSITION_STYLES);
  requireNumber(value, 'durationMs', path, issues);
  if (style && hasOwn(value, 'params') && value.params !== undefined) {
    const paramsPath = formatPath(path, 'params');
    if (requireRecord(value.params, paramsPath, issues)) {
      validateTransitionParams(value.params, style, paramsPath, issues);
    }
  }
  return true;
}

function validateSharedCompositionFields(
  value: Record<string, unknown>,
  path: string,
  issues: string[],
): void {
  requireString(value, 'id', path, issues);
  requireString(value, 'title', path, issues);
  requireString(value, 'description', path, issues);
  requireNumber(value, 'durationMs', path, issues);

  const parameters = requireArray(value, 'parameters', path, issues);
  parameters?.forEach((entry, index) => {
    validateParameter(entry, `${path}.parameters[${index}]`, issues);
  });

  // cuePresets (선택)
  if (hasOwn(value, 'cuePresets') && value.cuePresets !== undefined) {
    if (!Array.isArray(value.cuePresets)) {
      pushTypeIssue(issues, formatPath(path, 'cuePresets'), 'array', value.cuePresets);
    } else {
      (value.cuePresets as readonly unknown[]).forEach((entry, index) => {
        validateCuePreset(entry, `${path}.cuePresets[${index}]`, issues);
      });
    }
  }

  const assets = requireArray(value, 'assets', path, issues);
  assets?.forEach((entry, index) => {
    validateAsset(entry, `${path}.assets[${index}]`, issues);
  });
}

function validateMotionTarget(
  value: unknown,
  path: string,
  issues: string[],
): value is MotionTargetDef {
  if (!requireRecord(value, path, issues)) return false;
  requireString(value, 'id', path, issues);
  if (!hasOwn(value, 'target')) {
    pushMissingIssue(issues, formatPath(path, 'target'), 'object');
  } else {
    validateStageTarget(value.target, formatPath(path, 'target'), issues);
  }
  if (hasOwn(value, 'content') && value.content !== undefined) {
    validateLayerContent(value.content, formatPath(path, 'content'), issues);
  }
  return true;
}

function validateSceneLayerPlacement(
  value: unknown,
  path: string,
  issues: string[],
): value is SceneLayerPlacement {
  if (!requireRecord(value, path, issues)) return false;
  requireString(value, 'targetId', path, issues);
  requireNumber(value, 'startMs', path, issues);
  requireNumber(value, 'durationMs', path, issues);

  if (!hasOwn(value, 'enter')) {
    pushMissingIssue(issues, formatPath(path, 'enter'), 'object');
  } else {
    validateCueRef(value.enter, formatPath(path, 'enter'), issues);
  }

  if (hasOwn(value, 'exit') && value.exit !== undefined) {
    validateCueRef(value.exit, formatPath(path, 'exit'), issues);
  }

  return true;
}

function validateSceneSequenceTargetSlot(value: unknown, path: string, issues: string[]): boolean {
  if (!requireRecord(value, path, issues)) return false;
  requireString(value, 'targetId', path, issues);
  optionalNumber(value, 'offsetMs', path, issues);
  optionalNumber(value, 'zIndex', path, issues);
  optionalEnum(value, 'role', path, issues, SEQUENCE_LAYER_SLOT_ROLES);
  return true;
}

function validateSceneSequence(
  value: unknown,
  path: string,
  issues: string[],
): value is MotionSceneSequenceDef {
  if (!requireRecord(value, path, issues)) return false;
  requireString(value, 'id', path, issues);
  requireString(value, 'title', path, issues);
  requireNumber(value, 'startMs', path, issues);
  requireNumber(value, 'durationMs', path, issues);

  const targetIds = requireArray(value, 'targetIds', path, issues);
  targetIds?.forEach((entry, index) => {
    if (!isString(entry)) {
      pushTypeIssue(issues, `${formatPath(path, 'targetIds')}[${index}]`, 'string', entry);
    }
  });

  if (hasOwn(value, 'layers') && value.layers !== undefined) {
    if (!Array.isArray(value.layers)) {
      pushTypeIssue(issues, formatPath(path, 'layers'), 'array', value.layers);
    } else {
      value.layers.forEach((entry, index) => {
        validateSceneSequenceTargetSlot(entry, `${formatPath(path, 'layers')}[${index}]`, issues);
      });
    }
  }

  if (hasOwn(value, 'stagger') && value.stagger !== undefined) {
    const staggerPath = formatPath(path, 'stagger');
    if (requireRecord(value.stagger, staggerPath, issues)) {
      requireNumber(value.stagger, 'startOffsetMs', staggerPath, issues);
      requireNumber(value.stagger, 'intervalMs', staggerPath, issues);
    }
  }

  optionalStringArray(value, 'captionIds', path, issues);
  return true;
}

function validateScene(value: unknown, path: string, issues: string[]): value is MotionSceneDef {
  if (!requireRecord(value, path, issues)) return false;
  requireString(value, 'id', path, issues);
  requireString(value, 'title', path, issues);
  requireNumber(value, 'startMs', path, issues);
  requireNumber(value, 'durationMs', path, issues);

  const layers = requireArray(value, 'layers', path, issues);
  layers?.forEach((entry, index) => {
    validateSceneLayerPlacement(entry, `${path}.layers[${index}]`, issues);
  });

  const sequences = requireArray(value, 'sequences', path, issues);
  sequences?.forEach((entry, index) => {
    validateSceneSequence(entry, `${path}.sequences[${index}]`, issues);
  });

  const captions = requireArray(value, 'captions', path, issues);
  captions?.forEach((entry, index) => {
    validateCaption(entry, `${path}.captions[${index}]`, issues);
  });

  return true;
}

function validateMotionCompositionAtPath(value: unknown, path: string, issues: string[]): void {
  if (!requireRecord(value, path, issues)) return;

  validateSharedCompositionFields(value, path, issues);

  const layers = requireArray(value, 'layers', path, issues);
  layers?.forEach((entry, index) => {
    validateLayer(entry, `${path}.layers[${index}]`, issues);
  });

  const sequences = requireArray(value, 'sequences', path, issues);
  sequences?.forEach((entry, index) => {
    validateSequence(entry, `${path}.sequences[${index}]`, issues);
  });

  const captions = requireArray(value, 'captions', path, issues);
  captions?.forEach((entry, index) => {
    validateCaption(entry, `${path}.captions[${index}]`, issues);
  });

  const transitions = requireArray(value, 'transitions', path, issues);
  transitions?.forEach((entry, index) => {
    validateTransition(entry, `${path}.transitions[${index}]`, issues);
  });

  // 참조 무결성 검증 (shape 검증 통과 후)
  if (issues.length > 0) return;

  const comp = value as Record<string, unknown>;
  const validLayerIds = new Set((comp.layers as readonly { id: string }[]).map((l) => l.id));
  const sequenceIds = new Set((comp.sequences as readonly { id: string }[]).map((s) => s.id));
  const captionIds = new Set((comp.captions as readonly { id: string }[]).map((c) => c.id));
  const cuePresetIds = new Set(
    Array.isArray(comp.cuePresets)
      ? (comp.cuePresets as readonly { id: string }[]).map((p) => p.id)
      : [],
  );

  // cue preset 참조 검증
  type LayerLike = { id: string; enter: { preset?: string }; exit?: { preset?: string } };
  for (const [index, layer] of (comp.layers as readonly LayerLike[]).entries()) {
    if (layer.enter?.preset && !cuePresetIds.has(layer.enter.preset)) {
      issues.push(
        `${path}.layers[${index}].enter.preset: 존재하지 않는 cuePreset "${layer.enter.preset}"를 참조합니다.`,
      );
    }
    if (layer.exit?.preset && !cuePresetIds.has(layer.exit.preset)) {
      issues.push(
        `${path}.layers[${index}].exit.preset: 존재하지 않는 cuePreset "${layer.exit.preset}"를 참조합니다.`,
      );
    }
  }

  type SeqLike = {
    id: string;
    layers?: readonly { layerId: string }[];
    layerIds?: readonly string[];
    captionIds?: readonly string[];
  };

  (comp.sequences as readonly SeqLike[]).forEach((seq, index) => {
    // layers 슬롯 기반 참조 검증
    if (seq.layers) {
      for (const slot of seq.layers) {
        if (!validLayerIds.has(slot.layerId)) {
          issues.push(
            `${path}.sequences[${index}].layers: 존재하지 않는 layer "${slot.layerId}"를 참조합니다.`,
          );
        }
      }
    }
    // layerIds 기반 참조 검증
    if (seq.layerIds) {
      for (const layerId of seq.layerIds) {
        if (!validLayerIds.has(layerId)) {
          issues.push(
            `${path}.sequences[${index}].layerIds: 존재하지 않는 layer "${layerId}"를 참조합니다.`,
          );
        }
      }
    }
    if (seq.captionIds) {
      for (const captionId of seq.captionIds) {
        if (!captionIds.has(captionId)) {
          issues.push(
            `${path}.sequences[${index}].captionIds: 존재하지 않는 caption "${captionId}"를 참조합니다.`,
          );
        }
      }
    }
  });

  (
    comp.transitions as readonly { id: string; fromSequenceId: string; toSequenceId: string }[]
  ).forEach((tr, index) => {
    if (!sequenceIds.has(tr.fromSequenceId)) {
      issues.push(
        `${path}.transitions[${index}].fromSequenceId: 존재하지 않는 sequence "${tr.fromSequenceId}"를 참조합니다.`,
      );
    }
    if (!sequenceIds.has(tr.toSequenceId)) {
      issues.push(
        `${path}.transitions[${index}].toSequenceId: 존재하지 않는 sequence "${tr.toSequenceId}"를 참조합니다.`,
      );
    }
  });
}

function validateMotionCompositionV2AtPath(value: unknown, path: string, issues: string[]): void {
  if (!requireRecord(value, path, issues)) return;

  validateSharedCompositionFields(value, path, issues);

  const targets = requireArray(value, 'targets', path, issues);
  targets?.forEach((entry, index) => {
    validateMotionTarget(entry, `${path}.targets[${index}]`, issues);
  });

  const scenes = requireArray(value, 'scenes', path, issues);
  scenes?.forEach((entry, index) => {
    validateScene(entry, `${path}.scenes[${index}]`, issues);
  });

  if (issues.length > 0) return;

  const comp = value as Record<string, unknown>;
  const targetIds = new Set((comp.targets as readonly { id: string }[]).map((target) => target.id));
  const cuePresetIds = new Set(
    Array.isArray(comp.cuePresets)
      ? (comp.cuePresets as readonly { id: string }[]).map((preset) => preset.id)
      : [],
  );

  type SceneLike = {
    layers: readonly { targetId: string; enter: { preset?: string }; exit?: { preset?: string } }[];
    sequences: readonly {
      targetIds: readonly string[];
      layers?: readonly { targetId: string }[];
      captionIds?: readonly string[];
    }[];
    captions: readonly { id: string }[];
  };

  (comp.scenes as readonly SceneLike[]).forEach((scene, sceneIndex) => {
    const sceneTargetIds = new Set(scene.layers.map((layer) => layer.targetId));
    const sceneCaptionIds = new Set(scene.captions.map((caption) => caption.id));

    scene.layers.forEach((placement, placementIndex) => {
      if (!targetIds.has(placement.targetId)) {
        issues.push(
          `${path}.scenes[${sceneIndex}].layers[${placementIndex}].targetId: 존재하지 않는 target "${placement.targetId}"를 참조합니다.`,
        );
      }
      if (placement.enter?.preset && !cuePresetIds.has(placement.enter.preset)) {
        issues.push(
          `${path}.scenes[${sceneIndex}].layers[${placementIndex}].enter.preset: 존재하지 않는 cuePreset "${placement.enter.preset}"를 참조합니다.`,
        );
      }
      if (placement.exit?.preset && !cuePresetIds.has(placement.exit.preset)) {
        issues.push(
          `${path}.scenes[${sceneIndex}].layers[${placementIndex}].exit.preset: 존재하지 않는 cuePreset "${placement.exit.preset}"를 참조합니다.`,
        );
      }
    });

    scene.sequences.forEach((sequence, sequenceIndex) => {
      for (const targetId of sequence.targetIds) {
        if (!sceneTargetIds.has(targetId)) {
          issues.push(
            `${path}.scenes[${sceneIndex}].sequences[${sequenceIndex}].targetIds: scene.layers에 배치되지 않은 target "${targetId}"를 참조합니다.`,
          );
        }
      }
      for (const slot of sequence.layers ?? []) {
        if (!sceneTargetIds.has(slot.targetId)) {
          issues.push(
            `${path}.scenes[${sceneIndex}].sequences[${sequenceIndex}].layers: scene.layers에 배치되지 않은 target "${slot.targetId}"를 참조합니다.`,
          );
        }
      }
      for (const captionId of sequence.captionIds ?? []) {
        if (!sceneCaptionIds.has(captionId)) {
          issues.push(
            `${path}.scenes[${sceneIndex}].sequences[${sequenceIndex}].captionIds: scene.captions에 없는 caption "${captionId}"를 참조합니다.`,
          );
        }
      }
    });
  });
}

export function validateMotionComposition(value: unknown): string[] {
  const issues: string[] = [];
  validateMotionCompositionAtPath(value, '$', issues);
  return issues;
}

export function validateMotionCompositionV2(value: unknown): string[] {
  const issues: string[] = [];
  validateMotionCompositionV2AtPath(value, '$', issues);
  return issues;
}

export function createMotionCompositionDocument(
  composition: MotionCompositionDef,
): MotionCompositionDocumentV1 {
  return {
    schemaVersion: MOTION_COMPOSITION_SCHEMA_V1,
    composition,
  };
}

export function createMotionCompositionDocumentV2(
  composition: MotionCompositionDefV2,
): MotionCompositionDocumentV2 {
  return {
    schemaVersion: MOTION_COMPOSITION_SCHEMA_V2,
    composition,
  };
}

export function validateMotionCompositionDocument(value: unknown): string[] {
  const issues: string[] = [];
  if (!requireRecord(value, '$', issues)) return issues;

  if (!hasOwn(value, 'schemaVersion')) {
    pushMissingIssue(issues, '$.schemaVersion', 'string');
  } else if (!isString(value.schemaVersion)) {
    pushTypeIssue(issues, '$.schemaVersion', 'string', value.schemaVersion);
  } else if (value.schemaVersion !== MOTION_COMPOSITION_SCHEMA_V1) {
    issues.push(
      `$.schemaVersion: ${MOTION_COMPOSITION_SCHEMA_V1}여야 하지만 ${JSON.stringify(value.schemaVersion)}입니다.`,
    );
  }

  if (!hasOwn(value, 'composition')) {
    pushMissingIssue(issues, '$.composition', 'object');
  } else {
    validateMotionCompositionAtPath(value.composition, '$.composition', issues);
  }

  return issues;
}

export function validateMotionCompositionDocumentV2(value: unknown): string[] {
  const issues: string[] = [];
  if (!requireRecord(value, '$', issues)) return issues;

  if (!hasOwn(value, 'schemaVersion')) {
    pushMissingIssue(issues, '$.schemaVersion', 'string');
  } else if (!isString(value.schemaVersion)) {
    pushTypeIssue(issues, '$.schemaVersion', 'string', value.schemaVersion);
  } else if (value.schemaVersion !== MOTION_COMPOSITION_SCHEMA_V2) {
    issues.push(
      `$.schemaVersion: ${MOTION_COMPOSITION_SCHEMA_V2}여야 하지만 ${JSON.stringify(value.schemaVersion)}입니다.`,
    );
  }

  if (!hasOwn(value, 'composition')) {
    pushMissingIssue(issues, '$.composition', 'object');
  } else {
    validateMotionCompositionV2AtPath(value.composition, '$.composition', issues);
  }

  return issues;
}

export function isMotionCompositionDef(value: unknown): value is MotionCompositionDef {
  return validateMotionComposition(value).length === 0;
}

export function isMotionCompositionDefV2(value: unknown): value is MotionCompositionDefV2 {
  return validateMotionCompositionV2(value).length === 0;
}

export function isMotionCompositionDocumentV1(
  value: unknown,
): value is MotionCompositionDocumentV1 {
  return validateMotionCompositionDocument(value).length === 0;
}

export function isMotionCompositionDocumentV2(
  value: unknown,
): value is MotionCompositionDocumentV2 {
  return validateMotionCompositionDocumentV2(value).length === 0;
}

export class MotionCompositionParseError extends Error {
  readonly issues: readonly string[];

  constructor(issues: readonly string[]) {
    super(
      issues.length === 1
        ? issues[0]
        : `MotionComposition JSON 검증 실패\n- ${issues.join('\n- ')}`,
    );
    this.name = 'MotionCompositionParseError';
    this.issues = issues;
  }
}

export function serializeMotionComposition(composition: MotionCompositionDef): string {
  return JSON.stringify(createMotionCompositionDocument(composition), null, 2);
}

export function serializeMotionCompositionV2(composition: MotionCompositionDefV2): string {
  return JSON.stringify(createMotionCompositionDocumentV2(composition), null, 2);
}

/** layers 슬롯 기준으로 layerIds 파생 + 상대좌표 layer.startMs 동기화 */
function normalizeFromSlots(composition: MotionCompositionDef): MotionCompositionDef {
  const hasSlots = composition.sequences.some((seq) => seq.layers && seq.layers.length > 0);
  if (!hasSlots) return composition;

  // 1. layerIds 파생
  const sequences = composition.sequences.map((seq) => {
    if (!seq.layers || seq.layers.length === 0) return seq;
    return { ...seq, layerIds: seq.layers.map((slot) => slot.layerId) };
  });

  // 2. 상대좌표 layer.startMs 동기화
  const resolvedStarts = new Map<string, number>();
  for (const seq of sequences) {
    if (!seq.layers) continue;
    for (const slot of seq.layers) {
      if (slot.offsetMs !== undefined) {
        resolvedStarts.set(slot.layerId, seq.startMs + slot.offsetMs);
      }
    }
  }

  if (resolvedStarts.size === 0) return { ...composition, sequences };

  const layers = composition.layers.map((layer) => {
    const resolved = resolvedStarts.get(layer.id);
    return resolved !== undefined ? { ...layer, startMs: resolved } : layer;
  });

  return { ...composition, sequences, layers };
}

export function parseMotionComposition(json: string): MotionCompositionDef {
  let parsed: unknown;
  try {
    parsed = JSON.parse(json) as unknown;
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    throw new MotionCompositionParseError([`$: JSON 파싱에 실패했습니다. ${reason}`]);
  }
  const issues = validateMotionCompositionDocument(parsed);
  if (issues.length > 0) {
    throw new MotionCompositionParseError(issues);
  }
  return normalizeFromSlots((parsed as MotionCompositionDocumentV1).composition);
}

export function parseMotionCompositionV2(json: string): MotionCompositionDefV2 {
  let parsed: unknown;
  try {
    parsed = JSON.parse(json) as unknown;
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    throw new MotionCompositionParseError([`$: JSON 파싱에 실패했습니다. ${reason}`]);
  }
  const issues = validateMotionCompositionDocumentV2(parsed);
  if (issues.length > 0) {
    throw new MotionCompositionParseError(issues);
  }
  return (parsed as MotionCompositionDocumentV2).composition;
}
