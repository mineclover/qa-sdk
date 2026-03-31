---
name: automation-workflows
description: "automation skill 묶음 운영 가이드. e2e-test, gform-parser, spec-lifecycle를 어떤 순서로 쓰는지와 언제 어떤 skill을 고를지 안내한다."
---

# Automation Skill Workflows

테스트 작성, 외부 폼 파싱, 구현 후 문서 정리는 서로 다른 문제처럼 보이지만 실제로는 같은 자동화 묶음으로 자주 등장한다.

## 어떤 skill을 고를까

| 상황 | skill | 목적 |
|------|-------|------|
| 시나리오 문서를 브라우저 테스트로 옮겨야 함 | `e2e-test` | Playwright E2E 작성/실행/디버깅 |
| Google Form URL에서 entry ID와 필드 구조를 뽑아야 함 | `gform-parser` | config/HTML 생성 |
| 구현 완료 후 spec 문서를 코드 참조로 정리해야 함 | `spec-lifecycle` | drift 방지 |

## 권장 순서

### 1. 구현 전

- 시나리오 중심 검증이 필요하면 `e2e-test`
- 외부 폼 입력을 붙여야 하면 `gform-parser`

### 2. 구현 중

- 테스트나 config 생성은 코드 변경과 함께 진행
- 문서에는 purpose/intent/constraint 중심 내용만 남기고, 타입/시그니처는 코드로 이동할 준비를 한다

### 3. 구현 완료 후

- `spec-lifecycle`로 문서 전환 조건 확인
- 소스 참조 전환
- 필요하면 `e2e-test`로 최종 사용자 흐름 검증

## 빠른 링크

- command entrypoint
  `qa-sdk quality show <gate-doc-id>`
  `qa-sdk quality run <gate-doc-id> --json`
  `qa-sdk review request ...`
- catalog 문서
  `docs/specs/skill-catalog/automation-skill-group.md`
  `docs/specs/skill-catalog/skill-e2e-test.spec.md`
  `docs/specs/skill-catalog/skill-gform-parser.spec.md`
  `docs/specs/skill-catalog/skill-spec-lifecycle.spec.md`

skill 파일은 구현 SSOT이지만, 운영 조회는 command entrypoint와 catalog 문서를 먼저 사용한다.
