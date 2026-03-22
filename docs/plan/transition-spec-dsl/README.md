# Transition Spec DSL

> raw coordinate system 위에 state semantics를 덧씌우는 해석 계층

## 목표

좌표계의 4대 원칙을 유지하면서 상태 전이 해석을 외부 spec으로 분리한다.

1. **좌표계는 불변 primitive**
2. **개발자는 raw coordinate만 남긴다**
3. **transition은 외부 spec으로 조립한다**
4. **state transition은 deterministic 하게 재구성한다**

## DSL이 해결하는 5가지 문제

1. 무슨 좌표 묶음을 하나의 transition으로 볼지 → `match`
2. 그 transition의 이름이 뭔지 → `transition`
3. input 상태 조건이 뭔지 → `input` (축 기반)
4. output 상태 변경이 뭔지 → `output` (축 기반)
5. state에 어떤 effect를 주는지 → `effect`

## 핵심 설계 결정

### 상태 = 축의 entry (별도 slot vocabulary 없음)

상태는 DEMO_CATALOG의 축으로 표현한다. `flow_step`, `lifecycle_state`, `resource_location` 등 기존 축 시스템이 곧 상태 vocabulary.

| 용도 | 축 | 비고 |
|------|---|------|
| 흐름 위치 | `flow_step` | entry → processing → success |
| 자원 생명주기 | `lifecycle_state` | draft → active → deprecated |
| 자원 위치 | `resource_location` | origin, cache, queue, external |
| 존재 여부 | `lifecycle_state` 유무 | exists: false = 미설정 |

### address_context 전제

TransitionEngine은 **디코딩된 이벤트**를 소비한다. address_context는 `축 이름 → entry 값` 매핑이어야 하며, 인코딩된 prefix 주소(`"tracking:v2:42"`)가 아니다. decode 책임은 호출자에 있다.

## 핵심 객체 6개

| 객체 | 역할 |
|------|------|
| `transition` | 전이 정의의 최상위 단위 (고유 이름 + 버전) |
| `match` | 어떤 좌표/시퀀스를 이 transition으로 볼지 |
| `bind` | raw event에서 어떤 값을 뽑아 identity로 연결할지 |
| `input` | 전이 전 상태 조건 (축 entry 기준) |
| `output` | 전이 후 상태 변경 (축 entry 설정) |
| `effect` | 전이의 성격 (정규 vocabulary) |

## 용어

| 용어 | 정의 |
|------|------|
| Raw Event | 좌표가 부여된 원시 이벤트 |
| Coordinate Pattern | match에서 정의하는 좌표 조합 |
| Transition Spec | 전이 해석 규칙 선언 |
| Transition Instance | spec이 raw event에 적용된 런타임 결과 |
| State Snapshot | 특정 시점의 축별 entry 값 상태 |

## 기존 시스템과의 관계

```
ScenarioSpec  → "이 흐름이 올바른가?" → Verdict (pass/fail)
TransitionSpec → "이 흐름이 무슨 의미인가?" → TransitionInstance (상태 변화)
```

공존한다. 교체가 아닌 추가 계층.

```
DEMO_CATALOG (좌표 + 축) ← 불변
  ↓ match
TransitionSpec (해석) ← 버전별 진화
  ↓ output
StateStore (축별 상태) ← 런타임 파생
```

## 도입 현황

| Tier | 문서 | 범위 | 상태 |
|------|------|------|------|
| [Tier 1](./tier-1-types-and-schema.md) | 타입 + 스키마 + registry + DKG 노드 | **완료** |
| [Tier 2](./tier-2-state-and-engine.md) | 축 기반 상태 + 7단계 엔진 + 실증 | **완료** |
| [Tier 3](./tier-3-pipeline-integration.md) | ingest 통합 + 수렴 metric + effect DKG | 미착수 |

## 실증 결과 (Tier 2)

shop-web 실제 checkout 흐름 13개 이벤트 기반:

- **시나리오 A (정상)**: 4개 전이 순서 실행, 최종 상태 재구성, unmatched 이벤트 식별
- **시나리오 B (비정상)**: 주문 생성 없이 결제 도착 → input violation 감지. Verdict는 이벤트 존재만 확인하지만 Transition은 상태 전제조건 위반을 잡는다
- **시나리오 C (시점 질의)**: 이벤트를 중간까지 넣으면 중간 상태, 전체 넣으면 최종 상태. deterministic replay 보장

## 설계 원칙

1. **transition은 payload 자유 해석 금지** — bind에서 id 추출만 허용
2. **match는 좌표 중심** — 전이의 정체성은 좌표 패턴에서 나온다
3. **input/output은 축(axis)만 참조** — 별도 slot vocabulary 없음
4. **effect는 정규 vocabulary만 허용** — 개발자 자유 문자열 금지
5. **상태는 좌표계의 축으로 표현** — catalog의 검증/headroom 시스템 재사용

## 파일 구조

```
packages/spec-core/src/transition/
  transition.types.ts        — 핵심 타입 (축 기반 StateCondition/StateAssignment)
  transition.schema.ts       — 구조 검증 (snake_case, bind 경로, effect vocabulary)
  transition.registry.ts     — Map<name, Map<version, spec>> 인메모리 등록
  match-adapter.ts           — MatchPattern → ScenarioStep[] 변환
  catalog-validator.ts       — catalog 기반 축/entry 2단계 검증
  state-store.ts             — InMemoryStateStore (축 기반 get/set/unset/snapshot)
  bind-extractor.ts          — $.events[N].field 경로 추출
  input-validator.ts         — eq/neq/in/exists 연산자
  output-applier.ts          — set/unset (축 entry 변경)
  transition-engine.ts       — 7단계 파이프라인
  demo-transition-specs.ts   — DEMO_CATALOG 기반 예시 3종
  index.ts                   — barrel export (./transition subpath)
  transition.test.ts         — Tier 1 + catalog validator 테스트 (46개)
  transition-engine.test.ts  — Tier 2 엔진 테스트 (29개)
  proof-of-value.test.ts     — 실증 테스트 (10개)
```

## subpath export

```json
"./transition": { "import": "./dist/transition/index.js" }
```
