---
def:
  id: system-infra
  tier: layout
  address: def_document:v2:137230
  scope: flow
  aspect: process_flow
  depth: overview
  lifecycle: approved
  layer: operation
  tags: [structural]
  links:
    - target: ingest-system
      type: refs
    - target: gate-system
      type: refs
    - target: gate-engine-group
      type: refs
    - target: decode-system
      type: refs
    - target: decode-service-system
      type: refs
    - target: query-system
      type: refs
    - target: registry-system
      type: refs
    - target: pipeline-system
      type: refs
    - target: decision-service-spec
      type: refs
    - target: infra-engine-system
      type: refs
    - target: persistence-system-root
      type: refs
    - target: observability-system-root
      type: refs
    - target: system-libraries
      type: depends_on
sources:
  - scripts/package-surfaces.mjs
  - docs/specs/system/system-packages.spec.md
  - docs/specs/system/package-surface-separation.rule.md
  - packages/ingest-server/package.json
  - packages/registry-service/package.json
  - packages/gate-service/package.json
  - packages/query-service/package.json
  - packages/decode-service/package.json
  - packages/infra-engine/package.json
---
# 인프라 서비스 계층

## 목적 ^purpose

이벤트 수집, 주소 유효성, 디코딩, 질의, 레지스트리 등 observability runtime service와 infra governance tooling을 구분해 찾기 위한 layout 문서다.

## 구성 ^overview

Runtime service surface:

- `Observability runtime`: ingest-server(수집), gate-service(유효성), decode-service(디코딩), query-service(질의), registry-service(등록), gateway/store/logger/codec/context 계열.
- `Infra governance tooling`: infra-engine, infra-env-kit, db-bootstrap, db-traffic-control, config-loader, package-classifier, CLI/archi/scaffold 계열.
- `Decision recording`: decision-service는 운영 서비스 형태를 가질 수 있지만 판단/증거 기록 surface로 분리한다.

부속 인프라 도메인: decision-service-spec(결정 서비스 계약), infra-engine-system(인프라 엔진), persistence-system-root(영속성), observability-system-root(관측성).

## 검증 ^validation

```bash
corepack pnpm arch:surfaces
corepack pnpm arch:verify
```
