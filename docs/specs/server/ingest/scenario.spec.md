# Scenario API

> ScenarioSpec CRUD — 시나리오 스펙 등록, 조회, 삭제.

## 상태

implemented

## 엔드포인트

### POST /v1/scenarios

ScenarioSpec 등록/갱신 (upsert).

요청 body: ScenarioSpec JSON (scenarioSpecSchema로 검증).
등록 시 compileSpec()으로 의미 검증 (step 참조 유효성, 순환 참조 등). 실패 시 400.

응답 201: `{ accepted: true, scenario_id: string }`
응답 400: scenario compilation failed (compileSpec 실패) 또는 schema validation 실패

### GET /v1/scenarios?domain=&limit=

등록된 모든 ScenarioSpec 목록. domain 파라미터로 필터, limit으로 결과 수 제한 가능.

| 파라미터 | 타입 | 기본값 | 최대값 | 설명 |
|---|---|---|---|---|
| `domain` | string | - | - | 도메인 필터 (선택) |
| `limit` | number | 100 | 100 | 결과 수 제한 |

응답 200: `{ items: ScenarioSpec[] }`

### GET /v1/scenarios/:scenarioId

특정 ScenarioSpec 조회.

응답 200: ScenarioSpec JSON
응답 404: scenario 없음.

### DELETE /v1/scenarios/:scenarioId

ScenarioSpec 삭제.

응답 200: `{ deleted: true, scenario_id: string }`
응답 404: scenario 없음.

## 의존 포트

```typescript
interface ScenarioDeps {
  scenarioSpecStore: ScenarioSpecStore;
}
```
