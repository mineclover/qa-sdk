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
3. input state slot이 뭔지 → `input`
4. output state slot이 뭔지 → `output`
5. state에 어떤 effect를 주는지 → `effect`

## 핵심 객체 6개

| 객체 | 역할 |
|------|------|
| `transition` | 전이 정의의 최상위 단위 (고유 이름 + 버전) |
| `match` | 어떤 좌표/시퀀스를 이 transition으로 볼지 |
| `bind` | raw event에서 어떤 값을 뽑아 state slot과 연결할지 |
| `input` | 전이 전 상태 조건 |
| `output` | 전이 후 상태 변경 |
| `effect` | 전이의 성격 (정규 vocabulary) |

## 용어

| 용어 | 정의 |
|------|------|
| Raw Event | 좌표가 부여된 원시 이벤트 |
| Coordinate Pattern | match에서 정의하는 좌표 조합 |
| Transition Spec | 전이 해석 규칙 선언 |
| Transition Instance | spec이 raw event에 적용된 런타임 결과 |
| State Slot | 상태를 저장하는 정규화된 슬롯 (`<scope>.<field>`) |
| State Snapshot | 특정 시점의 전체 슬롯 상태 |

## 기존 시스템과의 관계

```
ScenarioSpec  → "이 흐름이 올바른가?" → Verdict (pass/fail)
TransitionSpec → "이 흐름이 무슨 의미인가?" → TransitionInstance (상태 변화)
```

공존한다. 교체가 아닌 추가 계층.

```
DEMO_CATALOG (좌표) ← 불변
  ↓ match
TransitionSpec (해석) ← 버전별 진화
  ↓ output
StateSlotStore (상태) ← 런타임 파생
```

## 도입 계획

| Tier | 문서 | 범위 | 리스크 |
|------|------|------|--------|
| [Tier 1](./tier-1-types-and-schema.md) | 타입 + 스키마 + registry + DKG 노드 | 낮음 |
| [Tier 2](./tier-2-state-slots-and-engine.md) | State Slot store + transition engine 7단계 | 중간 |
| [Tier 3](./tier-3-pipeline-integration.md) | ingest 통합 + 수렴 metric + effect DKG | 높음 |

## 설계 원칙

1. **transition은 payload 자유 해석 금지** — bind에서 id 추출만 허용
2. **match는 좌표 중심** — 전이의 정체성은 좌표 패턴에서 나온다
3. **input/output은 slot만 참조** — 비즈니스 객체 전체를 넣지 않는다
4. **effect는 정규 vocabulary만 허용** — 개발자 자유 문자열 금지
5. **State Slot은 좌표계의 일부가 아니다** — 해석 계층에서 관리
