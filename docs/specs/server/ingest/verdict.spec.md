---
def:
  id: verdict-api-spec
  address: def_document:v2:412834
  scope: interface
  aspect: api_contract
  depth: specification
  lifecycle: approved
  layer: mediation
  svc: ingest-server
  tags: [contract, runtime, observability]
  links:
    - target: verdict-spec
      type: depends_on
    - target: graph-spec
      type: depends_on
    - target: trace-spec
      type: depends_on
    - target: session-spec
      type: depends_on
    - target: scenario-store-spec
      type: depends_on
    - target: dlq-store-spec
      type: depends_on
---
# Verdict API

## 목적 ^purpose

trace와 session 단위의 시나리오 verdict를 조회하고 강제 재계산하는 서버 API 계약과 의존 범위를 정의한다.

## 구성 ^overview

- **조회 API**: GET /v1/traces/:traceId/verdicts, GET /v1/sessions/:sessionId/verdicts — verdict 목록(id, scenarioId, overallVerdict, report, computedAt) 반환
- **재계산 API**: POST /v1/traces/:traceId/verdicts/recompute — 기존 verdict 삭제 후 computePendingVerdicts(force: true) 실행, computed/skipped/failed 분류 반환
- **의존 포트**: VerdictStore, TraceStore, SessionStore, GraphStore, ScenarioSpecStore, DlqStore 6개 스토어 주입
- **테스트**: verdict 조회/404/recompute 단위 테스트 + SDK→ingest 전체 파이프라인 E2E 검증

## 상태

implemented

## 엔드포인트

### GET /v1/traces/:traceId/verdicts

해당 trace에 대한 모든 verdict 결과 조회.

응답 200:
```json
{
  "items": [
    {
      "id": "vrd_...",
      "scenarioId": "checkout-flow",
      "traceId": "trc_...",
      "qaSessionId": "qas_..." | null,
      "overallVerdict": "pass",
      "report": { ... },
      "computedAt": "2026-03-12T10:05:00.000Z"
    }
  ]
}
```

응답 404: trace 없음.

### GET /v1/sessions/:sessionId/verdicts

해당 session에 대한 모든 verdict 결과 조회. 응답 형식은 trace verdict와 동일.

응답 404: session 없음.

### POST /v1/traces/:traceId/verdicts/recompute

해당 trace의 verdict를 강제 재계산. 기존 verdict를 삭제하고 새로 계산한다.

내부적으로 `computePendingVerdicts(deps, [traceId], { force: true })`를 호출.

응답 200:
```json
{
  "computed": [{ "traceId": "trc_...", "scenarioId": "checkout-flow" }],
  "skipped": [],
  "failed": []
}
```

- `computed`: 성공적으로 재계산된 verdict 목록 (`Array<{ traceId: string; scenarioId: string }>`)
- `skipped`: 건너뛴 항목 — trace에 연결된 session이 없거나 scenarioId·scenarioSpec·graph가 없는 경우
- `failed`: 재계산 실패 항목

응답 404: trace 없음.

## 의존 포트

```typescript
interface VerdictDeps {
  verdictStore: VerdictStore;
  traceStore: TraceStore;
  sessionStore: SessionStore;
  graphStore: GraphStore;
  scenarioSpecStore: ScenarioSpecStore;
  dlqStore: DlqStore;
}
```

## 테스트 커버리지

`packages/ingest-server/src/routes/verdict.test.ts`:
- trace/session verdict 조회, trace 없음 → 404, recompute 200, recompute → session 없으면 skipped 반환

`packages/ingest-server/src/sdk-to-ingest.e2e.test.ts`:
- 전체 파이프라인 후 `GET /v1/traces/:traceId/verdicts`로 overallVerdict 및 missing_steps 검증
