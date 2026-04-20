---
def:
  id: work-domain
  type: spec
  level: leaf
  tier: component
  scope: data
  aspect: domain_data
  depth: specification
  lifecycle: approved
  layer: domain
  svc: work-domain
  tags: [classification, quality]
  links:
    - target: work-domain-quality-bundle
      type: traces_to
  source: packages/work-domain/src/index.ts
---

# work-domain — 작업 유형 분류 체계

## 목적 ^purpose

모노레포 작업을 10개 대분류(productivity/infra/observability 등)로 체계화하고 각 도메인에 품질 게이트를 자동 매핑하는 classification 라이브러리. `work-domain:<id>` 태그와 `work-domain-quality-bundle`의 gate 계약이 본 패키지에서 파생된다.
