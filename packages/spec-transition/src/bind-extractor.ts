// @def.boundary spec-engine-system
// @def.doc spec-engine-system

/**
 * Bind Extractor — raw event에서 identity 추출.
 *
 * 경로 형식: `$.events[N].field` 또는 `$.events[N].payload.field`
 * 깊이 2까지만 지원. 전체 JSONPath가 아닌 제한된 문법.
 */

import type { BindDef } from './transition.types.js';

type JsonValue = string | number | boolean | null | JsonObject | readonly JsonValue[];

interface JsonObject {
  readonly [key: string]: JsonValue;
}

export interface BindEventObject {
  readonly [key: string]: JsonValue;
}

function isJsonObject(value: JsonValue | undefined): value is JsonObject {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

/** bind 경로 파싱 결과 */
interface ParsedPath {
  readonly eventIndex: number;
  readonly fieldPath: readonly string[];
}

/** $.events[N].field.subfield 형식 파싱 */
function parsePath(path: string): ParsedPath | null {
  const match = path.match(/^\$\.events\[(\d+)\]\.(.+)$/);
  if (!match) return null;
  return {
    eventIndex: Number(match[1]),
    fieldPath: match[2].split('.'),
  };
}

/** 객체에서 중첩 필드 추출 (깊이 2까지) */
function extractField(obj: JsonValue, fieldPath: readonly string[]): JsonValue | undefined {
  let current: JsonValue = obj;
  for (const key of fieldPath) {
    if (!isJsonObject(current)) {
      return undefined;
    }
    current = current[key];
  }
  return current;
}

export interface BindResult {
  readonly context_id: string;
  readonly resource_id: string;
  readonly [key: string]: string;
}

export interface BindError {
  readonly key: string;
  readonly path: string;
  readonly reason: string;
}

/**
 * bind 정의에 따라 매칭된 이벤트에서 값을 추출한다.
 *
 * @param bind - BindDef (경로 정의)
 * @param events - 매칭된 이벤트 배열 (match 순서)
 * @returns 성공 시 BindResult, 실패 시 BindError[]
 */
export function extractBind(
  bind: BindDef,
  events: readonly BindEventObject[],
): { ok: true; result: BindResult } | { ok: false; errors: BindError[] } {
  const errors: BindError[] = [];
  const result: Record<string, string> = {};

  for (const [key, path] of Object.entries(bind)) {
    const parsed = parsePath(path);
    if (!parsed) {
      errors.push({ key, path, reason: 'invalid path format' });
      continue;
    }

    if (parsed.eventIndex >= events.length) {
      errors.push({
        key,
        path,
        reason: `event index ${parsed.eventIndex} out of range (${events.length} events)`,
      });
      continue;
    }

    const value = extractField(events[parsed.eventIndex], parsed.fieldPath);
    if (value === undefined || value === null) {
      errors.push({ key, path, reason: 'field not found or null' });
      continue;
    }

    if (typeof value !== 'string' && typeof value !== 'number') {
      errors.push({ key, path, reason: `expected string or number, got ${typeof value}` });
      continue;
    }

    result[key] = String(value);
  }

  if (errors.length > 0) {
    return { ok: false, errors };
  }

  return { ok: true, result: result as BindResult };
}
