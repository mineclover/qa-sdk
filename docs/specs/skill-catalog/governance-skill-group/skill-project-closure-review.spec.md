---
def:
  tier: component
  id: skill-project-closure-review
  scope: flow
  aspect: process_flow
  depth: specification
  lifecycle: approved
  layer: operation
  tags: [governance, closure, testing]
  links:
    - target: governance-skill-group
      type: refines
sources:
  - skills/project-closure-review/SKILL.md
---

# Skill — project-closure-review

## 탐색 ^navigation

skill-catalog-system > governance-skill-group > **skill-project-closure-review**

## 목적 ^purpose

멀티스텝 작업의 코드, 문서, root/submodule, generated artifact, 검증 결과를 저장소 경계별로 닫고 다음 작업의 남은 결정을 분리한다.

## 사용 맥락 ^context

리뷰 후속 항목을 닫거나, 문서 정리와 커밋을 준비하거나, root와 submodule 변경이 함께 보일 때 사용한다. submodule 내부 커밋과 root pointer 커밋의 순서를 분리하는 것이 핵심이다.

## 경계 ^boundary

실행 순서와 리뷰 출력 형식은 `skills/project-closure-review/SKILL.md`가 소유한다. 이 문서는 해당 skill을 거버넌스 카탈로그에서 찾기 위한 entry만 제공한다.

## 검증 ^validation

```bash
git diff --check
corepack pnpm def:check
corepack pnpm arch:feedback
```
