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
  // ── 인프라 서비스 (3xxx) ──
  { name: "registry-server",    defaultPort: 3100, description: "Prefix/version 메타데이터 (PostgreSQL)" },
  { name: "ingest-server",      defaultPort: 3200, description: "이벤트 수집 + Phase-2 (PostgreSQL/In-memory)" },
  { name: "registry-service",   defaultPort: 3300, description: "카탈로그/주소 스키마 관리 (SQLite) + Dev Dashboard" },
  { name: "gate-service",       defaultPort: 3400, description: "주소 상태 게이트 (SQLite)" },
  { name: "query-service",      defaultPort: 3500, description: "정책 규칙 질의 (SQLite)" },
  { name: "decode-service",     defaultPort: 3600, description: "좌표 디코더 캐시 (Stateless)" },
  // ── 비즈니스 서비스 (4xxx) ── (데모용, 실제 배포 시 변경)
  { name: "shopping-backend",   defaultPort: 4100, description: "쇼핑 백엔드 API" },
  { name: "auth",               defaultPort: 4200, description: "인증 서비스" },
  { name: "payment",            defaultPort: 4300, description: "결제 서비스" },
  { name: "gateway",            defaultPort: 4400, description: "API 게이트웨이" },
  // ── 프론트엔드 (5xxx) ──
  { name: "shopping-web",       defaultPort: 5220, description: "쇼핑 데모 사이트" },
  { name: "platform-demo",      defaultPort: 5176, description: "3D 모니터 + 다이어그램 뷰어" },
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
