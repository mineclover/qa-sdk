---
def:
  tier: component
  id: viteplus-playbook-boundary-coupling
  scope: constraint
  aspect: tech_constraint
  depth: specification
  lifecycle: approved
  layer: experience
  svc: viteplus-sdk-smoke
  tags: [frontend, structural]
  links:
    - target: viteplus-sdk-smoke-system
      type: refines
    - target: viteplus-playbook-boundary-relation
      type: refines
    - target: definition-mgmt-graph-links
      type: depends_on
sources:
  - docs/specs/system/context-action-convention.rule.md
  - packages/viteplus-sdk-smoke/src/context-action-contract.ts
  - packages/viteplus-sdk-smoke/src/context-action-contract.test.ts
  - packages/definition-catalog/src/assemble.test.ts
  - packages/definition-catalog/src/cli-tools-real.test.ts
---

# Vite+ Playbook Boundary Coupling 규칙

## 목적 ^purpose

boundary 간 결합을 어떤 링크 타입으로 표현하는지, boundary overview 문서에 무엇을 적고 무엇을 위임하는지 규칙을 고정한다.

## 정의 ^defines

- **결합 표현 4종** — contains(묶음/소속), depends_on(의존), constrains(순서 강제), refines(상세화)
- **boundary overview 표준** — purpose에는 존재 이유만, overview에는 구조 목적만, 세부는 위임
- **boundary 조회 3단계** — 구조 조회(purpose/overview), 결합 조회(direct links), 세부 조회(leaf)

## 소비 ^consumes

- `LinkType` 규칙 — contains/depends_on/constrains/refines (`definition-mgmt-graph-links`)

## 결합 표현 규칙

- `contains`
  boundary 묶음과 소속을 표현한다.
- `depends_on`
  한 boundary가 다른 boundary 없이 동작할 수 없을 때 사용한다.
- `constrains`
  provider/composition 순서처럼 "반드시 먼저 와야 함"을 표현한다.
- `refines`
  boundary overview에서 개별 app_state, interaction, implementation 문서로 내려갈 때 사용한다.

## boundary overview 표준

- boundary overview 문서는 세부 business logic를 적지 않는다.
- `## 목적 ^purpose`에는 "이 boundary가 왜 존재하는가"만 적는다.
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
