---
def:
  id: query-api
  address: def_document:v2:412823
  scope: interface
  aspect: api_contract
  depth: specification
  lifecycle: approved
  layer: mediation
  svc: query-service
  tags: []
  links:
    - target: query-rules
      type: depends_on
    - target: gate-api
      type: depends_on
---
# Query Service REST API

## 목적 ^purpose

좌표 질의를 수행하는 REST 엔드포인트. resolve(단일 해소), match-ranges(범위 매칭), compose-query(복합 질의), query-across-versions(버전 횡단), resolve-relation(관계 해소)를 제공한다.

## 구성 ^overview

- **POST /resolve** — coord + rules + shape → 정책 해소 (gate 합성 옵션 포함).
- **POST /match-ranges** — partial entity 조건 → 주소 범위 매칭 (gate 필터 옵션).
- **POST /compose-query** — source index → through → target 복합 질의.
- **POST /query-across-versions** — 동일 index의 여러 version에 걸쳐 constraint 질의.
- **POST /resolve-relation** — 관계형 타입/인스턴스 규칙 2계층 해소.
- Gate 통합: `withGate` 플래그 또는 `gateMode` 파라미터로 gate 필터 적용.

## 엔드포인트 상세

### POST /resolve

좌표에 대해 PatternRule 기반 정책을 해소한다.

| 필드 | 타입 | 필수 | 설명 |
|------|------|------|------|
| `coord` | `number[]` | O | 해소할 좌표 |
| `rules` | `PatternRule[]` | O | 정책 규칙 배열 (id, pattern, value, priority) |
| `shape` | `number[]` | O | 인덱스 shape |
| `strategy` | `ConflictStrategy` | - | most-specific, priority, collect, first-match |
| `indexId` | `string` | - | gate 통합 시 index ID |
| `versionId` | `string` | - | gate 통합 시 version ID |
| `withGate` | `boolean` | - | true 시 gate 상태를 합성하여 GateAwareResult 반환 |

### POST /match-ranges

partial entity 조건으로 주소 범위를 매칭한다.

| 필드 | 타입 | 필수 | 설명 |
|------|------|------|------|
| `indexId` | `string` | O | 대상 index ID |
| `versionId` | `string` | O | 대상 version ID |
| `partial` | `Record<string, EntityId \| null>` | O | dim별 필터 조건 (null=전체) |
| `gateMode` | `string \| null` | - | gate 필터 모드 |

**응답:** `[number, number][]` — 주소 범위 배열

### POST /compose-query

source index에서 through 관계를 거쳐 target으로 복합 질의한다.

| 필드 | 타입 | 필수 | 설명 |
|------|------|------|------|
| `source` | `{ indexId, versionId }` | O | 출발 인덱스 |
| `through` | `string` | O | 관통 관계 |
| `targetConstraint` | `Record<string, EntityId \| null>` | O | 도착 조건 |

### POST /query-across-versions

동일 index의 여러 version에 걸쳐 constraint를 적용한다.

| 필드 | 타입 | 필수 | 설명 |
|------|------|------|------|
| `indexId` | `string` | O | 대상 index ID |
| `versionIds` | `string[]` | O | 질의할 version ID 목록 |
| `constraint` | `Record<string, EntityId \| null>` | O | dim별 필터 조건 |

**응답:** `Record<string, [number, number][]>` — version별 주소 범위 맵

### POST /resolve-relation

관계형 타입 규칙 → 인스턴스 규칙 2계층 정책을 해소한다.

| 필드 | 타입 | 필수 | 설명 |
|------|------|------|------|
| `relTypeCoord` | `number[]` | O | 관계 타입 좌표 |
| `relShape` | `number[]` | O | 관계 타입 shape |
| `typeRules` | `RelationTypeRule[]` | O | 타입 레벨 규칙 (effect + instanceRules 중첩) |
| `typeStrategy` | `ConflictStrategy` | - | 타입 레벨 충돌 전략 |
| `instanceCoord` | `number[]` | - | 인스턴스 레벨 좌표 |

## 환경 변수

| 변수 | 기본값 | 설명 |
|------|--------|------|
| `PORT` | `3500` | 서비스 포트 |
| `SQLITE_DRIVER` | `node` | SQLite 드라이버 (node / better) |
| `SQLITE_PATH` | `data/query-service.sqlite` | PolicyRuleStore SQLite 경로 |
| `GATE_SERVICE_URL` | - | gate-service URL (gate 통합 시 필수) |
| `QUERY_DEFAULT_STRATEGY` | `most-specific` | 기본 충돌 해소 전략 |
| `QUERY_GATE_FAILURE_MODE` | `fail-open` | gate 호출 실패 시 동작 (fail-open / fail-closed) |
