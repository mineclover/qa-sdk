// @def.boundary viz-system-root
// @def.doc viz-system-root

/**
 * InstancedGrid — prefix당 하나의 InstancedMesh로 셀을 렌더링.
 *
 * 개별 Mesh 대신 InstancedMesh를 사용하여 draw call을 대폭 줄인다.
 *
 * Before: 172셀 × 3 오브젝트 = 516 draw calls
 * After:  19 prefix × 1 InstancedMesh = 19 draw calls + labels
 *
 * 각 인스턴스의 색상/emissive는 per-instance attribute로 제어.
 */

import * as THREE from 'three';
import type { GridLayout } from '../core/grid-builder.js';
import type { CategoryColor } from '../core/color-tokens.js';
import { CATEGORY_COLORS } from '../core/color-tokens.js';

export interface InstancedGridState {
  readonly gridId: string;
  readonly mesh: THREE.InstancedMesh;
  readonly group: THREE.Group;
  readonly cellCount: number;
  readonly catColor: CategoryColor;
  /** 셀 key → instance index 매핑 */
  readonly keyToIndex: Map<string, number>;
  /** instance index → 셀 key 매핑 */
  readonly indexToKey: string[];
  /** per-instance glow 상태 */
  readonly glows: Float32Array;
  /** per-instance hit count */
  readonly hits: Uint32Array;
}

/**
 * GridLayout에서 InstancedMesh를 생성한다.
 */
export function createInstancedGrid(
  gridLayout: GridLayout,
  category: string,
  cellSize: number,
  baseOpacity: number,
): InstancedGridState {
  const catColor = CATEGORY_COLORS[category] ?? CATEGORY_COLORS.entity;
  const count = gridLayout.cells.length;

  const geo = new THREE.BoxGeometry(cellSize, cellSize * 0.6, cellSize);
  const mat = new THREE.MeshStandardMaterial({
    color: catColor.main.hex,
    emissive: catColor.emissive.hex,
    emissiveIntensity: 0,
    metalness: 0.35,
    roughness: 0.5,
    transparent: true,
    opacity: baseOpacity,
  });

  const mesh = new THREE.InstancedMesh(geo, mat, count);
  mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);

  const group = new THREE.Group();
  group.add(mesh);

  // 인스턴스 위치 설정
  const dummy = new THREE.Object3D();
  const keyToIndex = new Map<string, number>();
  const indexToKey: string[] = [];

  for (let i = 0; i < count; i++) {
    const cell = gridLayout.cells[i];
    dummy.position.set(cell.localX, cell.localY, cell.localZ);
    dummy.updateMatrix();
    mesh.setMatrixAt(i, dummy.matrix);

    // per-instance color
    const color = new THREE.Color(catColor.main.hex);
    mesh.setColorAt(i, color);

    keyToIndex.set(cell.key, i);
    indexToKey.push(cell.key);
  }

  mesh.instanceMatrix.needsUpdate = true;
  if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;

  return {
    gridId: gridLayout.id,
    mesh,
    group,
    cellCount: count,
    catColor,
    keyToIndex,
    indexToKey,
    glows: new Float32Array(count),
    hits: new Uint32Array(count),
  };
}

/**
 * InstancedGrid의 glow 상태를 업데이트한다.
 * 활성 셀의 색상을 밝게, 비활성 셀은 어둡게.
 */
export function updateInstancedGrid(
  state: InstancedGridState,
  activeSet: ReadonlySet<string>,
  dt: number,
  time: number,
  settings: { baseOpacity: number; glowMultiplier: number },
): void {
  const { mesh, glows, indexToKey, catColor } = state;
  const baseColor = new THREE.Color(catColor.main.hex);
  const glowColor = new THREE.Color(catColor.emissive.hex);
  const tmpColor = new THREE.Color();
  let needsColorUpdate = false;

  for (let i = 0; i < state.cellCount; i++) {
    const key = indexToKey[i];

    // glow decay
    if (glows[i] > 0) glows[i] = Math.max(0, glows[i] - dt * 1.2);

    // active pulse
    const isActive = activeSet.has(key);
    const pulse = isActive ? 0.4 + Math.sin(time * 5) * 0.2 : 0;
    const intensity = Math.max(glows[i], pulse);

    if (intensity > 0.01 || isActive) {
      // 활성: 밝은 색상
      tmpColor.copy(baseColor).lerp(glowColor, intensity * settings.glowMultiplier);
      mesh.setColorAt(i, tmpColor);
      needsColorUpdate = true;
    }
  }

  // material 전체 opacity는 baseOpacity로 유지
  (mesh.material as THREE.MeshStandardMaterial).opacity = settings.baseOpacity;
  (mesh.material as THREE.MeshStandardMaterial).emissiveIntensity =
    Math.max(...Array.from(glows)) * 2 * settings.glowMultiplier;

  if (needsColorUpdate && mesh.instanceColor) {
    mesh.instanceColor.needsUpdate = true;
  }
}

/**
 * 특정 셀을 활성화한다.
 */
export function activateCell(state: InstancedGridState, key: string): boolean {
  const idx = state.keyToIndex.get(key);
  if (idx === undefined) return false;
  state.glows[idx] = 2.0;
  state.hits[idx]++;
  return true;
}

/**
 * Draw call 수를 계산한다 (디버그용).
 */
export function countDrawCalls(grids: readonly InstancedGridState[]): {
  instancedMeshes: number;
  totalInstances: number;
  drawCallsEstimate: number;
} {
  let totalInstances = 0;
  for (const g of grids) totalInstances += g.cellCount;
  return {
    instancedMeshes: grids.length,
    totalInstances,
    drawCallsEstimate: grids.length + 10, // +beams, +grid, +particles, +lights
  };
}
