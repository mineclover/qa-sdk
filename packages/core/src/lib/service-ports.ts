// @def.boundary qa-sdk-core-system
// @def.doc qa-sdk-core-system

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
  // ── 인프라 레이어 (기본 도구) ──
  { name: 'grafana', defaultPort: 3000, description: '대시보드 시각화' },
  { name: 'loki', defaultPort: 3100, description: '로그 집계 서비스' },
  { name: 'prometheus', defaultPort: 9090, description: '메트릭 수집 서비스' },
  // ── 인프라 데이터베이스 (PostgreSQL 인스턴스) ──
  {
    name: 'zitadel-postgres',
    defaultPort: 5433,
    description: 'Zitadel 인증 DB 컨테이너 (docker-compose.infra.yaml)',
  },
  {
    name: 'qa-sdk-postgres',
    defaultPort: 5434,
    description: 'qa-sdk 메인 PG 컨테이너 (auth/audit/ingest/decision/definition schema)',
  },
  // ── QA-SDK 엔진 서비스 (3xxx) ──
  {
    name: 'ingest-server',
    defaultPort: 3200,
    description: '이벤트 수집 + Phase-2 (PostgreSQL/In-memory)',
  },
  {
    name: 'registry-service',
    defaultPort: 3300,
    description: '카탈로그/주소 스키마 관리 (SQLite) + Dev Dashboard',
  },
  { name: 'gate-service', defaultPort: 3400, description: '주소 상태 게이트 (SQLite)' },
  { name: 'query-service', defaultPort: 3500, description: '정책 규칙 질의 (SQLite)' },
  { name: 'decode-service', defaultPort: 3600, description: '좌표 디코더 캐시 (Stateless)' },
  {
    name: 'definition-service',
    defaultPort: 3700,
    description: '문서/prefix 정의 관리 (NestJS + SQLite)',
  },
  {
    name: 'motion-workspace-service',
    defaultPort: 3710,
    description: '모션 워크스페이스 (Hono + SQLite)',
  },
  {
    name: 'decision-service',
    defaultPort: 3800,
    description: '의사결정 스키마/인스턴스 관리 (NestJS + SQLite)',
  },
  // ── 비즈니스 서비스 (4xxx) ── (데모용, 실제 배포 시 변경)
  { name: 'shopping-backend', defaultPort: 4100, description: '쇼핑 백엔드 API' },
  { name: 'auth', defaultPort: 4200, description: '인증 서비스' },
  { name: 'payment', defaultPort: 4300, description: '결제 서비스' },
  // ── 게이트웨이 (8xxx) ──
  {
    name: 'gateway',
    defaultPort: 8787,
    description: 'API 게이트웨이 (Hono + Tailscale/CF Workers)',
  },
  // ── 시뮬레이션 — Enterprise PM (Phase 4) ──
  {
    name: 'sim-auth-api',
    defaultPort: 4400,
    description: '시뮬: 사용자/role/department + bitmap 발행',
  },
  { name: 'sim-pm-api', defaultPort: 4500, description: '시뮬: Project/Task/Member' },
  {
    name: 'sim-approval-api',
    defaultPort: 4600,
    description: '시뮬: Budget/Resource/Time-off/Expense workflow',
  },
  { name: 'sim-notification-api', defaultPort: 4700, description: '시뮬: 알림·구독' },
  {
    name: 'sim-reporting-api',
    defaultPort: 4800,
    description: '시뮬: 분석·대시보드 (marginal density 측정)',
  },
  { name: 'sim-document-api', defaultPort: 4900, description: '시뮬: 첨부파일·코멘트·버전' },
  {
    name: 'sim-audit-browser-api',
    defaultPort: 5100,
    description: '시뮬: audit trace explorer API',
  },
  { name: 'sim-metrics-collector', defaultPort: 5200, description: '시뮬: Prometheus exporter' },
  {
    name: 'sim-canary-controller',
    defaultPort: 5300,
    description: '시뮬: 카나리 control-plane (Pass 1 + Pass 2 + 30s cycle)',
  },
  { name: 'sim-gateway', defaultPort: 8888, description: '시뮬: Hono gateway (JWT + traceparent)' },
  // ── 프론트엔드 (5xxx) ──
  { name: 'shopping-web', defaultPort: 5220, description: '쇼핑 데모 사이트' },
  { name: 'platform-demo', defaultPort: 5176, description: '3D 모니터 + 다이어그램 뷰어' },
] as const;

/** 이름으로 포트 조회 (인프라 레지스트리에 반드시 존재해야 함) */
export function getRequiredServicePort(name: string): number {
  const port = SERVICE_PORTS.find((e) => e.name === name)?.defaultPort;
  if (port === undefined) {
    throw new Error(
      `[Infrastructure] Service '${name}' is not registered in central SERVICE_PORTS. ` +
        `Check packages/core/src/lib/service-ports.ts to register it before starting.`,
    );
  }
  return port;
}

/** 이름으로 포트 조회 (선택적) */
export function getServicePort(name: string): number | undefined {
  return SERVICE_PORTS.find((e) => e.name === name)?.defaultPort;
}

/** 이름으로 dev URL 조회 */
export function getServiceDevUrl(name: string): string | undefined {
  const port = getServicePort(name);
  return port ? `http://localhost:${port}` : undefined;
}

/**
 * 현재 서비스의 포트가 다른 서비스 기본 포트와 충돌하는지 검사.
 *
 * @returns 충돌 경고 메시지 배열 (충돌 없으면 빈 배열)
 */
export function detectPortConflicts(currentService: string, currentPort: number): string[] {
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
