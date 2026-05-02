import { createHash } from "node:crypto";
import type { EventName } from "./event-name.js"; // Task 2.6 결과 — type-only import

// payloadShape는 JSON Schema-like 객체. 값은 "string"/"number"/"string?" 등 정규화 토큰
// 또는 중첩 객체/배열. zod schema는 호출자가 normalized 표현으로 변환 후 전달한다.
export type CanonicalShape =
  | string | number | boolean | null
  | CanonicalShape[]
  | { [key: string]: CanonicalShape | undefined };

export interface SchemaHashInput {
  eventName: EventName;
  payloadShape: CanonicalShape;
}

// canonicalJSON: 키 사전순 정렬, undefined 제거, 배열 순서 유지. 패키지 내부 전용 재귀.
function canonicalJSON(value: CanonicalShape): string {
  if (value === null) return "null";
  if (typeof value === "string") return JSON.stringify(value);
  if (typeof value === "number") return Number.isFinite(value) ? String(value) : "null";
  if (typeof value === "boolean") return value ? "true" : "false";
  if (Array.isArray(value)) return `[${value.map((v) => canonicalJSON(v ?? null)).join(",")}]`;
  const keys = Object.keys(value).filter((k) => value[k] !== undefined).sort();
  return `{${keys.map((k) => `${JSON.stringify(k)}:${canonicalJSON(value[k] as CanonicalShape)}`).join(",")}}`;
}

export function buildSchemaHash(input: SchemaHashInput): string {
  // spec §2.6: hash는 payloadShape의 content hash. eventName 일치 검증은 catalog 등록 시 별도 단계.
  return createHash("sha256").update(canonicalJSON(input.payloadShape)).digest("hex").slice(0, 16);
}

export function verifySchemaHash(input: SchemaHashInput, expected: string): boolean {
  return buildSchemaHash(input) === expected;
}
