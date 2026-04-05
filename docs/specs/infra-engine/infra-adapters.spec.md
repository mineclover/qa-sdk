---
def:
  id: infra-adapters
  scope: feature
  aspect: func_def
  depth: specification
  level: module
  lifecycle: draft
  layer: mediation
  tags: [infra, adapter, integration]
  links:
    - target: infra-engine-pipeline
      type: implements
---
# 어댑터 계층 — qa-sdk 연동 + 범용 확장

## 목적 ^purpose

인프라 엔진 코어(범용)와 qa-sdk 체계(registry, ingest, gate, service-profile) 사이의 경계를 어댑터 인터페이스로 정의한다. qa-sdk 데이터 구조에서 필요한 정보를 추출하거나, 외부 데이터를 qa-sdk 형식으로 변환하는 양방향 브릿지 역할.

## 방법 ^method

각 어댑터는 인터페이스(포트)와 구현(어댑터)으로 분리한다. 코어는 인터페이스만 참조하고, qa-sdk 구현은 `adapters/` 디렉토리에 격리한다. 다른 프로젝트에서 사용 시 어댑터만 교체하면 된다.

---

## 어댑터 인터페이스 (포트)

### RegistryAdapter

```typescript
/** 서비스 배포 정보를 레지스트리에 등록/조회/삭제 */
interface RegistryAdapter {
  register(record: DeploymentRecord): Promise<string>;  // → registryId
  getActive(serviceId: string): Promise<DeploymentRecord | null>;
  list(serviceId: string): Promise<DeploymentRecord[]>;
  delete(serviceId: string, registryId: string): Promise<void>;
}
```

### ServiceProfileAdapter

```typescript
/** service-profile.json 읽기/쓰기 */
interface ServiceProfileAdapter {
  get(serviceId: string): Promise<ServiceProfileEntry | null>;
  set(serviceId: string, entry: ServiceProfileEntry): Promise<void>;
  restore(serviceId: string): Promise<void>;  // rollback용 — 이전 값 복원
  getAll(): Promise<Record<string, ServiceProfileEntry>>;
}
```

### IngestAdapter

```typescript
/** ingest-server로 이벤트 전송 */
interface IngestAdapter {
  emit(eventKey: string, payload: Record<string, unknown>): Promise<boolean>;
}
```

### GateAdapter

```typescript
/** 품질 게이트 평가 — qa-sdk GateEngine 패턴 차용 */
interface GateAdapter {
  evaluate(checks: GateCheckResult[]): GateVerdict;
}

type GateVerdict = "pass" | "warn" | "fail";
```

### MonitorAdapter

```typescript
/** 모니터링 대상 등록/조회/상태 업데이트 */
interface MonitorAdapter {
  register(target: MonitorTarget): Promise<void>;
  unregister(serviceId: string): Promise<void>;
  getAll(): Promise<MonitorTarget[]>;
  updateStatus(serviceId: string, status: MonitorStatus): Promise<void>;
}
```

## qa-sdk 구현

### QaSdkRegistryAdapter

- `POST /v1/services/{id}/deployments` → registry-service HTTP 호출
- `ServiceClientError` 패턴 사용 (qa-sdk 에러 처리 컨벤션)
- timeout: 5초 (`AbortSignal.timeout(5_000)`)

### QaSdkServiceProfileAdapter

- `~/.qa-sdk/service-profile.json` 읽기/쓰기
- 기존 `getServiceUrl()` 유틸과 호환
- rollback용 이전 값은 메모리 스냅샷 (별도 파일 생성 안 함)

### QaSdkIngestAdapter

- `POST /v1/ingest` → ingest-server HTTP 호출
- `deploy_event` prefix 사용
- IngestForwarder 패턴 참고하되, 직접 HTTP 호출 (logger 경유 아님)
- fail-open: 실패 시 false 반환, 예외 던지지 않음

### QaSdkGateAdapter

- GateEngine의 4-state 판정 로직을 경량 재구현
- 필수 게이트 전부 pass → "pass"
- 필수 pass + 선택 fail → "warn"
- 필수 fail → "fail"

### QaSdkMonitorAdapter

- 모니터링 대상을 `~/.qa-sdk/monitor-targets.json`에 저장
- sync-loop가 이 파일을 읽어서 주기적 헬스체크 수행

## 데이터 추출 패턴

qa-sdk 데이터 구조에서 인프라 엔진이 필요한 정보를 추출하는 헬퍼:

```typescript
/** registry-service에서 서비스 메타데이터 추출 */
function extractServiceMeta(registryData: unknown): ServiceMeta {
  // ServiceBootConfig, ownedPrefixes 등에서 필요한 필드만 추출
}

/** DKG에서 서비스 의존 관계 추출 */
function extractDependencyGraph(dkgData: unknown): DependencyEdge[] {
  // DKG 엣지에서 서비스 간 의존 관계 추출
}

/** ingest 이벤트에서 서비스 상태 요약 추출 */
function extractHealthSummary(events: unknown[]): HealthSummary {
  // deploy_event, health_event에서 최근 상태 집계
}
```

## 정의 ^defines

- `RegistryAdapter` / `ServiceProfileAdapter` / `IngestAdapter` / `GateAdapter` / `MonitorAdapter` — 5개 포트 인터페이스
- `QaSdkRegistryAdapter` / `QaSdkServiceProfileAdapter` / `QaSdkIngestAdapter` / `QaSdkGateAdapter` / `QaSdkMonitorAdapter` — qa-sdk 구현
- `extractServiceMeta()` / `extractDependencyGraph()` / `extractHealthSummary()` — 데이터 추출 헬퍼

## 소비 ^consumes

- `registry-service` HTTP API (port 3300)
- `ingest-server` HTTP API (port 3200)
- `~/.qa-sdk/service-profile.json`
- `~/.qa-sdk/monitor-targets.json`
- qa-sdk 타입: `ServiceBootConfig`, `DeploymentRecord`, `MonitorTarget`

## 확장

다른 프로젝트에서 인프라 엔진을 사용할 때:
1. 5개 어댑터 인터페이스의 대체 구현을 작성
2. 파이프라인 생성 시 주입 (`createPipeline({ adapters: { registry: myAdapter, ... } })`)
3. 코어 코드 수정 없음
