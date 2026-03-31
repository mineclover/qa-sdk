---
def:
  id: meta-semantic-scope
  level: module
  scope: data
  aspect: system_data
  depth: specification
  lifecycle: draft
  layer: domain
  tags: [structural]
  links:
    - target: meta-semantic-system
      type: depends_on
    - target: meta-semantic-concepts
      type: depends_on
    - target: definition-taxonomy
      type: refines
---

# Meta-Semantic Scope — 검증 분류 체계

## 목적 ^purpose

meta-semantic이 정의한 데이터 단위(패싯, 파이프, 바운더리)에
**검증 방법**을 분류하는 체계. 같은 데이터 단위라도 DB인지 UI인지 API인지에 따라
적합한 검증 방법이 다르다. scope가 이것을 결정한다.

## 방법 ^method

계층적으로 결정된다:

1. **scope**가 데이터 단위의 성격(무엇에 대한 것인가)을 분류하고,
2. scope가 결정되면 **유효한 aspect 서브셋**이 정해지고 (경로 모델),
3. 각 aspect에 **적합한 검증 전략**이 결정된다.

```
scope (7종)
  └── aspect (scope별 서브셋, 총 22종)
       └── 검증 전략 (aspect별로 결정)
```

aspect는 scope에 독립적인 축이 아니다.
scope가 결정되면 들어올 수 있는 aspect이 정해져 있고,
aspect 유형별로 검증 전략이 정해져 있다.

## 구성 ^overview

- 1단계 (meta-semantic): 데이터 흐름의 최소 단위를 정의 — 패싯, 파이프, 바운더리
- **2단계 (scope): 그 단위를 검증 방법으로 분류** — scope → aspect 서브셋 → aspect별 검증 전략

---

## 1. 1단계와 2단계의 관계

```
1단계 meta-semantic:
  "이 코드의 데이터가 어떻게 흐르는가?"
  → 패싯(역할 분리) + 파이프(실행 묶음) + 바운더리(기능 단위)
  → 결과: 검증 가능한 단위 목록

2단계 scope:
  "이 단위를 어떻게 검증하는가?"
  → scope(성격 분류) + aspect(세부 유형) + 검증 전략
  → 결과: 각 단위에 적합한 검증 방법 결정
```

1단계 없이 2단계가 성립하지 않는다.
검증 가능한 단위가 먼저 식별되어야 검증 방법을 분류할 수 있다.

---

## 2. scope × aspect 경로 모델

### 전곱이 아닌 경로

기존 정의: scope(7) × aspect(22) = 154 조합 중 20개만 유효 (87% 낭비).
경로 모델: scope가 결정되면 유효한 aspect만 존재.

```
scope가 분기점 (7개 분기):
  ├── ui → [layout, component, interaction]        3 aspect
  ├── feature → [func_def, scenario]               2 aspect
  ├── flow → [user_scenario, process_flow, relation] 3 aspect
  ├── state → [app_state, domain_state, system_state] 3 aspect
  ├── constraint → [tech_constraint, biz_constraint, infra_constraint] 3 aspect
  ├── data → [domain_data, system_data, external_data, prefix_schema, axis_catalog] 5 aspect
  └── interface → [api_contract, cli_contract, event_contract] 3 aspect
총 aspect: 3+2+3+3+3+5+3 = 22 (전곱 154 → 경로 22)
```

### 인코딩 변경

```
현재 (전곱):
  WeightedIndex([16, 64, 8]) = 8,192 주소 공간
  scope=1 + aspect=15 는 유효하지 않아도 주소가 존재

경로 모델:
  scope별 segment + 주소 범위 연접
  ui:         offset 0,  WeightedIndex([3, 4]) → 12 주소
  feature:    offset 12, WeightedIndex([2, 4]) → 8 주소
  flow:       offset 20, WeightedIndex([3, 4]) → 12 주소
  state:      offset 32, WeightedIndex([3, 4]) → 12 주소
  constraint: offset 44, WeightedIndex([3, 4]) → 12 주소
  data:       offset 56, WeightedIndex([5, 4]) → 20 주소
  interface:  offset 76, WeightedIndex([3, 4]) → 12 주소
  총: 88 주소 (8,192 → 88, 93배 절감)
```

### VALID_SCOPE_ASPECTS와의 관계

기존 `VALID_SCOPE_ASPECTS`가 이미 이 경로 구조를 데이터로 가지고 있다.
인코딩만 전곱 → 경로로 바꾸면 된다. 데이터 모델 변경 불필요.

---

## 3. scope별 검증 전략

각 scope는 데이터 단위의 성격을 분류하고, 성격에 따라 적합한 검증 방법이 결정된다.

### ui — 사용자가 보는 것

