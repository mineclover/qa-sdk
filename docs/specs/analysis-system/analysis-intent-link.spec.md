---
def:
  id: analysis-intent-link
  address: def_document:v2:68739
  scope: feature
  aspect: func_def
  depth: specification
  lifecycle: approved
  layer: domain
  svc: spec-core
  tags: [observability]
  links:
    - target: analysis-prefix
      type: depends_on
    - target: analysis-transition
      type: depends_on
---
# IntentLink — Prefix 공출현 조건

## 목적 ^purpose

특정 prefix들이 함께 관측되어야 하는 조건(IntentLink)을 정의하고, 위반 시 invariant violation을 감지한다. 순서 없는 공출현 — 같은 서비스 컨텍스트에서 동시에 나타나기만 하면 된다.

## 구성 ^overview

IntentLink는 관측 체계 3단계 중 1단계(수동 선언)에 해당한다. DKG config에 사람이 직접 정의하는 prefix 공출현 조건이며, `traceFlows()` 함수로 위반을 감지한다.

### IntentLink 노드 구조

```typescript
interface IntentLinkNode {
  kind: "intent-link";
  id: string;            // 예: "IL-checkout-flow"
  endpoints: string[];   // 함께 관측되어야 하는 prefix 목록
  via: string;           // 연결 컨텍스트 (예: "service")
  intent: string;        // 의도 설명
  invariant?: string;    // 불변조건 텍스트 (위반 판정에 사용)
}
```

### 위반 감지 (traceFlows)

`traceFlows(graph, records)` 함수는 실 트래픽의 address_context를 IntentLink의 endpoints와 대조한다.

**검사 방식:**

1. 각 레코드의 address_context에서 prefix 집합 추출
2. IntentLink의 endpoints 중 일부만 존재하고 나머지가 누락되면 잠재적 위반
3. invariant 텍스트가 있으면 패턴 매칭으로 구체적 위반 판정

**invariant 패턴 매칭:**

- **"A 없이 B" 패턴** — A가 없고 B가 있으면 위반 (예: `"page_view 없이 flow_point"`)
- **endpoints 순서 기반** — 앞쪽 endpoint 없이 뒤쪽만 있고, invariant에 양쪽이 언급되면 위반

### 위반 시 자동 Observation 생성

위반이 감지되면 DKG ObservationNode가 자동으로 생성된다:

```typescript
{
  kind: "observation",
  id: "OBS-FLOW-{intentLinkId}-{missingPrefixes}",
  source: "runtime",
  subjects: [intentLinkId, ...presentPrefixes, ...missingPrefixes],
  finding: "{intentLinkId} invariant 위반 N건: {missing} 누락",
  suggestion: { kind: "revise-decision", decisionId: intentLinkId }
}
```

### DSL Bundle Invariant 검증

IntentLink 검증과 보완적으로, `validateDslInvariants()` 함수가 DSL 번들의 memberPrefixes 간 불변조건도 검증한다.

- IntentLink: endpoint 순서/포함 검증
- DSL Invariant: 번들 내 멤버 prefix 간 불변조건 검증

### 라벨링 (사람의 판단)

자동 발견된 IntentLink 후보에 사람이 의미를 부여하는 라벨링 API:

| 엔드포인트 | 메서드 | 설명 |
|-----------|--------|------|
| `/v1/labels` | GET | 라벨 목록 조회 (kind=intent-link 필터) |
| `/v1/labels` | POST | 새 라벨 생성 |
| `/v1/labels/:id` | PATCH | 상태 변경 (confirmed/rejected/investigating) |
| `/v1/labels/summary` | GET | kind별 상태 집계 |

**라벨 상태 흐름:**
```
pending → confirmed (수동 IntentLink로 승격)
pending → rejected (잘못된 패턴으로 기각)
pending → investigating (추가 조사 필요)
```

### 3단계 관측 체계에서의 위치

```
IntentLink (수동, 이 스펙)    "이 prefix들이 함께 있어야 한다"
     ↑ 발견
Auto IL (데이터, co-occurrence) "실제로 이렇게 쓰인다"
     ↓ gap
ScenarioSpec (설계)            "이 순서로 진행되어야 한다"
```

- Auto IL에서 ScenarioSpec으로의 직접 승격은 하지 않는다
- Auto IL과 ScenarioSpec의 gap = 인사이트

### convergence pipeline 통합

`ConvergencePipelineRunner.runPipeline()` 단계 5b에서 IntentLink 흐름 검증이 실행된다:

```typescript
// 5b. IntentLink 흐름 검증 (에러 격리)
if (convergenceFns.traceFlows) {
  const flowResult = convergenceFns.traceFlows(graph, addressRecords);
  flowViolationCount = flowResult.violations.length;
  observations.push(...flowResult.observations);
}
```

## 관련 소스

- `packages/spec-core/src/dkg/skills/flow-trace.ts` — `traceFlows()`, `validateDslInvariants()`
- `packages/ingest-server/src/lib/convergence-pipeline.ts` — 파이프라인 통합
- `packages/ingest-server/src/routes/labels.ts` — 라벨링 API
- `packages/spec-core/src/dkg/dkg.types.ts` — `IntentLinkNode` 타입
