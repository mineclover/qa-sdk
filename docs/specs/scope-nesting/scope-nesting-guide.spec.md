---
def:
  id: scope-nesting-guide
  scope: feature
  aspect: func_def
  depth: specification
  lifecycle: approved
  layer: domain
  tags: [structural, testing]
  links:
    - target: scope-nesting-system
      type: refines
    - target: ms-concept-contract-descent
      type: implements
    - target: ms-concept-boundary
      type: implements
---

# Scope Nesting 가이드

## 목적 ^purpose

`validateScopeNesting()`과 `resolveContracts()` API의 사용법을 고정한다.

## 정의 ^defines

- **ScopeContract** — scope가 소유하는 계약 선언 (provides/consumes)
- **ScopeNesting** — scope 중첩 순서 (외부→내부, index 0 = 최외부)
- **계약 하향 규칙** — 하위가 소비하는 계약의 제공자가 반드시 상위(조상)에 존재해야 한다

## 소비 ^consumes

- `validateScopeNesting()` — 계약 하향 정합성 검증 (`@qa-sdk/core`)
- `resolveContracts()` — scope 관점 계약 해결 결과 조회 (`@qa-sdk/core`)
- `checkSwapSafety()` — 스코프 순서 교환 안전성 검사 (`@qa-sdk/core`)

## 기본 사용법

```typescript
import { validateScopeNesting, type ScopeNesting } from "@qa-sdk/core";

const nesting: ScopeNesting = {
  nestingId: "my-app",
  scopes: [
    { scopeId: "bridge", provides: [{ contractId: "logging", type: "logging" }], consumes: [] },
    { scopeId: "context", provides: [{ contractId: "state", type: "state" }], consumes: [{ contractId: "logging", type: "logging" }] },
    { scopeId: "handlers", provides: [], consumes: [{ contractId: "state", type: "state" }] },
  ],
};

const result = validateScopeNesting(nesting);
// result.valid === true → 계약 하향 성립
// result.descentPaths → 계약별 provider→consumer 경로
// result.issues → error/warning 목록
```

## handlers PipeSpec 연결

scope-nesting은 구조 검증 (정적). handlers 내부 비즈니스 흐름은 PipeSpec simulate로 검증 (동적).

```typescript
// 1단계: 구조 검증
const nestingResult = validateScopeNesting(nesting);
assert(nestingResult.valid);

// 2단계: 흐름 검증 (handlers 내부만)
const simResult = simulate({ graph: handlerGraph, initialEvent: { eventKey: "form_submit" } });
assert(simResult.status === "complete");
```

## 관련 소스

| 파일 | 역할 |
|------|------|
| `core/src/scope-nesting.ts` | 타입 + guard + validate + resolve |
| `core/src/scope-nesting.test.ts` | 32건 |
