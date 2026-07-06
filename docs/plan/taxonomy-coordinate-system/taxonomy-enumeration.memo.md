---
status: draft
sources:
  - packages/taxonomy-engine/src/schema/ir.ts
  - packages/taxonomy-engine/src/parser/index.ts
  - packages/taxonomy-engine/src/validate/index.ts
  - packages/taxonomy-engine/src/indexer/index.ts
  - packages/taxonomy-engine/src/query/walk-by-coordinate.ts
  - packages/taxonomy-engine/src/query/walk-relation.ts
  - packages/taxonomy-engine/__tests__/dogfooding.test.ts
  - packages/taxonomy-engine/__tests__/dogfooding-def-catalog.test.ts
  - packages/taxonomy-engine/__tests__/dogfooding-lesson-builder.test.ts
  - packages/taxonomy-engine/__tests__/dogfooding-dkg.test.ts
  - packages/taxonomy-engine/__tests__/dogfooding-ingest.test.ts
  - docs/taxonomies/qa-sdk-coordinate-system.yaml
  - docs/taxonomies/qa-sdk-def-catalog.yaml
  - docs/taxonomies/lesson-builder-content.yaml
  - docs/taxonomies/dkg-schema.yaml
  - docs/taxonomies/ingest-coords.yaml
  - docs/specs/system/meta-taxonomy.spec.md
  - docs/specs/system/dual-coordinate-system.spec.md
---

# Taxonomy 나열과 역할 정의 — 소프트웨어 개발 realm

## 원칙

1. **모든 taxonomy는 고유한 역할을 가진다** — 역할이 겹치면 합친다
2. **적용 대상이 명확해야 한다** — 무엇에 적용되는지 지정
3. **taxonomy는 독립적이면서 상호작용한다** — 격리가 아니라 각자의 역할로 협력
4. **taxonomy의 하위도 taxonomy가 될 수 있다** — 재귀적 구성
5. **각 구성 요소가 기능을 담을 수 있다** — 독립 테스팅, 상수 추출, 기획 인터페이스 등
6. **일반화할 수 있으면 합친다** — 레벨 차이만 있는 것은 하나의 taxonomy 안의 axis

## 가지치기 기록

| 변경 | 이유 |
|------|------|
| boundary + scope + nesting → **structure** | 같은 방향(facet→boundary→scope→nesting)의 레벨. 하나의 "구조적 조립" taxonomy |
| link_type → **spec**에 흡수 | 문서/정의 간 관계는 정보 좌표 taxonomy의 관계 axis |
| rlsc → **observability** ui 계층 | UI 레이아웃 관측/녹화는 observability의 5번째 계층 |
| lifecycle + migration → **lifecycle** 통합 | migration은 lifecycle 전이의 구체적 경로 |
| harness 재정의 | 품질 상태 추적 ✗ → 환경 구성과 정보 공급 ✓ |
| service → structural | 아키텍처 위치는 시스템 정의의 일부 |
| deploy → contextual | 배포는 운영 맥락 |
| spec → bridge | 모든 space의 정보를 주소화하는 메타 역할 |
| "서비스/인프라" 카테고리 제거 | structural/contextual에 흡수 |

---

## Structural Space — 핵심 taxonomy (14개)

