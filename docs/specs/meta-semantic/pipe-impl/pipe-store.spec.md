---
def:
  id: pipe-store
  level: leaf
  scope: data
  aspect: system_data
  depth: implementation
  lifecycle: draft
  layer: operation
  links:
    - target: meta-semantic-pipe-impl
      type: depends_on
    - target: pipe-types
      type: depends_on
---

# PipeGraph / PipeSpec 저장소

## 목적 ^purpose

PipeGraph와 PipeSpec의 CRUD 포트 인터페이스 + 인메모리 어댑터.
기존 qa-sdk 포트 패턴(RecordStore, ScenarioSpecStore)과 동일 구조.

## 관련 소스

- `packages/core/src/pipe-store.ts` — 포트 + 인메모리 어댑터
- `packages/core/src/pipe-infra.test.ts` — 저장소 테스트 9케이스

## 포트: PipeGraphStore

```typescript
save(graph): void
get(graphId, version): PipeGraph | null
getLatest(graphId): PipeGraph | null
listVersions(graphId): PipeGraph[]
listAll(): PipeGraph[]            // 최신 버전만
remove(graphId, version): boolean
findByPipeId(pipeId): PipeGraph[]
findByTriggerEvent(eventKey): PipeGraph[]
```

## 포트: PipeSpecStore

```typescript
save(spec): void
get(pipeId, version): PipeSpec | null
getLatest(pipeId): PipeSpec | null
listAll(): PipeSpec[]
remove(pipeId, version): boolean
```

## 검증

```bash
pnpm --filter @qa-sdk/core test -- src/pipe-infra.test.ts
```
