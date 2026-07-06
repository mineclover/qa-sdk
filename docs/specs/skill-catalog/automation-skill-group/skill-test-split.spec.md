---
def:
  tier: component
  id: skill-test-split
  scope: feature
  aspect: func_def
  depth: specification
  lifecycle: approved
  layer: experience
  tags: [testing]
  links:
    - target: automation-skill-group
      type: refines
    - target: skill-bdd-contract
      type: depends_on
sources:
  - skills/test-split/SKILL.md
---

# Skill — test-split

## 탐색 ^navigation

skill-catalog-system > automation-skill-group > **skill-test-split**

## 목적 ^purpose

혼합된 관심사를 가진 테스트 파일을 소스 모듈/시나리오 패싯별로 분리하고 내부 구조를 표준화한다.

## 사용 맥락 ^context

테스트 파일이 너무 커졌거나 BDD contract/test unit과 실제 test file 구조가 어긋날 때 사용한다.

## 피드백 규칙 ^feedback

- 한 테스트 파일이 여러 owner system을 검증하면 split 후보로 본다.
- split 뒤에는 contract id 또는 scenario id가 테스트 제목/문서에 남는지 확인한다.

## 관련 소스

- `skills/test-split/SKILL.md`