| aspect | 검증 대상 | 검증 전략 |
|--------|----------|----------|
| layout | 화면 구조, 영역 배치 | 레이아웃 스냅샷 비교, 반응형 테스트 |
| component | 재사용 UI 단위 | 컴포넌트 단위 테스트, 스토리북 |
| interaction | 사용자 입력 반응 | 이벤트 시뮬레이션, 접근성 검증 |

### feature — 시스템이 하는 일

| aspect | 검증 대상 | 검증 전략 |
|--------|----------|----------|
| func_def | 기능 명세, 동작 규칙 | 단위 테스트, 속성 기반 테스트 |
| scenario | 사용 시나리오, 기대 결과 | 시나리오 테스트, BDD |

### flow — 순서와 경로

| aspect | 검증 대상 | 검증 전략 |
|--------|----------|----------|
| user_scenario | 사용자 관점 여정 | e2e 테스트, 사용자 흐름 검증 |
| process_flow | 시스템 내부 처리 순서 | 통합 테스트, 시퀀스 검증 |
| relation | 엔티티 간 연결 | 관계 그래프 검증, 의존성 분석 |

### state — 변하는 값

| aspect | 검증 대상 | 검증 전략 |
|--------|----------|----------|
| app_state | 프론트엔드 상태 | 상태 전이 테스트, 스냅샷 |
| domain_state | 비즈니스 상태 모델 | FSM 모델 체킹, 전이 규칙 검증 |
| system_state | 인프라 운영 상태 | 헬스 체크, 메트릭 임계값 |

### constraint — 규칙과 제약

| aspect | 검증 대상 | 검증 전략 |
|--------|----------|----------|
| tech_constraint | 기술 불변 조건 | 불변 조건 테스트, 정적 분석 |
| biz_constraint | 비즈니스 규칙 | 규칙 엔진 테스트, 경계값 분석 |
| infra_constraint | 인프라 제약 | 부하 테스트, 타임아웃 검증 |

### data — 구조화된 값

| aspect | 검증 대상 | 검증 전략 |
|--------|----------|----------|
| domain_data | 비즈니스 엔티티 | 스키마 검증, 마이그레이션 테스트 |
| system_data | 설정, 로그, 메트릭 | 포맷 검증, 무결성 체크 |
| external_data | 외부 API 데이터 | 계약 매칭, mock 기반 검증 |
| prefix_schema | 좌표 정의 | 라운드트립 검증, capacity 체크 |
| axis_catalog | 축 정의 | 5Q 검증, headroom 모니터링 |

### interface — 외부와의 약속

| aspect | 검증 대상 | 검증 전략 |
|--------|----------|----------|
| api_contract | REST/gRPC 엔드포인트 | 계약 테스트, OpenAPI 매칭 |
| cli_contract | CLI 명령어 | dry-run 출력 비교, 옵션 검증 |
| event_contract | 이벤트 스키마 | 스키마 호환성 테스트, 역직렬화 검증 |

---

## 4. meta-semantic 패싯 → scope 매핑

meta-semantic의 패싯이 scope 선택의 힌트가 된다:

| 패싯 역할 | 주로 대응하는 scope | 이유 |
|----------|-------------------|------|
| 생산 | feature, data | 데이터를 만드는 로직 또는 구조 |
| 소비 | ui, interface | 데이터를 사용하거나 표시 |
| 정의 | data, constraint | 스키마 선언, 규칙 정의 |
| 관리 | constraint, state | 정합성 보장, 상태 관리 |
| 저장 | data | 영속화, UID 체계 |

**파이프 → scope:**

| 파이프 패턴 | scope | 이유 |
|------------|-------|------|
| 소비→생산 (변환) | feature/func_def | 로직 변환 |
| 소비→저장 (수집) | data/system_data | 데이터 영속화 |
| 소비→관리 (검증) | constraint/* | 규칙 판정 |
| 전체 처리 | flow/process_flow | 순차 처리 흐름 |

---

## 5. depth와의 조합

경로 모델에서 depth는 scope×aspect 이후에 곱해진다:

```
ui/layout × depth(4) = 4 주소
  overview:       레이아웃 개요
  specification:  레이아웃 상세 명세
  implementation: 레이아웃 구현 세부
  validation:     레이아웃 검증 시나리오
```

depth는 scope나 aspect에 의존하지 않으므로 여전히 직교 축이다.
scope×aspect만 경로 모델, depth는 각 경로에 전곱.

---

## 6. 범위와 후속 과제

### 현재 범위

- scope × aspect 경로 모델 설계
- scope별 검증 전략 매핑
- meta-semantic 패싯 → scope 매핑
- depth 직교 유지

### 후속 과제

| 과제 | 설명 |
|------|------|
| core 경로 인코딩 스펙 | weighted-index에 경로 모델 인코딩 지원 추가 |
| 기존 주소 마이그레이션 | v1/v2 전곱 주소 → 경로 주소 전환 전략 |
| 검증 전략 자동 추천 | scope×aspect에서 검증 방법 자동 제안 |
| def-audit 연동 | 검증 전략 누락 감지 |
