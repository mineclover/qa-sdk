---
def:
  tier: component
  id: cli-flow-store
  scope: data
  aspect: domain_data
  depth: specification
  lifecycle: approved
  layer: operation
  svc: cli
  tags: [persistence, runtime, decision]
  links:
    - target: cli-contract-spec
      type: refines
    - target: dkg-state-store
      type: depends_on
---
# CLI Flow Instance Store

## 목적 ^purpose

CLI에서 실행된 decision-flow 인스턴스를 로컬 SQLite에 영속한다. `~/.qa-sdk/decision-flow.sqlite`에 저장. decision-service(전역 서버)와 별도로 CLI 로컬에서 의사결정 이력을 관리한다.

## 테이블 (1개)

소스: `packages/cli/src/db/schema.ts`

### flow_instances — 의사결정 흐름 인스턴스

| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | text PK | FlowInstance ID |
| schema_id | text | 흐름 스키마 ID (test-needed, scope-expansion, stabilization) |
| schema_version | text | 스키마 버전 |
| status | text | `active` / `completed` / `abandoned` |
| context | text (JSON) | 흐름 컨텍스트 (키워드, evidence 등) |
| selections | text (JSON) | 게이트별 선택 기록 `[{ gateId, branchId, reason }]` |
| outcome | text (nullable) | 최종 결과 (좌표 주소의 의미 해석) |
| address | integer (nullable) | 인코딩된 좌표 주소 |
| address_context | text (nullable) | 주소 컨텍스트 JSON |
| verdict | text (nullable) | 자동 판정 결과 |
| test_plan | text (nullable) | 테스트 계획 (test-needed 흐름) |
| started_at | text | 흐름 시작 시각 |
| completed_at | text (nullable) | 흐름 완료 시각 |
| created_at | text | 레코드 생성 시각 |

인덱스: schema_id, status, started_at

## decision-service와의 관계

| | CLI flow store | decision-service |
|---|---|---|
| 위치 | 로컬 `~/.qa-sdk/` | 서버 port 3800 |
| 범위 | 개인 CLI 세션 | 팀 전체 공유 |
| 용도 | 즉시 의사결정 기록 | 정규 의사결정 관리 |
| 동기화 | CLI → 서버 push (수동) | — |

CLI에서 `dkg decide`로 기록한 흐름은 로컬에만 존재. 팀 공유가 필요하면 decision-service에 push한다.
