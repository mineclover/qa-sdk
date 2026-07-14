/** @def.boundary apm-codegen-system */
/**
 * 네이밍 변환 유틸리티.
 * SchemaSnapshot의 snake_case ID를 protobuf/TypeScript 규약에 맞게 변환.
 */

/** snake_case → UPPER_SNAKE_CASE */
export function toUpperSnake(s: string): string {
  return s.toUpperCase();
}

/** snake_case → PascalCase */
export function toPascal(s: string): string {
  return s
    .split('_')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join('');
}

/** snake_case → SCREAMING_SNAKE (for TS const object keys) */
export function toConstKey(s: string): string {
  return s.toUpperCase().replace(/-/g, '_');
}

/**
 * entry 문자열 → protobuf enum value 이름.
 * "prod-east" → "PROD_EAST"
 */
export function toEnumValue(axisId: string, entry: string): string {
  const prefix = toUpperSnake(axisId);
  const value = entry.toUpperCase().replace(/[^A-Z0-9]/g, '_');
  return `${prefix}_${value}`;
}

/**
 * entry 문자열 → TypeScript const key.
 * "prod-east" → "PROD_EAST"
 */
export function toTsConstKey(entry: string): string {
  return entry.toUpperCase().replace(/[^A-Z0-9]/g, '_');
}
