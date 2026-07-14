// @def.boundary sim-canary-controller
// @def.doc canary-controller-config
// spec 01-decision-model §6 — controller env

import { z } from 'zod';

const envSchema = z.object({
  PORT: z.coerce.number().int().positive().default(5300),
  CORS_ORIGIN: z.string().default('*'),
  SIM_LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
  SIM_CONTROLLER_CYCLE_MS: z.coerce.number().int().positive().default(30_000),
  SIM_CONTROLLER_ID: z
    .string()
    .regex(/^[0-9A-Z]{8}$/)
    .default('CTRL0001'),
  SIM_CONTROLLER_CONFIG_PATH: z.string().default('./controller-config.yaml'),
  // 시뮬 happy-path 진입점 — true 시 onModuleInit 단계에서 healthy-metrics fault
  // 자동 enable. 시나리오 9 등 외부 metrics 미연결 환경에서 자연스럽게 promote 시퀀스
  // 진행 가능. spec 2026-05-02 §8 패턴 (fault = controller 입력 변경) 동일.
  SIM_CONTROLLER_HEALTHY_METRICS: z
    .enum(['true', 'false'])
    .default('false')
    .transform((v) => v === 'true'),
  // dwellTime override — controller-config.yaml 의 dwell.promotionMs 보다 우선.
  // 시뮬 환경에서 cycle MS=5000 + dwell=15000 으로 4 promote 가 ~75s 안에 완료되도록
  // 단축 가능. 미설정 시 yaml 값 사용 (production 기본 120000).
  SIM_CONTROLLER_DWELL_MS: z.coerce.number().int().positive().optional(),
  // 시뮬 candidate 시드 — startup 시 InMemorySimServiceCatalog 에 candidate 등록.
  // 시나리오 9 setup 의 v3=stable + v4=undeployed 가정에 따라 기본은 미설정 (v3 stable
  // 만 fixture). 값 설정 시 해당 정수 버전을 candidate 로 추가하여 controller 가 weight
  // 100 도달 시 transition 가능.
  SIM_CONTROLLER_CANDIDATE_VERSION: z.coerce.number().int().positive().optional(),
  SIM_DB_WRITE_URL: z.string().url(),
  SIM_METRICS_COLLECTOR_URL: z.string().url(),
  QA_INGEST_URL: z.string().url(),
  SIM_AUDIT_RECORDER_URL: z.string().url(),
  SIM_GATEWAY_ADMIN_URL: z.string().url(),
  SIM_COMPOSE_PROJECT: z.string().default('enterprise-pm'),
  SIM_LOAD_RPS_THRESHOLD: z.coerce.number().positive().default(100),
  SIM_CPU_HIGH_PCT: z.coerce.number().min(0).max(100).default(80),
  SIM_DB_POOL_HIGH_PCT: z.coerce.number().min(0).max(100).default(80),
  SIM_SCALE_COOLDOWN_UP_MS: z.coerce.number().int().positive().default(60_000),
  SIM_SCALE_COOLDOWN_DOWN_MS: z.coerce.number().int().positive().default(180_000),
  // spec 2026-05-02 §7 — controller 가 routing push 시 대상 서비스 이름.
  SIM_CONTROLLER_TARGET_SERVICE: z.string().default('approval'),
});

export const env = envSchema.parse(process.env);
export type ControllerEnv = z.infer<typeof envSchema>;
