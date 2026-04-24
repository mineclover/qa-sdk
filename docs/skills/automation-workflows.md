---
name: automation-workflows
description: "automation skill 묶음 운영 가이드. bdd-contract, e2e-test, gform-parser, spec-lifecycle, event-taxonomy-gate를 어떤 순서로 쓰는지와 언제 어떤 skill을 고를지 안내한다."
---

# Automation Skill Workflows

테스트 작성, 외부 폼 파싱, 구현 후 문서 정리는 서로 다른 문제처럼 보이지만 실제로는 같은 자동화 묶음으로 자주 등장한다.

## 어떤 skill을 고를까

| 상황 | skill | 목적 |
|------|-------|------|
| Given/When/Then으로 테스트·구현 단위를 먼저 쪼개야 함 | `bdd-contract` | 행동 계약 정규화, test unit / implementation unit 도출 |
| 문서 family의 spec/rule/todo/test/cases/memo/plan 상태를 정리해야 함 | `doc-lifecycle` | 문서 유형 생성/승격/정합성 검증 |
| 시나리오 문서를 브라우저 테스트로 옮겨야 함 | `e2e-test` | Playwright E2E 작성/실행/디버깅 |
| Google Form URL에서 entry ID와 필드 구조를 뽑아야 함 | `gform-parser` | config/HTML 생성 |
| 구현 완료 후 spec 문서를 코드 참조로 정리해야 함 | `spec-lifecycle` | drift 방지 |
| 테스트 파일의 관심사가 섞였거나 너무 커짐 | `test-split` | 테스트 패싯 분리와 시나리오 구조 표준화 |
| registry event taxonomy 운영 정합성을 확인해야 함 | `event-taxonomy-gate` | adoption migrate/check/assert |

## 권장 순서

### 1. 구현 전

- 시나리오 중심 검증이 필요하면 먼저 `bdd-contract`로 contract id, test unit, implementation unit을 고정한다
- BDD block이 있으면 `qa-sdk docs bdd validate <doc-id> --family-only --json`로 먼저 read model을 확인한다
- 브라우저 검증이면 그 다음 `e2e-test`
- 외부 폼 입력을 붙여야 하면 `gform-parser`

### 2. 구현 중

- 테스트나 config 생성은 코드 변경과 함께 진행
- 문서에는 purpose/intent/constraint 중심 내용만 남기고, 타입/시그니처는 코드로 이동할 준비를 한다

### 3. 구현 완료 후

- `spec-lifecycle`로 문서 전환 조건 확인
- 소스 참조 전환
- 필요하면 `e2e-test`로 최종 사용자 흐름 검증
- registry 운영 점검이면 `event-taxonomy-gate`로 drift gate 실행

## 빠른 링크

- command entrypoint
  `qa-sdk docs bdd list <doc-id> --family-only --json`
  `qa-sdk docs bdd validate <doc-id> --family-only --json`
  `qa-sdk docs bdd units <doc-id> --family-only --json`
  `qa-sdk docs bdd compile <doc-id> --family-only --format both --json`
  `qa-sdk quality show <gate-doc-id>`
  `qa-sdk quality run <gate-doc-id> --json`
  `qa-sdk review request ...`
- catalog 문서
  `docs/specs/skill-catalog/automation-skill-group.md`
  `docs/specs/skill-catalog/automation-skill-group/skill-bdd-contract.spec.md`
  `docs/specs/skill-catalog/automation-skill-group/skill-doc-lifecycle.spec.md`
  `docs/specs/skill-catalog/automation-skill-group/skill-e2e-test.spec.md`
  `docs/specs/skill-catalog/automation-skill-group/skill-gform-parser.spec.md`
  `docs/specs/skill-catalog/automation-skill-group/skill-spec-lifecycle.spec.md`
  `docs/specs/skill-catalog/automation-skill-group/skill-test-split.spec.md`
  `docs/specs/skill-catalog/automation-skill-group/skill-event-taxonomy-gate.spec.md`

skill 파일은 구현 SSOT이지만, 운영 조회는 command entrypoint와 catalog 문서를 먼저 사용한다.

## 검증 매핑

- `qa-sdk quality show <gate-doc-id>` / `qa-sdk quality run <gate-doc-id> --json`
  - 검증: `packages/cli/src/commands/quality.test.ts`
  - fixture execution smoke: `packages/cli/src/commands/quality-smoke.e2e.test.ts`
- `qa-sdk review request ...`
  - 검증: `packages/cli/src/commands/review.test.ts`
- 시나리오 기반 자동화 흐름
  - 검증: `packages/cli/src/scenarios.e2e.test.ts`
- 문서↔명령 매핑 smoke
  - 검증: `packages/cli/src/skills-workflows.test.ts`
- BDD contract read model
  - 검증: `packages/cli/src/commands/docs.test.ts`
- event taxonomy gate
  - 실행: `pnpm gate:event-taxonomy`
  - 전제: registry-service가 `localhost:3300`에서 실행 중이어야 함