| # | taxonomy | 고유 역할 | 역할 질문 | 적용 대상 |
|---|----------|----------|----------|----------|
| 1 | **facet** | 데이터가 맡는 역할을 분류 | "이것은 생산/소비/정의/관리/저장 중 무엇인가" | 데이터, 코드 함수 |
| 2 | **structure** | 코드 구성 요소의 경계·배치·계약 전파를 정의 | "기능 경계는 어디이고 어떻게 중첩되는가" | 코드 모듈, 컴포넌트 |
| 3 | **state** | 도메인 상태와 전이 규칙을 정의 | "어떤 상태가 있고 어떻게 전이하는가" | 도메인 엔티티, 비즈니스 프로세스 |
| 4 | **event** | 시스템 행위를 이산적 신호로 분류 | "어떤 일이 일어났는가" | 런타임 행위, 유저 액션 |
| 5 | **data-schema** | 데이터 형태·제약·변환·진화를 정의하고 추적 | "데이터의 형태와 제약은 무엇이고 어떻게 변형되는가" | 스키마, 테이블, 필드 |
| 6 | **protocol** | 컴포넌트 간 통신 방식을 분류 | "어떻게 대화하는가" | 서비스 간 연결, API 경계 |
| 7 | **service** | 서비스의 아키텍처 위치와 관심사를 분류 | "이 서비스는 어떤 계층/역할인가" | 서비스 |
| 8 | **goal** | 시스템/부품의 존재 이유를 정의 | "이것은 어떤 문제를 해결하는가" | 시스템, 서비스, 부품 |
| 9 | **actor** | 시스템과 상호작용하는 주체를 분류 | "누가 이것을 사용하는가" | 유저, 외부 시스템, 에이전트 |
| 10 | **usecase** | goal을 이루기 위한 사용 흐름을 정의 | "유저가 어떤 단계를 밟는가" | 유저 행위 |
| 11 | **rule** | 구성 요소의 소비 조건과 기능적 제약을 정의 | "이것을 쓸 때 무엇을 지켜야 하는가" | API, 컴포넌트, 라이브러리 |
| 12 | **interface** | 기능을 접하는 정보 단위와 구조를 정의 | "유저에게 무엇을 어떻게 보여주는가" | 화면, URL, 메뉴 |
| 13 | **pipe** | 실행 흐름과 제어 패턴을 정의 | "데이터/이벤트가 어떤 경로로 흐르는가" | 실행 경로, 런타임 흐름 |

## Contextual Space — 보조 taxonomy (9개)

| # | taxonomy | 고유 역할 | 역할 질문 | 적용 대상 |
|---|----------|----------|----------|----------|
| 15 | **harness** | space 동작을 위한 환경 구성과 정보를 공급 | "이것이 동작하려면 어떤 환경/설정이 필요한가" | space, 서비스, 컴포넌트 |
| 16 | **decision-flow** | 의사결정의 과정과 근거를 기록 | "왜 이 결정을 내렸는가" | 설계 결정, gap |
| 17 | **test** | 구성 요소의 정확성을 검증 | "이것이 올바르게 동작하는가" | 코드, 기능 |
| 18 | **gate** | 품질 기준의 통과 여부를 판정 | "이것이 기준을 충족하는가" | 빌드, 배포, 코드 |
| 19 | **constraint** | 시스템의 비기능적 제약을 정의 | "어떤 제약 하에서 동작해야 하는가" | 서비스, 인프라 |
| 20 | **lifecycle** | 컴포넌트의 생애 주기와 버전 전이를 정의 | "생성→활성→전이→폐기 과정은 어떠한가" | 서비스, API, 스키마, 인프라 |
| 21 | **pm** | 실행 계획과 진척을 추적 | "무엇을 언제까지 하는가" | 작업, 일정 |
| 22 | **observability** | 런타임 행위와 UI 구조를 관측 가능하게 분류 | "시스템이 지금 어떤 상태인가" | 런타임, 메트릭, UI (rlsc = 레이아웃 녹화/관측) |
| 23 | **deploy** | 배포 대상의 환경/제공자/지역을 지정 | "어디에 어떻게 배포하는가" | 서비스, 인프라 |

## Bridge — space 간 연결 (4개)

| # | taxonomy | 고유 역할 | 역할 질문 | 적용 대상 |
|---|----------|----------|----------|----------|
| 24 | **spec** | 모든 space의 정보 위치와 정의 간 관계를 주소화 | "이 정의는 어떤 좌표에 있고 무엇과 연결되는가" | 문서, 정의 |
| 25 | **DKG** | 모든 taxonomy 간 연결을 그래프로 표현 | "이 노드와 저 노드는 어떤 관계인가" | 모든 taxonomy |
| 26 | **meta-taxonomy** | taxonomy 자체를 분류 | "이 taxonomy는 어떤 종류인가" | taxonomy |
| 27 | **dsl-bundle** | prefix와 서비스의 바인딩을 정의 | "이 DSL은 어떤 서비스에 속하는가" | prefix, 서비스 |

