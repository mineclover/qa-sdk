---
def:
  id: definition-addressing-plan
  level: leaf
  address: def_document:v2:342162
  scope: flow
  aspect: process_flow
  depth: specification
  lifecycle: draft
  layer: operation
  svc: definition-service
  tags: [structural]
  links:
    - target: definition-addressing
      type: depends_on
    - target: definition-mgmt-verification-loop
      type: depends_on
---
# Definition Addressing — 도입 계획

## 목적 ^purpose

`def.id` 중심 운영에서 `v2 address` 병행 운영으로 이동하는 실제 단계와 검증 루프를 고정한다.

## 현재 완료

- frontmatter의 explicit `def_document:v2:*`를 scan 단계에서 보존
- sync/DB 적재 시 `documents.address`에 explicit v2 address 저장
- explicit address가 없는 문서는 legacy `v1` fallback 유지
- `document_links`에 `sourceId/targetId`와 `sourceAddress/targetAddress`를 병행 저장
- incoming/outgoing link read model에 `sourceAddress/targetAddress` 병행 노출
- `getByAddress`를 local/server/scan data source와 definition-service/CLI 조회면에 추가
- incoming/outgoing을 `--address=<ADDR>` 기준으로 조회하는 CLI/REST/GraphQL surface 추가
- `resolveByFile`와 graph impact output에 canonical address 노출 추가

## 다음 단계

### P1. address-aware read model 확장

- `DefDataSource.getIncomingLinks/getOutgoingLinks`가 address를 일관되게 노출
- REST/GraphQL/CLI 조회면에서 optional address 필드를 그대로 전달

### P2. address-aware link persistence

- 저장 전 `id -> address` resolve 실패 시의 정책을 정의
- 기존 row의 address backfill 전략을 고정

### P3. address-first lookup surface

- `resolveByFile` 결과에 canonical address를 더 강하게 노출
- REST/GraphQL의 address-first 엔드포인트를 더 넓게 확장

### P4. canonical key 전환

- 내부 graph/read model의 primary reference를 점진적으로 address 우선으로 이동
- `def.id`는 사람이 읽는 라벨로 유지

## 검증 루프

1. `def sync`
2. `def validate`
3. `def scan-audit`
4. `def audit-db`
5. targeted vitest

## 주의사항 ^caveat

- `def.id`를 즉시 제거하지 않는다.
- `def.id`와 `address`는 목적이 다르므로 장기적으로도 함께 유지할 수 있다.
- explicit v2 address가 없는 문서는 당분간 fallback을 유지한다.
- canonical key 전환은 read model, persistence, API surface를 분리해서 진행한다.
