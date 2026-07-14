// 본 사이클에서 시뮬이 사용하는 custom HTTP 헤더 목록.
// sim-identifier-grammar #4 HTTP header builder가 이 목록만 허용.
export const SIM_HEADER_VOCABULARY = [
  { domain: 'service', attr: 'version' }, // x-service-version
  { domain: 'canary', attr: 'override' }, // x-canary-override
  { domain: 'canary', attr: 'stage' }, // x-canary-stage
  { domain: 'trace', attr: 'id' }, // x-trace-id
  { domain: 'trace', attr: 'decision-id' }, // x-trace-decision-id
  { domain: 'sim', attr: 'scenario' }, // x-sim-scenario
] as const;
