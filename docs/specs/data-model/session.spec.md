---
def:
  id: session-spec
  scope: data
  aspect: domain_data
  depth: specification
  lifecycle: approved
---
# QA Session + SessionStore

> qa_session_id 기반 세션 식별 — 테스트/검증 세션 단위 추적. ^purpose

## 상태

implemented

## SessionStore 포트

```typescript
interface SessionStore {
  upsert(params: SessionUpsert): Promise<void>;
  findById(sessionId: string): Promise<StoredSession | null>;
  close(sessionId: string): Promise<void>;
}
```

## 동작

### upsert
- `sessionId`가 이미 존재하면 무시 (idempotent)
- `scenarioId`, `labels`는 첫 insert 시 설정
- ingest 시점에 record의 `qa_session_id`가 있으면 자동 upsert

### close
- `closedAt` 타임스탬프 설정
- 세션이 종료되었음을 표시 (verdict 산출 트리거 가능)

## StoredSession 구조

```typescript
interface StoredSession {
  sessionId: string;        // qas_<ULID>
  scenarioId: string | null;
  labels: Record<string, string> | null;
  startedAt: Date;
  closedAt: Date | null;
}
```

## 제약 조건

- `sessionId`는 PK
- `scenarioId`는 선택적 — 나중에 verdict 산출 시 어떤 시나리오로 검증할지 결정
- `labels`는 자유 key-value — 필터링/그룹핑용
