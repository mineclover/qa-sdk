---
def:
  id: event-taxonomy-usecases-plan
  tier: component
  scope: flow
  aspect: user_scenario
  depth: specification
  lifecycle: draft
  layer: operation
  svc: event-catalog
  tags: [cross-scope, structural, observability, entry-point]
  links:
    - target: event-taxonomy-layering-plan
      type: traces_to
    - target: event-mapping-pack-plan
      type: traces_to
    - target: service-event-adoption-plan
      type: traces_to
    - target: event-core-pattern
      type: traces_to
    - target: service-ownership-spec
      type: traces_to
  sources:
    - packages/event-catalog/src/index.test.ts
    - packages/event-catalog/src/prefix-mapping.test.ts
    - packages/registry-service/src/core/seed-events.test.ts
    - packages/registry-service/src/modules/events/event.controller.test.ts
---

# Event Taxonomy Use Cases — 설계 검증 계획

## 목적 ^purpose

event taxonomy 3층 분리 설계가 실제로 관리하기 쉬운지, 그리고 서비스/도메인 증가 시 확장 가능하게 유지되는지를 대표 사용 시나리오로 검증한다.

## 구성 ^overview

- 전역 vocabulary 추가/변경 시나리오
- mapping pack 추가/분리 시나리오
- 서비스별 adoption 시나리오
- registry materialization과 drift 검출 시나리오
- 각 시나리오별 관리 용이성/확장성 평가
- 시나리오 안정화 기준과 우선순위

## 시나리오 안정화 기준

각 use case는 아래 5개를 만족할 때 "안정화됨"으로 본다.

1. **변경 층이 명확하다**
   - 어느 layer를 수정해야 하는지가 1차적으로 고정돼 있어야 한다.
2. **blast radius가 예측 가능하다**
   - 어떤 시나리오가 다른 layer까지 전파되는지 명시돼 있어야 한다.
3. **registry materialization 규칙이 있다**
   - 이 시나리오가 registry surface에 어떻게 반영되는지 설명할 수 있어야 한다.
4. **drift 검출 경로가 있다**
   - ownership / pack / adoption / seed 결과의 어긋남을 어디서 잡는지 보여야 한다.
5. **점진 전환이 가능하다**
   - 전면 재작성 없이 pack/adoption 단위로 이동 가능해야 한다.

## 사용 시나리오

### UC-1: 전역 Core Event 추가

**상황**: 여러 서비스에서 재사용할 새 실행 패턴 이벤트를 추가한다.

예: `background_sync_started`

**변경 대상**:
- Layer 1 only
  - `CoreEventDef`
  - payload guide
  - graph hint

**기대 효과**:
- 기존 mapping pack과 service adoption은 수정하지 않아도 된다.
- 새 이벤트를 쓰고 싶은 서비스만 이후 adoption layer에서 채택한다.

**평가**:
- 관리 용이성: 높음
- 확장성: 높음
- 전제: core와 custom의 경계가 명확해야 함
- 안정화 상태: 높음

### UC-2: 특정 도메인용 Mapping Pack 추가

**상황**: checkout 전용 이벤트 해석 pack을 추가한다.

예: `checkout-process-pack`

**변경 대상**:
- Layer 2 only
  - 새 `packId`
  - 관련 `EventPrefixMapping[]`

**기대 효과**:
- 기존 global vocabulary는 변경하지 않는다.
- pack을 채택하지 않은 서비스에는 영향이 없다.

**평가**:
- 관리 용이성: 중간 이상
- 확장성: 높음
- 전제: pack이 first-class여야 하며 side-effect registry만으로 관리되면 안 됨
- 안정화 상태: 중간

### UC-3: 기존 Pack을 새 서비스가 채택

**상황**: 새 서비스가 기존 `infra-observe-pack`을 채택한다.

**변경 대상**:
- Layer 3 only
  - `serviceId -> eventPacks`

**기대 효과**:
- mapping 자체는 재작성하지 않는다.
- registry가 서비스별 event schema를 자동 materialize할 수 있다.

**평가**:
- 관리 용이성: 높음
- 확장성: 매우 높음
- 전제: service adoption 모델과 seed path가 연결돼 있어야 함
- 안정화 상태: 낮음

### UC-4: 한 서비스만 pack 일부 override

**상황**: 대부분 서비스는 공통 pack을 쓰지만, 한 서비스만 특정 이벤트를 다른 prefix 조합으로 해석한다.

**변경 대상**:
- Layer 3 중심
  - adoption override 또는 local pack 추가

**기대 효과**:
- global vocabulary와 공통 pack을 오염시키지 않는다.

