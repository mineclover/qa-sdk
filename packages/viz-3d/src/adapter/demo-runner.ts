// @def.boundary viz-system-root
// @def.doc viz-system-root

/**
 * demo-runner — 데모 재생 상태 머신.
 *
 * monitor.html의 dOn/dI/dT/rD 변수를 캡슐화한 모듈.
 * STEPS 데이터는 외부에서 onStep 콜백으로 주입한다.
 */

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

export interface DemoRunnerOptions {
  totalSteps: number;
  intervalMs: number;
  onStep: (index: number) => void;
  onComplete?: () => void;
}

/* ------------------------------------------------------------------ */
/*  DemoRunner                                                         */
/* ------------------------------------------------------------------ */

export class DemoRunner {
  private readonly _total: number;
  private readonly _interval: number;
  private readonly _onStep: (index: number) => void;
  private readonly _onComplete?: () => void;

  private _running = false;
  private _index = 0;
  private _timer: ReturnType<typeof setTimeout> | null = null;

  constructor(options: DemoRunnerOptions) {
    this._total = options.totalSteps;
    this._interval = options.intervalMs;
    this._onStep = options.onStep;
    this._onComplete = options.onComplete;
  }

  /* ── public API ── */

  /** 데모 재생 시작 (이미 실행 중이면 무시) */
  start(): void {
    if (this._running) return;
    this._running = true;
    this._index = 0;
    this._tick();
  }

  /** 재생 중지 */
  stop(): void {
    this._running = false;
    if (this._timer !== null) {
      clearTimeout(this._timer);
      this._timer = null;
    }
  }

  /** 상태 리셋 (중지 + 인덱스 초기화) */
  reset(): void {
    this.stop();
    this._index = 0;
  }

  get isRunning(): boolean {
    return this._running;
  }

  get currentIndex(): number {
    return this._index;
  }

  /* ── internal ── */

  private _tick(): void {
    if (!this._running) return;

    if (this._index >= this._total) {
      this._index = 0; // 루프 재시작
    }

    this._onStep(this._index);
    this._index++;
    this._timer = setTimeout(() => this._tick(), this._interval);
  }
}
