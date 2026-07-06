---
def:
  tier: component
  id: skill-infra-discover
  scope: feature
  aspect: func_def
  depth: specification
  lifecycle: approved
  layer: operation
  tags: [infrastructure, discovery]
  links:
    - target: infra-skill-group
      type: refines
  sources:
    - skills/infra-discover/SKILL.md

---

# Skill — infra-discover

## 탐색 ^navigation

skill-catalog-system > infra-skill-group > **skill-infra-discover**

## 목적 ^purpose

서비스 URL, 연결 정보, 문서, 테스트 상태를 한 번에 조회해 운영 연결점을 찾게 한다.

## 사용 맥락 ^context

배포된 서비스의 endpoint, gateway path, prefix 상세, 관련 문서를 찾을 때 사용한다.

## 피드백 규칙 ^feedback

- discovery 결과가 비어 있으면 registry seed/profile과 infra deployment 등록 단계를 함께 확인한다.

## 관련 소스

- `skills/infra-discover/SKILL.md`

