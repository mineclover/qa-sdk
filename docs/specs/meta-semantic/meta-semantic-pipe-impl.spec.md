---
def:
  id: meta-semantic-pipe-impl
  level: module
  scope: feature
  aspect: func_def
  depth: implementation
  lifecycle: approved
  layer: domain
  links:
    - target: meta-semantic-v2-migration
      type: depends_on
    - target: meta-semantic-pipe-catalog
      type: depends_on
    - target: ms-concept-pipe
      type: implements
    - target: pipe-types
      type: contains
    - target: facet-port-model
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
    - target: pipe-interpret
      type: contains
    - target: pipe-gate
      type: contains
    - target: pipe-zoom
      type: contains
    - target: verdict-v2
      type: contains
    - target: path-matcher-migration
      type: contains
    - target: meta-semantic-data-contract
      type: contains
    - target: meta-semantic-test-tracking
      type: contains
    - target: prefix-path-summation
      type: contains
    - target: pipe-mermaid
      type: contains
    - target: pipe-definition-bridge
      type: contains
    - target: pipe-svg
      type: contains
    - target: data-object-binding
      type: contains
    - target: pipe-transition-scope
      type: contains
    - target: pipe-static-lineage
      type: contains
---

# PipeSpec + PipeGraph 구현

## 목적 ^purpose

PipeFlow 30종 흐름 제어를 포함한 PipeSpec(단일 노드), PipeGraph(노드 연결),
경로 계산, 검증, 직렬화, 저장, 분석, 시뮬레이션을 구현한다.

## 방법 ^method

**pipe-types**가 PipeFlow 30종 + PipeSpec + PipeGraph + ConnectionKind 8종 타입을 정의하고,
**facet-port-model**이 typed port / PortRef / facetType edge 표현으로 이를 확장하고,
**pipe-path**가 단일 파이프 + 그래프 전체 경로 수를 계산하고,
**pipe-validate**가 구조 무결성을 검증하고,
**pipe-serialize**가 JSON 직렬화/역직렬화하고,
**pipe-store**가 CRUD 저장소를 제공하고,
**pipe-analyze**가 복잡도·병목·커버리지·이벤트 카탈로그 수집을 수행하고,
**pipe-simulate**가 시뮬레이션 + happy path 검증을 실행하고,
**pipe-interpret**가 관심사 추출·전파·역할 분류를 수행하고,
**pipe-gate**가 품질 게이트 평가(pass/fail/review)를 수행하고,
**pipe-fold**가 서브그래프 접기/펼치기 + 경계 계약을 도출하고,
**pipe-svg**가 PipeGraph → SVG/D3 3-레이어 렌더링 파이프라인을 구현한다.

## 위임 ^delegates

- **pipe-types** → PipeFlow 30종 + PipeSpec + PipeGraph + ConnectionKind 8종 타입 정의
- **facet-port-model** → typed port / PortRef / Feynman식 facet line 모델
- **pipe-path** → 단일 파이프 + 그래프 전체 경로 수 계산 (countPipePaths, countGraphPaths)
- **pipe-validate** → PipeSpec/PipeGraph 구조 무결성 검증
- **pipe-serialize** → JSON 직렬화/역직렬화
- **pipe-store** → PipeSpec/PipeGraph CRUD 인메모리 저장소
- **pipe-analyze** → 복잡도·병목·커버리지·이벤트 카탈로그 수집
- **pipe-simulate** → 시뮬레이션 + happy path 검증 + 시뮬 결과 드리프트 감지
- **pipe-interpret** → PipeConcern 8종 추출·BFS 전파·역할 분류·변경 영향 분석
- **pipe-gate** → 품질 게이트 정의 + 자동 평가 (pass/fail/review)
- **pipe-zoom** → 줌 레벨별 시각화 데이터 모델 (뷰·레이아웃·스타일 3 패싯)
- **pipe-svg** → PipeGraph → SVG/D3 3-레이어 렌더링 (primitives → shapes+tokens → renderer)

