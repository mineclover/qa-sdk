// @def.boundary viz-system-root
// @def.doc viz-system-root

/**
 * PerfStats — 프레임 성능 측정 + draw call 추적.
 */

export interface FrameStats {
  fps: number;
  frameTime: number;
  drawCalls: number;
  triangles: number;
  points: number;
  lines: number;
  cellCount: number;
  activeCount: number;
}

export class PerfMonitor {
  private frames = 0;
  private lastTime = performance.now();
  private _fps = 0;
  private _frameTime = 0;

  /** 매 프레임 호출 */
  tick(): void {
    this.frames++;
    const now = performance.now();
    const elapsed = now - this.lastTime;

    if (elapsed >= 1000) {
      this._fps = Math.round((this.frames * 1000) / elapsed);
      this._frameTime = Math.round((elapsed / this.frames) * 100) / 100;
      this.frames = 0;
      this.lastTime = now;
    }
  }

  get fps(): number {
    return this._fps;
  }
  get frameTime(): number {
    return this._frameTime;
  }

  /** Three.js renderer.info에서 통계 추출 */
  getStats(
    rendererInfo: {
      render: { calls: number; triangles: number; points: number; lines: number };
    },
    cellCount: number,
    activeCount: number,
  ): FrameStats {
    return {
      fps: this._fps,
      frameTime: this._frameTime,
      drawCalls: rendererInfo.render.calls,
      triangles: rendererInfo.render.triangles,
      points: rendererInfo.render.points,
      lines: rendererInfo.render.lines,
      cellCount,
      activeCount,
    };
  }

  /** HUD 표시용 문자열 */
  formatHud(stats: FrameStats): string {
    return `${stats.fps}fps ${stats.frameTime}ms | draw:${stats.drawCalls} tri:${stats.triangles} | cells:${stats.cellCount} active:${stats.activeCount}`;
  }
}
