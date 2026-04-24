---
def:
  id: skill-bdd-contract
  tier: component
  scope: feature
  aspect: func_def
  depth: specification
  lifecycle: approved
  layer: experience
  tags: [testing, contract]
  links:
    - target: automation-skill-group
      type: refines
    - target: skill-e2e-test
      type: depends_on
    - target: skill-spec-lifecycle
      type: depends_on
---

# Skill — bdd-contract

## 목적 ^purpose

BDD의 `Given / When / Then`을 qa-sdk의 행동 계약으로 정규화하고, 그 계약에서 테스트 단위와 구현 단위를 함께 도출하는 skill을 정의한다.

이 문서는 BDD contract skill의 카탈로그 entry다. 실행 정의는 `skills/bdd-contract/SKILL.md`가 소유하고, 기계화된 read-only CLI surface는 `bdd-contract-cli`가 소유한다.

## 사용 맥락 ^context

새 기능, PRD user story, `.cases.md`, `.test.md`, acceptance criteria를 실제 테스트와 구현으로 옮기기 전에 사용한다. 특히 AI agent가 임의로 production code를 만들기 전에 contract id, test unit, implementation unit을 먼저 고정해야 할 때 사용한다.

## 설계 의도 ^intent

BDD는 `e2e-test`보다 상위 계약 계층이다. `bdd-contract`는 behavior를 state/predicate/operation/result로 쪼개고, `e2e-test`는 그중 브라우저 검증이 필요한 contract를 Playwright로 옮긴다.

## 피드백 규칙 ^feedback

- BDD contract 없이 production code를 작성하려는 작업은 계약 보강 대상으로 본다.
- 하나의 scenario에 여러 primary `When`이 있으면 scenario split 후보로 본다.
- 테스트 단위와 구현 단위가 같은 contract id를 공유하지 않으면 drift 후보로 본다.
- 구현 단위가 owner system 경계를 넘으면 escalation 또는 별도 contract가 필요하다.

## 관련 소스

- `skills/bdd-contract/SKILL.md`
- `docs/specs/bdd-system/bdd-contract-system.spec.md`
- `docs/specs/bdd-system/bdd-contract-cli.spec.md`
- `docs/specs/bdd-system/bdd-contract-cli.rule.md`
- `packages/cli/src/commands/docs.ts`
- `packages/cli/src/lib/docs-control-plane/bdd-contract-extract.ts`
- `docs/proposals/ai-dlc-dspy-harness/04-bdd-contract-model.md`
