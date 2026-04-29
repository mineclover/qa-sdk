---
def:
  id: endpoint-resolution-chain
  tier: component
  scope: flow
  aspect: process_flow
  depth: specification
  lifecycle: approved
  layer: operation
  links:
    - target: infra-verify-stage
      type: refines
    - target: infra-providers
      type: depends_on
---
# Endpoint Resolution Chain — 서비스 엔드포인트 다계층 해석 패턴

## 목적 ^purpose

서비스 간 의존 엔드포인트를 다계층 체인으로 해석하고, 배포 결과를 피드백 루프로 순환시켜 다음 배포의 dependency check에 자동 반영하는 패턴을 정의한다.

## 구성 ^overview

- **Resolve Chain**: 3단계 우선순위로 의존 서비스의 엔드포인트를 결정한다
- **Feedback Loop**: 배포 성공 시 획득한 URL을 config와 service-profile에 기록하여 다음 배포 사이클에서 재사용한다
- **Local Skip**: localhost/127.0.0.1 엔드포인트는 원격 배포 환경(CF Workers 등)에서 자동 스킵한다
- **Warn-not-fail**: 원격 의존 서비스 도달 실패는 warn 처리하여 배포 자체를 차단하지 않는다

---

## 정의 ^defines

### Resolve Chain — 3단계 해석 순서

`resolveDepEndpoint(dep, ctx, profile)` 함수가 의존 서비스의 엔드포인트를 다음 순서로 탐색한다.

| 우선순위 | 소스 | source 태그 | 설명 |
|---------|------|------------|------|
| 1 | `config.connections[dep].endpoint` | `"config"` | 사용자가 설정 파일에 명시한 DNS/URL. 가장 높은 우선순위 |
| 2 | `serviceProfile.get(dep)` | `"profile"` | 이전 배포에서 service-profile에 기록된 URL |
| 3 | — | `"none"` | 두 곳 모두 없으면 `null` 반환. 해당 의존 검증 스킵 |

```typescript
interface ResolveResult {
  endpoint: string | null;
  source: "config" | "profile" | "none";
  healthPath: string;  // config.connections[dep].health_path ?? "/health"
}
```

체인의 각 단계는 이전 단계에서 값을 찾지 못했을 때만 다음으로 진행한다 (first-match 전략).

### Feedback Loop — 배포 결과 순환 구조

배포 성공 후 획득한 엔드포인트 URL이 두 경로를 통해 기록되어 다음 배포 사이클의 resolve chain에 투입된다.

```
배포 성공 (wrangler stdout URL 파싱)
  │
  ├─ 1. RegisterStage → serviceProfile.set(service, endpoint)
  │     경로: ~/.qa-sdk/service-profile.json → services[serviceId]
  │     용도: resolve chain 2순위 소스
  │
  └─ 2. cmd-deploy endpoint-feedback → config.connections[service].endpoint 기록
        경로: config/<env>.json → connections[serviceId].endpoint
        용도: resolve chain 1순위 소스
```

#### RegisterStage 기록 (service-profile)

`createRegisterStage`에서 `profile.set(ctx.service, endpoint)`를 호출하여 `~/.qa-sdk/service-profile.json`의 `services` 맵에 URL을 저장한다. 원자적 쓰기(tmp → rename)와 rollback 백업을 보장한다.

#### cmd-deploy endpoint-feedback (config 파일)

배포 성공 후 `cmd-deploy.ts`에서 config 파일의 `connections[service].endpoint`를 직접 갱신한다. 기존 값과 동일하면 쓰기를 건너뛴다. 실패 시 무시(try-catch)하여 배포 결과를 오염시키지 않는다.

```
이전 값 없음 → "[endpoint-feedback] {service}: {url} (신규)"
이전 값 불일치 → "[endpoint-feedback] {service}: {url} (이전: {prev})"
이전 값 일치 → 쓰기 생략
```

#### 순환 구조 요약

```
배포(N) 성공
  → service-profile에 URL 기록
  → config.connections에 URL 기록
  → 배포(N+1)의 dependency-reach 게이트
    → resolveDepEndpoint가 config(1순위) 또는 profile(2순위)에서 URL 획득
    → 원격 의존 서비스 헬스체크 수행
```

### Local Skip — 로컬 엔드포인트 자동 제외 ^constraint:local-skip

`isRemoteEndpoint()` 함수가 URL의 hostname을 검사하여 아래 주소는 로컬로 판단한다.

| hostname | 판정 |
|----------|------|
| `localhost` | 로컬 → 스킵 |
| `127.0.0.1` | 로컬 → 스킵 |
| `::1` | 로컬 → 스킵 |
| `0.0.0.0` | 로컬 → 스킵 |
| 그 외 | 원격 → 헬스체크 수행 |

로컬 엔드포인트는 CF Workers 등 원격 배포 환경에서 물리적으로 도달 불가하므로 dependency-reach 게이트를 `pass`로 처리하고 `"스킵 (로컬: {endpoint})"` 상세를 기록한다.

### Warn-not-fail — 의존 도달 실패 완화 ^constraint:warn-not-fail

원격 의존 서비스에 대한 `httpProbe` 호출이 실패(timeout 5초)해도 `verdict`를 `"fail"` → `"warn"`으로 강제 전환한다.

```
verdict === "fail"
  → verdict = "warn"
  → detail = "도달 불가 (warn): {원래 detail}"
```

근거: 의존 서비스의 일시적 장애가 현재 서비스의 배포를 차단하면 연쇄 배포 실패(cascade failure)를 유발한다. 배포는 성공시키되, 운영자에게 warn으로 가시성을 제공한다.

### 엔드포인트 미등록 처리

resolve chain에서 `endpoint === null`인 경우(미배포 서비스), dependency-reach 게이트를 `pass`로 처리하고 `"스킵 (엔드포인트 미등록)"` 상세를 기록한다. 첫 배포 순서에 관계없이 파이프라인이 진행되도록 보장한다.

## 소비 ^consumes

- `DeployContext.config.connections` — 서비스별 endpoint, health_path 설정
- `ServiceProfileAdapter` — service-profile.json 읽기/쓰기 (resolve chain 2순위, feedback 저장소)
- `ProvisionResult.outputs.endpoint` — 배포에서 획득한 URL (feedback loop 입력)
- `httpProbe` — 의존 서비스 헬스체크 수행

## 위임 ^delegates

- 헬스체크 프로브 실행 → `verify/health-check.ts` (`httpProbe`)
- service-profile 영속 → `adapters/service-profile.ts` (`createServiceProfileAdapter`)
- config 파일 갱신 → `cmd-deploy.ts` endpoint-feedback 블록

## 소스 위치

| 구현 | 파일 |
|------|------|
| `resolveDepEndpoint` | `packages/infra-engine/src/verify/gate-definitions.ts` |
| `isRemoteEndpoint` | `packages/infra-engine/src/verify/gate-definitions.ts` |
| endpoint-feedback | `packages/infra-engine/src/cli/cmd-deploy.ts` (179-194행) |
| service-profile 기록 | `packages/infra-engine/src/stages/register-stage.ts` (35행) |
| ServiceProfileAdapter | `packages/infra-engine/src/adapters/service-profile.ts` |
