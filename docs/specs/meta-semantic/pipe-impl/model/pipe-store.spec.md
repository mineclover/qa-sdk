---
def:
  id: pipe-store
  type: design
  tier: system
  owner_system: meta-semantic-system
  projection_plane: intent
  intent_hierarchy: core
  scope: data
  aspect: system_data
  depth: implementation
  lifecycle: approved
  layer: operation
  links:
    - target: meta-semantic-pipe-impl
      type: depends_on
    - target: pipe-types
      type: contains
    - target: pipe-store-memory
      type: contains
    - target: pipe-store-sqlite
      type: contains
  source: packages/core/src/pipe/pipe-store.ts
---

# PipeGraph / PipeSpec 저장소

## 목적 ^purpose

PipeGraph와 PipeSpec의 CRUD 포트 인터페이스를 정의하고,
두 가지 어댑터(인메모리, SQLite)로 구현한다.

## 방법 ^method

포트 인터페이스(PipeGraphStore, PipeSpecStore)를 `@qa-sdk/core`에 선언하고,
소비자가 어댑터를 선택하여 주입한다.

- **인메모리 (Memory)**: 테스트 및 단기 실행용 — `@qa-sdk/core`에 내장
- **SQLite (영속)**: 장기 보관 및 CLI 워크플로우용 — `pipe-store-sqlite` 패키지

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

## 위임 ^delegates

- **pipe-store-memory** → 인메모리 어댑터 (`@qa-sdk/core`)
- **pipe-store-sqlite** → SQLite 어댑터 (`pipe-store-sqlite` 패키지)
