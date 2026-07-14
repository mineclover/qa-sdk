// @def.boundary df-model-group
/**
 * 좌표 매핑 — FlowSchema ↔ WeightedIndex
 *
 * 의사결정 플로우를 좌표 공간으로 변환한다.
 * Gate → 차원(axis), Branch → 엔트리(entry), Path → 1D 주소(address).
 */

import { WeightedIndex } from 'weighted-index';
import type { DecodedPath, FlowCoordinateSpace, FlowSchema, GateSelection } from './types.js';

// ─── 좌표 공간 구성 ──────────────────────────────────────

/**
 * FlowSchema에서 좌표 공간 정보를 추출한다.
 *
 * 각 gate의 branch 수가 해당 차원의 shape가 된다.
 * subFlowId가 있는 gate는 subFlowCapacity를 shape로 사용한다.
 *
 * @param schema - 플로우 스키마
 * @param subFlowCapacities - subFlowId → 해당 플로우의 총 경로 수 매핑.
 *   subFlow gate가 있으면 반드시 제공해야 한다.
 */
export function buildCoordinateSpace(
  schema: FlowSchema,
  subFlowCapacities?: ReadonlyMap<string, number>,
): FlowCoordinateSpace {
  const shape: number[] = [];
  const labels: string[] = [];
  const subFlowRefs = new Map<number, string>();

  for (let i = 0; i < schema.gates.length; i++) {
    const gate = schema.gates[i];
    labels.push(gate.id);

    if (gate.subFlowId) {
      const capacity = subFlowCapacities?.get(gate.subFlowId);
      if (capacity === undefined) {
        throw new Error(
          `gate "${gate.id}"이 참조하는 subFlow "${gate.subFlowId}"의 capacity가 제공되지 않았다`,
        );
      }
      shape.push(capacity);
      subFlowRefs.set(i, gate.subFlowId);
    } else {
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion -- non-subFlow gate always has branches
      shape.push(gate.branches!.length);
    }
  }

  const totalPaths = shape.reduce((acc, s) => acc * s, 1);

  return {
    flowId: schema.id,
    shape,
    labels,
    totalPaths,
    subFlowRefs,
  };
}

/**
 * FlowSchema에서 WeightedIndex를 생성한다.
 *
 * @param schema - 플로우 스키마
 * @param subFlowCapacities - subFlow 참조가 있으면 필수
 */
export function createFlowIndex(
  schema: FlowSchema,
  subFlowCapacities?: ReadonlyMap<string, number>,
): WeightedIndex {
  const space = buildCoordinateSpace(schema, subFlowCapacities);
  return new WeightedIndex([...space.shape], [...space.labels]);
}

// ─── 인코딩 ──────────────────────────────────────────────

/**
 * GateSelection 배열을 1D 주소로 인코딩한다.
 *
 * 각 gate에서의 선택(branchId)을 해당 gate의 branch 배열에서
 * 인덱스로 변환하고, WeightedIndex.encode()로 압축한다.
 *
 * subFlow gate의 경우 subFlowInstanceId의 coordinateAddress를
 * 그대로 사용한다 (prefix_ref와 동일 패턴).
 *
 * @returns 1D 정수 주소
 */
export function encodeSelections(
  schema: FlowSchema,
  selections: readonly GateSelection[],
  subFlowAddresses?: ReadonlyMap<string, number>,
  subFlowCapacities?: ReadonlyMap<string, number>,
): number {
  const wi = createFlowIndex(schema, subFlowCapacities);
  const coords: number[] = [];

  for (const gate of schema.gates) {
    const sel = selections.find((s) => s.gateId === gate.id);
    if (!sel) {
      throw new Error(`gate "${gate.id}"에 대한 선택이 없다`);
    }

    if (gate.subFlowId) {
      // subFlow gate: 하위 플로우의 좌표 주소를 값으로 사용 (0-based → 1-based)
      const subAddr = subFlowAddresses?.get(sel.gateId);
      if (subAddr === undefined) {
        throw new Error(`subFlow gate "${gate.id}"의 하위 플로우 주소가 제공되지 않았다`);
      }
      coords.push(subAddr + 1); // WeightedIndex는 1-based
    } else {
      // 일반 gate: branchId → 인덱스 변환
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion -- non-subFlow gate always has branches
      const branchIdx = gate.branches!.findIndex((b) => b.id === sel.branchId);
      if (branchIdx === -1) {
        throw new Error(`gate "${gate.id}"에서 branch "${sel.branchId}"를 찾을 수 없다`);
      }
      coords.push(branchIdx + 1); // 1-based
    }
  }

  return wi.encode(coords);
}

