// @def.boundary observability-system-root
// @def.doc observability-system-root

import { z } from 'zod';

/**
 * OTel 환경변수 스키마.
 * 서비스의 envSchema에 merge하여 사용한다.
 *
 * @example
 * const envSchema = baseSchema.merge(otelEnvSchema);
 */
export const otelEnvSchema = z.object({
  /** OTel 활성화 여부 */
  OTEL_ENABLED: z
    .enum(['true', 'false', '1', '0'])
    .default('false')
    .transform((v) => v === 'true' || v === '1'),

  /** OTLP Exporter 엔드포인트 (예: http://localhost:4318) */
  OTEL_EXPORTER_OTLP_ENDPOINT: z.string().url().optional(),

  /** OTLP Exporter 헤더 (key=value,key2=value2) */
  OTEL_EXPORTER_OTLP_HEADERS: z.string().optional(),

  /** 샘플링 비율 (0.0~1.0, 기본 1.0 = 전부 수집) */
  OTEL_TRACES_SAMPLER_ARG: z.coerce.number().min(0).max(1).default(1.0),
});

export type OtelEnv = z.infer<typeof otelEnvSchema>;
