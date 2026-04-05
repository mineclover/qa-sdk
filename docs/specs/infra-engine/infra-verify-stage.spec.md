---
def:
  id: infra-verify-stage
  scope: feature
  aspect: func_def
  depth: specification
  level: leaf
  lifecycle: draft
  layer: operation
  tags: [infra, quality-gate, health-check]
  links:
    - target: infra-engine-pipeline
      type: implements
    - target: infra-register-stage
      type: depends_on
---
# VerifyStage — 헬스체크 + 품질 게이트

## 목적 ^purpose

배포된 서비스의 정상 동작 여부를 헬스체크와 품질 게이트로 검증한다. 실패 시 파이프라인 rollback을 트리거하여 비정상 배포가 레지스트리에 남지 않게 한다.

## 구성 ^overview

- **헬스체크**: HTTP/TCP 프로브로 서비스 응답 확인
- **품질 게이트**: 응답시간, 상태코드, 의존 서비스 연결성 등 복합 판정
- **게이트 verdict**: pass / warn / fail — fail이면 rollback 트리거
- **재시도**: 배포 직후 서비스 기동 지연을 고려한 retry (최대 3회, 간격 5초)
- **배포 라이프사이클**: pending → deploying → verifying → healthy / degraded / failed

---

## 배포 라이프사이클 상태 모델

```
pending → deploying → verifying → healthy
                                → degraded (warn: 일부 게이트 통과 못함)
                                → failed (rollback 트리거)
```

| 상태 | 의미 | 전이 조건 |
|------|------|----------|
| `pending` | 배포 대기 | 파이프라인 시작 |
| `deploying` | 프로비저닝 중 | ProvisionStage 시작 |
| `verifying` | 검증 중 | VerifyStage 시작 |
| `healthy` | 정상 | 모든 게이트 pass |
| `degraded` | 부분 이상 | 필수 게이트 pass + 선택 게이트 warn/fail |
| `failed` | 실패 | 필수 게이트 fail → rollback |

## 품질 게이트 정의

### 내장 게이트

| 게이트 | 유형 | 검사 내용 | 기본 임계값 |
|--------|------|----------|------------|
| `health-endpoint` | 필수 | `GET {endpoint}{healthPath}` → 200 | timeout 10s, retry 3회 |
| `response-time` | 선택 | 헬스체크 응답시간 | warn: >2s, fail: >10s |
| `dependency-reach` | 필수 | depends_on 서비스 endpoint 도달 | timeout 5s |
| `status-code` | 필수 | 헬스체크 응답 상태코드 | 200-299 범위 |

### 커스텀 게이트

사용자가 SOPS YAML에 서비스별 게이트를 정의할 수 있다:

```yaml
services:
  ingest-server:
    port: 3200
    gates:
      - name: db-connection
        type: custom
        check: "GET {endpoint}/health/db"
        expect_status: 200
        required: true
      - name: queue-ready
        type: custom
        check: "GET {endpoint}/health/queue"
        expect_status: 200
        required: false   # 선택 — 실패해도 degraded
```

## 정의 ^defines

### HealthGate 인터페이스

```typescript
interface HealthGate {
  name: string;
  required: boolean;          // true: fail→rollback, false: fail→degraded
  check(ctx: DeployContext): Promise<GateCheckResult>;
}

interface GateCheckResult {
  gate: string;
  verdict: "pass" | "warn" | "fail";
  detail: string;
  latency?: number;           // ms
}
```

### VerifyResult

```typescript
interface VerifyResult {
  healthStatus: "healthy" | "degraded" | "failed";
  gateVerdict: "pass" | "warn" | "fail";
  checks: GateCheckResult[];
  retryCount: number;
  totalDuration: number;
}
```

### 판정 규칙

```
필수 게이트 전부 pass → gateVerdict = "pass"
필수 게이트 전부 pass + 선택 게이트 일부 fail → gateVerdict = "warn", healthStatus = "degraded"
필수 게이트 하나라도 fail → gateVerdict = "fail", healthStatus = "failed" → rollback
```

## 실행 흐름

```
RegisterStage 완료 (endpoint 확정)
  │
  ├─ 1. 내장 게이트 실행 (health-endpoint, status-code, dependency-reach, response-time)
  │     retry: 최대 3회, 간격 5초 (서비스 기동 지연 대응)
  │
  ├─ 2. 커스텀 게이트 실행 (YAML에 정의된 gates)
  │
  └─ 3. 판정
        필수 게이트 결과 집계 → gateVerdict
        → pass: 파이프라인 계속
        → warn: 경고 + 파이프라인 계속
        → fail: rollback 트리거 (Register → Provision 역순)
```

## 소비 ^consumes

- `ProvisionResult.outputs.endpoint` — 헬스체크 대상 URL
- `ResolvedConfig.services[id].gates` — 커스텀 게이트 정의
- `ResolvedConfig.connections` — 의존 서비스 연결정보 (dependency-reach 게이트)
- `GateAdapter` — qa-sdk GateEngine 패턴 차용 시 사용 (선택)

## 사전 조건

VerifyStage는 이전 스테이지가 완료되어 `ctx.config`와 `ctx.provision`이 non-null임을 전제한다. null이면 파이프라인 실행기 레벨에서 이미 에러가 발생한 상태.

### healthPath 기본값

`ResolvedConfig.connections[target].health_path`가 미지정이면 VerifyStage가 기본값 `/health`를 적용한다.

## Rollback

VerifyStage 자체는 rollback할 것이 없다 (읽기 전용 검증). 실패 시 **파이프라인 실행기가** RegisterStage.rollback() → ProvisionStage.rollback()을 역순 호출한다.
