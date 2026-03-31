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

**aspect pool**이 전체 세부 유형을 글로벌하게 정의하고,
각 **scope**가 pool에서 일부 aspect를 소비하여 자신의 서브셋을 구성하고,
각 aspect에 **검증 전략**이 결정된다.

scope는 `scope:[index]`로 주소화되며,
scope가 소비하는 aspect 구성이 바뀌면 **버전이 올라간다.**

```
aspect pool (글로벌 정의, 버전 관리)
  │
  ├── scope:0 (ui) v1 → 소비: [layout, component, interaction]
  ├── scope:1 (feature) v1 → 소비: [func_def, scenario]
  ├── scope:2 (flow) v1 → 소비: [user_scenario, process_flow, relation]
  ├── scope:2 (flow) v2 → 소비: [user_scenario, process_flow, relation, scenario]
  │                                                              ↑ v2에서 추가
  └── ...
```

## 구성 ^overview

3가지 구성 요소:

1. **Aspect Pool** — 전체 aspect의 글로벌 정의 (정의는 한 곳에)
2. **Scope Registry** — 각 scope가 pool에서 어떤 aspect를 소비하는지 (소비 관계)
3. **검증 전략 매핑** — aspect별 검증 방법 (scope 컨텍스트에 따라 다를 수 있음)

---

## 1. Aspect Pool — 글로벌 정의

aspect는 scope에 소속되지 않는다. **글로벌 pool에 한 번만 정의된다.**
여러 scope가 같은 aspect를 소비할 수 있다.

```typescript
// aspect pool — 전체 aspect 정의 (버전 관리)
const aspectPool = createLabelRegistry({
  aspect: [
    {
      version: 'v1',
      ids: [
        'layout', 'component', 'interaction',
        'func_def', 'scenario',
        'user_scenario', 'process_flow', 'relation',
        'app_state', 'domain_state', 'system_state',
        'tech_constraint', 'biz_constraint', 'infra_constraint',
        'domain_data', 'system_data', 'external_data',
        'prefix_schema', 'axis_catalog',
        'api_contract', 'cli_contract', 'event_contract',
      ]  // 22개
    },
    {
      version: 'v2',
      ids: [
        // v1 전부 + 신규
        ...v1Ids,
        'visual_test', // 신규 aspect 예시
      ],
      changelog: 'visual_test 추가'
    }
  ]
});
```

**pool 버전 규칙:**
- 새 aspect 추가 → pool 버전 올림 (기존 인덱스 불변, append-only)
- 기존 aspect 제거 → 금지 (deprecated 표시만)

---

## 2. Scope Registry — 소비 관계

각 scope는 `scope:[index]`로 주소화되며, pool에서 일부 aspect를 소비한다.

```typescript
// scope registry — scope별 소비 구성 (버전 관리)
const scopeRegistry = {
  'scope:0': {  // ui
    name: 'ui',
    versions: [
      { version: 'v1', consumes: ['layout', 'component', 'interaction'] }
    ]
  },
  'scope:1': {  // feature
    name: 'feature',
    versions: [
      { version: 'v1', consumes: ['func_def', 'scenario'] }
    ]
  },
  'scope:2': {  // flow
    name: 'flow',
    versions: [
      { version: 'v1', consumes: ['user_scenario', 'process_flow', 'relation'] },
      { version: 'v2', consumes: ['user_scenario', 'process_flow', 'relation', 'scenario'] }
      //                                                              ↑ scenario 추가 소비
    ]
  },
  // ...
};
```

**소비 버전 규칙:**
- scope가 새 aspect를 소비 시작 → scope 버전 올림
- scope가 aspect 소비 중단 → scope 버전 올림 (기존 주소는 이전 버전에 유지)
- 같은 aspect를 여러 scope가 동시에 소비 가능

### 버전이 필요한 이유

scope가 소비하는 aspect가 바뀌면 주소 공간이 변한다:

```
scope:2 (flow) v1: 3 aspect × 4 depth = 12 주소
scope:2 (flow) v2: 4 aspect × 4 depth = 16 주소

v1에서 발급된 주소는 v1 공간에서 유효
v2에서 발급된 주소는 v2 공간에서 유효
→ 주소에 버전 포함 필수
```

---

## 3. 경로 모델 인코딩

### scope별 segment

각 scope의 현재 버전이 소비하는 aspect 수에 따라 WeightedIndex가 생성된다:

```
scope:0 (ui) v1:         WeightedIndex([3, 4])  → 12 주소
scope:1 (feature) v1:    WeightedIndex([2, 4])  → 8 주소
scope:2 (flow) v1:       WeightedIndex([3, 4])  → 12 주소
scope:3 (state) v1:      WeightedIndex([3, 4])  → 12 주소
scope:4 (constraint) v1: WeightedIndex([3, 4])  → 12 주소
scope:5 (data) v1:       WeightedIndex([5, 4])  → 20 주소
scope:6 (interface) v1:  WeightedIndex([3, 4])  → 12 주소
총: 88 주소
```

