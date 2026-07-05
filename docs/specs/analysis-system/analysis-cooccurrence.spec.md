---
def:
  tier: component
  id: analysis-cooccurrence
  type: spec
  address: def_document:v2:68738
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
  sources:
    - packages/ingest-server/src/routes/insights.ts
    - packages/ingest-server/src/stores/drizzle-insights-store.ts
    - packages/ingest-server/src/ports/insights-store.port.ts
    - packages/ingest-server/src/insights-store.e2e.test.ts
    - packages/convergence/src/usage-aggregator.ts
    - packages/convergence/src/causal-discovery.ts
    - packages/spec-core/src/convergence/pipeline-e2e.test.ts
    - packages/spec-core/src/convergence/convergence.test.ts
---
# Co-occurrence — 세션 기반 공출현 패턴

## 목적 ^purpose

세션 단위로 어떤 prefix가 함께 나타나는지 Jaccard 분석. Jaccard ≥ 0.5인 쌍에서 connected component를 찾아 Auto IntentLink 후보를 생성한다.

## 구성 ^overview

공출현 분석은 `GET /v1/insights/correlations` API에 구현되어 있으며, 수집된 이벤트의 address_context에서 prefix 공출현 패턴을 발견한다.

### 그룹핑 전략

세션 단위 그룹핑이 기본이다. trace가 아닌 session인 이유: trace는 SDK flush 타이밍(전송 단위)이고, session이 사용자 행동 단위이기 때문이다.

| 우선순위 | 그룹 키 | 설명 |
|----------|---------|------|
| 1 | `qa_session_id` | 사용자 행동 단위 (세션) |
| 2 | `trace_id` (fallback) | 세션 없는 레코드에 대한 대체 |

### 제외 이벤트

synthetic/system 이벤트는 공출현 분석에서 자동 제외된다:
- `synthetic.coverage` — 합성 커버리지 이벤트
- `system.change` — 시스템 변경 이벤트
- `error.service` — 서비스 에러
- `health.check` — 헬스 체크

### 분석 흐름

```
records (address_context ≠ null)
  → 세션별 prefix set 구성 (qa_session_id → Set<prefix>)
  → prefix 쌍 공출현 카운트
  → Jaccard similarity 계산
  → Jaccard ≥ 0.5 쌍에서 connected component (BFS)
  → 3개 이상 prefix가 있는 component → IntentLink 후보 제안
```

### Jaccard Similarity 계산

```
Jaccard(A, B) = |sessions(A) ∩ sessions(B)| / |sessions(A) ∪ sessions(B)|
```

- 분자: A와 B가 모두 나타나는 세션 수
- 분모: A 또는 B가 나타나는 세션 수
- 결과: 0~1 사이 값, 소수점 2자리 반올림

### IntentLink 자동 제안

Jaccard ≥ 0.5인 쌍을 간선으로 하는 그래프에서 BFS로 connected component를 추출한다.

- **최소 크기**: 3개 prefix 이상인 component만 제안
- **ID 형식**: `IL-AUTO-{순번}` (예: `IL-AUTO-1`)
- **avgJaccard**: component 내 모든 쌍의 평균 Jaccard
- **evidence**: 분석에 사용된 총 세션/trace 그룹 수

### 부가 분석

- **단독 출현 비율 (soloRate)**: 다른 prefix 없이 혼자 나타나는 빈도. soloRate가 높은 prefix는 독립적 사용 패턴을 의미
- **prefix 빈도**: 전체 세션에서 각 prefix의 출현 횟수

### API 파라미터

| 파라미터 | 기본값 | 설명 |
|----------|--------|------|
| `min_support` | 2 | 최소 공출현 횟수. 이하인 쌍은 무시 |

### 응답 구조

```typescript
{
  totalGroups: number;       // 세션 + trace 그룹 총 수
  sessionGroups: number;     // qa_session_id 기반 그룹 수
  traceGroups: number;       // trace_id fallback 그룹 수
  totalPairs: number;        // min_support 이상인 상관 쌍 수
  correlations: Array<{      // 상위 50개 (jaccard DESC)
    prefixA: string;
    prefixB: string;
    cooccurrence: number;
    jaccard: number;
    support: number;
  }>;
  suggestions: Array<{       // Auto IntentLink 후보
    id: string;
    endpoints: string[];
    avgJaccard: number;
    evidence: number;
  }>;
  prefixFrequency: Array<{   // prefix별 빈도
    prefix: string;
    count: number;
    soloRate: number;
  }>;
}
```

## 관련 소스

- `packages/ingest-server/src/routes/insights.ts` — `GET /v1/insights/correlations`
- `packages/ingest-server/src/stores/drizzle-insights-store.ts` — 세션/trace 그룹핑, Jaccard 계산, IntentLink 후보 제안
- `packages/ingest-server/src/insights-store.e2e.test.ts` — correlations API 소비자 검증
- `packages/convergence/src/usage-aggregator.ts` — `UsageData.coOccurrences` 집계
- `packages/convergence/src/causal-discovery.ts` — co-occurrence 기반 IntentLink/constraint 후보 판정
- `packages/spec-core/src/convergence/pipeline-e2e.test.ts` — co-occurrence 안정화/소비자 E2E 검증

## 검증 명령 ^validation

```bash
pnpm --filter @qa-sdk/ingest-server exec vitest run src/insights-store.e2e.test.ts src/routes/insights.test.ts
pnpm --filter @qa-sdk/convergence test
pnpm --filter @qa-sdk/spec-core exec vitest run src/convergence/pipeline-e2e.test.ts src/convergence/convergence.test.ts
node packages/cli/dist/index.js def validate
pnpm arch:feedback
```
