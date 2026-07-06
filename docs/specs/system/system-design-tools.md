---
def:
  id: system-design-tools
  tier: layout
  address: def_document:v2:137228
  scope: flow
  aspect: process_flow
  depth: overview
  lifecycle: approved
  layer: mediation
  tags: [structural, entry-point]
  links:
    - target: dkg-system
      type: refs
    - target: dkg-system-root
      type: refs
    - target: df-system
      type: refs
    - target: df-model-group
      type: refs
    - target: df-analysis-group
      type: refs
    - target: df-interface-group
      type: refs
    - target: df-narrative-group
      type: refs
    - target: taxonomy-boundaries
      type: refs
    - target: spec-engine-system
      type: refs
    - target: analysis-system
      type: refs
    - target: definition-catalog-spec
      type: refs
    - target: document-governance-guideline
      type: refs
    - target: prefix-catalog-system
      type: refs
    - target: qa-sdk-engine-system
      type: refs
sources:
  - scripts/package-surfaces.mjs
  - docs/specs/system/system-packages.spec.md
  - docs/specs/system/package-surface-separation.rule.md
  - packages/definition-catalog/package.json
  - packages/decision-flow/package.json
  - packages/spec-core/package.json
  - packages/cli/package.json
---
# 설계 도구 계층

## 목적 ^purpose

Definition governance surface를 찾기 위한 layout 문서다. DKG, Decision Flow, Spec Engine, Analysis, Definition Catalog, CLI/arch tooling은 설계·검증 control plane으로 묶되, taxonomy vocabulary ownership이나 profile contract ownership을 직접 흡수하지 않는다.

## 구성 ^overview

- DKG(설계 그래프) — dkg-system, dkg-system-root
- decision-flow(의사결정) — df-system + 서브그룹 4종 (model/analysis/interface/narrative)
- definition-catalog(문서 관리) — definition-catalog-spec, document-governance-guideline
- taxonomy-boundaries(분류 체계 경계 관리) — taxonomy capability의 소유권은 `taxonomy-engine`, `taxonomy-decision-bridge`, `taxonomy-web` surface로 분리
- spec-engine(설계 규칙)
- analysis(관측)
- prefix-catalog(도메인 prefix 카탈로그)
- qa-sdk-engine-system(추론/실행 엔진)

## 검증 ^validation

```bash
corepack pnpm arch:surfaces
corepack pnpm arch:verify
```