## 구성 ^overview

하위 모듈 + 관련 소스:

| 모듈 | 구현 파일 | 테스트 파일 | tests |
|------|----------|-----------|-------|
| pipe-types | `core/src/types/pipe-spec.ts` | 빌드 체크 | — |
| facet-port-model | `core/src/types/pipe-spec.ts`, `core/src/pipe/pipe-port.ts` | `pipe-port.test.ts` 외 | — |
| pipe-path | `core/src/pipe-path.ts` | `pipe-path.test.ts` | 38 |
| pipe-validate | `core/src/pipe-validate.ts` | `pipe-validate.test.ts` | 20 |
| pipe-serialize | `core/src/pipe-serialize.ts` | `pipe-serialize.test.ts` | 4 |
| pipe-store | `core/src/pipe-store.ts` | `pipe-store.test.ts` | 9 |
| pipe-analyze | `core/src/pipe-analyze.ts` | `pipe-analyze.test.ts` | 14 |
| pipe-simulate | `core/src/pipe-simulate.ts` | `pipe-simulate.test.ts` | 38 |
| pipe-simulate (30종) | 같은 파일 | `pipe-simulate-advanced.test.ts` | 40 |
| pipe-simulate (시나리오) | 같은 파일 | `pipe-simulate-scenarios.test.ts` | 14 |
| pipe-simulate (UI) | 같은 파일 | `pipe-simulate-ui.test.ts` | 12 |
| pipe-happy-path | `core/src/pipe-simulate.ts` | `pipe-happy-path.test.ts` | 18 |
| pipe-fold | `core/src/pipe-fold.ts` | `pipe-fold.test.ts` | 36 |
| pipe-interpret | `core/src/pipe-interpret.ts` | `pipe-interpret.test.ts` | 23 |
| pipe-gate | `core/src/pipe-gate.ts` | `pipe-gate.test.ts` | 17 |
| pipe-interpret-gate | 같은 파일 | `pipe-interpret-gate.test.ts` | 11 |
| pipe-runtime | `core/src/pipe-runtime.ts` | `pipe-runtime.test.ts` | 36 |
| pipe-bridge | `core/src/pipe-bridge.ts` | 통합 테스트 | — |
| pipe-benchmark | 성능 검증 | `pipe-benchmark.test.ts` | 11 |
| pipe-svg | `packages/viz-core/src/pipe-svg.ts` | `packages/core/src/pipe-svg.test.ts` | 15 |

통합 테스트: `meta-semantic-integration.test.ts` (12 tests)
공유 fixture: `__fixtures__/pipe-fixtures.ts` (step, simplePipe, branchPipe, simpleGraph)

`pipe-svg`의 구현 소유권은 `viz-core`로 이동했지만, 기존 compatibility 검증과 graph-level snapshot 테스트는 아직 `core`의 테스트 스위트에 남아 있다.

## 설계 구조

```
PipeSpec = 단일 실행 단위 (내부 패싯 흐름 트리)
PipeGraph = PipeSpec 노드들의 연결 그래프 (ScenarioSpec 대체)
```

> 타입 상세: `core/src/types/pipe-spec.ts` 참조
> 30종 흐름 제어 상세: `pipe-flow-catalog` 참조

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
| step kind 3종 | ConnectionKind 8종 + PipeFlow 30종 |

> v2 마이그레이션 계획: `meta-semantic-v2-migration` 참조

## 관련 문서

- `meta-semantic-pipe-catalog` — PipeFlow/ConnectionKind 카탈로그와 naming/colocation 규칙
- `scope-nesting-visualization` — `viz-core`/`viz-web` 기반 시각화 경계

## 검증

```bash
pnpm --filter @qa-sdk/core build    # 타입 체크
pnpm --filter @qa-sdk/core test     # 594 tests (33 files)
```
