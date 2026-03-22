/**
 * updateInstancedColors — InstancedMesh per-cell glow/role 색상 업데이트.
 *
 * monitor.html의 anim() 내부 glow 루프를 모듈화.
 */
import * as THREE from "three";

export interface InstancedGridState {
  iMesh: THREE.InstancedMesh;
  mat: THREE.MeshStandardMaterial;
  cc: { main: { hex: number }; emissive: { hex: number } };
  keyToIdx: Map<string, number>;
  idxToKey: string[];
  glows: Float32Array;
  count: number;
}

export interface CellRenderOptions {
  elapsedTime: number;
  dt: number;
  glowMul: number;
  baseOpacity: number;
  activeSet: ReadonlySet<string>;
  cellRoleColor: ReadonlyMap<string, number>;
  roleFilter: string | null;
  getRoleFn: (key: string) => string;
  /** glow 감쇠 속도 (기본 0.6) */
  glowDecay?: number;
}

const _baseC = new THREE.Color();
const _glowC = new THREE.Color();
const _tmpC = new THREE.Color();

/**
 * 모든 InstancedGrid의 per-instance 색상을 업데이트한다.
 *
 * - 활성 셀: role 색상으로 glow
 * - 비활성 셀: base 색상 복원
 * - roleFilter 활성 시 비매칭 role은 dimmed
 */
export function updateInstancedColors(
  grids: readonly InstancedGridState[],
  options: CellRenderOptions,
): void {
  const { elapsedTime: t, dt, glowMul, activeSet, cellRoleColor, roleFilter, getRoleFn } = options;
  const decay = options.glowDecay ?? 0.6;

  for (const ig of grids) {
    let needsUpdate = false;
    _baseC.setHex(ig.cc.main.hex);

    for (let i = 0; i < ig.count; i++) {
      const key = ig.idxToKey[i];

      // glow 감쇠
      if (ig.glows[i] > 0) ig.glows[i] = Math.max(0, ig.glows[i] - dt * decay);

      // active 셀 pulse
      const isActive = activeSet.has(key);
      const pulse = isActive ? 0.4 + Math.sin(t * 5) * 0.2 : 0;
      const intensity = Math.max(ig.glows[i], pulse);

      if (intensity > 0.01) {
        const roleHex = cellRoleColor.get(key);
        const role = getRoleFn(key);
        const dimByFilter = roleFilter != null && roleFilter !== role;

        if (roleHex && !dimByFilter) {
          _glowC.setHex(roleHex);
        } else {
          _glowC.setHex(ig.cc.emissive.hex);
        }

        const eff = Math.min(dimByFilter ? intensity * glowMul * 0.2 : intensity * glowMul, 1.0);
        _tmpC.copy(_baseC).lerp(_glowC, eff);
        ig.iMesh.setColorAt(i, _tmpC);
        needsUpdate = true;
      } else {
        ig.iMesh.setColorAt(i, _baseC);
        needsUpdate = true;
      }
    }

    ig.mat.opacity = options.baseOpacity;
    ig.mat.emissiveIntensity = 0.1;
    if (needsUpdate && ig.iMesh.instanceColor) {
      ig.iMesh.instanceColor.needsUpdate = true;
    }
  }
}
