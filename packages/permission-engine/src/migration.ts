// @def.boundary permission-engine-spec
// @def.doc permission-engine-spec

/**
 * migration.ts — PermissionSet 마스크 마이그레이션.
 *
 * shape 변경 (역할 추가, 기능 삭제 등) 시
 * 기존 마스크의 비트를 새 shape로 재배치한다.
 */

import { PermissionSet, type DimDef } from './permission-set.js';

// ── Types ────────────────────────────────────────────────────────────────────

/** 좌표 변환 함수. old 1-based coords → new 1-based coords, 또는 null(삭제). */
export type CoordMapper = (
  oldFeatureIdx: number,
  oldRoleIdx: number,
) => [newFeatureIdx: number, newRoleIdx: number] | null;

// ── Migration ────────────────────────────────────────────────────────────────

/**
 * 기존 PermissionSet을 새 차원 정의로 마이그레이션.
 *
 * @param source - 원본 PermissionSet
 * @param newFeatures - 새 기능 차원 정의
 * @param newRoles - 새 역할 차원 정의
 * @param mapper - 좌표 변환 함수. 미지정 시 ID 매칭으로 자동 변환.
 *
 * @example
 * // v1 roles: [admin, developer, operator, viewer, readonly]
 * // v2 roles: [admin, developer, operator, customer, viewer, readonly]
 * // → customer는 새 역할이므로 기존 grant 없음
 * // → admin~readonly의 기존 grant는 자동 보존
 * const v2 = migratePermissions(v1Set, newFeatures, newRoles);
 */
export function migratePermissions(
  source: PermissionSet,
  newFeatures: DimDef,
  newRoles: DimDef,
  mapper?: CoordMapper,
): PermissionSet {
  const target = new PermissionSet({ features: newFeatures, roles: newRoles });

  if (mapper) {
    // 명시적 매퍼 사용
    for (let fi = 0; fi < source.features.length; fi++) {
      for (let ri = 0; ri < source.roles.length; ri++) {
        const oldAddr = source.index.encode([fi + 1, ri + 1]);
        if ((source.mask[oldAddr >> 3] & (1 << (oldAddr & 7))) === 0) continue;

        const mapped = mapper(fi + 1, ri + 1);
        if (mapped) {
          target.grant(newFeatures.ids[mapped[0] - 1], newRoles.ids[mapped[1] - 1]);
        }
      }
    }
  } else {
    // ID 매칭 자동 변환: 같은 ID를 가진 기능/역할의 grant를 보존
    const newFeatureMap = new Map(newFeatures.ids.map((id, i) => [id, i]));
    const newRoleMap = new Map(newRoles.ids.map((id, i) => [id, i]));

    for (let fi = 0; fi < source.features.length; fi++) {
      const featId = source.features[fi];
      const newFi = newFeatureMap.get(featId);
      if (newFi === undefined) continue; // 삭제된 기능

      for (let ri = 0; ri < source.roles.length; ri++) {
        const roleId = source.roles[ri];
        const newRi = newRoleMap.get(roleId);
        if (newRi === undefined) continue; // 삭제된 역할

        if (source.has(featId, roleId)) {
          target.grant(newFeatures.ids[newFi], newRoles.ids[newRi]);
        }
      }
    }
  }

  return target;
}
