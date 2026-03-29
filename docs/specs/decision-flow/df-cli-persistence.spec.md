---
def:
  id: df-cli-persistence
  address: def_document:v2:413826
  scope: interface
  aspect: cli_contract
  depth: specification
  lifecycle: approved
  layer: mediation
  svc: cli
  tags: [decision, persistence]
  links:
    - target: df-state-model
      type: depends_on
    - target: df-system
      type: implements
---
# CLI SQLite 영속

## 목적 ^purpose

FlowInstance를 `~/.qa-sdk/decision-flow.sqlite`에 저장하여 CLI 세션 간 상태를 유지한다. WAL 모드 + busy_timeout으로 동시 접근 안전. active 인스턴스 복원, verdict 영속, 마이그레이션 포함.

## 구성 ^overview

- **SqliteInstanceStore**: InstanceStore 인터페이스의 SQLite 구현 (CLI 전용)
- **영속 범위**: active/completed 인스턴스 + verdict + address_context
- **동시 접근**: WAL 모드 + busy_timeout 3초 — 여러 CLI 프로세스 동시 사용 가능
- **마이그레이션**: 기존 DB에 verdict 컬럼 없으면 자동 추가
- **JSON 안전**: safeJsonParse로 손상 행 크래시 방지
- **라이브러리 순수성**: decision-flow 패키지는 SQLite 의존 없음. 영속은 CLI의 책임

## InstanceStore 인터페이스 ^interface

`decision-flow` 패키지의 `instance-store.ts`가 순수 인터페이스를 정의한다.

```typescript
interface InstanceStore {
  save(instance: FlowInstance): void;
  findBySchema(schemaId: string): FlowInstance[];
  findByContext(query: InstanceContextQuery): FlowInstance[];
  findByTimeRange(query: InstanceTimeRangeQuery): FlowInstance[];
}
```

- `MemoryInstanceStore` — 인메모리 구현. 테스트/라이브러리 용도
- `SqliteInstanceStore` — SQLite 구현. 독립 패키지 (`packages/decision-flow-store/src/store.ts`)
- FlowEngine 생성 시 `{ instanceStore }` 옵션으로 주입. 플로우 완료 시 자동 `save()` 호출

## 스키마 (DDL) ^schema

```sql
CREATE TABLE IF NOT EXISTS flow_instances (
  id              TEXT NOT NULL PRIMARY KEY,
  schema_id       TEXT NOT NULL,
  schema_version  TEXT NOT NULL,
  status          TEXT NOT NULL,
  context         TEXT NOT NULL DEFAULT '{}',
  selections      TEXT NOT NULL DEFAULT '[]',
  outcome         TEXT,
  address         INTEGER,
  address_context TEXT,
  verdict         TEXT,
  started_at      TEXT NOT NULL,
  completed_at    TEXT,
  created_at      TEXT NOT NULL DEFAULT (datetime('now'))
);
```

- 인덱스: `idx_fi_schema`(schema_id), `idx_fi_status`(status), `idx_fi_started`(started_at)
- `context`, `selections`, `address_context`, `verdict`는 JSON 문자열로 저장
- `address`는 좌표 인코딩 결과 (INTEGER). 미인코딩 시 NULL

## 초기화 + 마이그레이션 ^init

- 저장 위치: `~/.qa-sdk/decision-flow.sqlite`
- 디렉터리가 없으면 `mkdirSync({ recursive: true })`로 자동 생성
- `PRAGMA journal_mode = WAL` — 읽기/쓰기 동시 가능
- `PRAGMA busy_timeout = 3000` — 다른 프로세스 잠금 시 3초 대기
- `migrate()`: `ALTER TABLE flow_instances ADD COLUMN verdict TEXT` — 기존 DB 호환. 이미 존재하면 예외 무시

## 조회 API ^query-api

SqliteInstanceStore는 InstanceStore 기본 메서드 외에 CLI 전용 확장 메서드를 제공한다.

- `search(keyword)` — context LIKE 또는 schema_id LIKE 검색 (최대 50건)
- `recent(limit, schemaId?)` — 최신 N건 조회 (최신순 정렬)
- `findById(id)` — 단건 조회
- `findActive()` — `status = 'active'`인 인스턴스 목록 (세션 간 복원용)
- `stats()` — 총 건수, 완료/진행 중/스키마 수 통계
- `findByContext(query)` — `json_extract(context, '$.key')` 활용 JSON 필드 검색

## 세션 간 복원 흐름 ^restore

CLI 시작 시 `ensureInit()`에서 실행되는 복원 절차:

1. `store.findActive()` — SQLite에서 `status = 'active'`인 인스턴스 조회
2. 각 인스턴스의 스키마가 엔진에 등록되어 있는지 확인
3. 스키마 버전 불일치 시 경고 + 스킵
4. `engine.loadInstance(inst)` — 엔진 인메모리에 복원하여 `selectBranch()` 이어서 진행 가능
5. 복원 실패 시 경고만 출력하고 나머지 인스턴스는 계속 복원 (fail-open)

## JSON 안전 ^json-safety

```typescript
function safeJsonParse<T>(json: string, fallback: T): T {
  try { return JSON.parse(json) as T; }
  catch { console.warn(`[flow-sqlite] JSON 파싱 실패`); return fallback; }
}
```

- `context` 파싱 실패 → `{}` (빈 객체)
- `selections` 파싱 실패 → `[]` (빈 배열)
- `verdict`, `address_context` 파싱 실패 → `undefined`
- DB 손상이 CLI 크래시를 유발하지 않도록 방어
