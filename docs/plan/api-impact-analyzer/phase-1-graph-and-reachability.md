---
def:
  id: api-impact-analyzer-graph-reachability
  type: knowledge
  knowledge_kind: guide
  tier: component
  level: leaf
  scope: flow
  aspect: process_flow
  depth: specification
  lifecycle: draft
  layer: operation
  tags: [structural, roadmap, architecture]
  links:
    - target: api-impact-analyzer-roadmap
      type: refines
  sources:
    - scripts/api-impact-analyzer.ts
    - scripts/api-impact-collector.ts
    - scripts/api-impact-ast.ts
    - scripts/api-impact-diff.ts
    - scripts/api-impact-baseline.ts
    - scripts/endpoint-mapper.ts
    - packages/definition-service/src/modules/graph/graph.service.ts
    - simulations/enterprise-pm/services/pm-api/src/pm/project/presentation/http/project.controller.ts
    - simulations/enterprise-pm/services/audit-browser-api/src/graph-explorer/presentation/bff/graph-catalog.controller.ts
---

# API Impact Analyzer — 그래프와 도달성

## 목적 ^purpose

문자열 포함 검사를 실제 TypeScript import, Nest constructor DI, 제한된 method call 관계로 교체해 endpoint가 변경된 코드에 구조적으로 연결되는지 판정한다.

## Phase 2 — AST endpoint와 DI graph

1. 기존 TypeScript toolchain으로 import, class declaration, constructor parameter, Nest `@Inject()`를 추출한다.
2. controller → injected provider → service/repository/adapter edge를 파일 경로와 symbol 기준으로 저장한다.
3. `GraphCatalogBff`와 `GraphService`, `delegationGraph`와 `GraphService`를 서로 다른 node로 유지한다.
4. endpoint mapping은 decorator의 다음 줄에 있는 method 이름에 의존하지 않고 controller metadata와 OpenAPI `operationId`를 보존한다.
5. `Map<method path, site>`를 service/operation 단위 identity로 교체한다.

### 종료 조건

- 프로젝트 API 3개와 audit catalog API에 `GraphService` DI edge가 없다는 것이 evidence로 표시된다.
- 실제 DI fixture는 `di` confidence를 얻는다.
- 동일한 method/path가 다른 service에 있어도 mapping이 덮어써지지 않는다.

## Phase 3 — 변경 심볼과 도달성

1. `git diff` line range와 AST를 결합해 변경된 class/method/export symbol을 추출한다.
2. controller entry point에서 provider method 호출까지 제한된 call reachability를 계산한다.
3. 전체 언어 수준 call graph는 목표로 삼지 않고 Nest DI와 명시적 method call 범위부터 닫는다.
4. `GraphService.validate()`, `impact()`, `concerns()`를 별도 symbol로 관리한다.
5. 도달성 계산이 불가능하면 `heuristic` fallback으로 남기고 no-impact로 단정하지 않는다.

### 파일 분류 보완

AST 연결을 확인할 수 없는 경우에도 service/repository/entity뿐 아니라 use-case/query/command/port/adapter/module/handler 계열 변경을 heuristic fallback 대상에 포함한다. 이름 suffix는 공통 class token으로 정규화하고, 승격은 계속 구조적 evidence가 있을 때만 허용한다.

### 종료 조건

- unrelated public method 변경은 endpoint finding을 만들지 않는다.
- reachable method 변경은 `transitive` evidence로 표시된다.
- 도달성 실패는 후보를 숨기지 않고 낮은 confidence로 남긴다.

## 비목표

- 첫 단계에서 TypeScript 전체 프로그램의 완전한 call graph 구현
- DI가 없는 동적 runtime reflection을 완전하게 추론
- analyzer가 controller/provider의 소유권을 새로 정의

## 검증

```bash
corepack pnpm exec vitest run scripts/api-impact-analyzer.test.ts scripts/endpoint-mapper.test.ts
corepack pnpm arch:impact -- --json
corepack pnpm arch:feedback
```
