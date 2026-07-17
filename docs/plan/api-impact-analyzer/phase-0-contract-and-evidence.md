---
def:
  id: api-impact-analyzer-contract-and-evidence
  type: knowledge
  knowledge_kind: guide
  tier: component
  level: leaf
  scope: flow
  aspect: process_flow
  depth: specification
  lifecycle: draft
  layer: operation
  tags: [structural, roadmap, testing]
  links:
    - target: api-impact-analyzer-roadmap
      type: refines
  sources:
    - scripts/api-impact-analyzer.ts
    - scripts/api-impact-collector.ts
    - scripts/api-impact-model.ts
    - scripts/api-impact-sources.ts
    - scripts/api-impact-policy.ts
    - scripts/api-impact-baseline.ts
    - scripts/api-impact-analyzer.test.ts
    - scripts/endpoint-mapper.ts
    - scripts/oa-spec-resolver.ts
    - packages/definition-service/src/modules/graph/graph.service.ts
---

# API Impact Analyzer — 계약과 근거

## 목적 ^purpose

analyzer의 입력 범위, 결과 의미, confidence를 먼저 고정해 이후 AST 도입이 기존 경고의 의미를 조용히 바꾸지 않도록 한다.

## 문제

- OpenAPI root에 개발자 로컬 절대 경로가 있다.
- 구현 검색이 `simulations/enterprise-pm/services`에 고정되어 있다.
- 간접 영향이 파일명에서 만든 `Graph` 문자열과 컨트롤러 전체 문자열 포함 여부로 판정된다.
- JSON 결과가 `affectedApis`만 제공해 근거와 신뢰도를 보존하지 않는다.
- analyzer 전용 positive/negative fixture가 없다.

## 계약

```ts
type ImpactConfidence = 'direct' | 'di' | 'transitive' | 'heuristic';
type ImpactStatus = 'confirmed' | 'candidate' | 'unconfirmed';

interface ApiImpactFinding {
  serviceId: string;
  operationId?: string;
  method: string;
  path: string;
  changedFile: string;
  changedSymbols: string[];
  status: ImpactStatus;
  confidence: ImpactConfidence;
  evidence: Array<{
    kind: 'controller' | 'import' | 'di' | 'call' | 'consumer' | 'fallback';
    serviceId?: string;
    filePath: string;
    symbol?: string;
    lineNumber?: number;
    detail: string;
  }>;
}
```

`confirmed`는 영향이 반드시 발생한다는 뜻이 아니라, 구조적 근거를 확보했다는 뜻이다. 파일명 또는 raw text만으로는 `heuristic / unconfirmed`를 넘지 못한다.

## 실행 작업

1. `AI-001`: source profile을 설정화한다. spec root, implementation root, consumer root, service ID를 profile로 묶고 기본값은 repo-relative path로 둔다.
2. `AI-003`: human-readable 출력과 `--json` 출력이 같은 finding model을 사용하게 한다.
3. `AI-010`: 다음 fixture를 추가한다.
   - `GraphService.validate()` 변경과 프로젝트 controller의 `delegationGraph` 이름만 있는 경우: negative
   - `GraphCatalogBff`만 주입하는 graph catalog controller: negative
   - 실제 service를 constructor DI하는 controller: positive
   - controller 자체 변경: direct positive
   - 같은 이름의 unrelated class: negative
4. `AI-002`: 기존 substring 규칙은 제거하지 않고 `fallback` evidence로 강등한다.

## 종료 조건

- 절대 경로 없이 root와 CI에서 동일한 fixture를 실행한다.
- 현재 Graph 4개 후보가 `confirmed`로 승격되지 않는다.
- 모든 finding에 `status`, `confidence`, 최소 한 개의 evidence가 있다.
- 기존 보수적 후보가 조용히 사라지지 않고 snapshot 차이로 확인된다.

## 검증

```bash
corepack pnpm exec vitest run scripts/api-impact-analyzer.test.ts
corepack pnpm arch:impact:baseline -- --json
corepack pnpm arch:impact -- --json
git diff --check
```
