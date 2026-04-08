# 시스템 모델 전체 정리

## 1. realm (계)

모든 정의는 **realm** 안에서 일어난다. realm = 규칙이 적용되는 경계.

현재 realm = **소프트웨어 개발**. realm 안에 taxonomy들이 존재하고, taxonomy 안에 axis들이 존재한다.

realm은 "최상위 분류"가 아니다 — realm은 경계이고, 그 안의 분류는 taxonomy와 axis가 담당한다.

## 2. 용어 계층

```
realm           규칙이 적용되는 경계. (예: 소프트웨어 개발)
  ↓
axis            1차원 압축. 유한한 값의 집합. (토크나이저)
  ↓ 교차
taxonomy        axis 교차 → 분류 체계. (개념)
  ├── prefix    taxonomy의 인스턴스 → 정수 주소. (구현)
  └── DSL       taxonomy를 표기하는 언어. (구현)
  ↓ 교차
space           taxonomy 교차 → 의미 좌표 공간 (semantic space).
```

### prefix와 DSL의 위치

prefix와 DSL은 **taxonomy 레벨의 구현체**:

- **taxonomy** = 개념 — "어떤 axis를 교차해서 무엇을 분류하는가"
- **prefix** = 구현 — taxonomy 교차의 결과를 정수 하나로 수렴 (주소)
- **DSL** = 구현 — taxonomy 교차를 표기하는 언어

이 구현이 존재하는 이유: **1차원 압축 원칙**을 실현하기 위함.

```
복잡한 현실
  → (의사결정: 어디까지 관심사인가?)
  → axis로 1차원 압축
  → (의사결정: 어떤 axis를 교차하는가?)
  → prefix로 정수 수렴
  → DSL로 표기
```

## 3. axis = 토크나이저

같은 단어가 맥락에 따라 다른 의미를 가진다 (동음이의어). axis는 **taxonomy 안에서 의미를 인덱스로 고정**한다.

```
"provider" (동음이의어)

  taxonomy: infra-deploy
    axis "provider" → {cloudflare: 0, aws: 1, gcp: 2, local: 3, ...}

  taxonomy: auth
    axis "provider" → {zitadel: 0, keycloak: 1, ...}

  taxonomy: data-store
    axis "provider" → {postgres: 0, clickhouse: 1, d1: 2, ...}
```

- 같은 단어 "provider"도 taxonomy가 다르면 **다른 axis**
- axis의 값은 정수 인덱스로 고정 — 토크나이저처럼 동음이의어를 구분
- 이것이 기존 qa-sdk 좌표계(prefix 안에서 axis가 위치로 고정)와 동일한 원리

**1차원 압축 원칙**: 어떤 외부 구조든 axis로 표현할 때 1차원으로 압축된다. 클라우드의 내부 깊이(region→AZ→VPC→subnet→...)가 아무리 복잡해도, 이 시스템에서 필요한 만큼만 axis 하나(`provider`)로 닫는다. 관여하지 않는 깊이는 해당 구조 자체의 realm에 속한다.

## 4. space의 두 종류

| 종류 | 역할 |
|------|------|
| **structural space** | 시스템 자체를 정의 (핵심 모델링) |
| **contextual space** | 구조를 뒷받침하는 맥락 (의사결정, 테스트, 이력) |

structural이 먼저 정의되어야 contextual이 의미를 가진다.

## 5. space와 기존 체계의 관계

```
space (수평)                 = "무엇에 대한 것인가" — 어떤 면
scope × aspect × depth (수직) = "그것의 어디를 보는가" — 면의 깊이
문서 7종 (표현)               = space의 의존 — 면을 다른 관점으로 기술
```

직교: space가 면을 선택하고, scope×aspect×depth가 깊이를 탐색하고, 문서 타입이 관점을 결정.

## 6. goal의 두 레이어

scope×aspect×depth로 타고 들어간 각 부품마다 goal이 둘:

