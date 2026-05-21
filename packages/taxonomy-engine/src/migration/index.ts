import type { TaxonomyIR } from "../schema/ir.js";

export type IdRename = {
  axis: string;
  fromId: string;
  toId: string;
  address: number;
};

export type AddressConflict = {
  axis: string;
  address: number;
  ids: string[];
};

export type MigrationPlan = {
  idRenames: IdRename[];
  addressConflicts: AddressConflict[];
  manualReview: string[];
};

/**
 * 두 IR 간 마이그레이션 계획을 추정. 자동 변경은 하지 않고 보고만.
 *
 * - idRenames: 같은 axis에서 address 동일 + id 다른 entry (1:1 매칭만)
 * - addressConflicts: 한 axis의 한 address에 여러 후보가 동시 발생 (입력 부정합 보호)
 * - manualReview: capacity 감소로 entries 초과 등 자동 처리 불가 케이스
 */
export function migrationPlan(from: TaxonomyIR, to: TaxonomyIR): MigrationPlan {
  const idRenames: IdRename[] = [];
  const addressConflicts: AddressConflict[] = [];
  const manualReview: string[] = [];

  for (const [axisName, fromAxis] of from.axes) {
    const toAxis = to.axes.get(axisName);
    if (!toAxis) continue; // axis 자체 제거는 diff가 처리

    // address별 매칭. 여러 entry가 같은 address면 충돌 보고.
    const fromByAddr = groupByAddress(fromAxis.entries);
    const toByAddr = groupByAddress(toAxis.entries);

    for (const [addr, fromIds] of fromByAddr) {
      const toIds = toByAddr.get(addr);
      if (!toIds) continue; // 제거된 entry — diff가 처리
      if (fromIds.length > 1 || toIds.length > 1) {
        const allIds = Array.from(new Set([...fromIds, ...toIds]));
        addressConflicts.push({ axis: axisName, address: addr, ids: allIds });
        continue;
      }
      const fromId = fromIds[0];
      const toId = toIds[0];
      if (fromId !== toId) {
        idRenames.push({ axis: axisName, fromId, toId, address: addr });
      }
    }

    // capacity 감소로 entries 수가 초과되는지 체크
    if (toAxis.capacity < toAxis.entries.length) {
      manualReview.push(
        `axis "${axisName}" capacity ${toAxis.capacity} < entries ${toAxis.entries.length} — ${
          toAxis.entries.length - toAxis.capacity
        }개 제거 필요`,
      );
    }
  }

  return { idRenames, addressConflicts, manualReview };
}

function groupByAddress(entries: { id: string; address: number }[]) {
  const map = new Map<number, string[]>();
  for (const e of entries) {
    const list = map.get(e.address) ?? [];
    list.push(e.id);
    map.set(e.address, list);
  }
  return map;
}
