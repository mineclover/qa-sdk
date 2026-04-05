---
def:
  id: infra-monitoring
  scope: feature
  aspect: func_def
  depth: specification
  level: leaf
  lifecycle: approved
  layer: operation
  tags: [infra, monitoring, argocd]
  links:
    - target: infra-engine-pipeline
      type: implements
    - target: infra-observe-stage
      type: depends_on
---
# 모니터링 — ArgoCD 스타일 배포 상태 감시

## 목적 ^purpose

배포된 서비스의 상태를 ArgoCD처럼 주기적으로 동기화(sync)하고, 상태 변화를 감지하여 알림과 자동 대응을 수행한다. qa-sdk의 로그 수집(ingest-server)과 결합하여 서비스 정상 연결 여부를 모니터링한다.

## 구성 ^overview

- **sync-loop**: 등록된 모니터 대상에 주기적 헬스체크 수행
- **상태 모델**: Synced(정상) / OutOfSync(이상) / Degraded(부분 이상) / Unknown(도달 불가)
- **이벤트 emit**: 상태 변화 시 `health_event` prefix로 ingest-server에 전송
- **대시보드 API**: 서비스별 상태 집계 엔드포인트 제공
- **알림**: 상태 변화 시 webhook (Slack, Discord 등) 연동 가능

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
  
  /** 특정 서비스 수동 동기화 */
  syncOne(serviceId: string): Promise<SyncResult>;
}

interface SyncResult {
  serviceId: string;
  previousStatus: SyncStatus;
  currentStatus: SyncStatus;
  changed: boolean;
  checkedAt: string;          // ISO-8601
  latency?: number;
  details: string;
}

type SyncStatus = "Synced" | "OutOfSync" | "Degraded" | "Unknown";
```

### 동기화 흐름

```
매 interval초마다:
  monitor-targets.json에서 전체 대상 로드
    → 각 대상에 헬스체크 (병렬)
      → 상태 판정 (Synced / OutOfSync / Degraded / Unknown)
        → 이전 상태와 비교
          → 변화 있으면:
             1. monitor-targets.json 상태 업데이트
             2. health_event → ingest-server emit
             3. webhook 알림 (설정된 경우)
```

## 대시보드 데이터 API

인프라 엔진이 제공하는 상태 조회 인터페이스:

```typescript
interface DashboardData {
  /** 전체 서비스 상태 요약 */
  getSummary(): Promise<DashboardSummary>;
  
  /** 특정 서비스 상세 */
  getServiceDetail(serviceId: string): Promise<ServiceDetail>;
  
  /** 배포 이력 */
  getDeployHistory(serviceId: string, limit?: number): Promise<DeploymentRecord[]>;
}

interface DashboardSummary {
  total: number;
  synced: number;
  outOfSync: number;
  degraded: number;
  unknown: number;
  services: ServiceStatusEntry[];
}

interface ServiceStatusEntry {
  serviceId: string;
  provider: string;
  env: string;
  region: string;
  status: SyncStatus;
  endpoint: string;
  lastChecked: string;
  lastDeployed: string;
  uptime?: number;           // 마지막 Synced→OutOfSync 전이 이후 경과 시간
}

interface ServiceDetail extends ServiceStatusEntry {
  gateResults: GateCheckResult[];
  dependencyStatus: ConnectionCheck[];
  recentEvents: DeployEventPayload[];
}
```

## 알림 연동

```yaml
# config/dev.yaml 에 알림 설정 추가
monitoring:
  interval: 60                     # 헬스체크 주기 (초)
  webhooks:
    - url: https://hooks.slack.com/services/T.../B.../xxx
      events: ["OutOfSync", "Unknown"]   # 이 상태로 전이 시 알림
    - url: https://discord.com/api/webhooks/xxx
      events: ["OutOfSync", "Degraded", "Unknown"]
```

## 정의 ^defines

- `SyncLoop` — 주기적 상태 동기화 엔진
- `SyncResult` / `SyncStatus` — 동기화 결과/상태 타입
- `DashboardData` / `DashboardSummary` / `ServiceDetail` — 대시보드 인터페이스
- `MonitorTarget` — 감시 대상 (observe-stage에서 정의)

## 소비 ^consumes

- `InfraProfileAdapter` — 감시 대상 목록 관리 (`monitors` 필드)
- `IngestAdapter` — 상태 변화 이벤트 emit (`health_event` TransmissionEnvelope)
- `CoordinateAdapter` — svc_ref 좌표 해석 (health_event 인코딩)
- `RegistryAdapter` — 배포 이력 조회
- `health_event` prefix — demo-catalog (svc_ref × health_status)
- `ResolvedConfig.monitoring` — 알림 설정

## 구현 완료 모듈

| 모듈 | 파일 | 역할 |
|------|------|------|
| SyncLoop | `src/monitor/sync-loop.ts` | 주기적 헬스체크 + 상태 전이 |
| Dashboard | `src/monitor/dashboard.ts` | FleetStatus 집계 + 대시보드 데이터 |
| AutoRecovery | `src/monitor/auto-recovery.ts` | OutOfSync 감지 → 자동 재배포 트리거 |
| SLA | `src/monitor/sla.ts` | uptime 기반 SLA 계산 |

### CLI 명령

```
infra monitor start [--interval N]   # 백그라운드 sync-loop 시작
infra monitor check                  # 수동 1회 동기화
infra monitor status                 # 마지막 체크 결과

infra dashboard summary              # 전체 서비스 상태 요약
infra dashboard service <id>         # 서비스 상세
infra dashboard export [path]        # JSON export
```

## 향후 확장

- **Grafana 연동**: DashboardData를 Grafana 데이터소스로 노출
- **webhook 알림**: 상태 변화 시 Slack/Discord webhook POST
