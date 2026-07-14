// @def.boundary shared-utility-group
// @def.doc shared-utility-group

import type { EnvResolvedConfig } from './types.js';

/** infra 내부 전용 키 — env vars로 변환하지 않음 */
export const SKIP_ENV_KEYS = new Set(['depends_on', 'gates', 'health_path']);

/** config JSON의 서비스 설정 객체를 env vars로 변환 */
export function configToEnvVars(config: Record<string, unknown>): Record<string, string> {
  const vars: Record<string, string> = {};
  for (const [key, value] of Object.entries(config)) {
    if (SKIP_ENV_KEYS.has(key)) continue;
    if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
      vars[key.toUpperCase()] = String(value);
    }
  }
  return vars;
}

/** 서비스 설정에서 평탄한 환경변수 맵 추출 */
export function extractServiceEnv(
  config: EnvResolvedConfig,
  serviceId: string,
): Record<string, string> {
  const svc = config.services[serviceId];
  if (!svc) return {};
  return configToEnvVars(svc);
}

/** 의존 서비스 연결 URL을 환경변수로 변환 */
export function resolveConnectionEnv(
  config: EnvResolvedConfig,
  serviceId: string,
): Record<string, string> {
  const svc = config.services[serviceId];
  if (!svc?.depends_on) return {};
  const env: Record<string, string> = {};
  for (const dep of svc.depends_on) {
    const conn = config.connections[dep];
    if (conn?.endpoint) {
      const envKey = dep.replace(/-/g, '_').toUpperCase() + '_URL';
      env[envKey] = conn.endpoint;
    }
  }
  return env;
}
