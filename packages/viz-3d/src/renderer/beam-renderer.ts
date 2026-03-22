/**
 * ThreeBeamRenderer — Three.js Line 기반 beam 풀.
 *
 * pinned(고정) + transient(시간감쇠) 이중 모드.
 * monitor.html의 인라인 bLines 로직을 모듈화.
 */
import * as THREE from "three";

export interface BeamRendererOptions {
  maxBeams: number;
  scene: THREE.Scene;
  defaultColor: number;
}

interface BeamLine {
  geo: THREE.BufferGeometry;
  mat: THREE.LineBasicMaterial;
  life: number;
  pinned: boolean;
}

export class ThreeBeamRenderer {
  private lines: BeamLine[] = [];
  private index = 0;

  constructor(private options: BeamRendererOptions) {
    for (let i = 0; i < options.maxBeams; i++) {
      const geo = new THREE.BufferGeometry();
      geo.setAttribute("position", new THREE.BufferAttribute(new Float32Array(6), 3));
      const mat = new THREE.LineBasicMaterial({
        color: options.defaultColor,
        transparent: true,
        opacity: 0,
      });
      options.scene.add(new THREE.Line(geo, mat));
      this.lines.push({ geo, mat, life: 0, pinned: false });
    }
  }

  /** transient beam — 시간 지나면 fade */
  spawn(from: THREE.Vector3, to: THREE.Vector3, colorHex: number): void {
    const b = this.lines[this.index++ % this.options.maxBeams];
    b.pinned = false;
    this.setPositions(b, from, to);
    b.mat.color.setHex(colorHex);
    b.life = 4;
  }

  /** pinned beam — clearPinned() 전까지 유지 */
  spawnPinned(from: THREE.Vector3, to: THREE.Vector3, colorHex: number): void {
    const b = this.lines[this.index++ % this.options.maxBeams];
    b.pinned = true;
    this.setPositions(b, from, to);
    b.mat.color.setHex(colorHex);
    b.life = 1;
    b.mat.opacity = 0.6;
  }

  /** 모든 pinned beam 해제 */
  clearPinned(): void {
    for (const b of this.lines) {
      if (b.pinned) { b.pinned = false; b.life = 0; b.mat.opacity = 0; }
    }
  }

  /** 매 프레임 호출 — transient beam fade 처리 */
  update(dt: number): void {
    for (const b of this.lines) {
      if (b.pinned) continue;
      if (b.life > 0) {
        b.life -= dt * 0.5;
        b.mat.opacity = Math.max(0, Math.min(b.life * 0.2, 0.6));
      }
    }
  }

  private setPositions(b: BeamLine, from: THREE.Vector3, to: THREE.Vector3): void {
    const arr = b.geo.attributes.position.array as Float32Array;
    arr[0] = from.x; arr[1] = from.y; arr[2] = from.z;
    arr[3] = to.x; arr[4] = to.y; arr[5] = to.z;
    b.geo.attributes.position.needsUpdate = true;
  }
}
