/**
 * 서비스 포트 레지스트리 — 포트 할당 SSOT + 충돌 감지.
 *
 * 각 서비스 env.ts의 기본값과 일치해야 한다.
 * 서비스 시작 시 warnPortConflict()를 호출하면
 * 다른 서비스와 포트가 겹칠 때 경고를 출력한다.
 */

export interface ServicePortEntry {
  readonly name: string;
  readonly defaultPort: number;
  readonly description: string;
}

/** 서비스별 기본 포트 할당 (SSOT) */
export const SERVICE_PORTS: readonly ServicePortEntry[] = [
  { name: "registry-server",  defaultPort: 3100, description: "Prefix/version 메타데이터 (PostgreSQL)" },
  { name: "ingest-server",    defaultPort: 3200, description: "이벤트 수집 + Phase-2 (PostgreSQL + Redis)" },
  { name: "registry-service", defaultPort: 3300, description: "카탈로그/주소 스키마 관리 (SQLite)" },
  { name: "gate-service",     defaultPort: 3400, description: "주소 상태 게이트 (SQLite)" },
  { name: "query-service",    defaultPort: 3500, description: "정책 규칙 질의 (SQLite)" },
  { name: "decode-service",   defaultPort: 3600, description: "좌표 디코더 캐시 (Stateless)" },
] as const;

/**
 * 현재 서비스의 포트가 다른 서비스 기본 포트와 충돌하는지 검사.
 *
 * @returns 충돌 경고 메시지 배열 (충돌 없으면 빈 배열)
 */
export function detectPortConflicts(
  currentService: string,
  currentPort: number,
): string[] {
  const warnings: string[] = [];
  for (const entry of SERVICE_PORTS) {
    if (entry.name === currentService) continue;
    if (entry.defaultPort === currentPort) {
      warnings.push(
        `⚠ PORT ${currentPort} conflicts with ${entry.name} (default: ${entry.defaultPort}). ` +
        `Set PORT env to avoid collision.`,
      );
    }
  }
  return warnings;
}

/**
 * 서비스 시작 시 포트 충돌 경고를 로거로 출력.
 *
 * @example
 * ```ts
 * warnPortConflict("decode-service", env.PORT, logger);
 * ```
 */
export function warnPortConflict(
  serviceName: string,
  port: number,
  logger?: { warn: (msg: string) => void },
): void {
  const conflicts = detectPortConflicts(serviceName, port);
  const log = logger ?? { warn: (m: string) => console.warn(m) };
  for (const msg of conflicts) {
    log.warn(msg);
  }
}
