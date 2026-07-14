// @def.boundary sim-scenarios
// @def.doc sim-erp-pm-design

/**
 * Scenario — qa-sdk 시뮬 시나리오 정의 표준.
 *
 * setup → act → assert → teardown 4 phase.
 * runner는 이 4 phase를 try/finally 패턴으로 실행 — assert가 throw하면 teardown은 그대로 실행.
 */
export interface ScenarioEnv {
  /** gateway base URL (예: "http://localhost:8888"). */
  gatewayUrl: string;
  /** in-process: NestJS Test 모듈 부팅. http: 실 docker-compose 가정. */
  mode: 'in-process' | 'http';
  /** 실 외부 trace_id 추적용 (옵션). */
  rootTraceId?: string;
}

export interface ScenarioActResult {
  /** 시나리오 실행 결과 페이로드 — assert 단계에서 활용. */
  data: Record<string, unknown>;
  /** 시나리오 중 수집된 trace ID (응답 헤더 x-trace-id 기반). */
  traceIds: string[];
  /** 시나리오 step count (출력용). */
  stepCount: number;
  /** operator가 바로 이어서 사용할 수 있는 후속 명령. */
  operatorHints?: string[];
}

export interface Scenario<TCtx = unknown> {
  /** kebab-case 식별자 — CLI에서 `sim-scenarios run <name>`. */
  name: string;
  /** 사람 읽는 설명. */
  description: string;
  /** 기대 검증 대상 (design.md §4의 매트릭스 column). */
  validates: readonly string[];
  setup(env: ScenarioEnv): Promise<TCtx>;
  act(ctx: TCtx): Promise<ScenarioActResult>;
  assert(ctx: TCtx, actResult: ScenarioActResult): Promise<void>;
  teardown(ctx: TCtx): Promise<void>;
}

export interface ScenarioResult {
  name: string;
  status: 'passed' | 'failed';
  durationMs: number;
  stepCount: number;
  traceIds: string[];
  operatorHints?: string[];
  /** 실패 시 첫 에러. */
  error?: {
    message: string;
    stack?: string;
    phase: 'setup' | 'act' | 'assert' | 'teardown';
  };
}
