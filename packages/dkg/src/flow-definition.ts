/**
 * FlowDefinition — 비즈니스 흐름 관측 포인트 DSL.
 *
 * 진입점 → 분기점 → 결과를 선언적으로 정의한다.
 * 각 포인트는 prefix 주소(정수)로 표현된다.
 */

import type { Catalog } from "@qa-sdk/core";
import { encodePrefixByValue } from "@qa-sdk/core";

export interface FlowDefinition {
  readonly id: string;
  readonly name: string;
  readonly description?: string;

  /** 진입점: prefix:version:address */
  readonly entry: FlowPoint;

  /** 분기점들 */
  readonly branches: Record<string, FlowPoint>;

  /** 이 흐름에서 기대하는 권한 (선택) */
  readonly requiredPermissions?: readonly FlowPoint[];

  /** 이 흐름에서 기대하는 이벤트 (선택) */
  readonly expectedEvents?: readonly FlowPoint[];
}

export interface FlowPoint {
  readonly prefix: string;
  readonly version: string;
  readonly address: number;
  readonly label: string;
}

export interface FlowDefinitionInput {
  readonly id: string;
  readonly name: string;
  readonly description?: string;
  readonly entry: { prefix: string; version: string; values: Record<string, string | number> };
  readonly branches: Record<string, { prefix: string; version: string; values: Record<string, string | number> }>;
  readonly requiredPermissions?: readonly { prefix: string; version: string; values: Record<string, string | number> }[];
  readonly expectedEvents?: readonly { prefix: string; version: string; values: Record<string, string | number> }[];
}

/**
 * FlowDefinition을 생성한다.
 * 각 포인트의 values를 encode하여 주소를 확정한다.
 */
export function defineFlow(
  catalog: Catalog,
  input: FlowDefinitionInput,
): FlowDefinition {
  const encodePoint = (
    p: { prefix: string; version: string; values: Record<string, string | number> },
  ): FlowPoint => {
    const address = encodePrefixByValue(catalog, p.prefix, p.version, p.values);
    const label = Object.values(p.values).join(".");
    return { prefix: p.prefix, version: p.version, address, label };
  };

  return {
    id: input.id,
    name: input.name,
    description: input.description,
    entry: encodePoint(input.entry),
    branches: Object.fromEntries(
      Object.entries(input.branches).map(([k, v]) => [k, encodePoint(v)]),
    ),
    requiredPermissions: input.requiredPermissions?.map(encodePoint),
    expectedEvents: input.expectedEvents?.map(encodePoint),
  };
}

/**
 * FlowDefinition을 JSON으로 직렬화한다.
 */
export function serializeFlow(flow: FlowDefinition): string {
  return JSON.stringify(flow, null, 2);
}

/**
 * JSON에서 FlowDefinition을 복원한다.
 */
export function deserializeFlow(json: string): FlowDefinition {
  return JSON.parse(json) as FlowDefinition;
}