**평가**:
- 관리 용이성: 중간
- 확장성: 중간 이상
- 전제: override 규칙이 명시돼야 함
- 안정화 상태: 낮음

### UC-5: 서비스별 확장 이벤트

**상태**: future scope

현재 canonical adoption 모델은 `eventPacks + allowedCategories`만 지원한다.  
서비스별 custom event surface는 아직 구현/정책 범위에 포함하지 않는다.

따라서 이 시나리오는 현재 구조의 활성 use case가 아니라, 후속 확장 레이어 검토 항목으로 남긴다.

### UC-6: Registry가 서비스별 Event Schema를 Materialize

**상황**: registry-service가 전역 vocabulary, pack, service adoption을 조합해 서비스별 event schema를 생성한다.

**변경 대상**:
- seed/materialization path

**기대 효과**:
- `serviceId` 하드코딩 제거
- 서비스별 event taxonomy 조회 가능

**평가**:
- 관리 용이성: 높음
- 확장성: 높음
- 전제: `seed-events`가 adoption layer를 읽어야 함
- 안정화 상태: 낮음

### UC-7: Drift 검출

**상황**: service ownership, mapping pack, service adoption이 서로 어긋난다.

예:
- pack에는 있는데 adoption에 없음
- adoption에는 있는데 서비스가 prefix ownership에서 전혀 소비/생산하지 않음

**기대 효과**:
- drift를 조기에 탐지
- 어디가 source of truth인지 명확히 판단 가능

**평가**:
- 관리 용이성: 높음
- 확장성: 높음
- 전제: 정합성 규칙이 별도 gate로 존재해야 함
- 안정화 상태: 중간

### UC-8: Pack 버전 전환

**상황**: mapping pack의 해석 규칙이 바뀌어 v2가 필요하다.

**변경 대상**:
- Layer 2 versioning
- Layer 3 adoption migration

**기대 효과**:
- 서비스별 점진 전환 가능
- 한 번에 전체 시스템을 깨지 않고 migration 가능

**평가**:
- 관리 용이성: 중간
- 확장성: 높음
- 전제: pack version과 adoption version pin이 필요함
- 안정화 상태: 낮음

## 종합 평가

| 항목 | 평가 | 이유 |
|---|---|---|
| 전역 vocabulary 관리 | 좋음 | 공통 의미를 한 곳에 고정 가능 |
| 서비스별 해석 분리 | 좋음 | pack으로 분리하면 오염 최소화 |
| 서비스 온보딩 | 좋음 | adoption layer만 바꾸면 됨 |
| drift 추적 | 좋음 | adoption/ownership/materialization drift를 check/assert로 읽을 수 있음 |
| seed/materialization | 좋음 | adoption 기반 materialization으로 정리됨 |
| version migration | 중간 | pack/adoption version pin은 있으나 전환 시나리오 문서화는 더 필요 |

## 시나리오 안정화 상세

### 1차 안정화 시나리오 — vocabulary / pack 경계 (UC-1/2/5)

UC-1/2/5는 vocabulary와 pack 경계만 명확하면 관리 가능하므로 1차 안정화 대상이다.

| UC | 변경 층 | blast radius | 비고 |
|---|---|---|---|
| UC-1 | Layer 1 (Core Vocabulary) | core event 추가 → pack/adoption 무영향. 새 이벤트를 채택하려는 서비스만 adoption에서 명시적으로 추가 | 안정화 상태: 높음 |
| UC-2 | Layer 2 (Mapping Pack) | 새 pack 추가 → vocabulary 무영향, 미채택 서비스 무영향. 채택 서비스만 materialization 결과 변경 | 안정화 상태: 중간 |
| UC-5 | future scope | 현재 canonical adoption 모델(`eventPacks + allowedCategories`)에서 서비스별 custom event surface 미지원. 후속 확장 레이어로 남김 | 설계 예약 |

### 2차 안정화 시나리오 — adoption / materialization (UC-3/6/7)

UC-3/6/7은 service adoption과 seed/materialization 경로가 연결돼야 안정화된다. adoption path가 canonical `{ packId, version }` 형태로 정리된 현재 상태에서 안정화를 진행한다.

**UC-3: 서비스 adoption 경로**
- 새 서비스가 기존 pack을 채택할 때 Layer 3(adoption config)만 수정
- registry seed path: adoption config 조회 → pack registry에서 매핑 로드 → 서비스별 event schema materialize
- drift 검출: `adoption-missing` (adoption config 부재), `missing-pack-ids` (참조한 pack이 registry에 없음)

