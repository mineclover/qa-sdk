---
def:
  id: decision-definition-bridge
  address: def_document:v2:138368
  scope: flow
  aspect: relation
  depth: specification
  lifecycle: approved
  layer: domain
  tags: [cross-scope, decision, entry-point]
  links:
    - target: df-system
      type: depends_on
    - target: definition-service-system
      type: depends_on
    - target: definition-system-philosophy
      type: refines
    - target: dual-coordinate-system
      type: refines
---
# Decision ↔ Definition 브릿지

## 목적 ^purpose

decision-flow(왜 이렇게 결정했는가)와 definition-catalog(무엇을 정의하는가)를 연결한다. 의사결정이 문서를 만들고, 문서가 다음 의사결정의 컨텍스트가 되는 순환 구조를 정의한다.

## 핵심 관계 ^overview

### 의사결정이 문서를 만든다

소프트웨어 정의 문서는 자연 발생하지 않는다. 누군가 "이것을 이렇게 하겠다"고 결정한 결과물이다.

```
의사결정 과정 (decision-flow)
  FlowSchema: scope-expansion
  Gate 1: "기존에 뭐가 있나?" → ContextProvider.lookup()
  Gate 2: "확장할까 보류할까?" → expand / defer
  Gate 3: "어떤 scope로?" → data / feature / flow / ...
  Outcome: artifactType = "schema"
  ↓
문서 생성 (definition-catalog)
  artifactType "schema" → scope: data
  verdict: approved → lifecycle: approved
  address: def_document:v1:<N>
```

이 매핑은 `definition-catalog/src/bridge.ts`에 구현되어 있다:
- `suggestScopeFromArtifact(artifactType)` → DefScope
- `suggestLifecycleFromVerdict(verdict)` → DefLifecycle
- `buildDefinitionContext(entry)` → address_context (수집 파이프라인용)

### 문서가 다음 의사결정의 컨텍스트가 된다

```
문서 (definition-catalog)
  docs: [gate-state-model, gate-flow, gate-constraint, ...]
  ↓ buildDefinitionContext()
의사결정 시작 전 (decision-flow)
  ContextProvider.provide(schemaId, {
    existingDocs: ["gate-state-model", "gate-flow"],
    scope: "feature",
    layer: "domain",
    linkedConstraints: ["gate-constraint"],
  })
  → 결정자가 기존 문서를 보고 판단
```

### 순환 구조

```
Decision → 문서 생성 → 문서가 컨텍스트 → 다음 Decision → 새 문서 → ...

                    ┌─────────────────────────┐
                    │                         │
                    ▼                         │
              Decision Flow               Definition
              (왜? 근거?)    ──artifact──▶  (무엇? 분류?)
                    │                         │
                    │     ◀──context───        │
                    │                         │
                    └─────────────────────────┘
```

### 매핑 테이블

| decision-flow 산출 | artifactType | → DefScope | 예시 문서 |
|---|---|---|---|
| 새 기능 설계 | "module", "service" | feature | gate-engine-core |
| 데이터 스키마 결정 | "schema", "axis", "prefix" | data | prefix-order_event |
| 흐름 설계 | "flow", "pipeline" | flow | decode-svc-process-flow |
| 상태 모델 결정 | "state", "model" | state | gate-state-model |
| 제약 조건 수립 | "policy", "rule" | constraint | gate-constraint |
| API 계약 합의 | "api", "contract" | interface | decode-svc-api-contract |
| UI 구성 결정 | "component", "page" | ui | motion-editor-component |

| decision-flow 판정 | verdict | → DefLifecycle |
|---|---|---|
| 승인 | approved | approved |
| 보류/추가검토 | deferred | review |
| 거부 | rejected | deprecated |
| 미결정 | — | draft |

### CLI에서 확인

```bash
# 의사결정으로 만들어진 문서 목록 (decision 태그)
qa-sdk def list --tag=decision

# 특정 문서의 의사결정 컨텍스트
qa-sdk def incoming gate-state-model
# → gate-system (contains), gate-api (depends_on), ...

# 의사결정 이력 (decision-flow CLI)
qa-sdk flow history scope-expansion
```

## 구현 위치

| 컴포넌트 | 파일 | 역할 |
|----------|------|------|
| bridge.ts | definition-catalog/src/bridge.ts | artifact→scope, verdict→lifecycle 매핑 |
| ContextProvider | decision-flow/src/context-provider.ts | 기존 문서를 의사결정 컨텍스트로 제공 |
| FlowEngine | decision-flow/src/engine.ts | 의사결정 실행, outcome 산출 |
| definition-service | PATCH /docs/:id | outcome에 따라 lifecycle 변경 |
| CLI def-new skill | Claude skill | 의사결정 결과로 새 문서 생성 |
