// @def.boundary viz-system-root
// @def.doc viz-system-root

/**
 * ActivationSystem — 셀 활성화 상태 관리 + beam 풀.
 *
 * Three.js에 의존하지 않는 순수 상태 관리.
 * 렌더러가 이 상태를 읽어 시각 효과를 적용한다.
 */

import type { CellState, ActivationEvent } from "../core/types.js";

// ═══════════════════════════════════════════════════
//  Cell States
// ═══════════════════════════════════════════════════

export class CellStateManager {
  private states = new Map<string, CellState>();
  private _activeSet = new Set<string>();
  private _layerHits: number[];
  private _totalHits = 0;

  constructor(layerCount: number) {
    this._layerHits = new Array(layerCount).fill(0);
  }

  getOrCreate(key: string): CellState {
    let s = this.states.get(key);
    if (!s) { s = { glow: 0, hits: 0 }; this.states.set(key, s); }
    return s;
  }

  activate(key: string, layer: number): void {
    const s = this.getOrCreate(key);
    s.glow = 2;
    s.hits++;
    this._activeSet.add(key);
    if (layer >= 0 && layer < this._layerHits.length) this._layerHits[layer]++;
    this._totalHits++;
  }

  deactivateAll(): void {
    this._activeSet.clear();
  }

  /** glow decay — 매 프레임 호출 */
  decay(dt: number, decayRate: number = 1.2): void {
    for (const s of this.states.values()) {
      if (s.glow > 0) {
        s.glow = Math.max(0, s.glow - dt * decayRate);
      }
    }
  }

  isActive(key: string): boolean { return this._activeSet.has(key); }
  get activeSet(): ReadonlySet<string> { return this._activeSet; }
  get layerHits(): readonly number[] { return this._layerHits; }
  get totalHits(): number { return this._totalHits; }

  reset(): void {
    this.states.clear();
    this._activeSet.clear();
    this._layerHits.fill(0);
    this._totalHits = 0;
  }
}

// ═══════════════════════════════════════════════════
//  Beam Pool
// ═══════════════════════════════════════════════════

export interface BeamState {
  fromX: number; fromY: number; fromZ: number;
  toX: number; toY: number; toZ: number;
  color: number;
  life: number;
}

export class BeamPool {
  private beams: BeamState[];
  private index = 0;

  constructor(maxBeams: number) {
    this.beams = Array.from({ length: maxBeams }, () => ({
      fromX: 0, fromY: 0, fromZ: 0, toX: 0, toY: 0, toZ: 0, color: 0xffffff, life: 0,
    }));
  }

  spawn(from: { x: number; y: number; z: number }, to: { x: number; y: number; z: number }, color: number): void {
    const b = this.beams[this.index % this.beams.length];
    this.index++;
    b.fromX = from.x; b.fromY = from.y; b.fromZ = from.z;
    b.toX = to.x; b.toY = to.y; b.toZ = to.z;
    b.color = color; b.life = 1;
  }

  decay(dt: number, decayRate: number = 0.5): void {
    for (const b of this.beams) {
      if (b.life > 0) b.life = Math.max(0, b.life - dt * decayRate);
    }
  }

  getActive(): readonly BeamState[] {
    return this.beams.filter(b => b.life > 0);
  }

  getAll(): readonly BeamState[] {
    return this.beams;
  }
}

// ═══════════════════════════════════════════════════
//  Activation Processor
// ═══════════════════════════════════════════════════

export interface CellInfo {
  key: string;
  layer: number;
  category: string;
  worldX: number;
  worldY: number;
  worldZ: number;
  categoryColor: number;
}

export class ActivationProcessor {
  constructor(
    private cells: CellStateManager,
    private beams: BeamPool,
  ) {}

  /**
   * 셀 키 목록을 활성화하고, 크로스 레이어 빔을 생성한다.
   */
  fire(keys: readonly string[], cellInfoLookup: (key: string) => CellInfo | undefined): ActivationEvent {
    this.cells.deactivateAll();
    const activated: CellInfo[] = [];

    for (const key of keys) {
      const info = cellInfoLookup(key);
      if (!info) continue;
      this.cells.activate(key, info.layer);
      activated.push(info);
    }

    // Cross-layer beams
    for (let i = 0; i < activated.length; i++) {
      for (let j = i + 1; j < activated.length; j++) {
        if (activated[i].layer !== activated[j].layer) {
          this.beams.spawn(
            { x: activated[i].worldX, y: activated[i].worldY, z: activated[i].worldZ },
            { x: activated[j].worldX, y: activated[j].worldY, z: activated[j].worldZ },
            activated[i].categoryColor,
          );
        }
      }
    }

    return {
      keys,
      source: "manual",
      timestamp: new Date().toISOString(),
    };
  }
}
