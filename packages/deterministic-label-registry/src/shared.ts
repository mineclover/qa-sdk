// @def.doc deterministic-label-architecture
import type { DocumentMetadata } from "doc-envelope";

/**
 * 순수 primitives — 좌표/문서/충돌 어떤 system에도 종속되지 않는
 * 문자열/메타데이터 정규화 유틸. coordinate·projection·records가 공유한다.
 */

export function normalizeMetadata(
  metadata: DocumentMetadata | null | undefined,
): DocumentMetadata {
  return { ...metadata };
}

export function normalizeCoordinatePart(
  value: string | null | undefined,
): string | undefined {
  const normalized = value?.trim().replaceAll("\\", "/").replace(/\/+/g, "/");
  return normalized ? normalized : undefined;
}

export function asString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : undefined;
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function nestedMetadataString(value: unknown, key: string): string | undefined {
  if (!isRecord(value)) return undefined;
  return asString(value[key]);
}

export function metadataStringArray(value: unknown): readonly string[] {
  return Array.isArray(value)
    ? uniqueStrings(value.map((item) => asString(item)))
    : [];
}

export function uniqueStrings(values: readonly (string | undefined)[]): readonly string[] {
  return [...new Set(values.filter((value): value is string => Boolean(value)))];
}

export function normalizeRecordRefs(
  refs: readonly (string | undefined)[] | null | undefined,
): readonly string[] {
  return uniqueStrings((refs ?? []).map(normalizeCoordinatePart))
    .toSorted((left, right) => left.localeCompare(right));
}
