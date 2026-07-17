---
def:
  id: api-impact-analyzer-roadmap
  type: knowledge
  knowledge_kind: guide
  tier: layout
  level: leaf
  scope: flow
  aspect: process_flow
  depth: overview
  lifecycle: draft
  layer: operation
  tags: [structural, roadmap, testing, architecture]
  links:
    - target: skill-arch-governance
      type: depends_on
    - target: quality-gates-system
      type: traces_to
    - target: api-impact-analyzer-contract-and-evidence
      type: refs
    - target: api-impact-analyzer-graph-reachability
      type: refs
    - target: api-impact-analyzer-operations-and-gates
      type: refs
  sources:
    - scripts/api-impact-analyzer.ts
    - scripts/api-impact-collector.ts
    - scripts/api-impact-model.ts
    - scripts/api-impact-sources.ts
    - scripts/api-impact-ast.ts
    - scripts/api-impact-diff.ts
    - scripts/api-impact-consumers.ts
    - scripts/api-impact-policy.ts
    - scripts/api-impact-baseline.ts
    - scripts/api-impact-analyzer.test.ts
    - scripts/endpoint-mapper.ts
    - scripts/oa-spec-resolver.ts
    - scripts/ai-feedback-loop.ts
    - package.json
    - packages/definition-service/src/modules/graph/graph.service.ts
    - simulations/enterprise-pm/services/pm-api/src/pm/project/presentation/http/project.controller.ts
    - simulations/enterprise-pm/services/audit-browser-api/src/graph-explorer/presentation/bff/graph-catalog.controller.ts
---

# API Impact Analyzer Roadmap

## 목적 ^purpose

`arch:impact`의 보수적 경고를 유지하면서, 경고가 실제 의존성·실행 경로·소비자 근거를 보여주도록 개선한다. 현재 analyzer는 `GraphService` 변경을 프로젝트 API 4개와 연결했지만, 컨트롤러의 문자열 포함 여부만 확인했기 때문에 이번 변경의 실제 영향으로 판정할 수 없었다. 이 로드맵은 경고를 줄이는 것이 아니라 **후보와 확인된 영향의 의미를 분리하고, 각 판정의 증거를 추적 가능하게 만드는 순서**를 정한다.

## 현재 판정 ^overview

AST 도입 전 baseline에서 관찰된 4개 후보는 다음처럼 기록한다.

| 항목                           | 판정                      | 처리                             |
| ------------------------------ | ------------------------- | -------------------------------- |
| `GET /audit/graphs/catalog`    | `heuristic / unconfirmed` | 이번 변경의 API 회귀로 보지 않음 |
| `POST /projects`               | `heuristic / unconfirmed` | API 테스트 확장 대상 아님        |
| `GET /users/{userId}/projects` | `heuristic / unconfirmed` | API 테스트 확장 대상 아님        |
| `GET /projects`                | `heuristic / unconfirmed` | API 테스트 확장 대상 아님        |

이 표는 회귀 비교를 위한 historical baseline이다. 현재 analyzer는 AST import/DI와 route method body를 함께 확인하므로, 같은 `GraphService.validate()` 변경에서 `affectedApis: []`를 반환한다. 구조적 연결을 확인할 수 없는 문자열 후보는 숨기지 않고 `heuristic / unconfirmed`로 남긴다.

## Phase 0 진행 상태 ^status

- [x] `AI-001` source profile을 repo-relative 기본값과 환경 변수 override로 분리
- [x] `AI-002` 문자열 fallback을 `heuristic / unconfirmed`로 분류
- [x] `AI-003` finding/evidence 모델과 JSON 출력 연결
- [x] `AI-004` use-case/query/port/adapter/module provider suffix fallback coverage
- [x] `AI-010` Graph false-positive 및 direct controller fixture 4건 추가
- [x] consumer text 검색 결과를 API별로 cache하여 반복 비용 억제
- [x] `AI-005` operation/profile-aware endpoint identity와 AST route mapping
- [x] `AI-006` AST import/constructor DI graph 도입
- [x] `AI-007` changed symbol 및 method reachability 도입
- [x] `AI-008` operationId·HTTP method/path·text-path consumer evidence 분리
- [x] `AI-009` advisory 기본값과 confidence/baseline/strict 정책 옵션 도입
- [x] `AI-011` known fixture precision/recall baseline 및 `arch:feedback` 연결

## 기록된 개선 지점 ^findings

아래 표는 구현 전 audit에서 기록한 문제와 영향이다. 현재 해결 상태는 위의 체크리스트와 아래 검증 결과가 authoritative source다.

