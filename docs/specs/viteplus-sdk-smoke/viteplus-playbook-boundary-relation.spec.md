---
def:
  id: viteplus-playbook-boundary-relation
  scope: flow
  aspect: relation
  depth: specification
  lifecycle: approved
  layer: experience
  svc: viteplus-sdk-smoke
  tags: [frontend, structural, observability]
  links:
    - target: viteplus-sdk-smoke-system
      type: refines
    - target: viteplus-playbook-template-implementation
      type: traces_to
    - target: definition-mgmt-graph-links
      type: depends_on
    - target: definition-assembly
      type: depends_on
---

# Vite+ Playbook Boundary Relation

## 목적 ^purpose

컨텍스트 바운더리 자체와 컨텍스트 간 결합을 어떤 문서 단위와 링크 타입으로 표현할지 표준화한다.

## 구성 ^overview

- boundary는 “같은 최신 상태/refs/side effect 경계를 공유하는 단위”로 본다.
- 결합은 구현 복사가 아니라 링크로 표현한다.
- 조회는 기본적으로 boundary overview의 purpose/overview만 조립하고, 세부 로직은 leaf 구현 문서에서 읽는다.

## 바운더리 단위

| 단위 | 역할 | 권장 문서 좌표 |
|------|------|----------------|
| page root | feature mount 시작점 | `flow/process_flow` |
| qa-bridge facade | session/trace/logging 경계 | `feature/func_def` |
| feature context | store/refs/persist 경계 | `feature/func_def` + `state/app_state` |
| handlers/actions | orchestration 경계 | `feature/func_def` |
| view | 입력/표현 경계 | `ui/interaction` |

## 결합 표현 규칙

- `contains`
  boundary 묶음과 소속을 표현한다.
- `depends_on`
  한 boundary가 다른 boundary 없이 동작할 수 없을 때 사용한다.
- `constrains`
  provider/composition 순서처럼 “반드시 먼저 와야 함”을 표현한다.
- `refines`
  boundary overview에서 개별 app_state, interaction, implementation 문서로 내려갈 때 사용한다.

## boundary overview 표준

- boundary overview 문서는 세부 business logic를 적지 않는다.
- `## 목적 ^purpose`에는 “이 boundary가 왜 존재하는가”만 적는다.
- `## 구성 ^overview`에는 하위 boundary와 structural 목적만 적는다.
- 검증 규칙, 상태 전이, interaction 세부는 각각 `validation`, `app_state`, `interaction` 문서로 위임한다.

## boundary 단위 조회 표준

1. **구조 조회**
   boundary overview + contains 멤버의 purpose/overview만 조립한다.
2. **결합 조회**
   direct `depends_on` + `constrains` + `refines`만 보여준다.
3. **세부 조회**
   필요할 때만 구현 문서나 validation 문서로 내려간다.

권장 조회 명령:

```bash
qa-sdk def boundary <문서ID>
qa-sdk def boundary <문서ID> --json
qa-sdk def boundary-context <문서ID>
qa-sdk def boundary-context <문서ID> --mode direct --json
```

## scope/aspect 배정 이유

- `scope: flow`
  핵심은 boundary들 사이의 연결 구조와 읽기 경로다.
- `aspect: relation`
  이 문서는 기능 구현보다 boundary 간 관계 표현 규칙을 정의한다.
