// @def.boundary viz-system-root
// @def.doc viz-system-root

/**
 * ViewEngine — 뷰 모드 전환 + lerp 위치 전이.
 *
 * Three.js Group의 position을 target으로 lerp하여
 * 뷰 모드 전환 시 부드러운 애니메이션을 제공한다.
 */

import type { ViewMode, ViewPosition } from '../core/types.js';

export interface ViewTarget {
  readonly groupId: string;
  currentX: number;
  currentY: number;
  currentZ: number;
  targetX: number;
  targetY: number;
  targetZ: number;
}

export class ViewEngine {
  private targets = new Map<string, ViewTarget>();
  private positions: Record<ViewMode, Record<string, ViewPosition>> = {
    layer: {},
    category: {},
    dsl: {},
    service: {},
  };
  private _currentMode: ViewMode = 'layer';
  private _lerpSpeed = 3;

  get currentMode(): ViewMode {
    return this._currentMode;
  }

  setPositions(positions: Record<ViewMode, Record<string, ViewPosition>>): void {
    this.positions = positions;
  }

  /** 매트릭스 스택용 커스텀 뷰 모드 추가 */
  addViewMode(name: string, positions: Record<string, ViewPosition>): void {
    (this.positions as Record<string, Record<string, ViewPosition>>)[name] = positions;
  }

  registerGroup(groupId: string, initialPos: ViewPosition): void {
    this.targets.set(groupId, {
      groupId,
      currentX: initialPos.x,
      currentY: initialPos.y,
      currentZ: initialPos.z,
      targetX: initialPos.x,
      targetY: initialPos.y,
      targetZ: initialPos.z,
    });
  }

  setMode(mode: ViewMode): void {
    this._currentMode = mode;
    const modePositions = this.positions[mode];
    if (!modePositions) return;

    for (const [groupId, pos] of Object.entries(modePositions)) {
      const target = this.targets.get(groupId);
      if (target) {
        target.targetX = pos.x;
        target.targetY = pos.y;
        target.targetZ = pos.z;
      }
    }
  }

  /** 매 프레임 호출 — dt 기반 lerp */
  update(dt: number): void {
    const speed = this._lerpSpeed * dt;
    for (const t of this.targets.values()) {
      t.currentX += (t.targetX - t.currentX) * speed;
      t.currentY += (t.targetY - t.currentY) * speed;
      t.currentZ += (t.targetZ - t.currentZ) * speed;
    }
  }

  getPosition(groupId: string): { x: number; y: number; z: number } | undefined {
    const t = this.targets.get(groupId);
    return t ? { x: t.currentX, y: t.currentY, z: t.currentZ } : undefined;
  }

  getAllPositions(): Map<string, { x: number; y: number; z: number }> {
    const result = new Map<string, { x: number; y: number; z: number }>();
    for (const [id, t] of this.targets) {
      result.set(id, { x: t.currentX, y: t.currentY, z: t.currentZ });
    }
    return result;
  }
}
