---
def:
  id: dkg-skill-group
  level: module
  tier: system
  address: def_document:v2:68627
  scope: feature
  aspect: func_def
  depth: overview
  lifecycle: approved
  layer: experience
  tags: [structural, entry-point, generated]
  links:
    - target: dkg-skills-system
      type: depends_on
    - target: skill-dkg-skill-cascade
      type: contains
    - target: skill-dkg-skill-migrator
      type: contains
    - target: skill-dkg-skill-version-event
      type: contains
    - target: skill-dkg-skill-decision
      type: contains
    - target: skill-dkg-skill-catalog
      type: contains
---


## 탐색 ^navigation

skill-catalog-system > **dkg-skill-group**

형제: `claude-skill-group` · `automation-skill-group` · `ralph-tui-skill-group` · `cli-command-group`

## 목적 ^purpose

DKG 그래프 위에서 구조 분석·의사결정 기록·자동화 연산을 수행하는 skill 체계. 39개 SkillDef가 4개 카테고리(read/write/analysis/chain)로 분류되며, CLI `dkg skills`/`dkg run`으로 조회·실행한다.

## 구성 ^overview

### 스펙 문서 (experience 계층)

- `skill-dkg-skill-cascade`: 노드 변경 종단 영향 추적
- `skill-dkg-skill-migrator`: 마이그레이션 경로 자동 추론
- `skill-dkg-skill-version-event`: 버전 diff에서 VersionEvent 파생
- `skill-dkg-skill-decision`: 의사결정 템플릿 자동 생성
- `skill-dkg-skill-catalog`: skill 등록/조회/실행 카탈로그

### 현황 요약

| 카테고리 | 정의 | CLI 연결 |
|---------|------|---------|
| read | 5 | 5 |
| write | 5 | 5 |
| analysis | 26 | 26 |
| chain | 3 | 3 |
| **합계** | **39** | **39** |

상세 목록: `docs/specs/dkg-system/dkg-skill-catalog.spec.md`

## 경계 ^boundary

이 문서는 DKG 자동화 skill의 메타 스펙 그룹이다.
- 실제 DKG 연산 구현은 `packages/spec-core/src/dkg/skills`
- CLI 진입점은 `packages/cli/src/commands/dkg.ts`
- 운영 플레이북은 필요 시 `docs/skills/`에 별도 문서로 둔다
- representative workflow 검증은 `docs/skills/system-review.md` ↔ `packages/cli/src/skills-workflows.test.ts`가 담당

따라서 이 그룹 문서는 실행 코드나 운영 가이드가 아니라 DKG skill 관계와 목적을 설명하는 계층이다.
