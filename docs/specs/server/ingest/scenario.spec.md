---
def:
  id: scenario-api-spec
  scope: interface
  aspect: api_contract
  depth: specification
  lifecycle: approved
  layer: mediation
  tags: [tier-infra]
  links:
    - target: scenario-store-spec
      type: depends_on
---
# Scenario API

## 목적 ^purpose

ScenarioSpec CRUD — 시나리오 스펙 등록, 조회, 삭제.

## 구성 ^overview

- **CRUD 엔드포인트**: POST(upsert), GET(목록/단건 조회), DELETE — 모두 /v1/scenarios 경로
- **구조 검증**: 등록 시 compileSpec()으로 ScenarioSpec 구조 검증, 실패 시 400 반환
- **목록 필터링**: domain 파라미터로 도메인 필터, limit(기본 100, 최대 100)으로 결과 수 제한
- **의존 포트**: ScenarioSpecStore 단일 인터페이스에 의존

## 상태

implemented

## 엔드포인트

### POST /v1/scenarios

ScenarioSpec 등록/갱신 (upsert).

요청 body: ScenarioSpec JSON (scenarioSpecSchema로 검증).
등록 시 compileSpec()으로 구조 검증. compileSpec이 예외를 던지면 400을 반환한다.

응답 201: `{ accepted: true, scenario_id: string }`
응답 400: schema validation 실패 또는 compileSpec 예외

### GET /v1/scenarios?domain=&limit=

등록된 모든 ScenarioSpec 목록. domain 파라미터로 필터, limit으로 결과 수 제한 가능.

| 파라미터 | 타입 | 기본값 | 최대값 | 설명 |
|---|---|---|---|---|
| `domain` | string | - | - | 도메인 필터 (선택) |
| `limit` | number | 100 | 100 | 결과 수 제한. 양의 정수여야 하며 0이면 400 |

응답 200: `{ items: ScenarioSpec[] }`
응답 400: limit=0 또는 음수

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
