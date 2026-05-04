---
name: def-boundary
description: "definition-catalog 바운더리 조회와 구조화. 문서/컨텍스트 바운더리의 direct 구조, coupling, boundary-context를 읽고 scope/aspect로 정렬한다."
---

# Definition Catalog — Boundary

문서 그래프를 파일 묶음이 아니라 바운더리와 결합으로 읽는다.
문서 경계를 새로 정의하거나, E/C/I/S + L/P 책임 분리를 안정화할 때 사용한다.

## 권장 순서

먼저 local datasource를 맞춘다.

```bash
qa-sdk def sync
qa-sdk def boundary <문서ID>
qa-sdk def boundary-context <문서ID> --mode direct
qa-sdk def boundary-context <문서ID> --mode transitive
qa-sdk def body <문서ID>
```

- `def boundary`
  direct structural view. purpose/overview, contains 멤버, direct coupling만 본다.
- `def boundary-context --mode direct`
  지금 작업 단위의 concern/impact를 one-hop 기준으로 본다.
- `def boundary-context --mode transitive`
  inherited concern과 확장 blast radius까지 본다.
- `def body`
  purpose/context 요약만으로 부족할 때 최신 본문 전체를 직접 읽는다.

## 언제 무엇을 쓰는가

- 구조만 정리하고 싶다
  `qa-sdk def boundary <문서ID>`
- 현재 boundary 작업 범위만 보고 싶다
  `qa-sdk def boundary-context <문서ID> --mode direct`
- 전이 영향까지 리뷰하고 싶다
  `qa-sdk def boundary-context <문서ID> --mode transitive`
- 문서 경계가 코드 파일과 어디서 만나는지 보고 싶다
  `qa-sdk def find-by-file <파일경로[:symbol]>`  # DB에 explicit code reference가 있을 때만 결과 반환
- 상위 그룹에서 내려오고 싶다
  `qa-sdk def topdown <그룹ID>`
- 링크 누락을 메우고 싶다
  `def-link` skill 참조 또는 frontmatter `links:` 직접 편집 (전용 CLI 없음)

## boundary 문서 표준

| 대상 | 권장 좌표 |
|------|-----------|
| System behavior boundary | `flow/process_flow` 또는 `feature/func_def` |
| Interface / DSL contract | `interface/api_contract`, `interface/cli_contract`, `interface/event_contract` |
| Component data/state/evidence | `data/*`, `state/*`, `constraint/tech_constraint` |
| Entry / Identity | `data/domain_data` 또는 identity-specific component |
| Layout / Pack view | `tier: layout` + `refs` |
| 검증 시나리오 | `feature/scenario` + `depth: validation` |

canonical 패턴 사례:

- `nest-service-kit` (`docs/specs/system/nest-service-kit.spec.md`) — `tier: layout` + `owner_system: nest-service-kit` + `refs`로 bootstrap/envelope/port-contract 카탈로그.
- `scaffold-system` (`docs/specs/scaffold/scaffold-system.spec.md`) — `tier: layout` + `owner_system: scaffold` + `refs`로 schematic/template/validator 묶음.

추가 frontmatter 옵션 (선택): `owner_system`(소유 도메인), `projection_plane`(D-20 자동 추론), `intent_hierarchy`(layer 분류). 상세는 `packages/definition-catalog/src/frontmatter.ts`.

## 결합 표현 규칙

- `contains`
  소속과 boundary 묶음을 표현한다.
- `depends_on`
  다른 boundary 없이는 동작할 수 없는 의존을 표현한다.
- `constrains`
  provider 순서처럼 반드시 먼저 와야 하는 제약을 표현한다.
- `refines`
  boundary overview에서 state/interaction/implementation 세부로 내려간다.

`@def.boundary` 코드 주석 타깃 제약:

- 타깃 문서는 반드시 `tier: system` 또는 `tier: layout` 이어야 한다.
- `tier: component` / `tier: entry` / `interface/api_contract` spec은 금지.
- 위반 시 validator가 `invalid-code-boundary` 에러로 차단한다.
- 근거: `docs/specs/system/link-type-usage.rule.md` §1.2 / §2 (Phase 5e).

방향 sanity check:

- 종단 문서가 부모/상위 문서를 `contains`로 가리키면 거의 항상 방향 오류다.
- 이런 경우는 먼저 E/C/I/S + L/P 책임과 link 방향을 재판정하고, 필요하면 `refines` 또는 `depends_on`로 낮춘다.
- `level=leaf인데 contains 자식` 경고는 보조 메타데이터 신호다. 실제 분해 여부는 System/Interface/Component/Entry/Layout 책임이 섞였는지로 판단한다.

## direct 와 transitive

- `direct`
  boundary 주변의 직접 관계만 본다. 구현 계획과 문서 정리에 먼저 쓴다.
- `transitive`
  그래프 전파 결과까지 본다. 영향 범위, concern 확산, review 범위 판단에 쓴다.

`boundary`는 direct 구조 조회이고, `boundary-context`는 boundary 위에 concern/impact/feedback를 얹은 복합 조회다.

## 보완 순서

boundary가 흐리거나 결합이 과하면 다음 순서로 정리한다.

1. System boundary 문서에 behavior/runtime ownership만 남긴다.
2. 호출/소비 계약은 Interface / DSL 문서로 분리한다.
3. data/state/evidence vocabulary는 Component 문서로 분리한다.
4. 안정 ID/finite value는 Entry / Identity 문서로 분리한다.
5. 여러 System/Interface를 조망하는 문서는 Layout / Pack으로 두고 `refs`만 사용한다.
6. 세부 behavior는 BDD contract와 implementation/test source boundary로 닫는다.
7. 다중 부모가 의도적 공유라면 `cross-scope` 태그를 추가하고, 비의도적이면 하나의 `contains`를 `depends_on`/`refs`로 낮춘다.

## API surface

CLI 외에도 같은 개념을 쓸 수 있다.

```text
REST     GET /docs/:docId/boundary
REST     GET /graph/:docId/boundary-context
GraphQL  boundary(docId, level)
GraphQL  boundaryContext(docId, level, mode)
GraphQL  doc(id) { boundary boundaryContext }
```

## 판단 원칙 (meta-semantic 기반)

> 상세: `ms-concept-boundary`, `ms-concept-contract-descent` 참조

**바운더리 = 패싯 중 일부가 존재하는 검증 가능한 기능 단위.**

문서 그래프에서 바운더리를 식별할 때:
- 이 문서 그룹에 어떤 패싯(생산·소비·정의·관리·저장)이 존재하는가?
- 서로 다른 패싯 조합이 섞여 있으면 바운더리가 불분명한 신호
- 바운더리 내부는 블랙박스, 외부에는 계약(interface)만 노출

바운더리 간 관계:
- 상위-하위: 계약이 내려가고 트랜잭션이 올라감
- 동등 수준(peer): 각자 소비할 API 계약만 앎
- 공유 데이터: 공통 상위 바운더리가 관리

## 주의사항

- boundary overview에는 세부 business logic를 적지 않는다.
- `direct`와 `transitive`를 섞어 읽으면 blast radius 판단이 흔들린다.
- GraphQL lazy field `doc { boundaryContext }`는 기본적으로 `overview/transitive`다.
- `def find-by-file`는 `qa-sdk def sync`로 적재된 `code_references`만 사용한다.
- code reference 입력은 문서 frontmatter `source:`와 코드 주석 `@def.boundary[#symbol]`, `@def.doc[#symbol]`이다.
- explicit mapping이 없는 파일에는 결과를 주지 않는다. ranking fallback을 신뢰하지 않는다.
