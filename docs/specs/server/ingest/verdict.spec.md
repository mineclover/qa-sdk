---
def:
  id: verdict-api-spec
  scope: interface
  aspect: api_contract
  depth: specification
  lifecycle: approved
---
# Verdict API

> 시나리오 verdict 조회 및 강제 재계산 API. ^purpose

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
