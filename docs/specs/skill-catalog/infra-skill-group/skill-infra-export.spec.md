---
def:
  tier: component
  id: skill-infra-export
  scope: feature
  aspect: func_def
  depth: specification
  lifecycle: approved
  layer: operation
  tags: [infrastructure, export]
  links:
    - target: infra-skill-group
      type: refines
  sources:
    - skills/infra-export/SKILL.md

---

# Skill — infra-export

## 탐색 ^navigation

skill-catalog-system > infra-skill-group > **skill-infra-export**

## 목적 ^purpose

서비스 연결 정보를 `.env`, TypeScript 모듈, docker-compose override, 문서 요약으로 export한다.

## 사용 맥락 ^context

다른 앱/테스트/운영 스크립트가 배포된 서비스 연결 정보를 재사용해야 할 때 사용한다.

## 피드백 규칙 ^feedback

- export 결과가 오래된 URL을 담으면 `infra-status`와 registry profile을 먼저 확인한다.

## 관련 소스

- `skills/infra-export/SKILL.md`

