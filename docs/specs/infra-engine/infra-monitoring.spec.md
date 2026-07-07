---
def:
  id: infra-monitoring
  scope: feature
  aspect: func_def
  depth: specification
  tier: component
  lifecycle: approved
  layer: operation
  tags: [infra, monitoring, argocd, observability]
  links:
    - target: infra-engine-pipeline
      type: implements
    - target: infra-observe-stage
      type: depends_on
sources:
  - packages/infra-engine/src/monitor/sync-loop.ts
  - packages/infra-engine/src/monitor/auto-recovery.ts
  - packages/infra-engine/src/monitor/dashboard.ts
  - packages/infra-engine/src/monitor/sla.ts
  - packages/infra-engine/__tests__/monitor/sync-loop.test.ts
  - packages/infra-engine/__tests__/monitor/auto-recovery.test.ts
---
# 모니터링 — ArgoCD 스타일 배포 상태 감시

## 목적 ^purpose

배포된 서비스의 상태를 ArgoCD처럼 주기적으로 동기화(sync)하고, 상태 변화를 감지하여 알림과 자동 대응을 수행한다. qa-sdk의 로그 수집(ingest-server)과 결합하여 서비스 정상 연결 여부를 모니터링한다.

## 구성 ^overview

- **sync-loop**: 등록된 모니터 대상에 주기적 헬스체크 수행
- **상태 모델**: Synced(정상) / OutOfSync(이상) / Degraded(부분 이상) / Unknown(도달 불가)
- **이벤트 emit**: 상태 변화 시 `health_event` prefix를 ingest-server에 전송하며, CoordinateAdapter가 있으면 address_context도 함께 인코딩
- **대시보드 데이터**: infra-profile 기반 상태/이력 집계
- **알림**: 상태 변화 시 webhook (Slack, Discord 등) 연동 가능
- **설정 소스**: `packages/infra-engine/config/*.json`의 `monitoring.interval`, `monitoring.webhooks`

---

## Sync 상태 모델

ArgoCD의 Sync 상태를 참고하되, 인프라 엔진에 맞게 단순화:

```
Synced ←→ OutOfSync
  ↓          ↓
Degraded ←→ Unknown
```

| 상태 | 의미 | 전이 조건 |
|------|------|----------|
| `Synced` | 정상 — 헬스체크 pass | health endpoint 200 + 응답시간 정상 |
| `OutOfSync` | 이상 — 헬스체크 fail | health endpoint 비정상 응답 |
| `Degraded` | 부분 이상 — 일부 의존 서비스 불통 | 서비스 자체는 응답하나 dependency 일부 실패 |
| `Unknown` | 도달 불가 — 네트워크/서비스 다운 | 연결 자체 실패 (timeout, ECONNREFUSED) |

### VerifyStage 상태와의 매핑

VerifyStage의 배포 시점 `healthStatus`와 모니터링의 지속적 `SyncStatus`는 관점이 다르다:

| VerifyStage healthStatus | 초기 SyncStatus | 설명 |
|--------------------------|----------------|------|
| `healthy` | `Synced` | 배포 직후 정상 |
| `degraded` | `Degraded` | 배포 성공이나 일부 이상 |
| `failed` | — | rollback되므로 모니터링 미등록 |

## Sync Loop

```typescript
interface SyncLoop {
  /** sync-loop 시작 (백그라운드) */
  start(interval?: number): void;   // 기본 60초
  
  /** sync-loop 중지 */
  stop(): void;
  
  /** 수동 전체 동기화 */
  syncAll(): Promise<SyncResult[]>;

  /** 실행 여부 */
  isRunning(): boolean;

  /** 마지막 결과 */
  getLastResults(): SyncResult[];
}

interface SyncResult {
  serviceId: string;
  previousStatus: SyncStatus;
  currentStatus: SyncStatus;
  changed: boolean;
  checkedAt: string;          // ISO-8601
  latency?: number;
  detail: string;
}

type SyncStatus = "Synced" | "OutOfSync" | "Degraded" | "Unknown";
```

현재 구현에는 두 가지 runtime hook이 있다:
- `onStatusChange(serviceId, prev, curr)` — 상태 변화 로그/알림용
- `onResults(results)` — 한 번의 sync 결과 전체를 후처리하는 훅. auto-recovery가 여기에 연결된다.

### 동기화 흐름

```
매 interval초마다:
  ~/.qa-sdk/infra-profile.json의 monitors에서 전체 대상 로드
    → 각 대상에 헬스체크 (병렬)
      → 상태 판정 (Synced / OutOfSync / Degraded / Unknown)
        → 이전 상태와 비교
          → 변화 있으면:
             1. infra-profile 상태 업데이트
             2. health_event → ingest-server emit
             3. webhook 알림 (설정된 경우)
```

`infra monitor start`/`check`는 현재 등록된 monitor target들의 `env`를 기준으로 config JSON을 읽어 interval/webhook/recovery 설정을 조합한다. ingest-server가 살아 있으면 `health_event`를 emit하고, CoordinateAdapter가 있으면 `health_event` address_context도 함께 기록한다.

