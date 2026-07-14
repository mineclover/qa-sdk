import type { EntryIR, TaxonomyIR } from '../schema/ir.js';

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

/**
 * decisionLink를 가진 entry에 발생한 마이그레이션 영향.
 *
 * - `lifecycle-changed`: lifecycle 값만 변경. decision 파일과 yaml lifecycle 동기화 필요.
 * - `address-changed`: 같은 id가 다른 address로 이동. decision 파일의 subject 좌표 깨질 수 있음.
 * - `removed`: from에 있던 entry가 to에서 사라짐. decision 파일은 orphan 후보.
 */
export type DecisionImpact = {
  axis: string;
  id: string;
  decisionLink: string;
  impact: 'lifecycle-changed' | 'address-changed' | 'removed';
  /** lifecycle-changed: 이전 lifecycle */
  fromLifecycle?: string;
  /** lifecycle-changed: 이후 lifecycle */
  toLifecycle?: string;
  /** address-changed: 이전 address */
  fromAddress?: number;
  /** address-changed: 이후 address */
  toAddress?: number;
};

export type MigrationPlan = {
  idRenames: IdRename[];
  addressConflicts: AddressConflict[];
  manualReview: string[];
  /** decisionLink 가진 entry에 대한 영향. 빈 배열일 수 있음 (정보 제공만). */
  decisionImpact: DecisionImpact[];
};

/**
 * 두 IR 간 마이그레이션 계획을 추정. 자동 변경은 하지 않고 보고만.
 *
 * - idRenames: 같은 axis에서 address 동일 + id 다른 entry (1:1 매칭만)
 * - addressConflicts: 한 axis의 한 address에 여러 후보가 동시 발생 (입력 부정합 보호)
 * - manualReview: capacity 감소로 entries 초과 등 자동 처리 불가 케이스
 * - decisionImpact: decisionLink 가진 entry의 lifecycle/address/제거 변경 (정보 제공)
 */
export function migrationPlan(from: TaxonomyIR, to: TaxonomyIR): MigrationPlan {
  const idRenames: IdRename[] = [];
  const addressConflicts: AddressConflict[] = [];
  const manualReview: string[] = [];
  const decisionImpact: DecisionImpact[] = [];

  for (const [axisName, fromAxis] of from.axes) {
    const toAxis = to.axes.get(axisName);
    if (!toAxis) {
      // axis 자체가 제거된 경우, decisionLink 가진 entry는 모두 removed
      for (const entry of fromAxis.entries) {
        if (entry.decisionLink) {
          decisionImpact.push({
            axis: axisName,
            id: entry.id,
            decisionLink: entry.decisionLink,
            impact: 'removed',
          });
        }
      }
      continue;
    }

    // address별 매칭. 여러 entry가 같은 address면 충돌 보고.
    const fromByAddr = groupByAddress(fromAxis.entries);
    const toByAddr = groupByAddress(toAxis.entries);

    for (const [addr, fromIds] of fromByAddr) {
      const toIds = toByAddr.get(addr);
      if (!toIds) continue; // 제거된 entry — diff가 처리 + 아래 decisionImpact 루프에서 처리
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

    // decisionImpact: decisionLink 가진 entry 영향 분석
    // - id 기준으로 from/to 매칭 (rename 후보가 아니라 같은 id 추적)
    // - 같은 id 둘 다 존재 → lifecycle/address 변경 감지
    // - from에만 존재 → removed
    const fromById = indexById(fromAxis.entries);
    const toById = indexById(toAxis.entries);
    for (const [id, fromEntry] of fromById) {
      if (!fromEntry.decisionLink) continue;
      const toEntry = toById.get(id);
      if (!toEntry) {
        decisionImpact.push({
          axis: axisName,
          id,
          decisionLink: fromEntry.decisionLink,
          impact: 'removed',
        });
        continue;
      }
      // address 변경 (id 그대로) → decision subject 좌표 깨질 수 있음
      if (fromEntry.address !== toEntry.address) {
        decisionImpact.push({
          axis: axisName,
          id,
          decisionLink: fromEntry.decisionLink,
          impact: 'address-changed',
          fromAddress: fromEntry.address,
          toAddress: toEntry.address,
        });
        continue;
      }
      // lifecycle 변경 (undefined ↔ 값도 변경으로 본다)
      if (fromEntry.lifecycle !== toEntry.lifecycle) {
        decisionImpact.push({
          axis: axisName,
          id,
          decisionLink: fromEntry.decisionLink,
          impact: 'lifecycle-changed',
          fromLifecycle: fromEntry.lifecycle,
          toLifecycle: toEntry.lifecycle,
        });
      }
    }
  }

  return { idRenames, addressConflicts, manualReview, decisionImpact };
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

function indexById(entries: EntryIR[]): Map<string, EntryIR> {
  const map = new Map<string, EntryIR>();
  for (const e of entries) {
    map.set(e.id, e);
  }
  return map;
}