| 레이어 | 정의 | 예시 |
|--------|------|------|
| **original goal** | 부품이 원래 가진 목표 | Zitadel → "OIDC 인증 제공" |
| **applied goal** | 이 시스템에서 변형 적용한 목적 | Zitadel → "JWT claims에 bitmask 주입" |

gap = original → applied 사이의 차이. 이 gap을 메꾸는 것이 **의사결정**.

## 7. 전체 구조

```
┌──────────────────────────────────────────────┐
│  realm: 소프트웨어 개발                        │
│                                              │
│  ┌─ space (면) ─────────────────────────┐    │
│  │  structural space — 시스템 정의       │    │
│  │  contextual space — 맥락/의사결정     │    │
│  │                                      │    │
│  │  ┌─ taxonomy (분류 체계) ──────┐     │    │
│  │  │  ┌─ axis (1차원, 토크나이저) │     │    │
│  │  │  │  값 = 인덱스로 고정       │     │    │
│  │  │  │  동음이의어 구분          │     │    │
│  │  │  └─ axis × axis × ...      │     │    │
│  │  └─ taxonomy × taxonomy       │     │    │
│  └───────────────────────────────┘     │    │
│                                              │
│  각 부품의 goal                               │
│    original goal → (의사결정) → applied goal  │
│                                              │
│  깊이 탐색 (space와 직교)                     │
│    scope × aspect × depth                    │
│                                              │
│  표현 (space의 의존)                          │
│    spec / rule / todo / test / cases /        │
│    memo / plan                                │
└──────────────────────────────────────────────┘
```

## 8. 의미 좌표계의 탐색 — 어텐션 비유

지금까지 정의한 모든 것(axis, DSL, taxonomy, space, realm)은 **축의 구성 자체의 의미를 기록하고 고정하는 방법**이다. 이것이 의미 좌표계(semantic coordinate system).

### 탐색 문제

추상적인 질문("인증 관련 설정은 어디에?")에서 구체적인 좌표(space → taxonomy → axis → index)에 도달해야 한다.

### 어텐션 매커니즘과의 대조

일반 어텐션: 연속 벡터 공간에서 유사도 기반으로 관련 정보를 찾음

이 시스템의 차이점:
- axis의 값이 prefix 기반으로 **이산적으로 쪼개져** 있음
- 각 index가 고정된 의미를 가짐 (토크나이저)
- 따라서 임베딩 벡터 공간에 **prefix의 개별 index 의미를 뿌려놓고** 도달하게끔 구성하는 것이 적합

```
일반 어텐션:
  query → 연속 벡터 공간 → softmax → value

이 시스템:
  추상 질문 → space 탐색 → taxonomy 선택 → axis 도달 → 이산 index
                                                        ↑
                                          prefix의 개별 의미가 임베딩 공간에 배치됨
```

### 핵심

- 이것은 **의미 좌표계**다
- axis들은 서로 **교차**하기도 하고 (taxonomy 형성) **평행**하기도 한다 (독립 축)
- 교차와 평행의 조합이 **space**를 이룬다
- space 단위에 임베딩 벡터를 구성하거나 적절한 taxonomy 좌표에 도달하기 위한 규격을 정의함으로써 탐색을 보조할 수 있다

### 재귀적 구조와 검색 깊이

taxonomy가 axis가 되기도 한다 — 구조적으로 재귀적. 하지만 그 차원의 깊이는 **axis를 조회하기 전까지 드러나지 않는다** (lazy).

```
space → taxonomy → axis
                     ↓ (이 axis가 다른 taxonomy일 수 있음)
                   taxonomy → axis → ...
```

이 특성이 검색에 주는 의미:

- **임베딩 차원을 어디까지 불러오느냐** = 도달할 수 있는 axis의 깊이
- 얕은 조회: space → taxonomy 레벨까지만 → 넓고 빠른 탐색
- 깊은 조회: taxonomy → axis → 재귀 axis까지 → 정밀하지만 느린 탐색
- **같은 구조에 다른 검색 추상화**를 적용할 수 있음 (깊이 파라미터)

