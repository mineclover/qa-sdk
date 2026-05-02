---
def:
  id: pm-taxonomy
  type: spec
  tier: component
  scope: data
  aspect: domain_data
  depth: overview
  lifecycle: approved
  layer: domain
  tags: [cross-scope, structural, entry-point]
  links:
    - target: taxonomy-boundaries
      type: traces_to
    - target: status-crosswalk
      type: traces_to
    - target: df-taxonomy
      type: traces_to
    - target: definition-taxonomy
      type: traces_to
    - target: structural-taxonomy
      type: traces_to
---

# PM Taxonomy — delivery 상태 관리 분류 체계

## 목적 ^purpose

delivery 중심 프로젝트 관리를 위한 상태 관리 taxonomy를 정의한다. 이 taxonomy는 definition taxonomy나 decision-flow taxonomy를 병합하지 않고, "무엇을 누가 언제 어떤 증거로 끝낼 것인가"를 관리하기 위한 단위와 상태 축만을 소유한다.

## 구성 ^overview

- 단위 5종: initiative, epic, deliverable, task, checkpoint
- 핵심 축: owner, priority, target_window, process_status, outcome_verdict
- 보조 축: risk_profile, governance_layer, workstream_boundary
- 참조 필드: definition_refs, structural_refs, decision_refs, evidence_refs

## 정의 ^defines

### 단위 5종

| kind | 질문 | 설명 |
|---|---|---|
| initiative | 왜 하는가 | 제품/운영 결과 단위 |
| epic | 어떤 변화 서사인가 | 여러 deliverable을 묶는 변화 단위 |
| deliverable | 무엇이 검증 가능하게 끝나야 하는가 | spec/test/gate로 증명 가능한 산출물 |
| task | 지금 누가 수행하는가 | 실제 실행 단위 |
| checkpoint | 어디서 승인/검증하는가 | release, review, gate, escalation 지점 |

### 공통 필드

| 필드 | 설명 |
|---|---|
| `work_intent` | `DecisionUnit`에서 가져온 topic/objective/success_criteria |
| `governance_layer` | strategic/tactical/operational/execution |
| `workstream_boundary` | 어떤 structural boundary/runtime context를 건드리는가 |
| `process_status` | proposed/planned/active/blocked/review/verified/closed |
| `outcome_verdict` | success/failure/deferred/superseded |
| `priority` | P0/P1/P2/P3 |
| `owner` | 담당자 또는 담당 팀 |
| `target_window` | now/next/later 또는 날짜 범위 |
| `risk_profile` | reversibility, magnitude, unknowns |

## 경계 규칙 ^constraint

1. PM taxonomy는 `definition scope`를 소유하지 않는다.
2. PM taxonomy는 `runtime scope`를 소유하지 않는다.
3. PM taxonomy는 cognitive phase, mental model, forcing question을 core 축으로 편입하지 않는다.
4. PM taxonomy는 decision-flow의 `DecisionUnit`, `DecisionLayer`, `DecisionVerdict`를 재사용할 수 있지만, delivery 단위의 계층과 책임은 스스로 소유한다.
5. PM taxonomy는 프로젝트 관리 상태를 소유하지만, 문서 lifecycle·판단 상태·배포 상태를 직접 대체하지 않는다.

## 링크 규칙

- `definition_refs` → 관련 spec/rule/plan/test 문서 ID
- `structural_refs` → boundary, runtime scope, contract 관련 문서 ID
- `decision_refs` → FlowInstance, DecisionNarrative, policy candidate, escalation request
- `evidence_refs` → gate 결과, 테스트 결과, PR, 데모, 문서 검증 결과
