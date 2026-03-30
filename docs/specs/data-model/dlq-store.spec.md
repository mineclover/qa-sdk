---
def:
  id: dlq-store-spec
  address: def_document:v2:343173
  scope: data
  aspect: system_data
  depth: specification
  svc: ingest-server
  lifecycle: approved
  layer: domain
  tags: [observability, data, persistence]
  links:
    - target: trace-spec
      type: depends_on
---

# DlqStore

## 목적 ^purpose

reconstruction / verdict 후처리 실패를 적재하는 dead-letter queue 포트 계약.

## 구성 ^overview

- **DlqPhase 2종**: reconstruction(재구성 실패)과 verdict(판정 실패) 단계 구분
- **DlqStore 포트 4종**: insert(pending 생성), findPending(미해결 조회), markAttempted(재시도 카운트 증가), markResolved(해결 완료 처리)
- **생명주기**: 생성(attemptCount=0) → 재시도(attemptCount 증가 + lastAttemptedAt 갱신) → 해결(resolvedAt 설정, findPending에서 제외)
- **제약**: DLQ 항목 1개 = trace 1개 대응, 재시도 정책과 최대 시도 횟수 관리는 상위 계층 책임

## 상태

implemented

## 타입

```typescript
type DlqPhase = "reconstruction" | "verdict";

interface DlqInsert {
  id: string;
  traceId: string;
  phase: DlqPhase;
  errorMessage: string;
}

interface StoredDlqItem extends DlqInsert {
  attemptCount: number;
  lastAttemptedAt: Date | null;
  createdAt: Date;
  resolvedAt: Date | null;
}
```

## DlqStore 포트

```typescript
interface DlqStore {
  insert(params: DlqInsert): Promise<void>;
  findPending(limit?: number): Promise<StoredDlqItem[]>;
  markAttempted(id: string): Promise<void>;
  markResolved(id: string): Promise<void>;
}
```

## 동작

### insert

- 새 pending DLQ 항목을 생성한다.
- `attemptCount`는 `0`, `lastAttemptedAt`은 `null`, `createdAt`은 현재 시각, `resolvedAt`은 `null`로 시작한다.
- 동일 `id`가 이미 존재하면 삽입은 실패해야 한다. ID 생성에는 `newDlqId()` 사용을 권장한다.

### findPending

- `resolvedAt === null`인 항목만 반환한다.
- 오래된 `createdAt` 순으로 정렬하여 반환한다.
- `limit`를 생략하면 adapter 기본값을 사용하며, 현재 구현 기준 기본값은 `100`이다.

### markAttempted

- 해당 DLQ 항목의 `attemptCount`를 1 증가시킨다.
- `lastAttemptedAt`을 현재 시각으로 갱신한다.
- 존재하지 않는 `id`에 대해서는 no-op이다.

### markResolved

- 해당 DLQ 항목의 `resolvedAt`을 현재 시각으로 설정한다.
- resolved 항목은 이후 `findPending()` 결과에서 제외된다.
- 존재하지 않는 `id`에 대해서는 no-op이다.

## 제약 조건

- `phase`는 `"reconstruction"` 또는 `"verdict"`만 허용한다.
- `traceId`는 재처리 대상 trace를 가리키며, DLQ 항목 하나는 정확히 하나의 trace에 대응한다.
- `errorMessage`는 마지막 실패 원인의 사람이 읽을 수 있는 요약 문자열이다.
- `markResolved()`를 다시 호출하면 기존 `resolvedAt`이 새 시각으로 덮어써질 수 있다. 재시도 정책과 최대 시도 횟수 관리는 상위 계층 책임이다.
