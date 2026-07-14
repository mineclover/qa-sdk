// @def.boundary spec-engine-system
// @def.doc spec-engine-system

/**
 * Transition Spec 검증 — JSON Schema 수준 구조 검증.
 *
 * 축 이름/entry 값의 catalog 검증은 Tier 2에서 추가 (catalog 의존).
 * 이 단계에서는 구조적 형식만 검증한다.
 */

import type {
  ValidationResult,
  ValidationIssue,
  MatchMode,
  EffectKind,
} from './transition.types.js';
import { EFFECT_KINDS } from './transition.types.js';

// ── 정규 상수 ────────────────────────────────────────────────

const MATCH_MODES: readonly MatchMode[] = ['single', 'ordered', 'unordered', 'windowed'];

/** transition 이름 규칙: <domain>.<entity>.<operation> */
const TRANSITION_NAME_RE = /^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*){1,3}$/;

/** bind 경로 규칙: $.events[N].field 또는 $.events[N].payload.field */
const BIND_PATH_RE = /^\$\.events\[\d+\]\.[a-zA-Z_][a-zA-Z0-9_.]*$/;

/** 축 이름 규칙: snake_case (DEMO_CATALOG 축 이름 형식) */
const AXIS_NAME_RE = /^[a-z][a-z0-9_]*$/;

type JsonObject = Record<string, unknown>;

function isRecord(value: unknown): value is JsonObject {
  return !!value && typeof value === 'object';
}

// ── 검증 함수 ────────────────────────────────────────────────

export function validateTransitionSpec(spec: unknown): ValidationResult {
  const issues: ValidationIssue[] = [];

  if (spec === null || typeof spec !== 'object') {
    return { valid: false, issues: [{ path: '', message: 'spec must be an object' }] };
  }

  const s = spec as JsonObject;

  // transition name
  validateTransitionName(s.transition, issues);

  // version
  if (typeof s.version !== 'string' || s.version.length === 0) {
    issues.push({ path: 'version', message: 'version must be a non-empty string' });
  }

  // match
  validateMatch(s.match, issues);

  // bind
  validateBind(s.bind, issues);

  // input
  validateInput(s.input, issues);

  // output
  validateOutput(s.output, issues);

  // effect
  validateEffect(s.effect, issues);

  return { valid: issues.length === 0, issues };
}

// ── 내부 검증 ────────────────────────────────────────────────

function validateTransitionName(name: unknown, issues: ValidationIssue[]): void {
  if (typeof name !== 'string') {
    issues.push({ path: 'transition', message: 'transition must be a string' });
    return;
  }
  if (!TRANSITION_NAME_RE.test(name)) {
    issues.push({
      path: 'transition',
      message: `transition name must match <domain>.<entity>.<operation> pattern (lowercase, dot-separated): "${name}"`,
    });
  }
}

function validateMatch(match: unknown, issues: ValidationIssue[]): void {
  if (match === null || typeof match !== 'object') {
    issues.push({ path: 'match', message: 'match must be an object' });
    return;
  }

  const m = match as JsonObject;

  if (!MATCH_MODES.includes(m.mode as MatchMode)) {
    issues.push({
      path: 'match.mode',
      message: `match.mode must be one of: ${MATCH_MODES.join(', ')}`,
    });
  }

  if (!Array.isArray(m.coordinates) || m.coordinates.length === 0) {
    issues.push({
      path: 'match.coordinates',
      message: 'match.coordinates must be a non-empty array',
    });
    return;
  }

  const coordinates = Array.isArray(m.coordinates) ? m.coordinates : [];
  if (m.mode === 'single' && coordinates.length !== 1) {
    issues.push({
      path: 'match.coordinates',
      message: 'single mode requires exactly 1 coordinate pattern',
    });
  }

  for (let i = 0; i < coordinates.length; i++) {
    const coord = coordinates[i];
    if (!isRecord(coord)) {
      issues.push({ path: `match.coordinates[${i}]`, message: 'coordinate must be an object' });
      continue;
    }
    const entries = Object.entries(coord);
    if (entries.length === 0) {
      issues.push({
        path: `match.coordinates[${i}]`,
        message: 'coordinate must have at least one dimension',
      });
    }
    for (const [key, val] of entries) {
      if (typeof val !== 'string') {
        issues.push({
          path: `match.coordinates[${i}].${key}`,
          message: 'dimension value must be a string',
        });
      }
    }
  }

  if (m.mode === 'windowed') {
    if (typeof m.window_ms !== 'number' || m.window_ms <= 0) {
      issues.push({
        path: 'match.window_ms',
        message: 'windowed mode requires positive window_ms',
      });
    }
  }
}

