---
def:
  tier: component
  id: skill-dkg-skill-catalog
  address: def_document:v2:68802
  scope: feature
  aspect: func_def
  depth: specification
  lifecycle: approved
  layer: experience
  tags: [generated]
  links:
    - target: dkg-skill-group
      type: refines
    - target: skill-catalog-system
      type: refines
---


## 탐색 ^navigation

skill-catalog-system > dkg-skill-group > **skill-dkg-skill-catalog**

형제: `skill-dkg-skill-cascade` · `skill-dkg-skill-migrator` · `skill-dkg-skill-version-event` · `skill-dkg-skill-decision`

## 목적 ^purpose

스킬 정의와 실행 표면을 카탈로그로 읽게 해, 어떤 자동화 도구가 존재하고 어디에 연결되는지 추적 가능하게 만드는 스킬이다.

## 사용 맥락 ^context

새 skill을 추가하거나, 기존 skill의 등록 상태와 연결 구조를 점검할 때 사용한다.
experience 계층 문서와 실제 skill 파일의 정합성을 맞출 때도 유용하다.

## 설계 의도 ^intent

skill을 단순 파일 목록이 아니라 카탈로그 항목으로 취급해, 그룹화·추적·피드백 갱신을 가능하게 한다.
이렇게 해야 실제 skill 집합과 문서 카탈로그의 드리프트를 줄일 수 있다.

## 피드백 규칙 ^feedback

- 실제 skill 파일과 카탈로그 문서가 어긋나면 우선적으로 정합성 보수 대상에 올린다.
- 사용률이 낮은 skill은 그룹 구성이나 진입 설명을 다시 쓰는 신호로 본다.

## 주의사항 ^caveat

카탈로그에 등록됐다고 해서 모든 skill이 동일한 품질이나 유지 상태를 보장하지는 않는다.
실제 사용 전에는 SKILL.md와 관련 코드를 함께 봐야 한다.

## 관련 소스

- packages/spec-core/src/dkg/skills/