즉 이 의미 좌표계는 구조적 특성에 근거한 **검색 엔진**으로도 동작 가능.

### 임베딩과 공개 범위

모든 것은 axis로 정의되므로, 각각의 임베딩은 정의된 axis를 가진다. 핵심은 **공개 범위**:

- axis의 임베딩을 공개하면 → 의미 검색에 조회됨
- 공개하지 않으면 → 조회되지 않음
- **검색 깊이 = 어떤 axis까지 공개하느냐**

### 소유 관계의 의미 노출

taxonomy가 하위 axis를 **소유**한다. 이 소유 관계 자체에 의미가 담긴다.

```
taxonomy: permission (소유)
  ├── axis: role
  ├── axis: feature
  └── axis: env
```

하위 axis의 임베딩을 함께 공개하면:

1. axis 자체의 의미가 노출됨 (role = "역할 분류")
2. taxonomy → axis 경유 경로의 의미도 노출됨 (permission → role = "권한 체계 안에서의 역할")
3. 소유 관계의 의미가 검색됨 ("role이 permission에 속한다"는 구조적 지식)

```
"role" 단독 공개:
  → "역할" 이라는 일반적 의미만 검색됨

"permission.role" 경유 공개:
  → "권한 체계의 역할 분류" 라는 맥락이 함께 검색됨
  → taxonomy가 소유하는 관계의 의미가 임베딩에 포함됨
  → 이 구조적 관계를 통해 지식을 찾아낼 수 있음
```

의미는 중첩되기 때문에, 공개 범위가 넓을수록 경유 경로의 의미가 함께 드러나고, 그 관계 자체가 검색 가능한 지식이 된다.

### 임베딩 차원과 RAG 활용

임베딩은 방향을 뜻한다. axis 단독의 의미 임베딩 차원과 taxonomy+axis의 의미 임베딩 차원은 **구성이 다르고 검색 결과가 다르다**:

```
axis 단독 임베딩:          "role" → 일반적 방향
taxonomy+axis 임베딩:      "permission.role" → 맥락이 포함된 방향

→ 같은 query에 대해 top-K, top-P 결과가 달라짐
```

이 특성을 활용하면:

- **특정 space나 realm을 타겟**으로 활성 임베딩을 빠르게 제공
- QA, 코드 리뷰, 문서 검색 등 **관점별 RAG** 구축 시 임베딩 차원을 선택적으로 활성화
- space 단위로 임베딩을 미리 구성해두면, 해당 space에 진입할 때 관련 axis들의 임베딩이 즉시 활성화

```
RAG 시나리오:

  "인증 관련 코드 리뷰" (space: auth 활성)
    → auth space의 taxonomy+axis 임베딩 활성
    → permission.role, permission.feature 방향이 강화된 검색
    → 일반 "role" 검색보다 정밀한 결과

  "인프라 배포 QA" (space: infra-deploy 활성)
    → infra-deploy space의 임베딩 활성
    → deploy.provider, deploy.env 방향이 강화된 검색
```

핵심: 의미 좌표계의 구조가 곧 **임베딩 활성화의 단위**가 된다. space/realm 선택 = 어떤 방향의 임베딩을 켤 것인가.

## 9. 핵심 축과 보조 축 — space를 구성하는 taxonomy 분류

space 안의 taxonomy들은 두 그룹으로 나뉜다:

### 핵심 축 (structural) — 시스템을 정의하는 것

| taxonomy | 질문 | 정의 |
|----------|------|------|
| **core** | "핵심 개념이 무엇인가" | 시스템의 본질적 구성 요소, 도메인 모델 |
| **ux** | "사용자 경험을 어떻게 설계하는가" | 데이터 설계, 흐름 설계, 경험 구조 |
| **ui** | "기능을 어떻게 접하게 하는가" | 인터페이스 구조, 메뉴, 화면 구성 |

### 보조 축 (contextual) — 정의를 뒷받침하는 것

