---
name: def-boundary
description: "definition-catalog 바운더리 조회와 구조화. 문서/컨텍스트 바운더리의 direct 구조, coupling, boundary-context를 읽고 scope/aspect로 정렬한다."
---

# Definition Catalog — Boundary

문서 그래프를 파일 묶음이 아니라 바운더리와 결합으로 읽는다.
문서 경계를 새로 정의하거나, provider 순서와 state/interaction 분리를 안정화할 때 사용한다.

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
  `qa-sdk def link ...`

## boundary 문서 표준

| 대상 | 권장 좌표 |
|------|-----------|
| boundary overview | `flow/relation` 또는 boundary를 대표하는 `feature/func_def` |
| provider 선언/조립 순서 | `flow/process_flow` |
| runtime 상태 전이 | `state/app_state` |
| 사용자 반응 규칙 | `ui/interaction` |
| 세부 구현 | `feature/func_def` |
| 검증 시나리오 | `feature/scenario` + `depth: validation` |

## 결합 표현 규칙

- `contains`
  소속과 boundary 묶음을 표현한다.
- `depends_on`
  다른 boundary 없이는 동작할 수 없는 의존을 표현한다.
- `constrains`
  provider 순서처럼 반드시 먼저 와야 하는 제약을 표현한다.
- `refines`
  boundary overview에서 state/interaction/implementation 세부로 내려간다.

## direct 와 transitive

- `direct`
  boundary 주변의 직접 관계만 본다. 구현 계획과 문서 정리에 먼저 쓴다.
- `transitive`
  그래프 전파 결과까지 본다. 영향 범위, concern 확산, review 범위 판단에 쓴다.

`boundary`는 direct 구조 조회이고, `boundary-context`는 boundary 위에 concern/impact/feedback를 얹은 복합 조회다.

## 보완 순서

boundary가 흐리거나 결합이 과하면 다음 순서로 정리한다.

1. boundary overview 문서에 structural purpose만 남긴다.
2. provider 순서를 `flow/process_flow`로 분리한다.
3. 상태 전이를 `state/app_state`로 분리한다.
4. interaction을 `ui/interaction`으로 분리한다.
5. 세부 로직은 implementation/validation leaf로 내린다.

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
