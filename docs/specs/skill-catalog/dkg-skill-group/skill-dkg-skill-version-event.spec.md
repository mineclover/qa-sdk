---
def:
  tier: component
  id: skill-dkg-skill-version-event
  address: def_document:v2:68805
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
    - target: skill-dkg-skill-migrator
      type: traces_to
  sources:
    - packages/demo-dkg-config/src/index.ts
    - packages/cli/src/commands/dkg.ts
    - packages/dkg/src/skills/skill-chain.ts
    - packages/dkg/src/skills/skills-suite.test.ts
    - docs/specs/dkg-system/dkg-skills-system/dkg-skill-catalog/dkg-skill-catalog-registry.spec.md

---


## 탐색 ^navigation

skill-catalog-system > dkg-skill-group > **skill-dkg-skill-version-event**

형제: `skill-dkg-skill-cascade` · `skill-dkg-skill-migrator` · `skill-dkg-skill-decision` · `skill-dkg-skill-catalog`

## 목적 ^purpose

변경 diff에서 VersionEvent를 일관되게 생성해, 축과 prefix의 버전 진화를 추적 가능한 이벤트 로그로 남기는 스킬이다.

## 사용 맥락 ^context

축 entry 추가, capacity 변경, version 활성화/폐기처럼 버전 경계를 넘는 변경을 기록할 때 사용한다.

## 설계 의도 ^intent

버전 변경 사실을 free-form 메모가 아니라 구조화 이벤트로 남겨, 후속 diff/impact/migrator가 같은 입력을 재사용하게 한다.

## 피드백 규칙 ^feedback

- VersionEvent 누락이 자주 발생하면 change workflow 상에서 생성 타이밍을 더 앞쪽으로 당긴다.
- 같은 event type이 반복되면 event payload 예시를 더 구체화한다.

## 주의사항 ^caveat

VersionEvent는 변경 기록이지 변경 승인이나 배포 완료 신호가 아니다.
event만 있고 diff 근거가 빈약하면 이후 영향 분석 품질도 떨어진다.

## 관련 소스

- packages/spec-core/src/dkg/skills/
