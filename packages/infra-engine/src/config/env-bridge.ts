// config/env-bridge.ts — 설정에서 환경변수 추출
import type { ResolvedConfig } from "../core/types.js";

/** 서비스 설정에서 평탄한 환경변수 맵 추출 */
export function extractServiceEnv(config: ResolvedConfig, serviceId: string): Record<string, string> {
  const svc = config.services[serviceId];
  if (!svc) return {};
  const env: Record<string, string> = {};
  for (const [key, value] of Object.entries(svc)) {
    if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
      env[key.toUpperCase()] = String(value);
    }
  }
  return env;
}

/** 의존 서비스 연결 URL을 환경변수로 변환 */
export function resolveConnectionEnv(config: ResolvedConfig, serviceId: string): Record<string, string> {
  const svc = config.services[serviceId];
  if (!svc?.depends_on) return {};
  const env: Record<string, string> = {};
  for (const dep of svc.depends_on) {
    const conn = config.connections[dep];
    if (conn?.endpoint) {
      const envKey = dep.replace(/-/g, "_").toUpperCase() + "_URL";
      env[envKey] = conn.endpoint;
    }
  }
  return env;
}