| ID       | 우선순위 | 당시 문제                                                                                                                                                      | 영향                                                                                                |
| -------- | -------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| `AI-001` | P0       | OpenAPI source directory에 절대 경로가 하드코딩되고 구현 검색 범위가 simulation으로 고정되어 있다.                                                             | 다른 checkout, CI, 서비스 workspace에서 결과가 누락되거나 실행되지 않는다.                          |
| `AI-002` | P0       | 간접 영향은 변경 파일명에서 `Graph`를 만든 뒤 컨트롤러 전체에 문자열이 포함되는지만 확인한다.                                                                  | `delegationGraph` 같은 route/method 이름이 `GraphService` DI로 오인되어 false positive가 발생한다.  |
| `AI-003` | P0       | 결과 모델에 confidence, matched symbol, matched import/DI edge, call path가 없다.                                                                              | 후보 경고와 실제 영향의 차이를 사람이 다시 소스 전체에서 수동 추적해야 한다.                        |
| `AI-005` | P1       | endpoint mapping이 줄 단위 decorator parser와 `Map<method path, site>`에 의존한다. operationId, 서비스 식별자, 중복 route, 복잡한 decorator를 보존하지 않는다. | 같은 route가 여러 서비스에 있거나 route 표기만 다른 경우 구현 매핑이 덮어써질 수 있다.              |
| `AI-006` | P1       | controller → dependency 관계를 import/constructor injection이 아니라 raw source substring으로 추정한다.                                                        | 실제 GraphService가 아닌 `GraphCatalogBff`와 프로젝트의 `delegationGraph`가 같은 원인으로 보고된다. |
| `AI-007` | P2       | 메서드 단위 도달성을 계산하지 않는다. `GraphService.validate()` 변경과 GraphService의 다른 runtime method를 구분하지 않는다.                                   | 변경된 동작과 무관한 API가 동일한 영향 후보로 묶인다.                                               |
| `AI-008` | P2       | downstream consumer는 HTTP method나 operationId가 아닌 URL path 문자열 grep 결과다.                                                                            | 시나리오가 실제 client 호출을 수행하는지 확인할 수 없다.                                            |
| `AI-009` | P2       | 현재 출력은 `potentially affected`라는 단일 문구만 제공하고, JSON도 `affectedApis` 배열만 제공한다.                                                            | advisory warning, review-required, gate-blocking의 운영 의미를 구분하기 어렵다.                     |

## 설계 원칙 ^constraints

1. **보수성은 후보 생성에서 유지한다.** 근거가 약한 관계를 바로 버리지 않고 `heuristic`으로 남긴다.
2. **확정성은 별도 상태로 표현한다.** `candidate`는 `confirmed` 또는 `unconfirmed`와 혼용하지 않는다.
3. **모든 승격에는 증거가 필요하다.** import, constructor DI, method call, endpoint mapping 중 어떤 연결이 판정에 기여했는지 출력한다.
4. **workspace 범위를 명시한다.** API spec, 구현 root, 소비자 root는 설정으로 주입하고 서비스 ID를 endpoint identity에 포함한다.
5. **현재 advisory를 조기에 gate로 승격하지 않는다.** fixture 기준 precision과 주요 false-negative 검증이 닫힌 뒤에만 CI 정책을 추가한다.
6. **변경된 메서드와 endpoint의 실행 경로를 우선한다.** 파일 단위 영향은 마지막 fallback으로만 사용한다.

## 목표와 단계 ^roadmap

현재의 문자열 중심 결과를 다음 단계로 확장한다.

```text
changed symbol -> dependency evidence -> endpoint impact -> consumer evidence
```

| 단계      | 문서                                                     | 범위                                                         |
| --------- | -------------------------------------------------------- | ------------------------------------------------------------ |
| Phase 0~1 | [계약과 근거](./phase-0-contract-and-evidence.md)        | source profile, finding model, fixture, confidence           |
| Phase 2~3 | [그래프와 도달성](./phase-1-graph-and-reachability.md)   | AST DI graph, endpoint identity, changed method reachability |
| Phase 4~5 | [consumer와 운영 gate](./phase-2-consumers-and-gates.md) | operation-aware consumer, baseline, advisory/gate 정책       |

### 우선순위

| 우선순위 | 작업                                                                                                         |
| -------- | ------------------------------------------------------------------------------------------------------------ |
| P0       | `AI-001` source profile, `AI-003` finding/evidence 계약, `AI-010` fixture                                    |
| P1       | `AI-002` fallback 강등, `AI-004` provider suffix coverage, `AI-005` endpoint identity, `AI-006` AST DI graph |
| P2       | `AI-007` changed symbol/reachability, `AI-008` consumer mapping, `AI-009` 운영 정책                          |
| P3       | `AI-011` precision/recall baseline 및 feedback loop 연결                                                     |

한 작업 단위는 한 phase의 한 항목만 닫는다. baseline 수치는 보존하되, 현재 실행 결과와 historical 후보를 같은 상태로 표시하지 않는다.

## 공통 검증 ^validation

```bash
corepack pnpm arch:impact -- --json
corepack pnpm arch:impact:baseline -- --json
corepack pnpm arch:feedback
corepack pnpm def:check
git diff --check
```

`arch:impact`가 0개를 출력하는 것만으로 성공을 선언하지 않는다. fixture의 positive/negative 결과와 실제 변경 사례 결과를 함께 확인한다.

## 비목표 ^non_goals

- 현재 4개 경고를 근거 없이 삭제하거나 무조건 영향 없음으로 하향하는 것
- TypeScript 전체 프로그램의 완전한 정적 call graph를 첫 단계에서 구현하는 것
- API schema, implementation, consumer의 소유권을 analyzer가 새로 갖는 것
- analyzer 결과만으로 API 계약 변경을 자동 승인하거나 merge를 수행하는 것. `arch:feedback`은 confirmed impact를 review gate로 알리지만, 실제 CI/merge 정책은 별도 결정으로 둔다.

## 다음 실행 단위

현재 로드맵의 구현 단위는 완료되었다. baseline은 confirmed impact 기준으로 측정하고, heuristic 후보는 warning으로 별도 보존한다. `arch:feedback`은 analyzer를 `--strict`로 실행해 confirmed direct/di/transitive를 review gate로 알리며, 실제 CI/merge blocking 승격은 별도 운영 결정으로 남긴다.
