---
def:
  id: dec-svc-api-contract
  address: def_document:v1:3225
  scope: interface
  aspect: api_contract
  depth: specification
  lifecycle: approved
  layer: mediation
  svc: decision-service
  tags: [tier-infra, decision]
  links:
    - target: decision-service-system
      type: refines
---
# Decision Service — API 계약

## 목적 ^purpose

decision-service의 REST 엔드포인트 명세.

## 구성 ^overview

### Schemas

| Method | Path | 설명 |
|--------|------|------|
| GET | /schemas | 스키마 목록 |
| GET | /schemas/:id | 스키마 상세 (gates, outcomes) |
| POST | /schemas | 스키마 등록/갱신 |
| DELETE | /schemas/:id | 스키마 삭제 |

### Instances

| Method | Path | 설명 |
|--------|------|------|
| GET | /instances | 인스턴스 목록 (limit/offset) |
| GET | /instances/:id | 인스턴스 상세 (selections, outcome, address) |
| GET | /instances/schema/:schemaId | 스키마별 실행 이력 |
| POST | /instances | 인스턴스 저장 (upsert) |

### Links (Decision → Document)

| Method | Path | 설명 |
|--------|------|------|
| POST | /links | 연결 등록 {instanceId, docId, linkType} |
| GET | /links/instance/:id | 의사결정이 만든 문서 |
| GET | /links/doc/:docId | 문서에 연결된 의사결정 |
| DELETE | /links/:instanceId/:docId/:linkType | 연결 삭제 |

### 서비스 간 참조

| 참조 대상 | 용도 | 실패 시 |
|-----------|------|---------|
| definition-service (:3700) | GET /docs/:id — 문서 존재 확인 | fail-open (연결 생성 허용) |
