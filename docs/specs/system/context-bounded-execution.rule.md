---
def:
  id: context-bounded-execution
  type: spec
  tier: system
  level: leaf
  scope: feature
  aspect: func_def
  depth: specification
  lifecycle: draft
  layer: operation
  tags: [architecture, context, contract, testing, observability]
  links:
    - target: context-bounded-execution-cases
      type: traces_to
    - target: context-bounded-execution-todo
      type: traces_to
    - target: platform-context-spec
      type: depends_on
    - target: work-lifecycle
      type: depends_on
    - target: responsibility-closure-harness
      type: depends_on
---

# Context-Bounded Execution — 최상위 실행 불변 원칙

## 목적 ^purpose

하나의 Task가 필요한 정보를 무한히 누적하거나 임의로 잘라 쓰지 않고, 탐색과 실제 작업을 분리된 컨텍스트·경로·예산으로 실행하도록 제약한다.

## 핵심 원칙 ^constraint

1. Task는 하나의 판단, 외부 Commit, 승인 또는 분석 경계 안에서 완결 가능한 크기로 정의한다.
2. Discovery Context는 필요한 정보의 위치·경로·비용을 찾는 데만 사용한다.
3. Working Context는 선택된 경로에서 해소된 authoritative Fact, Policy, Revision, Evidence만 사용한다.
4. Discovery 예산은 Working 예약량을 침범할 수 없다.
5. Discovery 결과 전체를 Working Context로 복사하지 않는다. 선택된 Route와 Manifest만 전달한다.
6. 필수 Fact의 ResolutionRoute, Authority, Freshness가 없으면 Working Closure를 닫지 않는다.
7. 예산 초과는 임의 삭제가 아니라 탐색 종료, Task 분해, 에스컬레이션 또는 fail-closed로 처리한다.
8. Task 간 연속성은 대화 기록이 아니라 Typed Handoff와 원본 Evidence Reference로 유지한다.

## 두 컨텍스트 ^defines

| 항목 | Discovery Context | Working Context |
|------|------------------|-----------------|
| 질문 | 무엇을 어디서 확인해야 하는가 | 지금 무엇을 판단·실행해야 하는가 |
| 허용 표현 | map, summary, pointer, candidate | resolved fact, policy, revision, evidence |
| Route | `DiscoveryRoute` | `ResolutionRoute` |
| 신뢰도 | 후보·요약·불확실성 허용 | Authority/Freshness 충족 필수 |
| 기본 예산 | 최대 100K tokens | 최소 100K tokens 예약 |
| 산출물 | 선택 Route, unresolved question, manifest | decision/commit/verification 입력 |

Discovery Context의 내용은 Working Context의 사실을 대체하지 않는다. 예를 들어 `order.inventory`가 후보 경로로 발견되었다는 사실은 재고가 확보되었다는 Fact가 아니다.

## 예산 규칙 ^budget

실행 프로파일은 최소 다음 정책을 선언한다.

```yaml
context_budget:
  discovery_max_tokens: 100000
  working_reserve_tokens: 100000
  system_reserve_tokens: <profile-defined>
  output_reserve_tokens: <profile-defined>
  borrow_work_reserve: false
```

Core contract는 tokens에 종속되지 않도록 objects, relations, bytes, route expansions, latency 같은 표현 중립 지표를 함께 기록한다. 실제 token 계산은 model/runtime adapter가 담당한다.

## 경로 규칙 ^route

### DiscoveryRoute

DiscoveryRoute는 anchor에서 Context Map과 후보 정보로 이동한다. 반환값은 다음 중 하나다.

- 관련 문서·노드·서비스의 요약
- 후보 Relation Path
- authority/freshness/cost 메타데이터
- 해소가 필요한 Fact의 식별자
- 원본을 읽기 위한 pointer

DiscoveryRoute는 그 자체로 실행 Fact를 충족시키지 않는다.

### ResolutionRoute

ResolutionRoute는 Working Context에 들어갈 정확한 Fact를 해소한다.

- 선언된 Relation Path만 사용한다.
- maxDepth, maxFanOut, cyclePolicy를 가진다.
- source authority와 revision을 보존한다.
- freshness requirement를 검사한다.
- cross-domain 조회는 query port와 anti-corruption adapter를 사용한다.

임의 graph search나 모델의 자유로운 외부 탐색 결과는 ResolutionRoute가 아니다.

## 실행 전이 ^workflow

```text
Task Intent
  → Discovery Plan
  → Route Selection Freeze
  → Working Context Compile
  → Decision / Commit
  → Verification Context Rebuild
  → Typed Handoff
```

Discovery가 종료되면 선택된 Route를 freeze한다. Working Context는 Discovery Context를 복사하지 않고 freeze된 Route에서 다시 해소한다.

## Closure 판정 ^closure

- `discovery-closed`: 작업에 필요한 정보를 찾을 수 있는 Route와 비용이 확보됨
- `working-closed`: 판단·실행에 필요한 Fact, Policy, Revision, Evidence가 해소됨
- `verification-closed`: 예상 상태 변화와 실제 결과 Evidence를 대조할 수 있음

세 상태는 하나의 boolean으로 합치지 않는다. `discovery-closed`여도 `working-closed`가 아니면 실행할 수 없다.

## 소유권 경계 ^boundary

- source system은 업무 상태·payload·local ID의 authority다.
- federation layer는 SourceRef, ConnectionRef, mapping, cross-domain query seam을 소유한다.
- definition-catalog은 문서 구조와 책임 지도를 소유한다.
- decision-flow는 결정 경로와 결정 이력을 소유한다.
- context-runtime은 선택·해소 계획과 envelope/manifest/handoff를 소유한다.
- `address_context`는 관측 의미 좌표이며 Working Context 본문이 아니다.

## Release checklist ^validation

- [ ] Discovery와 Working 예산이 분리되어 있는가
- [ ] Working 예약량이 Discovery에서 borrow 불가능한가
- [ ] 모든 필수 Fact에 ResolutionRoute가 있는가
- [ ] Route마다 depth/fan-out/cycle 정책이 있는가
- [ ] Fact별 authority/revision/freshness가 있는가
- [ ] Discovery 요약이 실행 Fact로 잘못 승격되지 않는가
- [ ] 동일 snapshot + manifest로 계획을 재현할 수 있는가
- [ ] overflow 시 분해·중단·에스컬레이션 정책이 있는가
- [ ] Handoff가 대화 전문이 아닌 typed reference인가
