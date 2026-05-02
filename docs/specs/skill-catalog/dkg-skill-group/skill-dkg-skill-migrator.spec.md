---
def:
  tier: component
  id: skill-dkg-skill-migrator
  address: def_document:v2:68804
  scope: feature
  aspect: func_def
  depth: specification
  lifecycle: approved
  layer: experience
  tags: [generated]
  links:
    - target: dkg-skill-group
      type: refines
    - target: skill-dkg-skill-catalog
      type: traces_to
    - target: skill-dkg-skill-version-event
      type: traces_to
    - target: skill-dkg-skill-cascade
      type: traces_to
---


## 탐색 ^navigation

skill-catalog-system > dkg-skill-group > **skill-dkg-skill-migrator**

형제: `skill-dkg-skill-cascade` · `skill-dkg-skill-version-event` · `skill-dkg-skill-decision` · `skill-dkg-skill-catalog`

## 목적 ^purpose

축이나 prefix 변경 시 어떤 마이그레이션 경로가 필요한지 추론해, stride-break와 호환성 문제를 사전에 드러내는 스킬이다.

## 사용 맥락 ^context

capacity 변경, entry 추가, version bump, dim 변경처럼 주소 체계에 영향을 주는 설계를 검토할 때 사용한다.

## 설계 의도 ^intent

변경을 단순 추가라고 오해하지 않고, migrate/diff/version event를 한 묶음으로 보게 한다.
이렇게 해야 주소 보존 여부와 consumer 영향 범위를 같이 판단할 수 있다.

## 피드백 규칙 ^feedback

- 같은 마이그레이션 판단이 반복되면 canonical case를 문서 예제로 승격한다.
- migrator 추론과 실제 구현이 자주 어긋나면 version strategy 설명을 강화한다.

## 주의사항 ^caveat

마이그레이션 추론은 경로 제안이지 실제 데이터 변환 완료를 뜻하지 않는다.
consumer 쪽 배포 준비 없이 version만 늘리면 호환성 문제는 그대로 남는다.

## 관련 소스

- packages/spec-core/src/dkg/skills/
