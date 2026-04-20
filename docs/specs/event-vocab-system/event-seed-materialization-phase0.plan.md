---
def:
  id: event-seed-materialization-phase0-plan
  level: leaf
  tier: component
  scope: flow
  aspect: process_flow
  depth: specification
  lifecycle: draft
  layer: operation
  svc: event-catalog
  tags: [cross-scope, structural, observability]
  links:
    - target: event-taxonomy-roadmap-plan
      type: refines
    - target: event-taxonomy-rollout-todo
      type: traces_to
    - target: registry-events-module
      type: depends_on
    - target: service-ownership-spec
      type: depends_on
---

# Event Seed Materialization Phase 0 — 하드코딩 제거 설계

> 상태: historical. 이 문서는 Phase 0 임시 `_mapping` fallback 설계를 기록한다. 현재 runtime seed는 adoption 미존재 시 `_mapping`을 생성하지 않는다.

## 목적 ^purpose

`seed-events.ts`의 `serviceId: "shopping-web"` 하드코딩을 제거하여, 전역 mapping 기반 이벤트가 특정 실제 서비스에 잘못 귀속되는 문제를 먼저 해소한다. 이 단계는 최종 service adoption 구조를 구현하는 것이 아니라, 현재 구조에서 **거짓 소유권을 제거하는 안전한 임시 materialization**을 제공하는 것이 목적이다.

## 핵심 판단 ^overview

Phase 0에서는 **정확한 서비스 귀속을 시도하지 않는다.**

이유:
- 현재는 `service event adoption` 모델이 없다.
- `ownedPrefixes`만으로는 어떤 서비스가 어떤 이벤트 mapping을 실제 채택했는지 정확히 알 수 없다.
- 따라서 ownership 추정으로 강하게 귀속시키면 새로운 거짓 양성이 생긴다.

즉, 지금 단계의 목표는:
- `shopping-web` 하드코딩 제거
- 실제 서비스처럼 보이는 잘못된 serviceId 제거
- 이후 adoption 기반 materialization으로 갈 수 있는 중간 상태 확보

## 권장 알고리즘 ^method

### 1. Core Event Seed

기존대로 `_core` bucket에 저장한다.

```ts
serviceId = "_core"
```

의미:
- 전역 vocabulary
- 실제 서비스 귀속 아님

### 2. Mapping 기반 Event Seed

전역 mapping 레지스트리에서 읽은 이벤트는 **synthetic bucket**에 저장한다.

```ts
serviceId = "_mapping"
```

설명(description)에는 최소한 아래를 포함한다.

- mapping domain
- prefix 목록
- ownership 기반 추정 candidate services (있으면)

예:

```text
prefix: page_view, tracking, endpoint
candidates: shopping-web, gateway
```

### 3. Candidate Service 계산

candidate는 **참고용 힌트**로만 계산한다.

알고리즘:

1. config store에서 `services` config 조회
2. 각 mapping의 `prefixes[].prefixId` 집합 계산
3. `ownedPrefixes`와 교집합이 있는 서비스 목록 계산
4. 그 결과를 description에 기록

주의:
- candidate는 `serviceId`로 승격하지 않는다.
- candidate 0건이어도 seed는 실패시키지 않는다.

## 왜 synthetic bucket인가

### 잘못된 대안 1 — 여전히 특정 서비스에 귀속

문제:
- 현행과 동일한 거짓 소유권 유지
- 구조적 왜곡 계속 발생

### 잘못된 대안 2 — ownership overlap 서비스 모두에 복제

문제:
- `endpoint`, `flow_point`, `permission`처럼 공유 prefix가 많아 과다 귀속 위험
- adoption이 없는 상태에서는 false positive가 많다

### 선택한 대안 — `_mapping` synthetic bucket

장점:
- 거짓 소유권 제거
- 현재 스키마 변경 불필요
- 이후 adoption 도입 시 migration 경로가 단순

단점:
- 서비스별 event schema 조회는 아직 제한적
- candidate는 힌트일 뿐 authoritative source가 아님

## 입력과 출력

### 입력

- `allCoreEvents`
- `getAllMappings()`
- config store의 `services`

### 출력

`EventSchemaRecord`

| 입력 종류 | serviceId | 의미 |
|---|---|---|
| core event | `_core` | 전역 vocabulary |
| mapping event | `_mapping` | 전역 해석 규칙 |

## drift 관점

Phase 0에서 잡고 싶은 drift:

- mapping 이벤트가 실제 서비스처럼 보이는 문제
- mapping 변화가 특정 서비스 귀속으로 고정되는 문제

Phase 0에서 아직 못 잡는 drift:

- 서비스가 어떤 pack을 실제 채택했는가
- 서비스 custom event가 어떤 pack과 결합되는가
- pack version과 서비스 version pin 불일치

## Phase 0 완료 조건

1. `shopping-web` 하드코딩 제거
2. mapping 기반 이벤트는 `_mapping` bucket으로 seed
3. description에 prefix 목록과 candidate services 힌트 포함
4. seed path가 config store의 `services`를 읽을 수 있음
5. registry event schema 조회에서 `_core`, `_mapping`이 synthetic bucket임을 문서화

## 후속 연결

- Phase 1: mapping pack first-class화
- Phase 2: service event adoption 도입
- Phase 3: `_mapping` bucket 제거 후 adoption 기반 service materialization 전환