- `interval`: 여러 env가 섞여 있으면 가장 짧은 interval을 기본값으로 사용한다.
- `webhooks`: env별 webhook을 URL 기준으로 병합한다.
- `recovery`: env별로 따로 해석한다. 예를 들어 dev는 enabled, prod는 disabled일 수 있다.

`syncAll()`은 in-flight guard가 있어서 이전 sync가 아직 끝나지 않았으면 같은 Promise를 재사용한다. 긴 헬스체크나 auto-recovery 중 재진입해 중복 체크/중복 복구가 일어나는 것을 막기 위한 동작이다.

## 대시보드 데이터 API

인프라 엔진이 제공하는 상태 조회 인터페이스:

```typescript
interface DashboardData {
  /** 전체 서비스 상태 요약 */
  getSummary(): Promise<DashboardSummary>;
  
  /** 특정 서비스 상세 */
  getServiceDashboard(serviceId: string): Promise<ServiceDashboard>;

  /** JSON export */
  exportJson(): Promise<string>;
}

interface DashboardSummary {
  timestamp: string;
  totalServices: number;
  deployed: number;
  monitored: number;
  byStatus: Record<SyncStatus, number>;
  byProvider: Record<string, number>;
  byEnv: Record<string, number>;
}

interface ServiceDashboard {
  serviceId: string;
  deployment?: {
    provider: string;
    env: string;
    region: string;
    endpoint: string;
    deployedAt: string;
  };
  monitor?: {
    status: SyncStatus;
    lastChecked: string;
    interval: number;
  };
  history: DeployHistoryEntry[];
  uptime?: {
    since: string;
    durationMs: number;
    percentage: number;      // 0-100, 가장 최근 성공 배포 기준
  };
}
```

## 알림 연동

```yaml
# packages/infra-engine/config/dev.json
monitoring:
  interval: 60                     # 헬스체크 주기 (초)
  webhooks:
    - url: https://hooks.slack.com/services/T.../B.../xxx
      events: ["OutOfSync", "Unknown"]   # 이 상태로 전이 시 알림
    - url: https://discord.com/api/webhooks/xxx
      events: ["OutOfSync", "Degraded", "Unknown"]
  recovery:
    enabled: false
    maxRetries: 3
    cooldownSec: 300
```

복구 정책 해석 순서:
1. CLI 플래그 `--auto-recover`, `--max-retries`, `--cooldown-sec`
2. 해당 서비스가 속한 env의 `monitoring.recovery`
3. 기본값 (`disabled`, `3`, `300`)

## 정의 ^defines

- `SyncLoop` — 주기적 상태 동기화 엔진
- `SyncResult` / `SyncStatus` — 동기화 결과/상태 타입
- `DashboardData` / `DashboardSummary` / `ServiceDashboard` — 대시보드 인터페이스
- `MonitorTarget` — 감시 대상 (observe-stage에서 정의)

## 소비 ^consumes

- `InfraProfileAdapter` — 감시 대상 목록 관리 (`monitors` 필드)
- `IngestAdapter` — 상태 변화 이벤트 emit (`health_event` TransmissionEnvelope)
- `CoordinateAdapter` — svc_ref 좌표 해석 (health_event 인코딩)
- `health_event` prefix — demo-catalog (svc_ref × health_status)
- `ResolvedConfig.monitoring` — 알림 설정

## 구현 완료 모듈

| 모듈 | 파일 | 역할 |
|------|------|------|
| SyncLoop | `src/monitor/sync-loop.ts` | 주기적 헬스체크 + 상태 전이 |
| Dashboard | `src/monitor/dashboard.ts` | infra-profile 집계 + 대시보드 데이터 |
| AutoRecovery | `src/monitor/auto-recovery.ts` | OutOfSync/Unknown 감지 → 자동 재배포 트리거 |
| SLA | `src/monitor/sla.ts` | uptime 기반 SLA 계산 |

### CLI 명령

``` 
infra monitor start [--interval N]   # 백그라운드 sync-loop 시작
infra monitor start --auto-recover [--max-retries N] [--cooldown-sec N]
infra monitor check                  # 수동 1회 동기화
infra monitor check --auto-recover   # 수동 체크 후 복구 평가까지 수행
infra monitor status                 # 마지막 체크 결과

infra dashboard summary              # 전체 서비스 상태 요약
infra dashboard service <id>         # 서비스 상세
infra dashboard export [path]        # JSON export
```

`--auto-recover`는 CLI에서 전체 강제 활성화용 override다. config만으로도 env별 기본 활성화가 가능하다. 현재 구현은 `infra-profile`에 저장된 배포 정보를 읽어 `local`/`cloudflare` 서비스에 대해 기존 `infra deploy` CLI를 재호출한다. `--max-retries` 기본값은 `3`, `--cooldown-sec` 기본값은 `300`이다.

## 향후 확장

- **Grafana 연동**: DashboardData를 Grafana 데이터소스로 노출
- **webhook 알림**: 상태 변화 시 Slack/Discord webhook POST
