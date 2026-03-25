---
def:
  id: trace-spec
  scope: data
  aspect: domain_data
  depth: specification
  lifecycle: approved
  tags: [tier-infra]
  links:
    - target: session-spec
      type: depends_on
---
# Trace + TraceStore

## 목적 ^purpose

trace_id 단위 메타데이터 집계와 reconstruction 상태 관리.

## 상태

implemented

## TraceStore 포트

```typescript
interface TraceStore {
  upsert(params: TraceUpsert): Promise<void>;
  findById(traceId: string): Promise<StoredTrace | null>;
  findUnreconstructed(limit?: number): Promise<StoredTrace[]>;
  markReconstructed(traceId: string): Promise<void>;
}
```

## 동작

### upsert
- 동일 `traceId` 가 이미 존재하면 `recordCount` 누적, `firstTimestamp`/`lastTimestamp` min/max 갱신
- 새 trace 면 insert
- `sessionId`, `serviceName`은 첫 insert 시 설정, 이후 upsert에서 덮어쓰지 않음

### findUnreconstructed
- `reconstructed === false`인 trace 목록 반환
- engine의 reconstruction 스케줄러가 폴링하는 진입점
- `limit` 기본값: adapter 구현에 따라 다름 (메모리: 전체, Drizzle: 100)

### markReconstructed
- 해당 trace의 `reconstructed` 를 `true`로 갱신
- engine이 reconstruction 완료 후 호출

## StoredTrace 구조

```typescript
interface StoredTrace {
  traceId: string;
  sessionId: string | null;
  serviceName: string | null;
  recordCount: number;
  firstTimestamp: Date | null;
  lastTimestamp: Date | null;
  reconstructed: boolean;
  createdAt: Date;
  updatedAt: Date;
}
```

## 제약 조건

- `traceId`는 PK (전역 유일)
- `sessionId`는 `qa_sessions` FK (nullable — session 없는 trace 가능)
- `recordCount`는 upsert마다 누적되므로 동시 쓰기 시 race condition 주의 (현재 단일 writer 가정)
