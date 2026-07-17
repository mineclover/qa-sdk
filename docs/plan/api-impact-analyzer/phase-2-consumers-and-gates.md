---
def:
  id: api-impact-analyzer-operations-and-gates
  type: knowledge
  knowledge_kind: guide
  tier: component
  level: leaf
  scope: flow
  aspect: process_flow
  depth: specification
  lifecycle: draft
  layer: operation
  tags: [structural, roadmap, testing, quality-gate]
  links:
    - target: api-impact-analyzer-roadmap
      type: refines
    - target: quality-gates-system
      type: traces_to
  sources:
    - scripts/api-impact-analyzer.ts
    - scripts/api-impact-collector.ts
    - scripts/api-impact-consumers.ts
    - scripts/api-impact-policy.ts
    - scripts/api-impact-baseline.ts
    - scripts/api-impact-analyzer.test.ts
    - scripts/ai-feedback-loop.ts
    - package.json
    - simulations/enterprise-pm/scenarios/src
---

# API Impact Analyzer — consumer와 운영 gate

## 목적 ^purpose

downstream consumer를 URL 문자열 검색에서 실제 operation 소비 근거로 확장하고, confidence를 review와 CI 정책에 안전하게 연결한다.

## Phase 4 — consumer와 workspace 정합성

### 현재 구현 상태

- `operation-id`: 주석이 아닌 TypeScript 식별자에 OpenAPI operationId가 사용된 경우 구조적 consumer evidence로 기록한다.
- `http-call`: `Request`/`fetch`/`fetchImpl`의 HTTP method와 route template이 일치하는 경우 기록한다.
- `text-path`: 위 두 근거가 없을 때만 path 표기를 보조 후보로 기록한다.
- consumer 경로는 source profile의 서비스 경계 안에서 cache하며, 결과에는 match 유형과 위치를 함께 남긴다.

1. scenario/client 코드에서 operationId 또는 typed-client operation token, HTTP method/path 호출을 우선 추출한다.
2. 단순 URL grep은 제거하지 않고 `text-path` evidence로 별도 표시한다.
3. 외부 `oa-sdk` spec과 qa-sdk simulation spec을 source profile로 분리한다.
4. 모든 finding과 consumer evidence에 `serviceId`를 포함한다.
5. route template, path parameter, version prefix 정규화를 fixture로 고정한다.

### 종료 조건

consumer 출력이 “경로 문자열이 존재함”과 “해당 operation을 호출함”을 구분한다. 서로 다른 service의 같은 path가 하나의 consumer로 합쳐지지 않는다.

## Phase 5 — 운영 정책과 gate 승격

### 현재 구현 상태

- 기본 실행은 advisory이며, `--format json`/`--json`으로 동일 finding model을 출력한다.
- `--confidence <level>`은 지정 confidence 이상만 보여준다.
- `--baseline <file>`은 같은 `serviceId|api|changedFile|changedSymbols` finding을 제외한다.
- `--strict`는 `confirmed`이면서 `direct`/`di`/`transitive`인 finding이 있을 때만 종료 코드 1을 반환한다.
- `heuristic`, `candidate`, `unconfirmed`는 strict gate를 막지 않는다.
- `arch:impact:baseline`은 negative heuristic 후보를 보존하면서 confirmed impact precision/recall을 측정한다.
- `arch:feedback`는 별도의 6단계 운영 루프에서 analyzer regression test와 `--strict` API impact gate를 함께 실행한다. advisory 결과만 확인할 때는 `arch:impact`를 사용한다.

1. `--format json`, `--confidence`, `--strict`, `--baseline` 옵션을 정의한다.
2. 기본 모드는 모든 후보를 출력하는 advisory로 유지한다.
3. `confirmed direct/di/transitive`만 review-required 후보로 승격한다.
4. `heuristic` 후보는 gate를 막지 않지만, report에서 숨기지 않는다.
5. precision/recall fixture와 false-positive baseline을 `arch:feedback`에 연결한다.
6. 품질 기준을 만족한 뒤에만 API impact를 CI blocking gate로 승격한다.

### 종료 조건

- gate가 confidence를 근거로 동작한다.
- false positive 증가가 fixture 회귀에서 검출된다.
- historical 4개 Graph 후보는 `heuristic / unconfirmed` baseline으로 보존되고, 현재 동일 변경은 no-impact로 판정된다.
- analyzer 결과만으로 API 계약 변경을 자동 승인하지 않는다.

## 우선순위

| 순서 | 작업                                      | 완료 기준                             |
| ---: | ----------------------------------------- | ------------------------------------- |
|    1 | `AI-008` operation-aware consumer mapping | 실제 operation 호출과 text match 분리 |
|    2 | `AI-009` advisory/review/gate 정책        | confidence 기반 report와 gate         |
|    3 | `AI-011` precision/recall baseline        | known fixture와 실제 변경 사례 비교   |

## 검증

```bash
corepack pnpm arch:impact -- --json
corepack pnpm arch:impact:baseline -- --json
corepack pnpm arch:feedback
corepack pnpm def:check
git diff --check
```