---

## 역할 겹침 최종 검증

| 후보 A | 후보 B | 구분 | 적용 대상 차이 |
|--------|--------|------|---------------|
| facet | data-schema | facet = 역할 분류, data-schema = 형태·제약·변환 | 역할 vs 형태 |
| structure | interface | structure = 내부 코드 조립, interface = 외부 유저 접점 | 코드 모듈 vs 화면/URL |
| usecase | pipe | usecase = 유저 흐름, pipe = 시스템 실행 흐름 | 유저 행위 vs 런타임 경로 |
| rule | constraint | rule = 기능적 소비 조건, constraint = 비기능적 제약 | API/컴포넌트 vs 서비스/인프라 |
| rule | gate | rule = 조건 정의(설계 시점), gate = 통과 판정(검증 시점) | 정의 vs 실행 |
| state | event | state = 현재 상태 + 전이 규칙, event = 발생한 사실 | 정적 정의 vs 동적 신호 |
| state | lifecycle | state = 도메인 비즈니스 상태, lifecycle = 컴포넌트 생애 주기 | 도메인 엔티티 vs 서비스/API |
| protocol | pipe | protocol = 통신 방식, pipe = 흐름 경로 | 방식 vs 순서 |
| harness | deploy | harness = 환경 구성 정보 공급, deploy = 물리적 배포 | 정보/설정 vs 인프라 실행 |
| harness | constraint | harness = 필요한 환경 제공, constraint = 지켜야 할 제약 | 공급 vs 제한 |
| test | gate | test = 정확성 검증 실행, gate = 기준 충족 판정 | 검증 실행 vs 통과 판정 |
| observability | event | observability = 관측 계층, event = 행위 신호 | 어디서 보는가 vs 무엇이 발생했는가 |
| actor | usecase | actor = 주체 분류, usecase = 행위 흐름 | 누가 vs 어떻게 |
| service | deploy | service = 아키텍처 위치(설계), deploy = 물리적 배포(운영) | 논리적 vs 물리적 |
| spec | DKG | spec = 정보 좌표 주소화, DKG = 노드 간 관계 그래프 | 위치 vs 연결 |

**겹침 없음.**

## 적용 대상 교차 매트릭스

| 적용 대상 | structural | contextual | bridge |
|----------|-----------|-----------|--------|
| **데이터** | facet, data-schema, event | — | — |
| **코드** | facet, structure | test | — |
| **컴포넌트** | structure, rule | lifecycle, constraint | — |
| **서비스** | goal, protocol, service | harness, deploy, constraint, lifecycle | dsl-bundle |
| **유저** | actor, usecase, interface | — | — |
| **런타임** | pipe, event, state | observability | — |
| **문서/정의** | — | — | spec |
| **설계 결정** | goal (gap) | decision-flow | — |
| **검증** | — | test, gate | — |
| **프로젝트** | — | pm | — |
| **taxonomy** | — | — | meta-taxonomy, DKG |

## 수치 요약

| 분류 | 가지치기 전 | 가지치기 후 | 변화 |
|------|-----------|-----------|------|
| structural | 16 | 13 | boundary+scope+nesting→structure, link_type→spec, rlsc→interface, +service |
| contextual | 10 | 9 | lifecycle+migration 통합, harness 재정의, +deploy |
| bridge | 3 | 4 | +spec |
| ~~서비스/인프라~~ | ~~2~~ | ~~0~~ | structural/contextual에 흡수 |
| **합계** | **31** | **27** | -4 (합침·재배치) |

## 미결

- [ ] 각 taxonomy의 axis 값 구체화 (특히 goal, actor, state, protocol, interface)
- [ ] taxonomy 간 상호작용 패턴 구체화
- [ ] 하나의 space에서 이 taxonomy들이 어떻게 동작하는지 시뮬레이션
- [ ] taxonomy 역할 정의를 코드(vocabulary.ts)에 반영
- [ ] 적용 대상별 교차 검증: 같은 대상에 적용되는 taxonomy 간 역할 충돌 없는지
