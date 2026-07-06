---
def:
  id: system-root
  tier: layout
  address: def_document:v2:137234
  scope: flow
  aspect: process_flow
  depth: overview
  lifecycle: approved
  layer: domain
  tags: [structural, cross-scope, entry-point]
  links:
    - target: system-overview
      type: refs
    - target: system-design-tools
      type: refs
    - target: system-frontend
      type: refs
    - target: system-infra
      type: refs
    - target: system-libraries
      type: refs
    - target: system-narrative
      type: refs
    - target: system-packages
      type: refs
    - target: system-taxonomy
      type: refs
    - target: system-profile
      type: refs
    - target: system-support
      type: refs
  sources:
    - scripts/package-surfaces.mjs
    - scripts/report-package-surfaces.mjs
    - scripts/verify-analysis-os.ts
    - docs/specs/system/system-packages.spec.md
    - docs/specs/system/package-surface-separation.rule.md
---

# QA-SDK 시스템

## 목적 ^purpose

이벤트를 좌표로 인코딩하여, 데이터 흐름의 분기점에 명시적 추적성을 부여하는 로깅 SDK + 분석 인프라.

## 구성 ^overview

시스템 개요는 runtime, governance, taxonomy, profile, domain support, consumer verification, quarantine surface를 한 화면에서 찾기 위한 navigation root다. 패키지 소유권의 SSOT는 `system-packages`와 `package-surface-separation-rule`이며, 실제 배정은 `scripts/package-surfaces.mjs`가 소유한다.

- `system-overview`: 시스템을 한 문단씩 빠르게 훑는 교차 개요 문서.
- `system-concepts`: 이벤트, 좌표, 축, Prefix, prefix_ref 기본 개념.
- `system-data-flow`: 이벤트 발생 → 수집 → 저장 → 판정 → 시각화 전체 흐름.
- `system-packages`: package surface manifest를 리뷰 가능한 기능군 표로 요약한다.
- `system-taxonomy`: finite vocabulary tooling, decision bridge, taxonomy preview의 실제 패키지 진입점을 분리해 가리킨다.
- `system-profile`: profile contract, evidence ledger, measurement, profile preview의 실제 패키지 진입점을 분리해 가리킨다.
- `system-infra`: observability runtime service와 infra governance tooling의 운영 경계를 가리킨다.
- `system-libraries`: coordinate kernel과 observability runtime library surface를 가리킨다.
- `system-design-tools`: definition governance surface를 가리키며 taxonomy/profile 소유권을 직접 흡수하지 않는다.
- `system-frontend`: browser/runtime consumer, taxonomy preview, profile preview, product demo surface를 구분한다.
- `system-support`: authorization/domain support, verification suite, guide/skill 등 횡단 지원 surface를 구분한다.

## 검증 ^validation

```bash
corepack pnpm arch:surfaces
corepack pnpm arch:verify
node scripts/design-usefulness-audit.mjs --format json --all
```
