# Transition Spec DSL

> raw coordinate system 위에 state semantics를 덧씌우는 해석 계층

## 4대 원칙

1. **좌표계는 불변 primitive**
2. **개발자는 raw coordinate만 남긴다**
3. **transition은 외부 spec으로 조립한다**
4. **state transition은 deterministic 하게 재구성한다**

## 핵심 설계 결정

### 상태 = 축의 entry

별도 slot vocabulary 없이 DEMO_CATALOG의 축이 곧 상태 vocabulary.

| 용도 | 축 | 비고 |
|------|---|------|
| 흐름 위치 | `flow_step` | entry → processing → success |
| 자원 생명주기 | `lifecycle_state` | draft → active → deprecated |
| 자원 위치 | `resource_location` | origin, cache, queue, external |
| 존재 여부 | `lifecycle_state` 유무 | exists: false = 미설정 |

### address_context 전제

TransitionEngine은 **디코딩된 이벤트**를 소비한다. `decode-adapter.ts`가 인코딩된 prefix 주소를 `축 이름 → entry 값` flat map으로 변환.

## 핵심 객체 6개

| 객체 | 역할 |
|------|------|
| `transition` | 전이 정의의 최상위 단위 (고유 이름 + 버전) |
| `match` | 어떤 좌표/시퀀스를 이 transition으로 볼지 |
| `bind` | raw event에서 identity 추출 |
| `input` | 전이 전 상태 조건 (축 entry 기준) |
| `output` | 전이 후 상태 변경 (축 entry 설정) |
| `effect` | 전이의 성격 (정규 vocabulary) |

## 기존 시스템과의 관계

```
ScenarioSpec  → "이 흐름이 올바른가?" → Verdict (pass/fail)
TransitionSpec → "이 흐름이 무슨 의미인가?" → TransitionInstance (상태 변화)
```

```
DEMO_CATALOG (좌표 + 축) ← 불변
  ↓ match
TransitionSpec (해석) ← 버전별 진화
  ↓ output
StateStore (축별 상태) ← 런타임 파생
```

## 3-Tier 구조

| Tier | 문서 | 범위 |
|------|------|------|
| [Tier 1](./tier-1-types-and-schema.md) | 타입 + 스키마 + registry + DKG 노드 |
| [Tier 2](./tier-2-state-and-engine.md) | 축 기반 상태 + 7단계 엔진 + 실증 |
| [Tier 3](./tier-3-pipeline-integration.md) | ingest 통합 + 수렴 metric + API |

## 설계 원칙

1. **transition은 payload 자유 해석 금지** — bind에서 id 추출만 허용
2. **match는 좌표 중심** — 전이의 정체성은 좌표 패턴에서 나온다
3. **input/output은 축(axis)만 참조** — 별도 slot vocabulary 없음
4. **effect는 정규 vocabulary만 허용** — 개발자 자유 문자열 금지
5. **상태는 좌표계의 축으로 표현** — catalog의 검증/headroom 시스템 재사용

## 파일 구조

```
packages/spec-core/src/transition/
  transition.types.ts        — 핵심 타입 (StateCondition/StateAssignment)
  transition.schema.ts       — 구조 검증
  transition.registry.ts     — 인메모리 등록
  match-adapter.ts           — MatchPattern → ScenarioStep[]
  catalog-validator.ts       — catalog 기반 축/entry 2단계 검증
  state-store.ts             — InMemoryStateStore
  sqlite-state-store.ts      — SqliteStateStore (AsyncStateStore)
  bind-extractor.ts          — $.events[N].field 경로 추출
  input-validator.ts         — eq/neq/in/exists 연산자
  output-applier.ts          — set/unset (축 entry 변경)
  transition-engine.ts       — 7단계 파이프라인 (2-pass: matched_at 순서)
  decode-adapter.ts          — 인코딩된 address_context → 축:entry flat map
  dkg-bridge.ts              — TransitionSpec → TransitionSpecNode + inter-spec edges + satisfies
  violation-bridge.ts        — InputViolation → ObservationNode
  transition-pipeline.ts     — TransitionFunctions (convergence 주입 번들)
  transition-metrics.ts      — Phase 2.5 결과 → MetricValue[]
  demo-transition-specs.ts   — DEMO_CATALOG 기반 예시 3종
  index.ts                   — barrel export (./transition subpath)
```
