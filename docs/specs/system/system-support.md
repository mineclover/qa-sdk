---
def:
  id: system-support
  tier: layout
  address: def_document:v2:137235
  scope: flow
  aspect: process_flow
  depth: overview
  lifecycle: approved
  layer: operation
  tags: [structural, entry-point]
  links:
    - target: permission-system
      type: refs
    - target: permission-engine-spec
      type: refs
    - target: apm-system
      type: refs
    - target: event-vocab-system
      type: refs
    - target: guides-system
      type: refs
    - target: skill-catalog-system
      type: refs
    - target: auth-service-spec
      type: refs
    - target: e2e-suite-spec
      type: refs
    - target: facet-tests-spec
      type: refs
    - target: simulation-tests-spec
      type: refs
    - target: validation-layer-group
      type: refs
    - target: config-loader-spec
      type: refs
    - target: package-classifier-spec
      type: refs
    - target: db-traffic-control-spec
      type: refs
    - target: db-bootstrap
      type: refs
    - target: otel-package-spec
      type: refs
    - target: error-handling-convention
      type: refs
    - target: review-ledger-spec
      type: refs
    - target: tag-search
      type: refs
    - target: shared-utility-group
      type: refs
sources:
  - scripts/package-surfaces.mjs
  - docs/specs/system/system-packages.spec.md
  - docs/specs/system/package-surface-separation.rule.md
  - packages/resource-policy-store/package.json
  - packages/audit-recorder-store/package.json
  - packages/demo-tests/package.json
  - packages/e2e/package.json
  - packages/facet-tests/package.json
---
# 지원 계층

## 목적 ^purpose

권한 지원, 이벤트 어휘, 개발자 가이드, 테스트/검증 suite, 공통 유틸리티를 찾기 위한 횡단 navigation 문서다. APM runtime은 `Observability runtime` surface에 속하므로 여기서는 지원 문서 링크만 제공하고 runtime ownership을 가져오지 않는다.

## 구성 ^overview

현재 지원 surface는 다음처럼 나뉜다.

- `Authorization support`: resource-policy-store, audit-recorder-store, permission-system 관련 persistence/감사 보조.
- `Simulation contracts`: sim-* DTO, service catalog, internal network, outbox view, simulation test 계약.
- `Verification suites`: test-types, demo/e2e/facet/scenario test packages.
- `Motion authoring`: motion content/workspace/client/service authoring.
- `Visual analysis tools`: canvas/3D visualization/visual bridge/layout analysis.
- `Governance tooling`: config/db/otel/package-classifier 계열 운영 보조.
- `Guides/skill catalog`: 운영자가 runtime과 definition surface를 사용할 때 참조하는 guide 문서.

테스트 환경: e2e/facet/simulation 스펙 + validation-layer-group(통합).

인프라 보조: auth/config/db-traffic/db-bootstrap/otel/package-classifier/review-ledger/tag-search/error-handling-convention + shared-utility-group(공통 유틸).

## 검증 ^validation

```bash
corepack pnpm arch:surfaces
corepack pnpm arch:verify
```
