/**
 * LOD — 거리 기반 디테일 레벨 관리.
 *
 * 카메라와의 거리에 따라:
 *   근거리: 라벨 + 엣지 + 히트 카운트 표시
 *   중거리: 라벨만 표시
 *   원거리: 라벨 숨김 (InstancedMesh만)
 */

export interface LodThresholds {
  /** 이 거리 이내: 모든 디테일 표시 */
  readonly near: number;
  /** 이 거리 이내: 라벨만 표시 */
  readonly mid: number;
  /** 이 거리 초과: 라벨 숨김 */
}

export const DEFAULT_LOD: LodThresholds = {
  near: 15,
  mid: 35,
};

export type LodLevel = "near" | "mid" | "far";

export function computeLodLevel(
  cameraDistance: number,
  thresholds: LodThresholds = DEFAULT_LOD,
): LodLevel {
  if (cameraDistance <= thresholds.near) return "near";
  if (cameraDistance <= thresholds.mid) return "mid";
  return "far";
}

/**
 * 그룹별 LOD 레벨을 계산한다.
 */
export function computeGroupLod(
  cameraPosition: { x: number; y: number; z: number },
  groupPositions: ReadonlyMap<string, { x: number; y: number; z: number }>,
  thresholds?: LodThresholds,
): Map<string, LodLevel> {
  const result = new Map<string, LodLevel>();
  for (const [id, pos] of groupPositions) {
    const dx = cameraPosition.x - pos.x;
    const dy = cameraPosition.y - pos.y;
    const dz = cameraPosition.z - pos.z;
    const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
    result.set(id, computeLodLevel(dist, thresholds));
  }
  return result;
}

/**
 * LOD에 따른 표시 설정.
 */
export interface LodVisibility {
  readonly showLabels: boolean;
  readonly showEdges: boolean;
  readonly showHitCounts: boolean;
  readonly cellOpacityMultiplier: number;
}

export function getLodVisibility(level: LodLevel): LodVisibility {
  switch (level) {
    case "near": return { showLabels: true, showEdges: true, showHitCounts: true, cellOpacityMultiplier: 1.0 };
    case "mid": return { showLabels: true, showEdges: false, showHitCounts: false, cellOpacityMultiplier: 0.9 };
    case "far": return { showLabels: false, showEdges: false, showHitCounts: false, cellOpacityMultiplier: 0.7 };
  }
}
