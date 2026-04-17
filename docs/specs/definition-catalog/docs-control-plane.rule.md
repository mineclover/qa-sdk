---
def:
  id: docs-control-plane-rule
  level: leaf
  scope: constraint
  aspect: tech_constraint
  depth: specification
  lifecycle: approved
  layer: mediation
  svc: cli
  tags: [structural, contract, testing]
  links:
    - target: docs-control-plane
      type: refines
    - target: doc-type-convention
      type: depends_on
---

# Docs Control Plane — 문서 바운더리 소비 규칙

## 목적 ^purpose

`qa-sdk docs` control plane에서 문서 family, TODO, PRD, source-map, graph result를 작성하거나 소비할 때 적용할 바운더리 판별 기준을 정의한다. 목표는 문서 모듈화를 임의 주제나 오래된 파일 순서가 아니라 Entity-like identity, Component-like data, System-like transform 분리 원칙에 맞춰 반복 가능하게 유지하는 것이다.

## Entity / Component / System-Informed Boundary Rule ^defines

Docs control plane의 문서 모듈화는 architecture-neutral한 Entity / Component / System 분리 원칙을 기준점으로 삼는다. 이는 ECS 전용 문서 구조가 아니다. ECS는 이 분리 원칙을 잘 보여주는 하나의 아키텍처일 뿐이며, docs control plane은 임의의 도메인 문서와 운영 command를 같은 방식으로 모델링할 수 있어야 한다.

| Separation role | Docs control-plane 대응 | 문서화 규칙 |
|-----------------|-------------------------|-------------|
| Entity-like identity | `def.id`, `stableId`, `familyId`, source path, PRD story id, artifact id | 안정 식별자다. 상태와 행위를 넣지 않는다. |
| Component-like data | frontmatter, `DocumentEnvelope`, links, sources, tasks, evidence, role coverage, follow-up records, completed-record candidates | data-only read model이다. 숨은 mutation이나 실행 로직을 넣지 않는다. |
| System-like transform | `def validate`, `docs status`, `docs graph`, `docs drift`, `docs prd context`, `docs prd sync-completion`, graph reranking/filtering/summary | Component-like data를 읽고 변환하는 명시적 로직이다. 원본 문서 상태를 암묵적으로 소유하지 않는다. |

## Boundary Checklist

새 문서 family나 PRD를 만들 때는 아래 순서로 판단한다.

1. **Identity** — 이 family가 소유할 stable id와 좌표가 무엇인지 먼저 정한다.
2. **Component data** — 이 family가 정의하거나 소비하는 data-only 선언, metadata, source refs, evidence refs를 분리한다.
3. **System transform** — 이 family가 실행하거나 설명하는 검증, 투영, 동기화, ranking, filtering, scaffold, validate 같은 변환 경계를 정한다.
4. **Owned output** — command output이나 read model이 원본 상태인지, projection/candidate인지 명시한다.
5. **Non-goal** — activation, write, archive, promotion, resolver mutation처럼 다른 system이 소유한 행위를 현재 family에 섞지 않는다.

## Authoring Rules

- 새 module/family는 가능하면 System-like transform boundary를 기준으로 잡는다. 예: graph traversal, graph reranking, PRD completion sync, pack scaffold, pack validate.
- System-like 문서는 자신이 소비하는 Component-like data와 산출하는 read model을 명시해야 한다.
- Component-like 문서는 data shape와 lifecycle만 정의하고, 검증/투영/동기화/CLI 실행 로직을 소유하지 않는다.
- Entity-like id는 문서, source-map, PRD, artifact 전반에서 stable coordinate로 유지한다.
- TODO와 PRD는 System-like boundary를 기준으로 작성한다. 단순 파일 오래됨, 검색 결과, 임의 주제 묶음은 우선순위 기준이 아니다.
- Read-only command output(`roleCoverage`, `nextFollowUps`, `completedRecords`, graph ranking/filtered views)은 후보와 projection이며, 원본 문서를 자동 변경하는 authority가 아니다.

## TODO Heading Rules

- Checkbox state는 binary다. `[ ]`는 open, `[x]`/`[X]`는 completed이다.
- 실행 상태는 checkbox marker가 아니라 heading category가 표현한다.
- Canonical heading은 `Completed — 완료 기록`, `Actionable — 실행 가능`, `Deferred — 조건부 대기`, `Parking Lot — 후보 보관`이다.
- `Actionable`은 지금 PRD화 가능한 System-like work만 둔다.
- `Deferred`는 trigger condition이나 외부 boundary가 필요한 작업을 둔다.
- `Parking Lot`은 owner, scope, 실행 조건이 아직 확정되지 않은 후보만 둔다.

## PRD And Drift Rules

- PRD markdown은 authoring/review artifact이고, ralph PRD JSON은 execution state다.
- `passes: true`는 completion candidate signal일 뿐이며 TODO/spec promotion authority가 아니다.
- 완료된 PRD JSON과 markdown PRD 체크박스는 drift 없이 동기화해야 한다.
- `.ralph-tui/session-meta.json`은 transient local session state다. 기본 drift/completion 판단에는 포함하지 않고 `--include-session`에서만 본다.
- Archive PRD, archived doc, completed record candidate는 정확한 target이나 opt-in 없이 active inventory로 승격하지 않는다.

## Graph Result Rules

- Graph traversal은 retrieval phase다. Ranking/filtering/summary는 traversal 이후 result consumption phase다.
- Raw traversal fields(`nodes`, `edges`, `paths`)는 graph truth로 보존한다.
- Ranked/filtered/summary view는 additive projection이다.
- Rule-based reranking은 operator convenience이며, LLM/vector semantic reranking이 아니다.
- `--axis`는 traversal axis 선택이고, `--filter-axis`는 post-traversal view filtering이다.
