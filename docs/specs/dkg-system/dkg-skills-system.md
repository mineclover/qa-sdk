---
def:
  id: dkg-skills-system
  tier: system
  address: def_document:v2:68628
  scope: feature
  aspect: func_def
  depth: overview
  lifecycle: approved
  layer: domain
  svc: spec-core
  tags: [structural]
  links:
    - target: dkg-skill-cascade
      type: contains
    - target: dkg-skill-migrator
      type: contains
    - target: dkg-skill-version-event
      type: contains
    - target: dkg-skill-decision
      type: contains
    - target: dkg-skill-catalog
      type: depends_on
sources:
  - packages/demo-dkg-config/src/index.ts
  - packages/dkg/src/bootstrap.ts
  - packages/dkg/src/dkg.types.ts
  - packages/dkg/src/index.ts
  - packages/dkg/src/skills/skill-chain.ts
  - packages/dkg-enrichment/src/skills/converge-chain.ts
  - packages/dkg/src/skills/skills-suite.test.ts
  - packages/cli/src/commands/dkg.ts
---

# DKG Skills 시스템


## 탐색 ^navigation

dkg-system > **dkg-skills-system**

형제: `dkg-node-types` · `dkg-edge-types` · `dkg-queries` · `dkg-constraint` · `dkg-growth-spiral` · `dkg-service-topology` · `dkg-state-store`

## 목적 ^purpose

DKG 그래프 위에서 구조 분석·의사결정 기록·자동화 연산을 수행하는 40개 skill. 4개 카테고리(read/write/analysis/chain)로 분류되며, `bootstrapDkg()`에서 SkillNode로 등록된다.

## 구성 ^overview

### 스펙 문서 (domain 계층)

- `dkg-skill-cascade`: 노드 변경의 종단 영향 추적 (analyzeImpact)
- `dkg-skill-migrator`: 축/prefix 변경 시 마이그레이션 경로 자동 추론 (inferMigrator)
- `dkg-skill-version-event`: 두 버전 간 diff에서 VersionEvent 자동 생성 (versionEventFromDiff)
- `dkg-skill-decision`: 구조화된 의사결정 템플릿 자동 생성 (scaffoldDecision)
- `dkg-skill-catalog`: skill 등록/조회/실행 카탈로그 (SkillNode 타입, specialization)

### 카테고리별 skill 분포

| 카테고리 | 수 | CLI 연결 | 설명 |
|---------|---|---------|------|
| read | 5 | 5/5 | 그래프 탐색·조회 |
| write | 5 | 5/5 | Decision/Observation/Claim 기록, lifecycle 전이 |
| analysis | 27 | 27/27 | 구조 검증·커버리지·헬스체크·도메인별 분석 |
| chain | 3 | 3/3 | 다단계 skill 순차 실행 |

### 구현 계층

```
SkillDef (demo-dkg-config 패키지, 40개 정의)
  ↓ bootstrapDkg() — dkg-enrichment (base+enrich+finalize)
SkillNode (DKG 그래프 노드)
  ↓ dkg 스킬 모듈 + dkg-enrichment 수렴 스킬
skill 함수 구현
  ↓ cli/src/commands/dkg.ts (dkg run switch)
CLI 실행 경로 (40/40 연결)
```