**UC-6: registry materialization 경로**
- registry-service가 core vocabulary + pack + adoption을 조합하여 서비스별 event schema를 생성
- registry seed path: `seed-events` → adoption layer 읽기 → pack별 매핑 조합 → 서비스별 schema 생성
- drift 검출: `records-without-pack-metadata` (pack 메타 없는 레코드), `prefixes-without-ownership` (ownership 미선언 prefix)

**UC-7: drift 검출 경로**
- ownership / pack / adoption / materialization 결과 간 어긋남을 gate에서 탐지
- registry seed path: 서비스별 taxonomy 조회 → drift diagnostics surface에서 불일치 항목 수집
- drift 검출: `adopted-prefixes-without-ownership` (채택 pack prefix가 ownership에 없음), `stale-pack-versions` (오래된 pack version pin)

### 3차 안정화 시나리오 — override / versioning (UC-4/8)

#### UC-4 Override 규칙

서비스별 pack override 초안 정책:

1. **Global pack 오염 금지** — override는 global pack의 원본 정의를 변경하지 않는다.
2. **Local override 범위** — 단일 서비스 내에서만 유효하다. 다른 서비스의 materialization에 영향을 주지 않는다.
3. **Subset 재정의만 허용** — override pack은 원본 pack의 subset만 재정의할 수 있다. 원본에 없는 매핑을 추가할 수 없다.
4. **원본 pack 참조 필수** — override 시 원본 `packId`를 명시 참조해야 한다. 참조 없는 독립 override는 허용하지 않는다.

안정화 상태: 낮음 — override 정책이 실제 적용 사례로 검증되기 전까지 plan으로 유지.

#### UC-8 Pack Version Pin / Migration 규칙

pack version 관리 초안 정책:

1. **Adoption은 `{ packId, version }` 형식으로 pin** — version 미지정 시 latest를 암묵적으로 사용하지 않는다.
2. **Version 올릴 때 migration window 필요** — 새 version 발행 후 일정 기간 동안 구/신 version을 병행 허용한다.
3. **Deprecated version은 warning, removed version은 error** — deprecated pack version을 참조하면 drift check에서 warning, removed version은 error로 처리한다.
4. **Breaking change 시 major version bump** — 매핑 규칙의 의미가 바뀌거나 매핑이 삭제되면 major version을 올린다.

안정화 상태: 낮음 — version pin 구현은 완료되었으나 migration 시나리오의 실 검증이 필요.

### Drift Detection Gate 체크리스트

운영 게이트 스크립트 `pnpm gate:event-taxonomy`가 아래 drift 코드를 점검한다.

| drift 코드 | severity | 의미 |
|---|---|---|
| `adoption-missing` | warning | 서비스에 event adoption config가 없음 |
| `missing-pack-ids` | warning | adoption에서 참조한 packId가 pack registry에 없음 |
| `stale-pack-versions` | warning | adoption에서 pin한 pack version이 최신이 아니거나 deprecated |
| `adopted-prefixes-without-ownership` | warning | 채택한 pack의 prefix가 서비스 ownership에 선언되지 않음 |
| `records-without-pack-metadata` | warning | event schema 레코드에 pack 메타데이터가 없음 |
| `prefixes-without-ownership` | warning | event prefix가 어떤 서비스의 ownership에도 속하지 않음 |

gate 실행 경로: `check` (read-only diagnostics) → `assert` (drift 존재 시 409 실패)

## Spec 승격 범위

| UC 그룹 | 안정화 상태 | 승격 판정 |
|---|---|---|
| UC-1/2 | HIGH / MEDIUM | spec 승격 준비 완료. vocabulary/pack 경계가 명확하고 blast radius가 예측 가능 |
| UC-5 | future scope | spec 대상 아님. 후속 확장 레이어 검토 항목으로 유지 |
| UC-3/6/7 | adoption path 안정화 진행 중 | adoption path가 canonical 형태로 정리되었으나, 실제 서비스 온보딩 사례 검증 후 spec 승격 |
| UC-4/8 | LOW | plan으로 유지. override/migration 정책이 실 적용 사례로 검증된 후 승격 |

## 결론

이 3층 구조는 **확장성 있게 관리 가능하다**. 다만 실제로 그렇게 되려면 아래 3가지가 선행돼야 한다.

1. mapping pack first-class화
2. service adoption 모델 도입
3. seed/materialization 경로의 pack/adoption 기반 재구성

## 다음 단계

- UC-3/6/7 adoption path의 실제 서비스 온보딩 사례 검증 후 spec 승격 판단
- UC-4 override 정책의 실 적용 시나리오 수집
- UC-8 pack version migration window의 운영 기준 구체화
