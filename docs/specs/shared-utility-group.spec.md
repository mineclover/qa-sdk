---
def:
  id: shared-utility-group
  type: spec
  tier: system
  scope: data
  aspect: system_data
  depth: overview
  lifecycle: approved
  layer: domain
  links:
    - target: system-libraries
      type: depends_on
    - target: git-utils
      type: refs
    - target: config-loader-spec
      type: refs
    - target: package-classifier-spec
      type: refs
    - target: platform-context-spec
      type: refs
sources:
  - packages/git-utils/src/index.ts
  - packages/git-utils/src/git.ts
  - packages/config-loader/src/index.ts
  - packages/config-loader/src/catalog-loader.ts
  - packages/context/src/index.ts
  - packages/context/src/qa-context.ts
  - packages/package-classifier/src/index.ts
  - packages/package-classifier/src/pkg-classifier.ts
---
# Shared Utility Group

## 목적 ^purpose

특정 도메인에 종속되지 않는 공통 유틸리티(Git, Config, Classifier, Context 등)들을 포함한다.

## 구성 ^overview

공통 유틸리티 그룹은 제품 도메인 behavior를 직접 소유하지 않고, 여러 system/package가 재사용하는 보조 라이브러리 경계를 묶는다.

- `git-utils`: Git 메타데이터, branch conflict, workspace change 분석.
- `config-loader`: catalog/DKG config 파일 탐지와 JSON/module loading.
- `@qa-sdk/context`: catalog/session/service 정보를 묶는 QA context 제공층.
- `package-classifier`: `packages/*` surface-managed package를 tier/runtime/scope로 분류하는 SSOT.

## 경계 ^boundary

- 이 그룹은 독립 behavior surface가 아니라 shared library routing surface다.
- domain package가 utility package를 소비할 수 있지만, utility package가 domain-specific policy를 소유하지 않는다.
- classifier 규칙, config discovery, Git conflict logic처럼 저장소 구조를 읽는 기능은 각 전용 package spec/source가 책임진다.