### 주소 구조

```
scope:[scope-index]:[scope-version]:[local-address]

예시:
  scope:0:v1:5   → ui scope, v1, layout/specification (로컬 주소 5)
  scope:2:v2:13  → flow scope, v2, scenario/overview (로컬 주소 13)
```

### 공유 aspect의 주소

같은 aspect(scenario)를 feature와 flow가 소비하면 **서로 다른 주소**를 갖는다:

```
scope:1:v1:1  → feature/scenario (feature scope 내 로컬 주소)
scope:2:v2:9  → flow/scenario    (flow scope 내 로컬 주소)
```

같은 aspect 정의지만 scope 컨텍스트가 다르므로 검증 전략이 다를 수 있다.

---

## 4. 검증 전략 — scope 컨텍스트별

같은 aspect라도 scope에 따라 검증 전략이 달라진다:

| aspect | scope:feature 에서 | scope:flow 에서 |
|--------|-------------------|----------------|
| scenario | 단위 테스트, BDD | e2e 흐름 검증, 시퀀스 테스트 |

### scope별 전략 테이블

| scope | aspect | 검증 전략 |
|-------|--------|----------|
| ui | layout | 스냅샷 비교, 반응형 테스트 |
| ui | component | 컴포넌트 단위 테스트, 스토리북 |
| ui | interaction | 이벤트 시뮬레이션, 접근성 검증 |
| feature | func_def | 단위 테스트, 속성 기반 테스트 |
| feature | scenario | 시나리오 테스트, BDD |
| flow | user_scenario | e2e 테스트, 사용자 흐름 검증 |
| flow | process_flow | 통합 테스트, 시퀀스 검증 |
| flow | relation | 관계 그래프 검증, 의존성 분석 |
| state | app_state | 상태 전이 테스트, 스냅샷 |
| state | domain_state | FSM 모델 체킹, 전이 규칙 검증 |
| state | system_state | 헬스 체크, 메트릭 임계값 |
| constraint | tech_constraint | 불변 조건 테스트, 정적 분석 |
| constraint | biz_constraint | 규칙 엔진 테스트, 경계값 분석 |
| constraint | infra_constraint | 부하 테스트, 타임아웃 검증 |
| data | domain_data | 스키마 검증, 마이그레이션 테스트 |
| data | system_data | 포맷 검증, 무결성 체크 |
| data | external_data | 계약 매칭, mock 기반 검증 |
| data | prefix_schema | 라운드트립 검증, capacity 체크 |
| data | axis_catalog | 5Q 검증, headroom 모니터링 |
| interface | api_contract | 계약 테스트, OpenAPI 매칭 |
| interface | cli_contract | dry-run 출력 비교, 옵션 검증 |
| interface | event_contract | 스키마 호환성 테스트, 역직렬화 검증 |

---

## 5. 기존 VALID_SCOPE_ASPECTS와의 관계

현재 `VALID_SCOPE_ASPECTS`는 scope→aspect 1:1 소유 모델이다.
`ASPECT_TO_SCOPE`가 aspect→scope 역참조를 1:1로 제공한다.

**전환:**
- `VALID_SCOPE_ASPECTS` → `ScopeRegistry` (소비 관계, N:M, 버전 관리)
- `ASPECT_TO_SCOPE` → 제거 (1:N이 되므로 역참조 불가)
- aspect pool은 현재 `DEF_ASPECT` 그대로 유지

---

## 6. depth와의 조합

depth는 scope나 aspect에 의존하지 않으므로 여전히 직교 축이다.
각 scope segment 내에서 aspect × depth로 전곱.

```
scope:0 (ui) v1:
  layout × [overview, specification, implementation, validation] = 4
  component × [overview, specification, implementation, validation] = 4
  interaction × [overview, specification, implementation, validation] = 4
  총: 12 주소
```

---

## 7. meta-semantic 1단계와의 연결

| 1단계 개념 | 2단계 역할 |
|-----------|-----------|
| 패싯 | scope 선택 힌트 (생산→feature, 소비→ui 등) |
| 파이프 | scope×aspect 조합 결정 (변환 파이프→feature/func_def) |
| 바운더리 | scope segment 경계와 대응 |

---

## 8. 범위와 후속 과제

### 현재 범위

- aspect pool + scope registry 소비 모델
- scope:[index]:[version] 주소 체계
- scope별 aspect 소비 버전 관리
- 경로 모델 인코딩 설계

### 후속 과제

| 과제 | 설명 |
|------|------|
| ScopeRegistry 구현 | aspect pool + scope 소비 관계 코드 구현 |
| 경로 인코딩 엔진 | weighted-index에 경로 모델 인코딩 지원 |
| VALID_SCOPE_ASPECTS 마이그레이션 | 1:1 소유 → N:M 소비 모델 전환 |
| 검증 전략 자동 추천 | scope×aspect에서 검증 방법 자동 제안 |
