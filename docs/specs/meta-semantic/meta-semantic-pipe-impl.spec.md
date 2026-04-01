---
def:
  id: meta-semantic-pipe-impl
  level: module
  scope: feature
  aspect: func_def
  depth: implementation
  lifecycle: draft
  layer: domain
  links:
    - target: meta-semantic-v2-migration
      type: depends_on
    - target: ms-concept-pipe
      type: implements
    - target: pipe-types
      type: contains
    - target: pipe-path
      type: contains
    - target: pipe-validate
      type: contains
    - target: pipe-serialize
      type: contains
    - target: pipe-store
      type: contains
    - target: pipe-analyze
      type: contains
    - target: pipe-simulate
      type: contains
    - target: pipe-flow-catalog
      type: contains
---

# PipeSpec + PipeGraph 구현

## 목적 ^purpose

PipeFlow 31종 흐름 제어를 포함한 PipeSpec(단일 노드), PipeGraph(노드 연결),
경로 계산, 검증, 직렬화, 저장, 분석, 시뮬레이션을 구현한다.

## 방법 ^method

**pipe-types**가 PipeFlow 31종 + PipeSpec + PipeGraph + ConnectionKind 8종 타입을 정의하고,
**pipe-path**가 단일 파이프 + 그래프 전체 경로 수를 계산하고,
**pipe-validate**가 구조 무결성을 검증하고,
**pipe-serialize**가 JSON 직렬화/역직렬화하고,
**pipe-store**가 CRUD 저장소를 제공하고,
**pipe-analyze**가 복잡도·병목·커버리지를 분석하고,
**pipe-simulate**가 dry-run 시뮬레이션을 실행하고,
**pipe-flow-catalog**가 31종 각각의 표현·정의·검증 방식을 문서화한다.

## 구성 ^overview

8개 하위 모듈 + 관련 소스:

| 모듈 | 구현 파일 | 테스트 |
|------|----------|--------|
| pipe-types | `core/src/types/pipe-spec.ts` | 빌드 체크 |
| pipe-path | `core/src/pipe-path.ts` | 38 tests (`pipe-path.test.ts`) |
| pipe-validate | `core/src/pipe-validate.ts` | 포함 |
| pipe-serialize | `core/src/pipe-serialize.ts` | 4 tests (`pipe-infra.test.ts`) |
| pipe-store | `core/src/pipe-store.ts` | 9 tests (`pipe-infra.test.ts`) |
| pipe-analyze | `core/src/pipe-analyze.ts` | 6 tests (`pipe-infra.test.ts`) |
| pipe-simulate | `core/src/pipe-simulate.ts` | 15 tests (`pipe-simulate.test.ts`) |
| pipe-bridge | `core/src/pipe-bridge.ts` | 통합 테스트 |
| pipe-flow-catalog | 문서 전용 | — |

통합 테스트: `core/src/meta-semantic-integration.test.ts` (12 tests)

## 설계 구조

```
PipeSpec = 단일 실행 단위 (내부 패싯 흐름 트리)
PipeGraph = PipeSpec 노드들의 연결 그래프 (ScenarioSpec 대체)
```

> 타입 상세: `core/src/types/pipe-spec.ts` 참조
> 31종 흐름 제어 상세: `pipe-flow-catalog` 참조

## ConnectionKind 8종

| 종류 | 설명 |
|------|------|
| next | 순차 |
| conditional | 조건부 |
| event | 이벤트 체인 |
| error | 에러 핸들링 |
| compensate | 보상/롤백 |
| fan-out | 1→N 동시 시작 |
| join | N→1 합류 대기 |
| feedback | 폐루프 재트리거 |

> 타입 상세: `core/src/types/pipe-spec.ts` `ConnectionKind` 참조

## ScenarioSpec과의 대응

| ScenarioSpec | PipeGraph |
|---|---|
| `scenario_id` | `graphId` |
| `steps[]` (flat + next[]) | `pipes[]` (노드) + `connections[]` (엣지) |
| step kind 3종 | ConnectionKind 8종 + PipeFlow 31종 |

> v2 마이그레이션 계획: `meta-semantic-v2-migration` 참조

## 검증

```bash
pnpm --filter @qa-sdk/core build    # 타입 체크
pnpm --filter @qa-sdk/core test     # 275 tests
```
