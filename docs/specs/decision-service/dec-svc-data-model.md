---
def:
  id: dec-svc-data-model
  address: def_document:v2:342157
  scope: data
  aspect: domain_data
  depth: specification
  lifecycle: approved
  layer: operation
  svc: decision-service
  tags: [tier-infra, decision]
  links:
    - target: decision-service-system
      type: refines
---
# Decision Service — 데이터 모델

## 목적 ^purpose

decision-service가 관리하는 3개 SQLite 테이블의 구조를 정의한다.

## 구성 ^overview

### flow_schemas — 의사결정 스키마 정의

| 컬럼 | 타입 | 설명 |
|------|------|------|
| schema_id | TEXT PK | 스키마 고유 ID (scope-expansion, test-needed 등) |
| name | TEXT | 표시 이름 |
| version | TEXT | 스키마 버전 (v1, v2) |
| gates_json | TEXT | gate 배열 JSON (id, label, weight, phase, branches[]) |
| outcomes_json | TEXT | outcome 배열 JSON |
| meta_json | TEXT | 추가 메타데이터 |

### flow_instances — 의사결정 실행 이력

| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | TEXT PK | 인스턴스 ID (ULID) |
| schema_id | TEXT FK | 사용된 스키마 |
| status | TEXT | active / completed / abandoned |
| selections_json | TEXT | gate 선택 배열 (gateId, branchId, evidence[], selectedAt) |
| outcome_json | TEXT | 결과 (artifactType, verdict 등) |
| address | INTEGER | 좌표 주소 (gate 선택 경로 인코딩) |
| verdict | TEXT | approved / deferred / rejected |

### flow_links — 의사결정 → 문서 연결

| 컬럼 | 타입 | 설명 |
|------|------|------|
| instance_id | TEXT FK | 의사결정 인스턴스 |
| doc_id | TEXT | definition-service 문서 ID |
| link_type | TEXT | created / modified / deprecated / approved |