// ─── 디코딩 ──────────────────────────────────────────────

/**
 * 1D 주소를 gate별 선택으로 디코딩한다.
 *
 * @returns gate ID → branch ID (또는 subFlow address) 매핑
 */
export function decodePath(
  schema: FlowSchema,
  address: number,
  subFlowCapacities?: ReadonlyMap<string, number>,
): DecodedPath {
  const wi = createFlowIndex(schema, subFlowCapacities);
  const coords = wi.decode(address);
  const selections: Record<string, string> = {};

  for (let i = 0; i < schema.gates.length; i++) {
    const gate = schema.gates[i];
    const coordValue = coords[i]; // 1-based

    if (gate.subFlowId) {
      // subFlow gate: 0-based 주소를 문자열로 반환
      selections[gate.id] = String(coordValue - 1);
    } else {
      // 일반 gate: 인덱스 → branchId
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion -- non-subFlow gate always has branches
      selections[gate.id] = gate.branches![coordValue - 1].id;
    }
  }

  return { flowId: schema.id, address, selections };
}

/**
 * 디코딩된 경로에서 subFlow 참조를 재귀적으로 해석한다.
 *
 * prefix_ref의 L2 resolveAddress()와 동일한 패턴.
 */
export function resolveDeepPath(
  schemas: ReadonlyMap<string, FlowSchema>,
  flowId: string,
  address: number,
  subFlowCapacities: ReadonlyMap<string, number>,
): Record<string, string | Record<string, string>> {
  const schema = schemas.get(flowId);
  if (!schema) throw new Error(`FlowSchema "${flowId}"를 찾을 수 없다`);

  const decoded = decodePath(schema, address, subFlowCapacities);
  const result: Record<string, string | Record<string, string>> = {};

  for (let i = 0; i < schema.gates.length; i++) {
    const gate = schema.gates[i];
    const value = decoded.selections[gate.id];

    if (gate.subFlowId) {
      // 재귀 해석: subFlow 주소 → subFlow 경로
      const subSchema = schemas.get(gate.subFlowId);
      if (subSchema) {
        const subAddress = parseInt(value, 10);
        const subDecoded = decodePath(subSchema, subAddress, subFlowCapacities);
        result[gate.id] = subDecoded.selections;
      } else {
        result[gate.id] = value; // 스키마 없으면 주소 그대로
      }
    } else {
      result[gate.id] = value;
    }
  }

  return result;
}

// ─── 분석 유틸 ───────────────────────────────────────────

/**
 * 주소 범위 질의를 위한 차원 제약 생성.
 *
 * 예: "risk가 high 이상인 모든 결정" →
 *   constraintForGate(schema, "risk", ["high", "critical"])
 *   → { dimIndex: 0, positions: [3, 4] }
 *
 * WeightedIndex의 calcAddressRanges()와 조합하면
 * SQL BETWEEN 구간으로 변환 가능.
 */
export function constraintForGate(
  schema: FlowSchema,
  gateId: string,
  branchIds: readonly string[],
): { dimIndex: number; positions: number[] } {
  const gateIdx = schema.gates.findIndex((g) => g.id === gateId);
  if (gateIdx === -1) throw new Error(`gate "${gateId}"를 찾을 수 없다`);

  const gate = schema.gates[gateIdx];
  if (!gate.branches) {
    throw new Error(`subFlow gate "${gateId}"에는 branch 제약을 적용할 수 없다`);
  }

  const positions = branchIds.map((bid) => {
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion -- guard above ensures branches exist
    const idx = gate.branches!.findIndex((b) => b.id === bid);
    if (idx === -1) throw new Error(`gate "${gateId}"에서 branch "${bid}"를 찾을 수 없다`);
    return idx + 1; // 1-based
  });

  return { dimIndex: gateIdx, positions };
}
