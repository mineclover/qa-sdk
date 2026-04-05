---
def:
  id: query-rules
  level: module
  address: def_document:v2:342189
  scope: data
  aspect: domain_data
  depth: specification
  lifecycle: approved
  layer: domain
  svc: query-service
  tags: [data, persistence, runtime]
  links:
    - target: registry-data-model
      type: depends_on
    - target: query-rule-migration
      type: contains
contains:
  - query-rule-migration
---
# 규칙 영속화 (PolicyRule Store)

## 목적 ^purpose

PolicyRule의 CRUD와 충돌 전략을 정의한다. Memory/SQL 어댑터를 지원하며, 여러 서비스가 동일 규칙 집합을 공유한다.

## 구성 ^overview

- **PolicyRuleStore 인터페이스** — insert, findById, findByIndex, update, delete 5개 메서드.
- **SqlPolicyRuleStore** — SQLite 기반 영속 저장. query-service 기본 저장소.
- **InMemoryPolicyRuleStore** — 테스트/데모용 인메모리 구현.
- **REST /rules 엔드포인트** — CRUD + force 옵션으로 규칙 관리.
- **충돌 전략** — priority 기반, 같은 priority 시 latest-wins.

## StoredPolicyRule 구조

`PatternRule<T>`를 확장하여 영속화에 필요한 메타데이터를 추가한다.

| 필드 | 타입 | 설명 |
|------|------|------|
| `id` | `string` | 규칙 고유 식별자 |
| `pattern` | `CoordConstraint[]` | 좌표 패턴 (position 기반 매칭) |
| `value` | `T` | 규칙 값 |
| `priority` | `number` | 우선순위 |
| `indexId` | `string` | 대상 index ID |
| `versionId` | `string` | 대상 version ID |
| `createdAt` | `string` | 생성 시각 (ISO-8601) |
| `updatedAt` | `string` | 수정 시각 (ISO-8601) |
| `ruleSetId` | `string?` | 규칙 집합 ID (선택) |

## REST 엔드포인트

### POST /rules

새 PolicyRule을 생성한다.

- Body: `PolicyRulePayload` (zod 검증)
- Query: `force=true` — 기존 규칙과 충돌 시 강제 생성
- 응답: 201 Created + 생성된 StoredPolicyRule

### GET /rules

규칙 목록을 조회한다.

- Query: `indexId`, `versionId` — index/version으로 필터
- 응답: StoredPolicyRule 배열

### GET /rules/:id

단건 규칙을 조회한다.

### PUT /rules/:id

기존 규칙을 업데이트한다.

- Body: `PolicyRulePayload`
- Query: `force=true` — 충돌 시 강제 업데이트

### DELETE /rules/:id

규칙을 삭제한다. 204 No Content 반환.

## RuleService 내부 로직

`createRuleService`가 PolicyRuleStore와 PrefixRegistry를 조합하여 비즈니스 로직을 제공한다.

- `createRule(payload, force)` — 규칙 생성 (충돌 검사 포함)
- `updateRule(id, payload, force)` — 규칙 수정
- `deleteRule(id)` — 규칙 삭제
- `getRule(id)` — 단건 조회
- `listRules(indexId, versionId)` — 목록 조회

## 에러 타입

| 에러 | 설명 |
|------|------|
| `PolicyRuleNotFoundError` | 존재하지 않는 규칙 ID |
| `PolicyRuleAlreadyExistsError` | 동일 ID의 규칙이 이미 존재 |
| `ValidationError` | pattern 길이와 shape 불일치 |

## 저장소 어댑터

| 어댑터 | 설명 | 용도 |
|--------|------|------|
| `SqlPolicyRuleStore` | SQLite 기반 영속 | 운영 (SQLITE_PATH) |
| `InMemoryPolicyRuleStore` | 메모리 기반 | 테스트, SQLITE_PATH=:memory: |
