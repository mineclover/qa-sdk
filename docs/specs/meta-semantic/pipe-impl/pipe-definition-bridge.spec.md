---
def:
  id: pipe-definition-bridge
  type: design
  tier: component
  owner_system: meta-semantic-system
  projection_plane: intent
  intent_hierarchy: core
  scope: feature
  aspect: func_def
  depth: implementation
  lifecycle: approved
  layer: mediation
  links:
    - target: meta-semantic-pipe-impl
      type: depends_on
  source: packages/core/src/pipe/pipe-definition-bridge.ts
---

# PipeGraph ↔ Definition Catalog 브릿지

## 목적 ^purpose

PipeSpec의 scope/aspect를 definition-catalog의 lifecycle/layer/tags와 연결한다.
definition-catalog 패키지에 직접 의존하지 않고 DefinitionLookup 포트를 통해 소비자가 주입.

## 정의 ^defines

- `DefinitionLookup` — definition 조회 포트 (findByCoordinate, getById)
- `DefinitionMeta` — docId, lifecycle, layer?, tags?
- `resolveLifecycles(graph, lookup)` → 파이프별 lifecycle 조회
- `analyzeLayerPropagation(graph, lookup)` → layer 영향 전파 분석 (canPropagate: canonical impact.ts와 동일)
- `resolveTags(graph, lookup)` → 파이프별 tags 조회
- `PipeBindingInfo` — 파이프별 DataObjectBinding 해석 결과
- `resolveBindings(graph, registry)` → 파이프별 binding 조회

## 소비 ^consumes

- `PipeGraph`, `PipeSpec` (pipe-spec.ts)
- DefLifecycle, DefLayer 타입 (definition-catalog 호환, 자체 정의)

## 브릿지 패턴

```
PipeSpec.scope × PipeSpec.aspect
  → DefinitionLookup.findByCoordinate(scope, aspect)
    → DefinitionMeta { lifecycle, layer, tags }
```

definition-catalog에 직접 의존하지 않으므로:
- core 패키지가 definition-catalog를 import하지 않음
- 소비자(CLI, 서비스)가 DefinitionLookup 구현을 주입
- 타입은 호환되도록 자체 정의 (DefLifecycle, DefLayer)

## layer 전파 규칙

```
domain → domain, operation, mediation, experience (모든 곳)
operation → operation (자기만)
mediation → mediation, experience
experience → experience (자기만)
```

## 관련 소스

| 파일 | 역할 |
|------|------|
| `core/src/pipe/pipe-definition-bridge.ts` | 구현 |
| `core/src/pipe/pipe-definition-bridge.test.ts` | 테스트 (5 tests) |

## 검증

```bash
pnpm --filter @qa-sdk/core test -- src/pipe/pipe-definition-bridge.test.ts
```