function validateBind(bind: unknown, issues: ValidationIssue[]): void {
  if (bind === null || typeof bind !== 'object') {
    issues.push({ path: 'bind', message: 'bind must be an object' });
    return;
  }

  const b = bind as JsonObject;

  for (const required of ['context_id', 'resource_id'] as const) {
    if (typeof b[required] !== 'string') {
      issues.push({ path: `bind.${required}`, message: `bind.${required} must be a string` });
    } else if (!BIND_PATH_RE.test(b[required] as string)) {
      issues.push({
        path: `bind.${required}`,
        message: `bind path must match $.events[N].field pattern: "${b[required]}"`,
      });
    }
  }

  for (const [key, val] of Object.entries(b)) {
    if (key === 'context_id' || key === 'resource_id') continue;
    if (typeof val !== 'string') {
      issues.push({ path: `bind.${key}`, message: `bind.${key} must be a string` });
    } else if (!BIND_PATH_RE.test(val)) {
      issues.push({
        path: `bind.${key}`,
        message: `bind path must match $.events[N].field pattern: "${val}"`,
      });
    }
  }
}

function validateInput(input: unknown, issues: ValidationIssue[]): void {
  if (input === null || typeof input !== 'object') {
    issues.push({ path: 'input', message: 'input must be an object' });
    return;
  }

  const inp = input as JsonObject;
  if (!Array.isArray(inp.all)) {
    issues.push({ path: 'input.all', message: 'input.all must be an array' });
    return;
  }

  for (let i = 0; i < inp.all.length; i++) {
    const cond = inp.all[i];
    if (!isRecord(cond)) {
      issues.push({ path: `input.all[${i}]`, message: 'condition must be an object' });
      continue;
    }
    if (typeof cond.axis !== 'string') {
      issues.push({ path: `input.all[${i}].axis`, message: 'axis must be a string' });
    } else if (!AXIS_NAME_RE.test(cond.axis as string)) {
      issues.push({
        path: `input.all[${i}].axis`,
        message: `axis must be a valid axis name (snake_case): "${cond.axis}"`,
      });
    }
    // 최소 1개 연산자 필요
    const hasOp = 'eq' in cond || 'neq' in cond || 'in' in cond || 'exists' in cond;
    if (!hasOp) {
      issues.push({
        path: `input.all[${i}]`,
        message: 'condition must have at least one operator (eq, neq, in, exists)',
      });
    }
    // eq, neq 값은 string만 (축 entry는 문자열)
    if ('eq' in cond && cond.eq !== null && typeof cond.eq !== 'string') {
      issues.push({ path: `input.all[${i}].eq`, message: 'eq must be a string or null' });
    }
    if ('neq' in cond && cond.neq !== null && typeof cond.neq !== 'string') {
      issues.push({ path: `input.all[${i}].neq`, message: 'neq must be a string or null' });
    }
    if ('in' in cond) {
      if (!Array.isArray(cond.in)) {
        issues.push({ path: `input.all[${i}].in`, message: 'in must be an array' });
      } else {
        for (let j = 0; j < cond.in.length; j++) {
          if (typeof cond.in[j] !== 'string') {
            issues.push({ path: `input.all[${i}].in[${j}]`, message: 'in values must be strings' });
          }
        }
      }
    }
    if ('exists' in cond && typeof cond.exists !== 'boolean') {
      issues.push({ path: `input.all[${i}].exists`, message: 'exists must be a boolean' });
    }
  }
}

function validateOutput(output: unknown, issues: ValidationIssue[]): void {
  if (output === null || typeof output !== 'object') {
    issues.push({ path: 'output', message: 'output must be an object' });
    return;
  }

  const out = output as JsonObject;
  if (!Array.isArray(out.set)) {
    issues.push({ path: 'output.set', message: 'output.set must be an array' });
    return;
  }

  for (let i = 0; i < out.set.length; i++) {
    const assign = out.set[i];
    if (!isRecord(assign)) {
      issues.push({ path: `output.set[${i}]`, message: 'assignment must be an object' });
      continue;
    }
    if (typeof assign.axis !== 'string') {
      issues.push({ path: `output.set[${i}].axis`, message: 'axis must be a string' });
    } else if (!AXIS_NAME_RE.test(assign.axis as string)) {
      issues.push({
        path: `output.set[${i}].axis`,
        message: `axis must be a valid axis name (snake_case): "${assign.axis}"`,
      });
    }
    if (!('value' in assign)) {
      issues.push({ path: `output.set[${i}].value`, message: 'value is required' });
    } else if (assign.value !== null && typeof assign.value !== 'string') {
      issues.push({ path: `output.set[${i}].value`, message: 'value must be a string or null' });
    }
  }
}

function validateEffect(effect: unknown, issues: ValidationIssue[]): void {
  if (effect === null || typeof effect !== 'object') {
    issues.push({ path: 'effect', message: 'effect must be an object' });
    return;
  }

  const e = effect as Record<string, unknown>;
  if (!EFFECT_KINDS.includes(e.kind as EffectKind)) {
    issues.push({
      path: 'effect.kind',
      message: `effect.kind must be one of: ${EFFECT_KINDS.join(', ')}`,
    });
  }
}
