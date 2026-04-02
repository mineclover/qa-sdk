---
def:
  id: pipe-store-memory
  level: leaf
  scope: data
  aspect: system_data
  depth: implementation
  lifecycle: approved
  layer: operation
  links:
    - target: pipe-store
      type: depends_on
---

# PipeGraph / PipeSpec 인메모리 저장소

## 목적 ^purpose

PipeGraphStore / PipeSpecStore 포트의 인메모리 어댑터.
테스트, 단기 실행, 의존성 주입 기본값으로 사용.

## 정의 ^defines

- `MemoryPipeGraphStore` — Map 기반 PipeGraphStore
- `MemoryPipeSpecStore` — Map 기반 PipeSpecStore

## 관련 소스

- `packages/core/src/pipe-store.ts` — 포트 + 어댑터 구현
- `packages/core/src/pipe-store.test.ts` — 9 tests

## 저장 구조

```
Map<graphId, Map<version, PipeGraph>>   // PipeGraphStore
Map<pipeId,  Map<version, PipeSpec>>    // PipeSpecStore
```

`getLatest`: 버전 문자열 사전순 최대값. `listAll`: 각 ID의 최신 버전만 반환.

## 검증

```bash
pnpm --filter @qa-sdk/core test -- src/pipe-store.test.ts
```