| taxonomy | 질문 | 정의 |
|----------|------|------|
| **spec** | "그것이 무엇인가" | 구성 요소의 명세 |
| **test** | "어떻게 검증하는가" | 구성의 검증 방법 |
| **usecase** | "어떻게 쓰는가" | 사용 시나리오, 흐름 |
| **rule** | "어떻게 써야 하는가" | 소비 규칙, 제약 조건 |

### 관계

```
핵심 축 (core / ux / ui)
  = 시스템 자체를 구성하는 면
  = structural space를 형성

보조 축 (spec / test / usecase / rule)
  = 핵심 축의 각 면을 기술하는 관점
  = contextual space를 형성

핵심 축이 "무엇을 만드는가"
보조 축이 "그것을 어떻게 설명/검증/사용하는가"
```

### 구조적 원리 — 핵심/보조 분리

이것은 문서 타입의 이야기가 아니라 **소프트웨어 설계의 일반 원리**:

- **핵심 시스템** = 실제로 동작하는 것
- **보조 시스템** = 핵심을 더 쉽게 만들고/쓰고/검증하게 해주는 것
- 역할이 다르고, 의존 방향은 한쪽: 보조 → 핵심

어떤 space든 이 분리가 적용된다:

```
space X
  ├── 핵심 — X 자체를 이루는 것
  └── 보조 — X를 설명·검증·사용하기 위한 것

의존: 보조 → 핵심 (역방향 금지)
재귀: 보조 space도 자기 안에서 핵심/보조를 가질 수 있음
```

이 원리가 현재 시스템에 적용되면:

```
핵심 space (core / ux / ui) = 시스템 자체
보조 space (spec / test / usecase / rule) = 시스템을 설명하기 위한 시스템
```

## 미결 사항

- [ ] realm 안의 taxonomy 목록 확정 (현재 코드에 흩어진 것들 수집)
- [ ] structural space를 구성하는 taxonomy 조합 확정
- [ ] goal × interface × scenario 3축이 이 구조에서 어디에 위치하는가
- [ ] space를 frontmatter에 어떻게 표현할 것인가 — 여러 독립적 taxonomy의 교집합으로 구성될 것
- [ ] space 레벨의 새로운 데이터 역할 패턴 정의 (기존 facet 5종은 코드 레벨, space 레벨 정보 간 관계 역할은 별도)
- [ ] 제어공학적 피드백의 realm 레벨 적용
- [ ] 시뮬레이션의 space 인식 (현재 pipe 레벨 → space 단위로 확장)
- [ ] axis 네이밍 규칙 — taxonomy qualified name (예: `infra-deploy.provider` vs `auth.provider`)

## 10. 최종 목표

scope×aspect×depth는 **taxonomy 1개**다. 이것과 다른 taxonomy들이 교집합으로 space를 형성한다:

```
space = taxonomy 교집합
  ├── 위상 좌표계 taxonomy (scope×aspect×depth 등)
  ├── 기능 정의 taxonomy (core / ux / ui)
  ├── goal taxonomy (original goal / applied goal)
  ├── gap taxonomy (original → applied 사이의 의사결정)
  └── ...
```

이 taxonomy들이 혼합되어 **소프트웨어 스펙을 아름답게 정의하는 것**이 목표.

- 위상 좌표계: "시스템의 어디인가"
- 기능 정의: "무엇을 하는가"
- goal: "왜 존재하는가"
- gap + 의사결정: "왜 이렇게 만들었는가"

이것들이 하나의 space 안에서 교차하면, 소프트웨어의 모든 측면(구조, 기능, 목적, 근거)이 좌표로 표현된다.

## 관련 메모

- `terminology-hierarchy.memo.md` — axis → taxonomy → space 용어 상세
- `goal-scenario-interface-triad.memo.md` — goal × interface × scenario 3축
- `business-decomposition-coordinate.memo.md` — 비즈니스 분해 좌표 (중간층)
- `purpose.md` — 청사진 전체 구조
