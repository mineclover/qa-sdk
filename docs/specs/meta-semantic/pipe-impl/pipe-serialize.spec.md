---
def:
  id: pipe-serialize
  type: design
  tier: component
  owner_system: meta-semantic-system
  projection_plane: intent
  intent_hierarchy: core
  scope: feature
  aspect: func_def
  depth: implementation
  lifecycle: approved
  layer: domain
  links:
    - target: meta-semantic-pipe-impl
      type: depends_on
    - target: pipe-types
      type: depends_on
    - target: pipe-validate
      type: depends_on
  source: packages/core/src/pipe/pipe-serialize.ts
---

# PipeSpec / PipeGraph 직렬화

## 목적 ^purpose

PipeSpec과 PipeGraph를 JSON으로 직렬화/역직렬화한다.
역직렬화 시 validatePipeSpec/validatePipeGraph로 자동 검증하여 무효 데이터 유입을 방지한다.

## 관련 소스

- `packages/core/src/pipe-serialize.ts` — serialize/deserialize 4함수
- `packages/core/src/pipe-infra.test.ts` — 직렬화 테스트 4케이스

## API

```typescript
serializePipeSpec(spec: PipeSpec): string
deserializePipeSpec(json: string): PipeSpec    // 검증 실패 시 throw
serializePipeGraph(graph: PipeGraph): string
deserializePipeGraph(json: string): PipeGraph  // 검증 실패 시 throw
```

## 검증

```bash
pnpm --filter @qa-sdk/core test -- src/pipe-infra.test.ts
```
